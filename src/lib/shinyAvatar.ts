// Shiny-Pokémon avatars. The chosen avatar is stored as a shiny sprite URL in the
// existing profiles.avatar_url column (no migration, backward compatible — a legacy
// custom URL still renders). The app's universe is Gen I–V (649), and official
// shiny sprites exist for all of them.

const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'
export const POKE_API = 'https://pokeapi.co/api/v2'
export const SHINY_MAX = 649

/** Official transparent shiny sprite for a Pokémon id. */
export function shinySpriteUrl(id: number): string {
  return `${SPRITE_BASE}/shiny/${id}.png`
}

/** A random shiny avatar URL — new users get one and can change it anytime. */
export function randomShinyUrl(): string {
  return shinySpriteUrl(1 + Math.floor(Math.random() * SHINY_MAX))
}

/** Recover the Pokémon id from a stored shiny avatar URL (…/shiny/{id}.png). */
export function avatarPokemonId(url: string | null | undefined): number | null {
  const m = /\/shiny\/(\d+)\.png/.exec(url ?? '')
  return m ? Number(m[1]) : null
}

/** Generations by id range — drives the gallery's generation filter. */
export const GENERATIONS = [
  { gen: 1, label: 'Gen I',   from: 1,   to: 151 },
  { gen: 2, label: 'Gen II',  from: 152, to: 251 },
  { gen: 3, label: 'Gen III', from: 252, to: 386 },
  { gen: 4, label: 'Gen IV',  from: 387, to: 493 },
  { gen: 5, label: 'Gen V',   from: 494, to: 649 },
] as const

export function generationOf(id: number): number {
  return GENERATIONS.find((g) => id >= g.from && id <= g.to)?.gen ?? 0
}

// ── Favorites (per device, no DB) ───────────────────────────────────────────
const FAV_KEY = 'soullink-shiny-favorites'
export function loadFavorites(): number[] {
  try { const a = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(a) ? a.filter((x) => typeof x === 'number') : [] }
  catch { return [] }
}
export function saveFavorites(ids: number[]) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
}
