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

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

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
