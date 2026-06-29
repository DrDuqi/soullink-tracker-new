// SoulLink randomizer service — drives the Universal Pokémon Randomizer FVX via
// its CLI. Verified against FVX 1.5.3 on Windows; the official Windows bundle ships
// its OWN JRE (java/bin/java.exe), so "bundle FVX" also covers Java — no separate
// runtime needed.
//
//   <fvx>/java/bin/java.exe -Xmx4608M -jar <fvx>/UPR-FVX.jar cli
//        -i <source.nds> -o <output.nds> { -s <preset.rnqs> | -S <settingsString> }
//        [-z <seed>] [-l]
//
// PROVEN: same ROM + same settings + same -z seed → byte-identical output. That is
// what makes a multiplayer SoulLink reproducible (every player randomizes their own
// original ROM with the shared settings+seed and gets the exact same world).

import { existsSync, readdirSync, createWriteStream, mkdirSync, rmSync } from 'node:fs'
import { join, basename } from 'node:path'
import { spawn, exec } from 'node:child_process'
import { get as httpsGet } from 'node:https'
import { tmpdir } from 'node:os'

let BUNDLED = null      // resources/randomizer in the packaged app
let ROOTS = []          // folders to scan for a user-installed FVX
let GET_CFG = null      // () => stored fvx dir (user override), or null

export function initRandomizer({ bundledDir = null, roots = [], getConfigDir = null } = {}) {
  BUNDLED = bundledDir
  ROOTS = roots.filter(Boolean)
  GET_CFG = typeof getConfigDir === 'function' ? getConfigDir : null
}

// A valid FVX folder has BOTH the jar and the bundled Java next to each other.
function fvxFromDir(dir) {
  if (!dir) return null
  const jar = join(dir, 'UPR-FVX.jar')
  const java = join(dir, 'java', 'bin', 'java.exe')
  try { if (existsSync(jar) && existsSync(java)) return { dir, jar, java } } catch { /* ignore */ }
  return null
}

function detectFvx() {
  for (const root of ROOTS) {
    const direct = fvxFromDir(root)
    if (direct) return direct
    let entries = []
    try { entries = readdirSync(root, { withFileTypes: true }) } catch { continue }
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
    // Prefer folders that look like an FVX release (e.g. UPR_FVX-v1_5_3-Windows).
    dirs.sort((a, b) => (/(upr|fvx|randomiz)/i.test(b) ? 1 : 0) - (/(upr|fvx|randomiz)/i.test(a) ? 1 : 0))
    for (const name of dirs) {
      const f = fvxFromDir(join(root, name))
      if (f) return f
    }
  }
  return null
}

// Resolution order: explicit env → user-picked config → bundled (controlled
// version) → auto-detected install. Returns { dir, jar, java, source } or null.
function resolveFvx() {
  const env = process.env.SOULLINK_FVX_DIR && fvxFromDir(process.env.SOULLINK_FVX_DIR)
  if (env) return { ...env, source: 'env' }
  const cfg = GET_CFG && fvxFromDir(GET_CFG())
  if (cfg) return { ...cfg, source: 'config' }
  const bundled = fvxFromDir(BUNDLED)
  if (bundled) return { ...bundled, source: 'bundled' }
  const det = detectFvx()
  return det ? { ...det, source: 'detected' } : null
}

function versionFromDir(dir) {
  const m = basename(dir || '').match(/v?(\d+)[._](\d+)[._](\d+)/)
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null
}

export function randomizerStatus() {
  const fvx = resolveFvx()
  if (!fvx) return { found: false }
  return { found: true, source: fvx.source, version: versionFromDir(fvx.dir), dir: fvx.dir }
}

// ── Auto-install FVX (so the user never hunts for the randomizer) ─────────────
// Mirrors the BizHawk auto-install: download the PINNED FVX Windows bundle (which ships
// its OWN JRE → also covers Java), extract it and verify jar+java are present. The
// release URL is overridable via SOULLINK_FVX_URL (config) so the version is easy to
// bump without an app update. Never throws; the client polls fvxInstallState() for a bar.
const FVX_URL = process.env.SOULLINK_FVX_URL || ''
let INSTALL = { state: 'idle', percent: 0, dir: null, error: null }
export function fvxInstallState() { return INSTALL }

function fvxDownload(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) { reject(new Error('Zu viele Weiterleitungen')); return }
    const req = httpsGet(url, { headers: { 'User-Agent': 'SoulLink-Companion' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); resolve(fvxDownload(res.headers.location, dest, onProgress, redirects + 1)); return }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let got = 0
      const out = createWriteStream(dest)
      res.on('data', (c) => { got += c.length; if (total) onProgress(got / total) })
      res.pipe(out); out.on('finish', () => out.close(() => resolve())); out.on('error', reject)
    })
    req.on('error', reject)
  })
}
function fvxUnzip(zip, dir) {
  return new Promise((resolve, reject) => {
    const cmd = `powershell -NoProfile -NonInteractive -Command "Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force"`
    exec(cmd, { windowsHide: true, maxBuffer: 1 << 24 }, (err) => err ? reject(err) : resolve())
  })
}
// FVX may extract at the root or one level down (e.g. UPR_FVX-v1_5_3-Windows/).
function findFvxDir(root) {
  const direct = fvxFromDir(root); if (direct) return direct.dir
  try { for (const e of readdirSync(root, { withFileTypes: true })) if (e.isDirectory() && fvxFromDir(join(root, e.name))) return join(root, e.name) } catch { /* ignore */ }
  return null
}

