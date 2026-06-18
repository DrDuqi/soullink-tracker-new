import { create } from 'zustand'
import type { EmulatorMon } from '../lib/emulatorSync'

// Holds the latest LIVE emulator party so any part of the run page can derive
// "is this encounter currently in the main team?" by stable PID — without each
// consumer subscribing to the polling loop. Updated by EmulatorReconciler.
interface EmuTeamStore {
  team: EmulatorMon[]
  connected: boolean
  currentLocationName: string | null
  currentLocationId: number | null
  setTeam: (
    team: EmulatorMon[],
    connected: boolean,
    location?: { name: string | null; id: number | null },
  ) => void
}

export const useEmuTeamStore = create<EmuTeamStore>((set) => ({
  team: [],
  connected: false,
  currentLocationName: null,
  currentLocationId: null,
  setTeam: (team, connected, location) =>
    set({
      team,
      connected,
      currentLocationName: location?.name ?? null,
      currentLocationId: location?.id ?? null,
    }),
}))
