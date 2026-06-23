// ──────────────────────────────────────────────────────────────────────────
//  SoulLink Companion — local launcher + sync bridge for the ONLINE web app.
//
//  The deployed website (https://…vercel.app) runs in a browser sandbox: it
//  CANNOT start EmuHawk.exe, open a ROM or load a Lua script, and it cannot read
//  local files. This tiny Node process runs on the player's own PC and does that
//  on the website's behalf. It serves the SAME endpoints the Vite dev-server
//  serves in development, so the existing web-app code works unchanged — only the
//  base URL differs (dev → same-origin /api/…, prod → http://127.0.0.1:<port>/api/…).
//
//    node emulator/companion/server.mjs           (or: npm run companion)
//    → http://127.0.0.1:8787/api/companion/health
//                            /api/emulator-detect
//                            /api/emulator-launch
//                            /api/emulator-sync
//
//  Data path stays exactly as before: the BizHawk Lua script writes
//  emulator/bizhawk/soullink_team.json, this server reads it, the (authenticated)
//  browser polls it and reconciles into Supabase. The companion itself never
//  touches Supabase and never needs the run id or any credentials — the open run
//  in your browser is the target. Zero npm dependencies (Node built-ins only).
// ──────────────────────────────────────────────────────────────────────────

import { createServer } from 'node:http'
import { readFileSync, writeFileSync, statSync, existsSync, readdirSync, mkdirSync, renameSync, unlinkSync, copyFileSync, rmSync } from 'node:fs'
import { join, dirname, resolve, extname, sep } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn, exec } from 'node:child_process'
import { initProfiles, listProfiles, createProfile, updateProfile, deleteProfile, duplicateProfile, setActiveProfile } from './profiles.mjs'
import { initRandomizer, randomizerStatus, randomize } from './randomizer.mjs'
import { validateRom } from './roms.mjs'

// Real running version. NEVER hardcoded — the Electron host passes app.getVersion()
// (which CI bumps from the release tag) to startCompanion; CLI falls back to the
// companion-app package.json. null → the website shows "Version nicht erkannt".
let appVersion = null
const PORT = Number(process.env.SOULLINK_COMPANION_PORT || process.env.SYNC_PORT || 8787)

// Repo root = two levels up from this file (…/emulator/companion/server.mjs).
// Override with SOULLINK_ROOT if you run the companion from somewhere else.
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.SOULLINK_ROOT || join(HERE, '..', '..')

// The team file lives in a dedicated LOCAL AppData folder — never Desktop /
// Downloads / a cloud-synced or project folder. That keeps frequent writes away
// from Windows Search indexing, iCloud/OneDrive hooks and most AV real-time
// scanning (one folder the user can exclude in Defender). The Lua is told this
// path via the SOULLINK_TEAM_FILE env var on launch, so both sides always agree.
const APPDATA_DIR = join(process.env.LOCALAPPDATA || process.env.APPDATA || HERE, 'SoulLink Companion')
try { mkdirSync(APPDATA_DIR, { recursive: true }) } catch { /* ignore */ }
const TEAM_FILE = join(APPDATA_DIR, 'soullink_team.json')

// Which team file to read. Env override wins; otherwise the AppData file above.
let currentTeamFile = process.env.SOULLINK_TEAM_FILE || TEAM_FILE

// Set by the Electron host (main.cjs) → opens a NATIVE file dialog and returns the
// absolute path. null in CLI mode (no Electron) → the website falls back to its
// (path-less) browser picker.
let nativePick = null

// ── persistent config (BizHawk/ROM paths the user picked once) ───────────────
// The Companion — not the browser — is the machine-bound part, so it remembers the
// paths. This makes setup survive a browser change / cache reset and is the basis
// for the future standalone app. Per-machine → gitignored.
const CONFIG_FILE = process.env.SOULLINK_COMPANION_CONFIG || join(HERE, 'companion-config.json')
// Profiles live next to the config, in the same per-machine folder.
initProfiles(join(dirname(CONFIG_FILE), 'profiles.json'))
// Randomizer (FVX): bundled in the installer (resources/randomizer), else a
// user-picked path (config.fvxDir), else auto-detected under the usual folders.
initRandomizer({
  bundledDir: join(HERE, '..', 'randomizer'),
  roots: (() => {
    let home = null; try { home = homedir() } catch { /* none */ }
    const r = [ROOT, dirname(ROOT)]
    if (home) r.push(join(home, 'Downloads'), join(home, 'Desktop'), join(home, 'Documents'))
    return r
  })(),
  getConfigDir: () => { try { return loadConfig().fvxDir || null } catch { return null } },
})
function loadConfig() {
  try { const j = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')); return (j && typeof j === 'object') ? j : {} }
  catch { return {} }
}
function saveConfig(patch) {
  const next = { ...loadConfig() }
  for (const [k, v] of Object.entries(patch)) { if (v) next[k] = v }   // never store empty
  try { writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2)) }
  catch (e) { console.error('[config] Speichern fehlgeschlagen:', e?.message || e) }
  return next
}

