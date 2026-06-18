import { useEffect } from 'react'
import { create } from 'zustand'

// Auto-learning map: emulator currentLocationId → route/area name (as used in the
// encounter checklist). Learned automatically when the user picks a route while
// importing an emulator mon, so location IDs never have to be hard-coded in the
// Lua script. Stored locally per game (the emulator live-sync is dev-only and
// device-local anyway), editable + deletable via the LocationMapManager UI.

type GameMap = Record<string, string>   // locationId (as string) → route name

const KEY = (game: string) => `soullink-locmap-${game.toLowerCase()}`

function load(game: string): GameMap {
  try {
    const raw = localStorage.getItem(KEY(game))
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as GameMap) : {}
  } catch {
    return {}
  }
}
function persist(game: string, map: GameMap) {
  try { localStorage.setItem(KEY(game), JSON.stringify(map)) } catch { /* ignore quota/private mode */ }
}

interface LocationMapStore {
  maps: Record<string, GameMap>                 // game (lowercased) → its map
  hydrate: (game: string) => void
  setMapping: (game: string, id: number, route: string) => void
  removeMapping: (game: string, id: number) => void
}

export const useLocationMapStore = create<LocationMapStore>((set, get) => ({
  maps: {},
  hydrate: (game) => {
    const g = game.toLowerCase()
    if (!get().maps[g]) set((s) => ({ maps: { ...s.maps, [g]: load(g) } }))
  },
  setMapping: (game, id, route) => {
    const g = game.toLowerCase()
    set((s) => {
      const next = { ...(s.maps[g] ?? load(g)), [String(id)]: route }
      persist(g, next)
      return { maps: { ...s.maps, [g]: next } }
    })
  },
  removeMapping: (game, id) => {
    const g = game.toLowerCase()
    set((s) => {
      const next = { ...(s.maps[g] ?? load(g)) }
      delete next[String(id)]
      persist(g, next)
      return { maps: { ...s.maps, [g]: next } }
    })
  },
}))

/** Non-reactive lookup (safe in event handlers). Reads localStorage as the source
 *  of truth so it is always current even before the store is hydrated. */
export function getLearnedRoute(game: string, id: number | null | undefined): string | null {
  if (id == null || !game) return null
  return load(game)[String(id)] ?? null
}

/** Reactive map for the given game (hydrates on first use). */
export function useLocationMap(game: string): GameMap {
  const g = (game || '').toLowerCase()
  const map = useLocationMapStore((s) => s.maps[g])
  const hydrate = useLocationMapStore((s) => s.hydrate)
  useEffect(() => { if (g && !map) hydrate(g) }, [g, map, hydrate])
  return map ?? {}
}
