import { create } from 'zustand'
import type { EmulatorMon } from '../lib/emulatorSync'

// Holds the latest LIVE emulator party so any part of the run page can derive
// "is this encounter currently in the main team?" by stable PID — without each
// consumer subscribing to the polling loop. Updated by EmulatorReconciler.
interface EmuTeamStore {
  team: EmulatorMon[]
  connected: boolean
  setTeam: (team: EmulatorMon[], connected: boolean) => void
}

export const useEmuTeamStore = create<EmuTeamStore>((set) => ({
  team: [],
  connected: false,
  setTeam: (team, connected) => set({ team, connected }),
}))