// Sensible start folder for the native file dialog: last-used path → SoulLink
// subfolder → Desktop → Downloads → home.
function pickDefaultDir(kind) {
  const cfg = loadConfig()
  const last = kind === 'biz' ? cfg.bizhawk : cfg.rom
  if (last) { try { const d = dirname(last); if (existsSync(d)) return d } catch { /* ignore */ } }
  let home = null
  try { home = homedir() } catch { /* none */ }
  if (home) {
    const sub = kind === 'biz' ? 'BizHawk' : 'ROMs'
    for (const d of [join(home, 'Desktop', 'SoulLink', sub), join(home, 'SoulLink', sub), join(home, 'Desktop'), join(home, 'Downloads')]) {
      if (existsSync(d)) return d
    }
  }
  return home || undefined
}

// ── Developer diagnostics: automatic logging (dev machine only) ──────────────
// Active only when SOULLINK_DEV_LOG_DIR is set OR the developer's project folder
// exists → normal users get NOTHING (no env passed to BizHawk → zero overhead).
// We own rotation/archive/pruning so current.log is fresh each launch and the
// Lua just appends. Logs live in the dev project Logs folder (or the env dir).
const DEV_PROJECT = 'C:\\Users\\VShah\\Desktop\\SoulLink Projekt'
function resolveDevLogDir() {
  if (process.env.SOULLINK_DEV_LOG_DIR) return process.env.SOULLINK_DEV_LOG_DIR
  try { if (existsSync(DEV_PROJECT)) return join(DEV_PROJECT, 'Logs') } catch { /* ignore */ }
  return null
}
function setupDevLog() {
  const dir = resolveDevLogDir()
  if (!dir) return null
  try {
    const arch = join(dir, 'Archive')
    mkdirSync(dir, { recursive: true })
    mkdirSync(arch, { recursive: true })
    const cur = join(dir, 'current.log')
    // Archive the previous session (if any), so current.log is always THIS run.
    try { if (statSync(cur).size > 0) {
      const ts = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
      renameSync(cur, join(arch, `session_${ts}.log`))
    } } catch { /* no previous current.log */ }
    // The focused views (performance/sync/errors) mirror THIS run only — the full
    // history lives in the archived current.log — so reset them each launch.
    for (const v of ['performance.log', 'sync.log', 'errors.log']) {
      try { unlinkSync(join(dir, v)) } catch { /* not present */ }
    }
    // Keep only the newest 10 archived sessions (no huge folders).
    try {
      const old = readdirSync(arch).filter((f) => f.endsWith('.log'))
        .map((f) => ({ f, t: statSync(join(arch, f)).mtimeMs })).sort((a, b) => b.t - a.t)
      for (const e of old.slice(10)) { try { unlinkSync(join(arch, e.f)) } catch { /* ignore */ } }
    } catch { /* ignore */ }
    return dir
  } catch (e) {
    console.error('[dev] Log-Setup fehlgeschlagen:', e?.message || e)
    return null
  }
}

