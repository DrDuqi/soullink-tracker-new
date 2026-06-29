import { create } from 'zustand'

// Quick-Look = the SoulDex-in-the-run bridge. Any run surface can open a lightweight
// panel for a Pokémon / move / item / ability / type without leaving the run. `analyze`
// is an optional run-contextual action ("Im Run analysieren"); omit it when not sensible.
export type QuickLookKind = 'pokemon' | 'move' | 'item' | 'ability' | 'type'

// Optional run context an opener can attach to a Pokémon Quick-Look so it shows the
// ACTUAL state in the run (current 4 moves, status, route, partner) instead of generic
// dex data — the whole point of an in-run Quick-Look.
export interface RunContext {
  moves?: (string | null | undefined)[]
  status?: string
  location?: string | null
  nickname?: string | null
  level?: number | null
  soulLink?: string | null
}
export interface QuickLookTarget {
  kind: QuickLookKind
  key: number | string        // numeric id for pokemon/move/item/ability, type slug for type
  analyze?: { label: string; run: () => void }
  context?: RunContext
}
interface QuickLookState {
  target: QuickLookTarget | null
  open: (t: QuickLookTarget) => void
  close: () => void
}
export const useQuickLook = create<QuickLookState>((set) => ({
  target: null,
  open: (t) => set({ target: t }),
  close: () => set({ target: null }),
}))
