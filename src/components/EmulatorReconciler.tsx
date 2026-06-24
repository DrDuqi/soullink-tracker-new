import { useEffect } from 'react'
import { fetchPokemon, fetchEvolutionChain, fetchMoveById } from '../lib/pokemon-api'
import { useUpdateEncounter, useUpdateMoves } from '../hooks/useEncounters'
import { useEmulatorSync, resetEmulatorSync } from '../hooks/useEmulatorSync'
import { useEmuTeamStore } from '../store/emuTeamStore'
import type { Encounter } from '../types/database'

/**
 * Invisible component. Keeps emulator-imported encounters in sync with the live
 * game by the STABLE PID (which never changes through evolution):
 *  - evolution → updates species/name/types of the SAME encounter (route, soul
 *    links, status, notes, team membership, order all preserved);
 *  - adopts a not-yet-bound encounter of the same evolution family (heals legacy
 *    imports that predate the PID, incl. ones that already evolved);
 *  - syncs the 4 moves.
 * It NEVER creates a second encounter and only writes on real divergence
 * (idempotent → no 2x/second spam). Manual encounters (emu_pid null & no family
 * match) are never touched.
 */
export default function EmulatorReconciler({ encounters, runId }: { encounters: Encounter[]; runId: string }) {
  const { team, phase, game: emuGame, currentLocationName, currentLocationId, runId: syncRunId } = useEmulatorSync(true)
  const updateEncounter = useUpdateEncounter()
  const updateMoves = useUpdateMoves()
  const setEmuTeam = useEmuTeamStore((s) => s.setTeam)

  // BizHawk is still showing a DIFFERENT run's ROM (e.g. right after starting a new
  // SoulLink while the old run is open). Treat as "not connected to THIS run": show
  // nothing live and never bind the old team's Pokémon to this run's encounters.
  // (null runId = unknown → assume it's this run, so nothing regresses.)
  const wrongRun = syncRunId != null && syncRunId !== runId
  const liveTeam = wrongRun ? [] : team

  // Clear the shared live team AND the sync poller's last-seen team the instant the
  // run changes, so a freshly opened run never inherits the previous run's party
  // (which the poller otherwise keeps across the new game's empty frames).
  useEffect(() => { resetEmulatorSync(); setEmuTeam([], false, {}) }, [runId, setEmuTeam])

  // Re-run only when identity-relevant data changes (not on the 1s age ticker).
  const teamKey = liveTeam.map((m) => `${m.pid ?? ''}:${m.speciesId}:${(m.moveIds ?? []).join('|')}`).join(',')
  const encKey = encounters.map((e) => `${e.emu_pid ?? ''}#${e.pokemon_id}#${e.move_1}|${e.move_2}|${e.move_3}|${e.move_4}`).join(',')

  // Publish the live team to the shared store (drives the Team/Box overview).
  // Keyed incl. HP/level/item so the overview shows them live.
  const liveKey = liveTeam.map((m) => `${m.pid ?? ''}:${m.speciesId}:${m.level}:${m.hp}:${m.maxHp}:${m.heldItemId ?? ''}:${(m.moveIds ?? []).join('|')}`).join(',')
  useEffect(() => {
    setEmuTeam(liveTeam, phase === 'connected' && !wrongRun, { game: emuGame, locationName: currentLocationName, locationId: currentLocationId })
  }, [liveKey, phase, wrongRun, emuGame, currentLocationName, currentLocationId, setEmuTeam]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false

    async function reconcile() {
      for (const mon of liveTeam) {
        if (cancelled) break
        if (mon.pid == null) continue
        const pid = String(mon.pid)
        let enc = encounters.find((e) => e.emu_pid === pid) ?? null

        // Adopt an unbound encounter of the same evolution family.
        if (!enc) {
          const famIds = new Set<number>([mon.speciesId])
          try {
            const chain = await fetchEvolutionChain(mon.speciesId)
            chain.forEach((c) => famIds.add(c.id))
          } catch { /* fall back to same-species only */ }
          const cands = encounters.filter((e) => !e.emu_pid && e.pokemon_id != null && famIds.has(e.pokemon_id))
          if (cands.length === 1) {
            enc = cands[0]
            await updateEncounter.mutateAsync({ id: enc.id, runId, updates: { emu_pid: pid } })
          } else {
            continue // genuinely new Pokémon → user imports it deliberately
          }
        }
        if (cancelled) break

        // Evolution: species diverged → update the SAME encounter.
        if (enc.pokemon_id !== mon.speciesId) {
          const poke = await fetchPokemon(mon.speciesId)
          if (poke && !cancelled) {
            await updateEncounter.mutateAsync({
              id: enc.id, runId,
              updates: { pokemon_id: poke.id, pokemon_name: poke.name, types: poke.types },
              prevPokemonName: enc.nickname ?? enc.pokemon_name, // → logs "pokemon_evolved"
            })
          }
        }
        if (cancelled) break

        // Move sync (emulator is source of truth for bound encounters).
        const ids = (mon.moveIds ?? []).filter((x) => x > 0)
        if (ids.length) {
          const resolved = await Promise.all(ids.map((id) => fetchMoveById(id)))
          const next = [0, 1, 2, 3].map((i) => resolved[i]?.name ?? null)
          const cur = [enc.move_1, enc.move_2, enc.move_3, enc.move_4]
          if (!cancelled && resolved.some(Boolean) && next.some((n, i) => n !== cur[i])) {
            await updateMoves.mutateAsync({ id: enc.id, runId, moves: { move_1: next[0], move_2: next[1], move_3: next[2], move_4: next[3] } })
          }
        }
      }
    }

    reconcile().catch(() => { /* transient errors retrigger on the next change */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamKey, encKey])

  return null
}
