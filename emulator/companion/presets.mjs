// Preset store — a preset is the RULE SET ("how to randomize"), strictly separate
// from the seed ("which concrete result"). Two sources, one list:
//   • BUILT-IN  — shipped with SoulLink (bundled resources/presets), per edition,
//     described by manifest.json. Read-only.
//   • CUSTOM    — the user's own, created/imported via the FVX editor, stored in a
//     managed Presets/ folder with a small registry. Editable/deletable.
//
// Each preset is backed by an FVX .rnqs file; getPresetFile(id) resolves it for the
// randomizer (-s). Designed to extend to more editions/generations and to a future
// in-app preset editor (Stufe 2) and run-sync (the preset belongs to the run) WITHOUT
// reworking the flow: the list is generation-aware and presets are content-addressable
// by id.

import { existsSync, readFileSync, readdirSync, writeFileSync, renameSync, copyFileSync, mkdirSync, unlinkSync, statSync, watch } from 'node:fs'
import { join, basename } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { homedir } from 'node:os'

// Content hash of a .rnqs → identity for idempotent imports (same rules = same preset).
function rnqsHash(p) { try { return createHash('sha1').update(readFileSync(p)).digest('hex') } catch { return null } }

let BUILTIN_DIR = null
let CUSTOM_DIR = null
let REGISTRY = null

// Canonical, visible "save your rules here" inbox: Documents/SoulLink/Presets. The FVX
// "Save Settings" JFileChooser opens in Documents by default, so this folder appears
// right there — the user clicks into a clearly-named SoulLink folder instead of guessing.
// It is NOT the managed CUSTOM_DIR (grab still copies imports into CUSTOM_DIR), so it is
// safe to scan. Created on demand; returns its absolute path (or null on locked-down FS).
let _inbox = null
export function presetInbox() {
  if (_inbox !== null) return _inbox || null
  const bases = [process.env.OneDrive, process.env.USERPROFILE, (() => { try { return homedir() } catch { return null } })()]
    .filter(Boolean).map((b) => join(b, 'Documents'))
  const base = bases.find((d) => existsSync(d)) || bases[0] || null
  const dir = base ? join(base, 'SoulLink', 'Presets') : null
  if (dir) { try { mkdirSync(dir, { recursive: true }) } catch { /* ignore */ } }
  _inbox = dir || ''
  return dir
}

export function initPresets({ builtinCandidates = [], customDir = null } = {}) {
  BUILTIN_DIR = builtinCandidates.find((d) => { try { return d && existsSync(join(d, 'manifest.json')) } catch { return false } }) || null
  CUSTOM_DIR = customDir
  REGISTRY = customDir ? join(customDir, 'presets.json') : null
  try { if (customDir) mkdirSync(customDir, { recursive: true }) } catch { /* ignore */ }
}

function loadBuiltin() {
  if (!BUILTIN_DIR) return []
  try {
    const m = JSON.parse(readFileSync(join(BUILTIN_DIR, 'manifest.json'), 'utf8'))
    const arr = Array.isArray(m?.presets) ? m.presets : []
    return arr
      .filter((p) => p?.file && existsSync(join(BUILTIN_DIR, p.file)))
      .map((p) => ({ id: p.id, name: p.name, edition: p.edition || null, description: p.description || null, builtin: true, _file: join(BUILTIN_DIR, p.file) }))
  } catch { return [] }
}

function loadReg() {
  try { const j = JSON.parse(readFileSync(REGISTRY, 'utf8')); return Array.isArray(j?.presets) ? j.presets : [] } catch { return [] }
}
function saveReg(presets) {
  const tmp = REGISTRY + '.tmp'
  writeFileSync(tmp, JSON.stringify({ schemaVersion: 1, presets }, null, 2))
  renameSync(tmp, REGISTRY)   // atomic
}
function loadCustom() {
  if (!CUSTOM_DIR) return []
  return loadReg()
    .filter((p) => p?.file && existsSync(join(CUSTOM_DIR, p.file)))
    .map((p) => ({ id: p.id, name: p.name, edition: p.edition || null, description: p.description || null, builtin: false, _file: join(CUSTOM_DIR, p.file) }))
}

function all() { return [...loadBuiltin(), ...loadCustom()] }

