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

import { existsSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import { spawn } from 'node:child_process'

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
