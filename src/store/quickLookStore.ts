import { create } from 'zustand'

// Quick-Look = the SoulDex-in-the-run bridge. Any run surface can open a lightweight
// panel for a Pokémon / move / item / ability / type without leaving the run. `analyze`
// is an optional run-contextual action ("Im Run analysieren"); omit it when not sensible.
export type QuickLookKind = 'pokemon' | 'move' | 'item' | 'ability' | 'type'
export interface QuickLookTarget {
  kind: QuickLookKind
  key: number | string        // numeric id for pokemon/move/item/ability, type slug for type
  analyze?: { label: string; run: () => void }
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