// Anonymize personal paths (C:\Users\<name>\… → C:\Users\<USER>\…). Tolerant of
// single OR double backslashes, so it works on raw paths and on JSON-escaped ones.
function anonDevPath(s) {
  return typeof s === 'string'
    ? s.replace(/[Cc]:[\\/]+Users[\\/]+[^\\/"\n]+/g, 'C:\\Users\\<USER>')
    : s
}

// ── Tray-facing developer helpers (called by companion-app/main.cjs) ─────────
// All are inert for normal users: resolveDevLogDir() === null → the tray never
// shows the developer section, so none of these is reachable.
export function getDevLogDir() { return resolveDevLogDir() }

// Wipe every dev log (current + views + archive). Returns true on success.
export function clearDevLogs() {
  const dir = resolveDevLogDir(); if (!dir) return false
  try {
    for (const f of ['current.log', 'performance.log', 'sync.log', 'errors.log']) {
      try { unlinkSync(join(dir, f)) } catch { /* not present */ }
    }
    try { rmSync(join(dir, 'Archive'), { recursive: true, force: true }) } catch { /* ignore */ }
    return true
  } catch { return false }
}

function luaRevFromLog(dir) {
  try { const m = readFileSync(join(dir, 'current.log'), 'utf8').slice(0, 2000).match(/Lua-Rev\s+(\S+)/); return m ? m[1] : '?' }
  catch { return '?' }
}

// Build SoulLink-Diagnose-<ts>.zip in the Logs folder: the 4 logs + a meta.txt
// (versions + anonymized config). NEVER ROMs, savegames or full personal paths —
// the logs are already anonymized by the Lua, and meta.txt is anonymized here.
// Returns a Promise<{ zip } | { error }>. Uses PowerShell Compress-Archive (built
// into Windows → no extra dependency).
export function buildDiagnose() {
  return new Promise((resolve) => {
    const dir = resolveDevLogDir()
    if (!dir) return resolve({ error: 'no_dev_mode' })
    const ts = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
    const stage = join(dir, '_diag_stage')
    try {
      mkdirSync(stage, { recursive: true })
      for (const f of ['current.log', 'performance.log', 'sync.log', 'errors.log']) {
        const src = join(dir, f)
        if (existsSync(src)) { try { copyFileSync(src, join(stage, f)) } catch { /* ignore */ } }
      }
      let cfg = {}
      try { cfg = loadConfig() } catch { /* ignore */ }
      const meta = anonDevPath([
        `SoulLink Diagnose — ${ts}`,
        `Companion-Version: ${appVersion || '?'}`,
        `Lua-Rev: ${luaRevFromLog(dir)}`,
        `OS: ${process.platform} ${process.arch} · Node ${process.version}`,
        '',
        '── Konfiguration (anonymisiert) ──',
        JSON.stringify(cfg, null, 2),
      ].join('\n'))
      writeFileSync(join(stage, 'meta.txt'), meta)
      const zip = join(dir, `SoulLink-Diagnose-${ts}.zip`)
      const ps = `Compress-Archive -Path '${stage.replace(/'/g, "''")}\\*' -DestinationPath '${zip.replace(/'/g, "''")}' -Force`
      exec('powershell -NoProfile -NonInteractive -Command ' + JSON.stringify(ps), (err) => {
        try { rmSync(stage, { recursive: true, force: true }) } catch { /* ignore */ }
        resolve(err ? { error: 'zip_failed' } : { zip })
      })
    } catch (e) {
      try { rmSync(stage, { recursive: true, force: true }) } catch { /* ignore */ }
      resolve({ error: String(e?.message || e) })
    }
  })
}

// The Lua ships WITH the Companion. Candidate locations, in priority order:
// the writable copy the packaged app sets (SOULLINK_LUA), an optional stored
// override, the copy next to the Companion, then the in-repo script. The user
// never picks it — it is always the Companion's own asset.
function luaCandidates(storedLua) {
  return [
    ['SOULLINK_LUA', process.env.SOULLINK_LUA],
    ['stored/sent', storedLua],
    ['HERE/soullink_sync.lua', join(HERE, 'soullink_sync.lua')],
    ['HERE/lua/soullink_sync.lua', join(HERE, 'lua', 'soullink_sync.lua')],
    ['ROOT/emulator/bizhawk/soullink_sync.lua', join(ROOT, 'emulator', 'bizhawk', 'soullink_sync.lua')],
  ]
}
function resolveLua(storedLua) {
  for (const [, p] of luaCandidates(storedLua)) { try { if (p && existsSync(p)) return p } catch { /* skip */ } }
  return null
}
// Human-readable "which candidate exists" string for debug logs / error detail.
function luaDebug(storedLua) {
  return luaCandidates(storedLua).map(([k, p]) => `${k}=${p ? (existsSync(p) ? 'OK' : 'fehlt') : '-'}`).join(' · ')
}

// Effective config = saved paths ∪ auto-detection. `ready` means the website can
// skip the wizard and go straight to "Lua-Sync verbinden".
function effectiveConfig() {
  const stored = loadConfig()
  const detected = detectEmulatorPaths(ROOT)
  const lua = resolveLua(stored.lua)
  const bizhawk = (stored.bizhawk && existsSync(stored.bizhawk)) ? stored.bizhawk : (detected.bizhawk || stored.bizhawk || null)
  let rom = (stored.rom && existsSync(stored.rom)) ? stored.rom : null
  if (!rom && detected.roms.length === 1) rom = detected.roms[0].path   // unambiguous → auto-pick
  const syncFolder = stored.syncFolder || (lua ? dirname(lua) : detected.syncFolder)
  const ready = !!(bizhawk && existsSync(bizhawk) && rom && existsSync(rom) && lua)
  return { config: { bizhawk, rom, lua, syncFolder }, detected, ready }
}

// ── shared helpers (mirrored from vite.config.ts; kept dependency-free) ──────
const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const hex32 = (n) => (n != null ? '0x' + (n >>> 0).toString(16).toUpperCase() : '-')

function isBizhawkRunning() {
  return new Promise((resolve) => {
    try {
      exec('tasklist /FI "IMAGENAME eq EmuHawk.exe" /NH', { windowsHide: true }, (err, stdout) => {
        resolve(!err && /EmuHawk\.exe/i.test(stdout || ''))
      })
    } catch { resolve(false) }
  })
}
function killBizhawk() {
  return new Promise((resolve) => {
    try { exec('taskkill /IM EmuHawk.exe /F', { windowsHide: true }, () => resolve()) } catch { resolve() }
  })
}

// Does the EmuHawk.exe folder look like a COMPLETE BizHawk install? A loose copy
// of just EmuHawk.exe crashes at startup (.NET 0xE0434352) — missing DLLs/gamedb.
function bizhawkFolderInfo(exeDir) {
  let dllCount = 0, hasDllDir = false, hasGamedb = false
  const sample = []
  let readError = null
  try {
    for (const ent of readdirSync(exeDir, { withFileTypes: true })) {
      const n = ent.name.toLowerCase()
      if (sample.length < 20) sample.push(ent.isDirectory() ? ent.name + '/' : ent.name)
      if (ent.isFile() && n.endsWith('.dll')) dllCount++
      if (ent.isDirectory() && n === 'dll') hasDllDir = true
      if (ent.isDirectory() && n === 'gamedb') hasGamedb = true
    }
  } catch (e) { readError = String(e?.message || e) }
  return { complete: dllCount > 0 || hasDllDir || hasGamedb, dllCount, hasDllDir, hasGamedb, sample, readError }
}

// Spawn and OBSERVE for `ms`: capture stdout/stderr/error/exit so a crash is
// visible instead of a silent "launched". alive=true only if still running.
function tryLaunch(exe, args, cwd, ms, env) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '', errEvent = null, exited = false
    let code = null, signal = null
    let child
    try { child = spawn(exe, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: env || process.env }) }
    catch (e) { resolve({ alive: false, code: null, signal: null, stdout: '', stderr: '', errEvent: null, spawnThrew: String(e?.message || e) }); return }
    child.stdout?.on('data', (d) => { if (stdout.length < 4000) stdout += d.toString() })
    child.stderr?.on('data', (d) => { if (stderr.length < 4000) stderr += d.toString() })
    child.on('error', (e) => { errEvent = String(e?.message || e) })
    child.on('exit', (c, s) => { exited = true; code = c; signal = s })
    setTimeout(() => resolve({ alive: !exited, code, signal, stdout, stderr, errEvent, pid: child.pid }), ms)
  })
}

