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

import { existsSync, readFileSync, readdirSync, writeFileSync, renameSync, copyFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

let BUILTIN_DIR = null
let CUSTOM_DIR = null
let REGISTRY = null

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
    const id = 'user-' + randomUUID()
    const fileName = `${safe(name)}-${id.slice(-6)}.rnqs`
    mkdirSync(CUSTOM_DIR, { recursive: true })
    copyFileSync(sourceFile, join(CUSTOM_DIR, fileName))
    const reg = loadReg()
    reg.push({ id, name: String(name || 'Eigenes Preset').slice(0, 60), edition: edition || null, file: fileName, createdAt: new Date().toISOString() })
    saveReg(reg)
    return { id, name: String(name || 'Eigenes Preset').slice(0, 60), edition: edition || null, builtin: false }
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
