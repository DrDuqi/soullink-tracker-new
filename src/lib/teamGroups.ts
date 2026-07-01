import type { Encounter, TeamSlot } from '../types/database'
import type { EmulatorMon } from './emulatorSync'

export interface TeamGroups {
  team: Encounter[]                       // currently in the main team (max 6)
  box: Encounter[]                        // alive, not in team
  dead: Encounter[]                       // status 'dead'
  liveByPid: Map<string, EmulatorMon>     // live mon by stable PID (for enrichment)
}

/** Groups my encounters into Team / Box / Dead. The emulator is the source of
 *  truth for the current main team (matched by stable PID); manual team_slots
 *  count too, and serve as the fallback when the emulator isn't connected. */
export function deriveTeamGroups(
  myEncounters: Encounter[],
  teamSlots: TeamSlot[],
  myPlayerId: string,
  liveTeam: EmulatorMon[],
  connected: boolean,
): TeamGroups {
  const liveByPid = new Map(liveTeam.filter((m) => m.pid != null).map((m) => [String(m.pid), m]))
  const mySlotEncIds = new Set(teamSlots.filter((s) => s.player_id === myPlayerId).map((s) => s.encounter_id))

  // While CONNECTED the emulator party is the SINGLE source of truth for team
  // membership — team_slots (manual/persisted) are ignored, so a Pokémon that gets
  // moved to the PC box leaves the team and lands in the box instantly (and can never
  // show in both). Only when disconnected do we fall back to the manual team_slots.
  const inTeam = (e: Encounter) => connected
    ? (!!e.emu_pid && liveByPid.has(e.emu_pid))
    : mySlotEncIds.has(e.id)
  const slotOf = (e: Encounter): number => {
    const m = e.emu_pid ? liveByPid.get(e.emu_pid) : undefined
    return m?.slot ?? 99
  }

  const alive = myEncounters.filter((e) => e.status !== 'dead')
  const team = alive.filter(inTeam).sort((a, b) => slotOf(a) - slotOf(b)).slice(0, 6)
  const box = alive.filter((e) => !inTeam(e))
  const dead = myEncounters.filter((e) => e.status === 'dead')

  return { team, box, dead, liveByPid }
}