// Bounded filesystem detection so the setup wizard can auto-fill paths the
// browser file picker hides. Scans the repo + parent only.
function detectEmulatorPaths(root) {
  const parent = dirname(root)
  let home = null
  try { home = homedir() } catch { /* none */ }
  const slDirs = home ? [join(home, 'Desktop', 'SoulLink'), join(home, 'SoulLink')] : []

  // ── BizHawk: collect ALL EmuHawk.exe candidates so we can auto-pick when there
  //    is exactly one and let the user choose when there are several. We scan the
  //    common spots a non-technical user would have it: repo/parent, SoulLink
  //    folders, Desktop/Downloads/Documents, and the usual install roots.
  const bizRoots = [root, parent, ...slDirs.map((p) => join(p, 'BizHawk')), ...slDirs]
  if (home) bizRoots.push(join(home, 'Desktop'), join(home, 'Downloads'), join(home, 'Documents'))
  bizRoots.push('C:\\BizHawk', 'C:\\Tools', 'C:\\Program Files', 'C:\\Program Files (x86)')
  const bizSet = new Set(); const bizhawkCandidates = []
  const addBiz = (p) => { try { if (p && existsSync(p) && !bizSet.has(p)) { bizSet.add(p); bizhawkCandidates.push(p) } } catch { /* ignore */ } }
  for (const base of bizRoots) {
    addBiz(join(base, 'EmuHawk.exe'))
    try {
      for (const ent of readdirSync(base, { withFileTypes: true })) {
        if (ent.isDirectory() && /bizhawk|emuhawk/i.test(ent.name)) addBiz(join(base, ent.name, 'EmuHawk.exe'))
      }
    } catch { /* unreadable → skip */ }
    if (bizhawkCandidates.length >= 8) break
  }
  // Prefer a COMPLETE install (has its DLLs); else the first found.
  const bizhawk = bizhawkCandidates.find((p) => bizhawkFolderInfo(dirname(p)).complete) || bizhawkCandidates[0] || null

  const romDirs = [root, join(root, 'roms'), join(root, 'ROMs'), join(root, 'emulator'), parent, join(parent, 'roms'),
    ...slDirs.map((p) => join(p, 'ROMs')), ...slDirs]
  if (home) romDirs.push(join(home, 'Desktop'), join(home, 'Downloads'))
  const roms = []
  const seen = new Set()
  for (const dir of romDirs) {
    try {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (ent.isFile() && /\.(nds|gba|gbc|gb)$/i.test(ent.name)) {
          const p = join(dir, ent.name)
          if (!seen.has(p)) { seen.add(p); roms.push({ name: ent.name, path: p }) }
        }
      }
    } catch { /* skip */ }
    if (roms.length >= 80) break
  }

  // The Lua is the Companion's own bundled asset — resolve it the same way the
  // launch does (never a root-relative guess that fails in the packaged app).
  const luaR = resolveLua(null)
  return { lua: luaR, syncFolder: luaR ? dirname(luaR) : join(root, 'emulator', 'bizhawk'), bizhawk, bizhawkCandidates, roms }
}

// Resolve a file the user picked in the browser dialog (base name only) to an
// absolute path. Bounded BFS over repo/parent/Downloads/Desktop/Documents/Tools.
function findFileByName(root, name) {
  if (!name || /[\\/]/.test(name)) return null
  const skip = new Set(['node_modules', '.git', 'dist', '.vite', 'coverage', 'AppData', '.cache'])
  const roots = [root, dirname(root)]
  try {
    const home = homedir()
    roots.push(join(home, 'Downloads'), join(home, 'Desktop'), join(home, 'Documents'), join(home, 'Tools'))
  } catch { /* no home → repo/parent only */ }
  const seenRoot = new Set()
  const queue = []
  for (const r of roots) { if (!seenRoot.has(r)) { seenRoot.add(r); queue.push({ dir: r, depth: 0 }) } }
  let scanned = 0
  const target = name.toLowerCase()
  const matches = []
  while (queue.length && scanned < 12000) {
    const { dir, depth } = queue.shift()
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const ent of entries) {
      scanned++
      if (ent.isFile() && ent.name.toLowerCase() === target) {
        matches.push(join(dir, ent.name))
        if (matches.length >= 30) { queue.length = 0; break }
      }
      if (ent.isDirectory() && depth < 3 && !skip.has(ent.name) && !ent.name.startsWith('.')) {
        queue.push({ dir: join(dir, ent.name), depth: depth + 1 })
      }
    }
  }
  if (matches.length === 0) return null
  if (target === 'emuhawk.exe' && matches.length > 1) {
    const complete = matches.find((m) => bizhawkFolderInfo(dirname(m)).complete)
    if (complete) return complete
  }
  return matches[0]
}

