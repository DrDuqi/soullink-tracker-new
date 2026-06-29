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

// After the user edits rules in FVX and clicks "Save Settings", they save a .rnqs
// somewhere. Instead of making them import it, SoulLink finds the NEWEST .rnqs saved
// AFTER the editor was opened (across the likely save locations) and imports it
// automatically — so the user never picks a file or a folder. Returns the new preset
// or null (nothing saved yet). Never scans CUSTOM_DIR (would re-grab its own imports).
export function grabLatestRnqs({ sinceMs = 0, roots = [], name = 'Eigene Regeln', edition = null } = {}) {
  let best = null
  let bestT = sinceMs
  // Scan a directory's files; recurse ONE level into sub-folders (FVX/Windows often
  // save into a sub-folder of the chosen location). Shallow → fast, never deep-indexes.
  const scan = (dir, depth) => {
    let entries = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = join(dir, e.name)
      if (e.isFile() && /\.rnqs$/i.test(e.name)) {
        try { const t = statSync(p).mtimeMs; if (t > bestT) { bestT = t; best = p } } catch { /* ignore */ }
      } else if (e.isDirectory() && depth > 0 && !/^(node_modules|\$Recycle|AppData)/i.test(e.name)) {
        scan(p, depth - 1)
      }
    }
  }
  for (const root of roots) if (root) scan(root, 1)
  if (!best) return null
  return importPreset({ name: name || basename(best).replace(/\.rnqs$/i, ''), edition, sourceFile: best })
}

// ── Real-time, location-INDEPENDENT capture ──────────────────────────────────
// Watching the user's home recursively catches a .rnqs the instant FVX writes it —
// no matter which folder the dialog happened to open in (FVX folder, Desktop, OneDrive,
// a sub-folder …). The session is short-lived (started when the editor opens, stopped on
// the first hit or after a timeout) and import COPIES the file into the managed Presets
// folder, so the user truly never thinks about location or filename. Best-effort: if
// recursive watch isn't available, the polling scan above still works as a fallback.
let WATCH = null   // { since, name, edition, found, watchers:[], timer }
export function stopRnqsWatch() {
  if (!WATCH) return
  for (const w of WATCH.watchers) { try { w.close() } catch { /* ignore */ } }
  if (WATCH.timer) { try { clearTimeout(WATCH.timer) } catch { /* ignore */ } }
  WATCH = null
}
export function pollRnqsWatch() { return WATCH?.found || null }

/** Start (or keep) a recursive watch for the newest .rnqs after `sinceMs`. Idempotent
 *  per `sinceMs` so repeated polls don't restart it. `roots` should be high-level dirs
 *  (home, FVX folder) — recursion covers everything beneath. Auto-stops after 5 min. */
export function startRnqsWatch({ sinceMs = 0, name = 'Eigene Regeln', edition = null, roots = [] } = {}) {
  if (WATCH && WATCH.since === sinceMs) return WATCH.found
  stopRnqsWatch()
  const state = { since: sinceMs, name, edition, found: null, watchers: [], timer: null }
  const seen = new Set()
  for (const root of roots) {
    if (!root || !existsSync(root)) continue
    try {
      const w = watch(root, { recursive: true }, (_ev, file) => {
        if (state.found || !file || !/\.rnqs$/i.test(String(file))) return
        const p = join(root, String(file))
        if (seen.has(p)) return; seen.add(p)
        try {
          const t = statSync(p).mtimeMs
          if (t > state.since) { const preset = importPreset({ name: state.name, edition: state.edition, sourceFile: p }); if (preset) { state.found = preset; stopRnqsWatch() } }
        } catch { /* file mid-write / vanished — ignore */ }
      })
      state.watchers.push(w)
    } catch { /* recursive watch unsupported on this root — fallback scan covers it */ }
  }
  state.timer = setTimeout(() => stopRnqsWatch(), 5 * 60 * 1000)
  WATCH = state
  return null
}
