// Local run registry — maps a Supabase run id to the LOCAL launch data prepared on
// THIS PC: the randomized ROM, its seed/preset, and (implicitly) its savegame.
//
// Savegame model (verified against BizHawk on the dev machine): BizHawk stores the
// NDS battery save as NDS/SaveRAM/<ROM-basename>.SaveRAM — keyed by the ROM file
// NAME. So a per-run ROM whose name includes the run id has its OWN savegame, and
// re-opening a run = relaunching that exact ROM ⇒ the exact same save loads. No
// BizHawk config change needed; we only guarantee a globally-unique ROM basename.
//
// The run's IDENTITY + team live in Supabase; this registry is purely the local
// "how to launch this run + which savegame". Per-machine, atomic, schema-versioned.

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, rmSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'

let FILE = null
let RUNS_DIR = null

export function initRuns({ file, runsDir }) {
  FILE = file
  RUNS_DIR = runsDir
  try { if (runsDir) mkdirSync(runsDir, { recursive: true }) } catch { /* ignore */ }
}

/** Per-run folder for the randomized ROM (+ anything run-specific later). */
export function runFolder(runId) { return join(RUNS_DIR, String(runId)) }

function load() {
  try {
    if (!existsSync(FILE)) return { schemaVersion: 1, runs: {} }
    const j = JSON.parse(readFileSync(FILE, 'utf8'))
    return (j && typeof j === 'object' && j.runs) ? j : { schemaVersion: 1, runs: {} }
  } catch { return { schemaVersion: 1, runs: {} } }
}
function save(s) {
  const tmp = FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(s, null, 2))
  renameSync(tmp, FILE)   // atomic
}

// Upsert the local data for a run (romPath, bizhawk, seed, presetId, edition, …).
export function recordLocalRun(runId, data) {
  const s = load()
  s.runs[runId] = { ...(s.runs[runId] || {}), ...data, runId, updatedAt: new Date().toISOString() }
  save(s)
  return s.runs[runId]
}
export function getLocalRun(runId) { return load().runs[String(runId)] || null }
export function listLocalRuns() { return load().runs }

// Which run does a launched ROM belong to? Lets the live-sync tell the UI whether
// BizHawk is really on THIS run's ROM (vs. an old run still open). Matches by exact
// ROM path; falls back to the per-run folder name (Runs/<runId>/…). null if unknown.
export function runIdForRom(romPath) {
  if (!romPath) return null
  const norm = (p) => String(p).replace(/\\/g, '/').toLowerCase()
  const target = norm(romPath)
  const runs = load().runs
  for (const id of Object.keys(runs)) {
    if (runs[id]?.romPath && norm(runs[id].romPath) === target) return id
  }
  // Fallback: the ROM lives in Runs/<runId>/… → its parent folder is the run id.
  try {
    const parent = dirname(romPath)
    if (RUNS_DIR && norm(dirname(parent)) === norm(RUNS_DIR)) {
      const id = parent.replace(/\\/g, '/').split('/').pop()
      if (id && runs[id]) return id
    }
  } catch { /* ignore */ }
  return null
}

// Write a self-describing metadata.json into the run folder, so the folder survives
// even if the central registry is lost (and is human-readable).
export function writeRunMetadata(runId, meta) {
  try {
    const dir = runFolder(runId)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'metadata.json'), JSON.stringify({ runId, ...meta }, null, 2))
  } catch { /* non-fatal */ }
}

// The BizHawk savegame for a run (keyed by ROM basename) + its backup.
function savePathsFor(rec) {
  if (!rec?.bizhawk || !rec?.saveName) return []
  const dir = join(dirname(rec.bizhawk), 'NDS', 'SaveRAM')
  return [join(dir, rec.saveName), join(dir, rec.saveName + '.bak')]
}

export function archiveLocalRun(runId, archived = true) {
  const s = load(); const r = s.runs[String(runId)]
  if (!r) return false
  r.archived = !!archived; r.updatedAt = new Date().toISOString()
  save(s); return true
}

// Fully remove a run's LOCAL files: its folder (ROM + metadata) AND its savegame
// (+ .bak) in BizHawk's SaveRAM. The shared Supabase run is deleted by the client.
export function deleteLocalRun(runId) {
  const s = load(); const r = s.runs[String(runId)]
  try { rmSync(runFolder(runId), { recursive: true, force: true }) } catch { /* ignore */ }
  if (r) for (const p of savePathsFor(r)) { try { if (existsSync(p)) unlinkSync(p) } catch { /* ignore */ } }
  if (r) { delete s.runs[String(runId)]; save(s) }
  return true
}
