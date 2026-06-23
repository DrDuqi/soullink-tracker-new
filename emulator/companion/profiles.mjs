// SoulLink profiles — local, machine-bound game profiles ("Valon + Leon", …).
//
// Profiles hold the LOCAL paths + preferences for a pairing (original ROM, BizHawk,
// randomizer, output folder, preset, last seed, run history). They are per-machine
// and therefore live in the Companion, NOT in Supabase — the shared part of a
// SoulLink (edition / preset / seed) belongs to the Run, not the profile.
//
// Design notes (foundation we don't want to rebuild later):
//   • schemaVersion + migrate() → the file format can evolve without breaking old
//     installs. Every future shape change adds one migration step.
//   • Atomic writes (tmp + rename) → a crash mid-write can never corrupt the store.
//   • Corrupt file → preserved as profiles.corrupt-<ts>.json, never silently wiped.
//   • players is an ARRAY → 2/3/4-player SoulLinks need no schema change.

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const SCHEMA_VERSION = 1
const MAX_NAME = 80

let FILE = null
/** Called once by the server with the resolved path (next to companion-config.json). */
export function initProfiles(filePath) { FILE = filePath }

function emptyStore() {
  return { schemaVersion: SCHEMA_VERSION, activeProfileId: null, profiles: [], presets: [] }
}

// Bring any older/garbled shape up to the current schema. No-op at v1; future
// versions add `if (d.schemaVersion === N) { …transform…; d.schemaVersion = N+1 }`.
function migrate(input) {
  if (!input || typeof input !== 'object') return emptyStore()
  const d = input
  if (typeof d.schemaVersion !== 'number') d.schemaVersion = 1
  if (!Array.isArray(d.profiles)) d.profiles = []
  if (!Array.isArray(d.presets)) d.presets = []
  if (!('activeProfileId' in d)) d.activeProfileId = null
  d.schemaVersion = SCHEMA_VERSION
  return d
}

function load() {
  if (!FILE) throw new Error('profiles not initialised')
  try {
    if (!existsSync(FILE)) return emptyStore()
    return migrate(JSON.parse(readFileSync(FILE, 'utf8')))
  } catch {
    // Never destroy user data on a parse error — set it aside and start clean.
    try { if (existsSync(FILE)) renameSync(FILE, FILE.replace(/\.json$/i, `.corrupt-${Date.now()}.json`)) } catch { /* ignore */ }
    return emptyStore()
  }
}

function save(store) {
  store.schemaVersion = SCHEMA_VERSION
  const tmp = FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(store, null, 2))
  renameSync(tmp, FILE)   // atomic on the same volume
  return store
}

function cleanName(s, fallback) {
  const t = String(s ?? '').trim().slice(0, MAX_NAME)
  return t || fallback
}
function cleanPlayers(v) {
  return Array.isArray(v) ? v.map((p) => String(p ?? '').trim()).filter(Boolean).slice(0, 4) : []
}

function blankProfile(input) {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    name: cleanName(input?.name, 'Neues Profil'),
    players: cleanPlayers(input?.players),
    edition: input?.edition ? String(input.edition) : null,
    paths: { originalRom: null, bizhawk: null, randomizer: null, preset: null, outputDir: null },
    presetId: null,
    lastSeed: null,
    lastRandomizedRom: null,
    runHistory: [],
    createdAt: now,
    updatedAt: now,
  }
}

// ── public API ───────────────────────────────────────────────────────────────
export function listProfiles() {
  const s = load()
  return { activeProfileId: s.activeProfileId, profiles: s.profiles }
}

export function createProfile(input) {
  const s = load()
  const p = blankProfile(input)
  s.profiles.push(p)
  if (!s.activeProfileId) s.activeProfileId = p.id   // first profile becomes active
  save(s)
  return p
}

export function updateProfile(id, patch) {
  const s = load()
  const p = s.profiles.find((x) => x.id === id)
  if (!p) return null
  const { id: _drop, paths, name, players, createdAt: _drop2, ...rest } = patch || {}
  Object.assign(p, rest)                                  // edition, presetId, lastSeed, …
  if (name !== undefined) p.name = cleanName(name, p.name)
  if (players !== undefined) p.players = cleanPlayers(players)
  if (paths && typeof paths === 'object') p.paths = { ...p.paths, ...paths }
  p.updatedAt = new Date().toISOString()
  save(s)
  return p
}

export function deleteProfile(id) {
  const s = load()
  const i = s.profiles.findIndex((x) => x.id === id)
  if (i < 0) return false
  s.profiles.splice(i, 1)
  if (s.activeProfileId === id) s.activeProfileId = s.profiles[0]?.id ?? null
  save(s)
  return true
}

export function duplicateProfile(id) {
  const s = load()
  const src = s.profiles.find((x) => x.id === id)
  if (!src) return null
  const now = new Date().toISOString()
  const copy = { ...structuredClone(src), id: randomUUID(), name: cleanName(`${src.name} (Kopie)`, 'Kopie'), runHistory: [], createdAt: now, updatedAt: now }
  s.profiles.push(copy)
  save(s)
  return copy
}

export function setActiveProfile(id) {
  const s = load()
  if (id !== null && !s.profiles.some((x) => x.id === id)) return false
  s.activeProfileId = id
  save(s)
  return true
}

export function getProfile(id) {
  return load().profiles.find((x) => x.id === id) || null
}

// Record a started run on the profile: remember the seed + randomized ROM and
// prepend a capped history entry. Used by the "Neuer SoulLink" flow.
export function recordRun(id, { seed = null, romPath = null, presetId = null, runId = null, code = null } = {}) {
  const s = load()
  const p = s.profiles.find((x) => x.id === id)
  if (!p) return null
  p.lastSeed = seed
  p.lastRandomizedRom = romPath
  if (presetId) p.presetId = presetId   // remember the chosen preset for next time
  if (!Array.isArray(p.runHistory)) p.runHistory = []
  p.runHistory.unshift({ seed, romPath, presetId, runId, code, date: new Date().toISOString() })
  p.runHistory = p.runHistory.slice(0, 50)
  p.updatedAt = new Date().toISOString()
  save(s)
  return p
}