// ── liveness: is BizHawk running? (cached, throttled) ────────────────────────
// Freshness must NOT depend on how often the Lua writes the file — the Lua now
// only writes on real change, so an idle game would otherwise look "stale". While
// EmuHawk is alive and we have a team, we report the data as fresh; the staleness
// (file mtime) only matters once BizHawk is gone.
let bizhawkAlive = false
let lastAliveCheck = 0
function refreshBizhawkAlive() {
  const now = Date.now()
  if (now - lastAliveCheck < 3000) return            // throttle the tasklist spawn
  lastAliveCheck = now
  isBizhawkRunning().then((v) => { bizhawkAlive = v }).catch(() => {})
}

// ── sync file reading (newer of file vs. last POST) ──────────────────────────
let lastPost = null
let fileCache = null
function readTeamFile() {
  try {
    const at = statSync(currentTeamFile).mtimeMs
    if (fileCache && fileCache.at === at && fileCache.file === currentTeamFile) return fileCache
    const data = JSON.parse(readFileSync(currentTeamFile, 'utf8'))
    fileCache = { data, at, file: currentTeamFile }
    return fileCache
  } catch {
    return fileCache && fileCache.file === currentTeamFile ? fileCache : null
  }
}

// ── CORS + Private Network Access ────────────────────────────────────────────
// A public HTTPS origin (Vercel) calling http://127.0.0.1 is a "private network"
// request: Chrome/Edge send a preflight with Access-Control-Request-Private-Network
// and require Access-Control-Allow-Private-Network: true on the response. Echo the
// Origin (PNA is unreliable with the "*" wildcard).
function setCors(req, res) {
  const origin = req.headers.origin
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Access-Control-Max-Age', '86400')
}
const sendJson = (res, obj, status = 200) => {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(obj))
}

// ── static web app (same-origin) ─────────────────────────────────────────────
// The Companion serves the BUILT React app at `/`, so the native window can load
// http://127.0.0.1:<port>/ — same origin as /api, which removes the cross-origin
// HTTPS→localhost problem entirely (no CORS/PNA, WebBridge just works). Bundled to
// resources/web in the installer; in dev it's the repo's dist/. Vercel still hosts
// the public landing/spectator site from the same source.
const WEB_ROOT = (() => {
  const cands = [process.env.SOULLINK_WEB_ROOT, join(HERE, '..', 'web'), join(ROOT, 'dist')]
  for (const c of cands) { try { if (c && existsSync(join(c, 'index.html'))) return resolve(c) } catch { /* ignore */ } }
  return null
})()
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
}
function serveStatic(req, res, pathname) {
  if (!WEB_ROOT) { res.statusCode = 404; res.end('Web build not bundled'); return }
  let rel = '/index.html'
  try { rel = decodeURIComponent(pathname) || '/' } catch { /* malformed → index */ }
  if (rel === '/' || rel === '') rel = '/index.html'
  const filePath = resolve(WEB_ROOT, '.' + rel)
  // Path-traversal guard: the resolved file must stay inside WEB_ROOT.
  if (filePath !== WEB_ROOT && !filePath.startsWith(WEB_ROOT + sep)) { res.statusCode = 403; res.end(); return }
  try {
    if (statSync(filePath).isFile()) {
      res.statusCode = 200
      res.setHeader('content-type', MIME[extname(filePath).toLowerCase()] || 'application/octet-stream')
      // Hashed Vite assets are immutable; index.html must always re-check.
      res.setHeader('cache-control', /[\\/]index\.html$/.test(filePath) ? 'no-cache' : 'public, max-age=31536000, immutable')
      res.end(readFileSync(filePath))
      return
    }
  } catch { /* not found → SPA fallback */ }
  // History fallback: an unknown route without a file extension (e.g. /setup,
  // /profiles) → index.html so client-side routing (BrowserRouter) takes over.
  if (!extname(rel)) {
    try {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.setHeader('cache-control', 'no-cache')
      res.end(readFileSync(join(WEB_ROOT, 'index.html')))
      return
    } catch { /* ignore */ }
  }
  res.statusCode = 404
  res.end()
}