/** Download + extract the pinned FVX into targetDir. onDone(dir) fires once verified so
 *  the server can persist config.fvxDir → resolveFvx() then finds it. */
export async function installFvx({ targetDir, onDone } = {}) {
  if (INSTALL.state === 'downloading' || INSTALL.state === 'extracting') return INSTALL
  if (!FVX_URL) { INSTALL = { state: 'error', percent: 0, dir: null, error: 'fvx_url_unconfigured' }; return INSTALL }
  INSTALL = { state: 'downloading', percent: 0, dir: null, error: null }
  const zip = join(tmpdir(), 'soullink-fvx.zip')
  try {
    try { mkdirSync(targetDir, { recursive: true }) } catch { /* ignore */ }
    await fvxDownload(FVX_URL, zip, (p) => { INSTALL.percent = Math.round(p * 95) })
    INSTALL = { ...INSTALL, state: 'extracting', percent: 96 }
    await fvxUnzip(zip, targetDir)
    try { rmSync(zip, { force: true }) } catch { /* ignore */ }
    const dir = findFvxDir(targetDir)
    if (!dir) throw new Error('FVX-Ordner nach dem Entpacken unvollständig (UPR-FVX.jar oder Java fehlt).')
    INSTALL = { state: 'done', percent: 100, dir, error: null }
    if (typeof onDone === 'function') { try { onDone(dir) } catch { /* ignore */ } }
    return INSTALL
  } catch (e) {
    try { rmSync(zip, { force: true }) } catch { /* ignore */ }
    INSTALL = { state: 'error', percent: 0, dir: null, error: (e && e.message) || String(e) }
    return INSTALL
  }
}

// Open the FVX GUI (Stufe-1 preset editor): the user loads a ROM, sets rules and
// uses "Save Settings" → a .rnqs which SoulLink then imports as a custom preset.
// Detached so it doesn't block the Companion. (FVX can't preload a ROM via args, so
// the user opens it once inside FVX — documented in the UI.)
export function openRandomizer() {
  const fvx = resolveFvx()
  if (!fvx) return { ok: false, error: 'fvx_not_found' }
  try {
    const child = spawn(fvx.java, ['-Xmx4608M', '-jar', fvx.jar, 'please-use-the-launcher'], { cwd: fvx.dir, detached: true, stdio: 'ignore' })
    child.unref()
    return { ok: true, dir: fvx.dir }
  } catch (e) { return { ok: false, error: 'spawn_failed', detail: String(e?.message || e) } }
}

// Run FVX. settingsString (-S) wins over settingsFile (-s). Resolves with
// { ok, outputRom, log } or { ok:false, error, ... }. Never throws.
export function randomize({ inputRom, outputRom, settingsFile = null, settingsString = null, seed = null, log = true } = {}) {
  return new Promise((resolve) => {
    const fvx = resolveFvx()
    if (!fvx) return resolve({ ok: false, error: 'fvx_not_found' })
    if (!inputRom || !existsSync(inputRom)) return resolve({ ok: false, error: 'rom_not_found' })
    if (!outputRom) return resolve({ ok: false, error: 'no_output_path' })
    if (!settingsString && !(settingsFile && existsSync(settingsFile))) return resolve({ ok: false, error: 'settings_missing' })

    const args = ['-Xmx4608M', '-jar', fvx.jar, 'cli', '-i', inputRom, '-o', outputRom]
    if (settingsString) args.push('-S', settingsString)
    else args.push('-s', settingsFile)
    if (seed !== null && seed !== undefined && seed !== '') args.push('-z', String(seed))
    if (log) args.push('-l')

    let out = ''
    let child
    // cwd MUST be the FVX folder — it reads its data/ relative to itself.
    try { child = spawn(fvx.java, args, { cwd: fvx.dir, windowsHide: true }) }
    catch (e) { return resolve({ ok: false, error: 'spawn_failed', detail: String(e?.message || e) }) }
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    child.on('error', (e) => resolve({ ok: false, error: 'spawn_failed', detail: String(e?.message || e) }))
    child.on('close', (code) => {
      const ok = /Randomized successfully/i.test(out) && existsSync(outputRom)
      if (ok) resolve({ ok: true, outputRom, version: versionFromDir(fvx.dir), log: out.slice(-4000) })
      else resolve({ ok: false, error: 'randomize_failed', code, log: out.slice(-4000) })
    })
  })
}