// Public list (no filesystem paths leak to the UI). edition optional → presets with
// no edition (generic) are always included.
export function listPresets(edition) {
  const list = all().filter((p) => !edition || !p.edition || p.edition === edition)
  return list.map(({ _file, ...rest }) => rest)
}
export function getPresetFile(id) {
  const p = all().find((x) => x.id === id)
  return p ? p._file : null
}

const safe = (s) => String(s ?? 'preset').replace(/[^\w-]+/g, '_').slice(0, 60) || 'preset'

// Import a .rnqs (from the FVX editor or a file the user picked) as a new custom
// preset. Returns the new preset meta, or null.
export function importPreset({ name, edition = null, sourceFile }) {
  if (!CUSTOM_DIR || !sourceFile || !existsSync(sourceFile)) return null
  try {
    const ed = edition || null
    const hash = rnqsHash(sourceFile)
    const reg = loadReg()
    // IDEMPOTENT: identical rules (same content + edition) → update the existing preset
    // instead of creating a duplicate. This makes repeated file-watcher/poll events and
    // re-saving the same file a no-op (or a name/refresh), never a new entry.
    const existing = hash ? reg.find((r) => r.hash === hash && (r.edition || null) === ed) : null
    if (existing) {
      if (name) existing.name = String(name).slice(0, 60)
      if (ed) existing.edition = ed
      try { mkdirSync(CUSTOM_DIR, { recursive: true }); copyFileSync(sourceFile, join(CUSTOM_DIR, existing.file)) } catch { /* keep old file */ }
      saveReg(reg)
      return { id: existing.id, name: existing.name, edition: existing.edition || null, builtin: false }
    }
    const id = 'user-' + randomUUID()
    const fileName = `${safe(name)}-${id.slice(-6)}.rnqs`
    mkdirSync(CUSTOM_DIR, { recursive: true })
    copyFileSync(sourceFile, join(CUSTOM_DIR, fileName))
    reg.push({ id, name: String(name || 'Eigenes Preset').slice(0, 60), edition: ed, file: fileName, hash, createdAt: new Date().toISOString() })
    saveReg(reg)
    return { id, name: String(name || 'Eigenes Preset').slice(0, 60), edition: ed, builtin: false }
  } catch { return null }
}
export function renamePreset(id, name) {
  const reg = loadReg(); const p = reg.find((x) => x.id === id)
  if (!p) return false
  p.name = String(name || p.name).slice(0, 60); saveReg(reg); return true
}
export function deletePreset(id) {
  const reg = loadReg(); const i = reg.findIndex((p) => p.id === id)
  if (i < 0) return false   // built-ins (not in registry) can't be deleted
  try { unlinkSync(join(CUSTOM_DIR, reg[i].file)) } catch { /* ignore */ }
  reg.splice(i, 1); saveReg(reg); return true
}

// ── Single atomic capture (used by BOTH the watcher and the polling fallback) ────
// Captures a .rnqs robustly: (1) an in-flight lock per path blocks parallel watcher/poll
// events, (2) we WAIT until the file is fully written (size stable over time) so FVX's
// mid-write partial bytes never become a corrupt preset, (3) importPreset is idempotent
// by content-hash+edition, so re-running on the same file simply RETURNS the existing
// preset (never a duplicate, never null). Returns { preset, error } so a real failure
// reason surfaces instead of a silent null.
const _captureInFlight = new Set()
function waitFileStable(path, tries = 25, interval = 200) {
  return new Promise((resolve) => {
    let last = -1, stable = 0, n = 0
    const tick = () => {
      let sz = -1; try { sz = statSync(path).size } catch { resolve(false); return }
      if (sz > 0 && sz === last) { if (++stable >= 2) { resolve(true); return } } else { stable = 0; last = sz }
      if (++n >= tries) { resolve(sz > 0); return }
      setTimeout(tick, interval)
    }
    tick()
  })
}
export async function captureRnqs(path, { name = 'Eigene Regeln', edition = null, sinceMs = 0 } = {}) {
  if (!path || _captureInFlight.has(path)) return { preset: null, error: null }
  try { if (statSync(path).mtimeMs <= sinceMs) return { preset: null, error: null } } catch { return { preset: null, error: 'read_failed' } }
  _captureInFlight.add(path)
  try {
    if (!(await waitFileStable(path))) return { preset: null, error: 'unstable' }   // FVX still writing → retry next poll
    const preset = importPreset({ name, edition, sourceFile: path })               // idempotent: new OR existing
    return { preset, error: preset ? null : 'import_failed' }
  } finally { _captureInFlight.delete(path) }
}

