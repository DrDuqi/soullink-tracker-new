import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Run, Player } from '../types/database'

interface RunStore {
  currentRunId: string | null
  currentRun: Run | null
  players: Player[]
  myPlayerId: string | null
  setCurrentRun: (run: Run, players: Player[], myPlayerId: string) => void
  clearRun: () => void
}

export const useRunStore = create<RunStore>()(
  persist(
    (set) => ({
      currentRunId: null,
      currentRun: null,
      players: [],
      myPlayerId: null,
      setCurrentRun: (run, players, myPlayerId) =>
        set({ currentRunId: run.id, currentRun: run, players, myPlayerId }),
      clearRun: () =>
        set({ currentRunId: null, currentRun: null, players: [], myPlayerId: null }),
    }),
    { name: 'soullink-run' }
  )
)