function handleRequest(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }

  const url = new URL(req.url || '/', 'http://localhost')
  const path = url.pathname

  // ── health: the website pings this to know the companion is running ─────────
  if (path === '/api/companion/health') {
    let ready = false
    try { ready = effectiveConfig().ready } catch { /* detection error → not ready */ }
    sendJson(res, { ok: true, name: 'soullink-companion', version: appVersion, port: PORT, ready })
    return
  }

  // ── config: GET effective (saved ∪ detected) paths; POST saves picked paths ──
  if (path === '/api/companion/config') {
    if (req.method === 'GET') {
      try { sendJson(res, { ok: true, ...effectiveConfig() }) }
      catch { sendJson(res, { ok: false }, 500) }
      return
    }
    if (req.method === 'POST') {
      let body = ''
      req.on('data', (c) => { body += c; if (body.length > 100_000) req.destroy() })
      req.on('end', () => {
        const clean = (p) => String(p ?? '').trim().replace(/^"+|"+$/g, '').trim()
        let cfg = {}
        try { cfg = JSON.parse(body || '{}') } catch { /* invalid */ }
        const patch = {}
        if (cfg.bizhawk != null) patch.bizhawk = clean(cfg.bizhawk)
        if (cfg.rom != null) patch.rom = clean(cfg.rom)
        if (cfg.lua != null) patch.lua = clean(cfg.lua)
        if (cfg.syncFolder != null) patch.syncFolder = clean(cfg.syncFolder)
        saveConfig(patch)
        console.log('[config] gespeichert:', Object.keys(patch).filter((k) => patch[k]).join(', ') || '(leer)')
        try { sendJson(res, { ok: true, ...effectiveConfig() }) }
        catch { sendJson(res, { ok: true }) }
      })
      return
    }
    sendJson(res, { ok: false }, 405)
    return
  }

  // ── profiles: local per-machine game profiles (Valon + Leon, …) ─────────────
  // GET list · POST create · PATCH ?id= update · DELETE ?id= remove
  if (path === '/api/profiles') {
    if (req.method === 'GET') {
      try { sendJson(res, { ok: true, ...listProfiles() }) } catch { sendJson(res, { ok: false }, 500) }
      return
    }
    if (req.method === 'POST' || req.method === 'PATCH') {
      let body = ''
      req.on('data', (c) => { body += c; if (body.length > 200_000) req.destroy() })
      req.on('end', () => {
        let data = {}
        try { data = JSON.parse(body || '{}') } catch { /* invalid → empty */ }
        try {
          if (req.method === 'POST') {
            const p = createProfile(data)
            console.log('[profiles] erstellt:', p.name)
            sendJson(res, { ok: true, profile: p })
          } else {
            const p = updateProfile(url.searchParams.get('id'), data)
            sendJson(res, p ? { ok: true, profile: p } : { ok: false, error: 'not_found' }, p ? 200 : 404)
          }
        } catch (e) { sendJson(res, { ok: false, error: String(e?.message || e) }, 500) }
      })
      return
    }
    if (req.method === 'DELETE') {
      try { sendJson(res, { ok: deleteProfile(url.searchParams.get('id')) }) } catch { sendJson(res, { ok: false }, 500) }
      return
    }
    sendJson(res, { ok: false }, 405)
    return
  }
  // profile actions: POST ?id= → duplicate / set-active
  if (path === '/api/profiles/duplicate' && req.method === 'POST') {
    try { const p = duplicateProfile(url.searchParams.get('id')); sendJson(res, p ? { ok: true, profile: p } : { ok: false, error: 'not_found' }, p ? 200 : 404) }
    catch { sendJson(res, { ok: false }, 500) }
    return
  }
  if (path === '/api/profiles/active' && req.method === 'POST') {
    try { sendJson(res, { ok: setActiveProfile(url.searchParams.get('id')) }) }
    catch { sendJson(res, { ok: false }, 500) }
    return
  }

  // ── rom: validate a picked file (.nds header → edition/region/revision) ─────
  if (path === '/api/rom/validate') {
    try { sendJson(res, { ok: true, ...validateRom(url.searchParams.get('path')) }) }
    catch { sendJson(res, { ok: false }, 500) }
    return
  }

  // ── randomizer (FVX): status + run ──────────────────────────────────────────
  if (path === '/api/randomizer/detect') {
    try { sendJson(res, { ok: true, ...randomizerStatus() }) } catch { sendJson(res, { ok: false }, 500) }
    return
  }
  if (path === '/api/randomize') {
    if (req.method !== 'POST') { sendJson(res, { ok: false }, 405); return }
    let body = ''
    req.on('data', (c) => { body += c; if (body.length > 1_000_000) req.destroy() })
    req.on('end', async () => {
      let p = {}
      try { p = JSON.parse(body || '{}') } catch { /* invalid → empty */ }
      const clean = (s) => (s == null ? null : String(s).trim().replace(/^"+|"+$/g, '').trim() || null)
      console.log('[randomize] start:', clean(p.inputRom), '→', clean(p.outputRom), '· seed:', p.seed)
      const r = await randomize({
        inputRom: clean(p.inputRom),
        outputRom: clean(p.outputRom),
        settingsFile: clean(p.settingsFile),
        settingsString: p.settingsString ? String(p.settingsString) : null,
        seed: p.seed,
      })
      console.log('[randomize] result:', r.ok ? 'OK → ' + r.outputRom : 'FEHLER ' + r.error)
      sendJson(res, r, r.ok ? 200 : 500)
    })
    return
  }

  // ── detect: GET /api/emulator-detect[?find=NAME] ────────────────────────────
  if (path === '/api/emulator-detect') {
    try {
      const find = url.searchParams.get('find')
      if (find) { sendJson(res, { ok: true, path: findFileByName(ROOT, find) }); return }
      sendJson(res, { ok: true, ...detectEmulatorPaths(ROOT) })
    } catch { sendJson(res, { ok: false }, 500) }
    return
  }

  // ── pick: native file dialog via the Electron host → returns an ABSOLUTE path ─
  // Fixes the browser picker, which can never reveal the real filesystem path.
  if (path === '/api/companion/pick') {
    if (typeof nativePick !== 'function') { sendJson(res, { ok: false, error: 'no_dialog' }); return }
    const kind = url.searchParams.get('kind') === 'biz' ? 'biz' : 'rom'
    Promise.resolve(nativePick({ kind, defaultPath: pickDefaultDir(kind) }))
      .then((picked) => {
        if (!picked) { sendJson(res, { ok: false, error: 'cancelled' }); return }
        saveConfig(kind === 'biz' ? { bizhawk: picked } : { rom: picked })   // persist → auto-loads next time
        console.log('[pick] %s = %s', kind, picked)
        sendJson(res, { ok: true, path: picked })
      })
      .catch((e) => sendJson(res, { ok: false, error: String(e?.message || e) }))
    return
  }

  // ── launch: POST { bizhawk, rom, lua, restart } ─────────────────────────────
  if (path === '/api/emulator-launch') {
    if (req.method !== 'POST') { sendJson(res, { ok: false }, 405); return }
    let body = ''
    req.on('data', (c) => { body += c; if (body.length > 100_000) req.destroy() })
    req.on('end', async () => {
      const clean = (p) => String(p ?? '').trim().replace(/^"+|"+$/g, '').trim()
      let cfg = {}
      try { cfg = JSON.parse(body || '{}') } catch { /* invalid */ }
      // BizHawk/ROM are the user's own files → fall back to the saved config when
      // the website omits them. The Lua, however, is the Companion's OWN bundled
      // asset: ALWAYS use the Companion's resolved Lua and ignore whatever the
      // website sends — a stale or relative luaPath from the browser must never be
      // able to break the launch.
      const eff = effectiveConfig()
      const bizhawk = clean(cfg.bizhawk) || eff.config.bizhawk || ''
      const rom = clean(cfg.rom) || eff.config.rom || ''
      const lua = eff.config.lua || clean(cfg.lua) || ''
      const restart = !!cfg.restart

      console.log('\n[launch] ── Request ─────────────────────────────')
      console.log('[launch] restart:', restart, '· EmuHawk:', bizhawk || '(leer)')
      console.log('[launch] ROM :', rom || '(leer)', '· existiert:', rom ? existsSync(rom) : false)
      console.log('[launch] Lua : gesendet=%s · verwendet=%s · existiert=%s', clean(cfg.lua) || '(leer)', lua || '(leer)', lua ? existsSync(lua) : false)
      console.log('[launch] Lua-Kandidaten:', luaDebug(clean(cfg.lua)))

      if (!bizhawk || !existsSync(bizhawk)) { console.error('[launch] BizHawk fehlt:', bizhawk); sendJson(res, { ok: false, error: 'bizhawk_not_found' }); return }
      if (!rom || !existsSync(rom)) { console.error('[launch] ROM fehlt:', rom); sendJson(res, { ok: false, error: 'rom_not_found' }); return }
      if (!lua || !existsSync(lua)) {
        const dbg = luaDebug(clean(cfg.lua))
        console.error('[launch] Lua fehlt — kein Kandidat existiert:', dbg)
        sendJson(res, { ok: false, error: 'lua_not_found', detail: 'Sync-Script nirgends gefunden. Geprüft: ' + dbg })
        return
      }

      // Paths are valid → remember them for next time (any browser, no wizard).
      saveConfig({ bizhawk, rom, syncFolder: dirname(lua) })

      // The Lua writes to the AppData team file (passed via env below) → read it.
      currentTeamFile = TEAM_FILE
      console.log('[launch] Team-Datei:', TEAM_FILE)
      console.log('[launch] Tipp: Falls BizHawk ruckelt, diesen Ordner in Windows Defender ausschliessen:', APPDATA_DIR)

      const running = await isBizhawkRunning()
      if (running && !restart) { console.log('[launch] bereits offen, kein Neustart.'); sendJson(res, { ok: true, already: true, lua: true }); return }
      if (running && restart) { console.log('[launch] schliesse laufendes EmuHawk …'); await killBizhawk(); await delay(1200) }

      const cwd = dirname(bizhawk)
      const folder = bizhawkFolderInfo(cwd)
      if (!folder.complete) console.log('[launch] ⚠ Ordner ohne BizHawk-DLLs — evtl. falsche/lose EmuHawk.exe.')

      // Tell the Lua where to write (AppData) so both sides always agree.
      const launchEnv = { ...process.env, SOULLINK_TEAM_FILE: TEAM_FILE }
      // Developer diagnostics (dev machine only): point the Lua at the rotated log.
      const devDir = setupDevLog()
      if (devDir) {
        launchEnv.SOULLINK_DEVLOG = devDir
        launchEnv.SOULLINK_VERSION = appVersion || ''
        console.log('[dev] Diagnose-Log →', join(devDir, 'current.log'))
      }
      const variants = [
        { label: 'rom --lua', args: [rom, '--lua=' + lua] },
        { label: '--lua rom', args: ['--lua=' + lua, rom] },
      ]
      let last = null
      for (const v of variants) {
        const r = await tryLaunch(bizhawk, v.args, cwd, 2500, launchEnv)
        last = r
        console.log(`[launch] "${v.label}" alive=${r.alive} exit=${r.code} (${hex32(r.code)}) pid=${r.pid ?? '-'}`)
        if (r.alive) { bizhawkAlive = true; lastAliveCheck = Date.now(); sendJson(res, { ok: true, launched: true, lua: true, restarted: running && restart, variant: v.label }); return }
      }

      const code = last?.code ?? null
      let hint = ''
      if (hex32(code) === '0xE0434352') hint += ' .NET-Ausnahme beim Start (0xE0434352) – meist unvollständiger BizHawk-Ordner oder fehlende .NET-Runtime.'
      if (!folder.complete) hint += ' Der gewählte Ordner enthält keine BizHawk-DLLs – bitte EmuHawk.exe aus dem VOLLSTÄNDIGEN Ordner wählen.'
      console.error('[launch] ❌ Alle Varianten fehlgeschlagen.')
      sendJson(res, { ok: false, error: 'launch_exited', detail: `Exit ${code} (${hex32(code)}).${hint}`.trim() })
    })
    return
  }

  // ── sync: GET returns latest team, POST stores a payload (parity w/ dev) ─────
  if (path === '/api/emulator-sync') {
    if (req.method === 'POST') {
      let body = ''
      req.on('data', (c) => { body += c; if (body.length > 1_000_000) req.destroy() })
      req.on('end', () => {
        try { lastPost = { data: JSON.parse(body || '{}'), at: Date.now() }; sendJson(res, { ok: true }) }
        catch { sendJson(res, { ok: false, error: 'invalid json' }, 400) }
      })
      return
    }
    if (req.method === 'GET') {
      const fileEntry = readTeamFile()
      let last = lastPost
      if (fileEntry && (!last || fileEntry.at > last.at)) last = { data: fileEntry.data, at: fileEntry.at }
      // Keep "connected" alive while EmuHawk runs, regardless of write frequency.
      refreshBizhawkAlive()
      if (last && bizhawkAlive) last = { data: last.data, at: Date.now() }
      sendJson(res, { ok: true, last })
      return
    }
    sendJson(res, { ok: false }, 405)
    return
  }

  // Not an API route → serve the bundled React app (same-origin) so the Companion
  // window can load http://127.0.0.1:<port>/ . API paths keep returning JSON 404s.
  if (req.method === 'GET' && !path.startsWith('/api/')) { serveStatic(req, res, path); return }

  res.statusCode = 404
  res.end()
}

