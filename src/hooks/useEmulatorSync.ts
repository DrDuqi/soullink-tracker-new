import { useEffect, useState, useSyncExternalStore } from 'react'
import { SYNC_ENDPOINT } from '../lib/emulatorSync'
import type { EmulatorMon, SyncEnvelope } from '../lib/emulatorSync'

// phases the UI distinguishes:
//   init       – before the first response
//   error      – endpoint unreachable (no dev server) after a few tries
//   offline    – endpoint OK but no team file / no data yet  → "Emulator nicht gefunden"
//   waiting    – file present but stale or empty             → "Datei gefunden, warte auf Pokémon"
//   connected  – fresh data with ≥1 Pokémon                  → "Verbunden mit <game>"
export type SyncPhase = 'init' | 'error' | 'offline' | 'waiting' | 'connected'

export interface EmulatorSyncState {
  phase: SyncPhase
  team: EmulatorMon[]
  game: string | null
  trainer: string | null
  currentLocationName: string | null
  currentLocationId: number | null
  runId: string | null    // which run's ROM is loaded (null = unknown → assume this run)
}

const POLL_MS = 1200
const FRESH_MS = 6000
const FAIL_LIMIT = 3

// Guard against transient garbage reads from the emulator (e.g. during battle or
// save-block switches): a single bad frame must never flip team/box membership or
// show impossible HP like 4223/4223. We reject the whole frame and keep the last
// good team — legitimate changes still arrive on the next clean frame.
function plausibleMon(m: EmulatorMon): boolean {
  return (
    Number.isFinite(m.level) && m.level >= 1 && m.level <= 100 &&
    Number.isFinite(m.maxHp) && m.maxHp >= 1 && m.maxHp <= 1000 &&
    Number.isFinite(m.hp) && m.hp >= 0 && m.hp <= m.maxHp &&
    Number.isFinite(m.speciesId) && m.speciesId >= 1 && m.speciesId <= 1025
  )
}
function plausibleFrame(team: EmulatorMon[]): boolean {
  return Array.isArray(team) && team.length >= 1 && team.length <= 6 && team.every(plausibleMon)
}

// ── Single shared poller ──────────────────────────────────────────────────────
// One fetch loop for the whole app, regardless of how many components read the
// sync. The reactive snapshot deliberately EXCLUDES the "last update" timestamp,
// so it only changes on a real data change (no per-second re-render storm). The
// age display reads `frameAt` via its own isolated 1s ticker (useEmulatorAgeSec).
const EMPTY: EmulatorSyncState = {
  phase: 'init', team: [], game: null, trainer: null, currentLocationName: null, currentLocationId: null, runId: null,
}
let snapshot: EmulatorSyncState = EMPTY
let frameAt: number | null = null
let lastTeamText: string | null = null
let goodLen = 0
let fails = 0

const listeners = new Set<() => void>()
let pollId: ReturnType<typeof setInterval> | null = null
let enabledCount = 0

function commit(next: EmulatorSyncState) {
  if (
    next.phase === snapshot.phase &&
    next.team === snapshot.team &&
    next.game === snapshot.game &&
    next.trainer === snapshot.trainer &&
    next.currentLocationName === snapshot.currentLocationName &&
    next.currentLocationId === snapshot.currentLocationId &&
    next.runId === snapshot.runId
  ) return                                   // nothing changed → no re-render
  snapshot = next
  for (const l of listeners) l()
}

async function pollOnce() {
  try {
    const res = await fetch(SYNC_ENDPOINT, { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    const env = (await res.json()) as SyncEnvelope
    fails = 0
    const envRunId = env.runId ?? null

    if (!env.last || !env.last.data) { commit({ ...snapshot, phase: 'offline', runId: envRunId }); return }
    const data = env.last.data
    frameAt = env.last.at

    // Only accept clean frames; a garbage/partial frame keeps the last good team.
    let team = snapshot.team
    const rawTeam = data.team ?? []
    if (plausibleFrame(rawTeam)) {
      goodLen = rawTeam.length
      const text = JSON.stringify(rawTeam)
      if (text !== lastTeamText) { lastTeamText = text; team = rawTeam }
    }

    const fresh = Date.now() - env.last.at < FRESH_MS
    commit({
      phase: fresh && goodLen > 0 ? 'connected' : 'waiting',
      team,
      game: data.game ?? null,
      trainer: data.trainer ?? null,
      currentLocationName: data.currentLocationName ?? null,
      currentLocationId: data.currentLocationId ?? null,
      runId: envRunId,
    })
  } catch {
    fails += 1
    if (fails >= FAIL_LIMIT) commit({ ...snapshot, phase: 'error' })
  }
}

function acquire() {
  enabledCount += 1
  if (pollId == null) { fails = 0; pollOnce(); pollId = setInterval(pollOnce, POLL_MS) }
}
function release() {
  enabledCount = Math.max(0, enabledCount - 1)
  if (enabledCount === 0 && pollId != null) { clearInterval(pollId); pollId = null }
}

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb) } }
function getSnapshot() { return snapshot }

/** Forget the last-seen team/game/age. MUST be called on a run switch: the poller is
 *  a singleton and deliberately keeps the last good team across "empty" frames (to
 *  ride out battle/save transitions). Without a reset, a brand-new run would inherit
 *  the previous run's party until its own Lua writes a team — showing foreign Pokémon. */
export function resetEmulatorSync() {
  snapshot = EMPTY
  frameAt = null
  lastTeamText = null
  goodLen = 0
  fails = 0
  for (const l of listeners) l()
}

/** Reactive emulator state from the shared poller. `enabled` only gates whether
 *  THIS consumer keeps the poll loop alive (ref-counted) — the snapshot is shared. */
export function useEmulatorSync(enabled = true): EmulatorSyncState {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => {
    if (!enabled) return
    acquire()
    return release
  }, [enabled])
  return snap
}

/** Seconds since the last frame — re-renders ONLY its caller (use in a tiny leaf
 *  so the heavy live panel never re-renders just to update "vor Xs"). */
export function useEmulatorAgeSec(): number | null {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => (n + 1) % 1_000_000), 1000)
    return () => clearInterval(id)
  }, [])
  return frameAt != null ? Math.max(0, Math.floor((Date.now() - frameAt) / 1000)) : null
}
