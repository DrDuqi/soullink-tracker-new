import { useEffect, useRef, useState } from 'react'
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
  ageSec: number | null   // seconds since the file was last written (null if unknown)
}

const POLL_MS = 1200
const FRESH_MS = 6000
const FAIL_LIMIT = 3

/** Polls the local sync endpoint. State only changes on real changes (no flicker);
 *  an isolated 1s ticker refreshes the "last update Xs ago" display. */
export function useEmulatorSync(enabled = true): EmulatorSyncState {
  const [phase, setPhase] = useState<SyncPhase>('init')
  const [team, setTeam] = useState<EmulatorMon[]>([])
  const [game, setGame] = useState<string | null>(null)
  const [trainer, setTrainer] = useState<string | null>(null)
  const [curLocName, setCurLocName] = useState<string | null>(null)
  const [curLocId, setCurLocId] = useState<number | null>(null)
  const [, tick] = useState(0)

  const lastAt = useRef<number | null>(null)
  const lastTeamText = useRef<string | null>(null)
  const fails = useRef(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(SYNC_ENDPOINT, { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        const env = (await res.json()) as SyncEnvelope
        if (cancelled) return
        fails.current = 0

        if (!env.last || !env.last.data) { setPhase('offline'); return }
        const data = env.last.data
        lastAt.current = env.last.at
        setGame(data.game ?? null)           // primitive → React bails if unchanged
        setTrainer(data.trainer ?? null)
        setCurLocName(data.currentLocationName ?? null)
        setCurLocId(data.currentLocationId ?? null)

        const text = JSON.stringify(data.team ?? [])
        if (text !== lastTeamText.current) { lastTeamText.current = text; setTeam(data.team ?? []) }

        const fresh = Date.now() - env.last.at < FRESH_MS
        const hasMons = (data.team?.length ?? 0) > 0
        setPhase(fresh && hasMons ? 'connected' : 'waiting')
      } catch {
        if (cancelled) return
        fails.current += 1
        if (fails.current >= FAIL_LIMIT) setPhase('error')
      }
    }

    poll()
    const pollId = setInterval(poll, POLL_MS)
    const tickId = setInterval(() => tick((n) => (n + 1) % 1_000_000), 1000) // age refresh only
    return () => { cancelled = true; clearInterval(pollId); clearInterval(tickId) }
  }, [enabled])

  const ageSec = lastAt.current != null ? Math.max(0, Math.floor((Date.now() - lastAt.current) / 1000)) : null
  return { phase, team, game, trainer, currentLocationName: curLocName, currentLocationId: curLocId, ageSec }
}
