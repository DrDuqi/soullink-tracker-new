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
import { readFileSync, writeFileSync, statSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn, exec } from 'node:child_process'

const VERSION = '1.0.0'
const PORT = Number(process.env.SOULLINK_COMPANION_PORT || process.env.SYNC_PORT || 8787)

// Repo root = two levels up from this file (…/emulator/companion/server.mjs).
// Override with SOULLINK_ROOT if you run the companion from somewhere else.
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.SOULLINK_ROOT || join(HERE, '..', '..')

// Which team file to read. Defaults to the Lua's output next to the script; once
// a launch happens we point it at dirname(lua)/soullink_team.json (robust even if
// the user keeps the .lua elsewhere). Env override still wins.
let currentTeamFile = process.env.SOULLINK_TEAM_FILE
  || join(ROOT, 'emulator', 'bizhawk', 'soullink_team.json')

// ── persistent config (BizHawk/ROM paths the user picked once) ───────────────
// The Companion — not the browser — is the machine-bound part, so it remembers the
// paths. This makes setup survive a browser change / cache reset and is the basis
// for the future standalone app. Per-machine → gitignored.
const CONFIG_FILE = process.env.SOULLINK_COMPANION_CONFIG || join(HERE, 'companion-config.json')
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

// The Lua ships WITH the Companion: prefer a copy next to it (what the future
// standalone .exe bundles), then the in-repo script. The user never picks it.
function resolveLua(storedLua) {
  const candidates = [
    process.env.SOULLINK_LUA,   // packaged app points this at a writable copy
    storedLua,
    join(HERE, 'soullink_sync.lua'),
    join(HERE, 'lua', 'soullink_sync.lua'),
    join(ROOT, 'emulator', 'bizhawk', 'soullink_sync.lua'),
  ]
  for (const c of candidates) { try { if (c && existsSync(c)) return c } catch { /* skip */ } }
  return null
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
function tryLaunch(exe, args, cwd, ms) {
  return new Promise((resolve) => {
    let stdout = '', stderr = '', errEvent = null, exited = false
    let code = null, signal = null
    let child
    try { child = spawn(exe, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }) }
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
  const lua = join(root, 'emulator', 'bizhawk', 'soullink_sync.lua')
  const parent = dirname(root)

  let bizhawk = null
  for (const base of [root, parent]) {
    const direct = join(base, 'EmuHawk.exe')
    if (existsSync(direct)) { bizhawk = direct; break }
    try {
      for (const ent of readdirSync(base, { withFileTypes: true })) {
        if (ent.isDirectory() && /bizhawk|emuhawk/i.test(ent.name)) {
          const cand = join(base, ent.name, 'EmuHawk.exe')
          if (existsSync(cand)) { bizhawk = cand; break }
        }
      }
    } catch { /* unreadable dir → skip */ }
    if (bizhawk) break
  }

  const romDirs = [root, join(root, 'roms'), join(root, 'ROMs'), join(root, 'emulator'), parent, join(parent, 'roms')]
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
    if (roms.length >= 60) break
  }

  return { lua: existsSync(lua) ? lua : null, syncFolder: join(root, 'emulator', 'bizhawk'), bizhawk, roms }
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

function handleRequest(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }

  const url = new URL(req.url || '/', 'http://localhost')
  const path = url.pathname

  // ── health: the website pings this to know the companion is running ─────────
  if (path === '/api/companion/health') {
    let ready = false
    try { ready = effectiveConfig().ready } catch { /* detection error → not ready */ }
    sendJson(res, { ok: true, name: 'soullink-companion', version: VERSION, port: PORT, ready })
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

  // ── detect: GET /api/emulator-detect[?find=NAME] ────────────────────────────
  if (path === '/api/emulator-detect') {
    try {
      const find = url.searchParams.get('find')
      if (find) { sendJson(res, { ok: true, path: findFileByName(ROOT, find) }); return }
      sendJson(res, { ok: true, ...detectEmulatorPaths(ROOT) })
    } catch { sendJson(res, { ok: false }, 500) }
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
      // Fall back to the Companion's saved config when the website omits paths, and
      // always auto-resolve the bundled Lua so the user never has to provide it.
      const eff = effectiveConfig()
      const bizhawk = clean(cfg.bizhawk) || eff.config.bizhawk || ''
      const rom = clean(cfg.rom) || eff.config.rom || ''
      const lua = clean(cfg.lua) || eff.config.lua || ''
      const restart = !!cfg.restart

      console.log('\n[launch] ── Request ─────────────────────────────')
      console.log('[launch] restart:', restart, '· EmuHawk:', bizhawk || '(leer)')
      console.log('[launch] ROM:', rom || '(leer)', '· Lua:', lua || '(leer)')

      if (!bizhawk || !existsSync(bizhawk)) { console.error('[launch] BizHawk fehlt:', bizhawk); sendJson(res, { ok: false, error: 'bizhawk_not_found' }); return }
      if (!rom || !existsSync(rom)) { console.error('[launch] ROM fehlt:', rom); sendJson(res, { ok: false, error: 'rom_not_found' }); return }
      if (!lua || !existsSync(lua)) { console.error('[launch] Lua fehlt:', lua); sendJson(res, { ok: false, error: 'lua_not_found' }); return }

      // Paths are valid → remember them for next time (any browser, no wizard).
      saveConfig({ bizhawk, rom, syncFolder: dirname(lua) })

      // Read this Lua's team output from now on (robust if it lives elsewhere).
      currentTeamFile = join(dirname(lua), 'soullink_team.json')

      const running = await isBizhawkRunning()
      if (running && !restart) { console.log('[launch] bereits offen, kein Neustart.'); sendJson(res, { ok: true, already: true, lua: true }); return }
      if (running && restart) { console.log('[launch] schliesse laufendes EmuHawk …'); await killBizhawk(); await delay(1200) }

      const cwd = dirname(bizhawk)
      const folder = bizhawkFolderInfo(cwd)
      if (!folder.complete) console.log('[launch] ⚠ Ordner ohne BizHawk-DLLs — evtl. falsche/lose EmuHawk.exe.')

      const variants = [
        { label: 'rom --lua', args: [rom, '--lua=' + lua] },
        { label: '--lua rom', args: ['--lua=' + lua, rom] },
      ]
      let last = null
      for (const v of variants) {
        const r = await tryLaunch(bizhawk, v.args, cwd, 2500)
        last = r
        console.log(`[launch] "${v.label}" alive=${r.alive} exit=${r.code} (${hex32(r.code)}) pid=${r.pid ?? '-'}`)
        if (r.alive) { sendJson(res, { ok: true, launched: true, lua: true, restarted: running && restart, variant: v.label }); return }
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
      sendJson(res, { ok: true, last })
      return
    }
    sendJson(res, { ok: false }, 405)
    return
  }

  res.statusCode = 404
  res.end()
}

// Start the companion HTTP server. Shared by the CLI (`npm run companion`) and
// the Electron tray app — one implementation, no drift. Resolves with the server
// once it is listening; rejects on bind error (e.g. EADDRINUSE) so the caller
// decides what to do (CLI exits; the tray app shows "läuft bereits").
export function startCompanion({ port = PORT, quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest)
    server.once('error', reject)
    // Bind to 127.0.0.1 only — never expose the launcher on the network.
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      server.on('error', (e) => console.error('[server]', e?.message || e))
      if (!quiet) {
        console.log('╔══════════════════════════════════════════════════════════╗')
        console.log('║  SoulLink Companion läuft                                  ║')
        console.log('╚══════════════════════════════════════════════════════════╝')
        console.log(`  Health : http://127.0.0.1:${port}/api/companion/health`)
        console.log(`  Team   : ${currentTeamFile}`)
        try {
          const eff = effectiveConfig()
          console.log(`  Lua    : ${eff.config.lua || '(nicht gefunden)'}`)
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
