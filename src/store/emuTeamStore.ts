import { create } from 'zustand'
import type { EmulatorMon } from '../lib/emulatorSync'

// Holds the latest LIVE emulator party so any part of the run page can derive
// "is this encounter currently in the main team?" by stable PID — without each
// consumer subscribing to the polling loop. Updated by EmulatorReconciler.
interface EmuTeamStore {
  team: EmulatorMon[]
  connected: boolean
  game: string | null                     // emulator game code (e.g. "platinum")
  currentLocationName: string | null
  currentLocationId: number | null
  setTeam: (
    team: EmulatorMon[],
    connected: boolean,
    meta?: { game?: string | null; locationName?: string | null; locationId?: number | null },
  ) => void
}

export const useEmuTeamStore = create<EmuTeamStore>((set) => ({
  team: [],
  connected: false,
  game: null,
  currentLocationName: null,
  currentLocationId: null,
  setTeam: (team, connected, meta) =>
    set({
      team,
      connected,
      game: meta?.game ?? null,
      currentLocationName: meta?.locationName ?? null,
      currentLocationId: meta?.locationId ?? null,
    }),
}))