// Start the companion HTTP server. Shared by the CLI (`npm run companion`) and
// the Electron tray app — one implementation, no drift. Resolves with the server
// once it is listening; rejects on bind error (e.g. EADDRINUSE) so the caller
// decides what to do (CLI exits; the tray app shows "läuft bereits").
export function startCompanion({ port = PORT, quiet = false, pickFile = null, version = null, log = null } = {}) {
  const step = (m) => { try { if (typeof log === 'function') log(m) } catch { /* ignore */ } }
  nativePick = typeof pickFile === 'function' ? pickFile : null
  // Real version: from the Electron host (app.getVersion()), else the companion-app
  // package.json (CLI/dev). Never a hardcoded constant.
  if (version) appVersion = String(version)
  else if (!appVersion) {
    try { appVersion = JSON.parse(readFileSync(join(ROOT, 'companion-app', 'package.json'), 'utf8')).version || null } catch { /* unknown */ }
  }
  step(`✓ Version geladen: ${appVersion || '?'}`)
  step(`✓ Config-Pfad: ${CONFIG_FILE}`)
  step(`✓ Profile-Store initialisiert: ${join(dirname(CONFIG_FILE), 'profiles.json')}`)
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest)
    const onBindError = (e) => { step(`✗ HTTP-Bind fehlgeschlagen: ${e && e.code ? e.code : e}`); reject(e) }
    server.once('error', onBindError)
    // Bind to 127.0.0.1 only — never expose the launcher on the network.
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onBindError)
      server.on('error', (e) => console.error('[server]', e?.message || e))
      step(`✓ HTTP-Server lauscht auf 127.0.0.1:${port}`)
      if (!quiet) {
        console.log('╔══════════════════════════════════════════════════════════╗')
        console.log('║  SoulLink Companion läuft                                  ║')
        console.log('╚══════════════════════════════════════════════════════════╝')
        console.log(`  Health : http://127.0.0.1:${port}/api/companion/health`)
        console.log(`  Team   : ${currentTeamFile}`)
        try {
          const eff = effectiveConfig()
          console.log(`  Lua    : ${eff.config.lua || '(nicht gefunden)'}`)
          console.log(`  Lua-Check: ${luaDebug(null)}`)
          console.log(`  Setup  : ${eff.ready ? 'fertig – Website kann direkt verbinden' : 'erster Start → Website öffnet den Setup-Assistenten'}`)
        } catch { /* detection error → ignore */ }
        console.log('  → Auf der Website auf „Lua-Sync verbinden" klicken.')
      }
      resolve(server)
    })
  })
}

// Run directly (`node server.mjs` / `npm run companion`) → start + handle errors.
const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (invokedDirectly) {
  startCompanion().catch((e) => {
    if (e?.code === 'EADDRINUSE') {
      console.error(`\n[FEHLER] Port ${PORT} ist belegt. Läuft der Companion schon? Sonst SOULLINK_COMPANION_PORT setzen.`)
    } else {
      console.error('[FEHLER]', e?.message || e)
    }
    process.exit(1)
  })
}