// Polling fallback (and reliability net for OneDrive, where recursive fs.watch can miss
// events): find the NEWEST .rnqs saved after `sinceMs` across the likely locations, then
// capture it through the same stability+idempotent gate. Returns { preset, detecting,
// error } — `detecting` = a fresh file exists but isn't a finished preset yet.
export async function grabLatestRnqs({ sinceMs = 0, roots = [], name = 'Eigene Regeln', edition = null } = {}) {
  let best = null, bestT = sinceMs
  const scan = (dir, depth) => {
    let entries = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isFile() && /\.rnqs$/i.test(e.name)) {
        try { const t = statSync(p).mtimeMs; if (t > bestT) { bestT = t; best = p } } catch { /* ignore */ }
      } else if (e.isDirectory() && depth > 0 && !/^(node_modules|\$Recycle|AppData|\.git)$/i.test(e.name)) {
        scan(p, depth - 1)
      }
    }
  }
  for (const root of roots) if (root) scan(root, 2)   // root + 2 levels deep (FVX often saves into a sub-folder)
  if (!best) return { preset: null, detecting: false, error: null }
  const { preset, error } = await captureRnqs(best, { name: name || basename(best).replace(/\.rnqs$/i, ''), edition, sinceMs })
  const fresh = !preset && (Date.now() - bestT < 20000)   // saw a new file, not finished yet → keep showing "importing"
  return { preset, detecting: fresh, error }
}

// ── Real-time, location-INDEPENDENT capture ──────────────────────────────────
// Watching the user's home recursively catches a .rnqs the instant FVX writes it — no
// matter which folder the dialog used. CRITICAL: the found preset is PERSISTED on the
// session (CAP.found) and survives the watchers being closed, so a poll that arrives
// after the watcher fires still receives it (the old code nulled the session on the hit
// and lost the result → status bounced back to "waiting"). A new editor session (new
// `sinceMs`) resets the session.
let CAP = null   // { since, name, edition, found, detecting, error, watchers:[], timer }
function closeWatchers() {
  if (!CAP) return
  for (const w of CAP.watchers) { try { w.close() } catch { /* ignore */ } }
  CAP.watchers = []
  if (CAP.timer) { try { clearTimeout(CAP.timer) } catch { /* ignore */ } CAP.timer = null }
}
export function stopRnqsWatch() { closeWatchers() }              // stops fs handles, KEEPS CAP.found
export function pollRnqsWatch() { return CAP?.found || null }
export function rnqsWatchBusy() { return !!(CAP && CAP.detecting && !CAP.found) }
export function rnqsWatchError() { return (CAP && !CAP.found && CAP.error) || null }

/** Start (or keep) a recursive watch for the newest .rnqs after `sinceMs`. Idempotent
 *  per `sinceMs` so repeated polls keep the same session (and its found preset). */
export function startRnqsWatch({ sinceMs = 0, name = 'Eigene Regeln', edition = null, roots = [] } = {}) {
  if (CAP && CAP.since === sinceMs) return CAP.found       // same session → keep state + found
  closeWatchers()
  CAP = { since: sinceMs, name, edition, found: null, detecting: false, error: null, watchers: [], timer: null }
  const seen = new Set()
  for (const root of roots) {
    if (!root || !existsSync(root)) continue
    try {
      const w = watch(root, { recursive: true }, (_ev, file) => {
        if (!CAP || CAP.found || !file || !/\.rnqs$/i.test(String(file))) return
        const p = join(root, String(file))
        if (seen.has(p)) return; seen.add(p)
        try { if (statSync(p).mtimeMs <= CAP.since) { seen.delete(p); return } } catch { seen.delete(p); return }
        CAP.detecting = true   // a fresh file appeared → UI flips to "wird importiert"
        captureRnqs(p, { name: CAP.name, edition: CAP.edition, sinceMs: CAP.since })
          .then(({ preset, error }) => {
            if (!CAP) return
            if (preset) { CAP.found = preset; closeWatchers() }   // persist; stop fs handles but KEEP found
            else { seen.delete(p); CAP.detecting = false; if (error) CAP.error = error }
          })
          .catch(() => { if (CAP) CAP.detecting = false; seen.delete(p) })
      })
      CAP.watchers.push(w)
    } catch { /* recursive watch unsupported on this root — the scan covers it */ }
  }
  CAP.timer = setTimeout(() => closeWatchers(), 5 * 60 * 1000)
  return null
}
