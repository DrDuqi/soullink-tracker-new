// Type effectiveness — the canonical Gen 6+ chart, bundled (no fetch, fully offline).
// Drives Pokémon weaknesses/resistances and the Types matrix page.
import { ALL_TYPES } from './dex'

// attacker → defenders it hits for ×2 / ×0.5 / ×0. Everything else is ×1.
const REL: Record<string, { d2: string[]; h: string[]; z: string[] }> = {
  normal: { d2: [], h: ['rock', 'steel'], z: ['ghost'] },
  fire: { d2: ['grass', 'ice', 'bug', 'steel'], h: ['fire', 'water', 'rock', 'dragon'], z: [] },
  water: { d2: ['fire', 'ground', 'rock'], h: ['water', 'grass', 'dragon'], z: [] },
  electric: { d2: ['water', 'flying'], h: ['electric', 'grass', 'dragon'], z: ['ground'] },
  grass: { d2: ['water', 'ground', 'rock'], h: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'], z: [] },
  ice: { d2: ['grass', 'ground', 'flying', 'dragon'], h: ['fire', 'water', 'ice', 'steel'], z: [] },
  fighting: { d2: ['normal', 'ice', 'rock', 'dark', 'steel'], h: ['poison', 'flying', 'psychic', 'bug', 'fairy'], z: ['ghost'] },
  poison: { d2: ['grass', 'fairy'], h: ['poison', 'ground', 'rock', 'ghost'], z: ['steel'] },
  ground: { d2: ['fire', 'electric', 'poison', 'rock', 'steel'], h: ['grass', 'bug'], z: ['flying'] },
  flying: { d2: ['grass', 'fighting', 'bug'], h: ['electric', 'rock', 'steel'], z: [] },
  psychic: { d2: ['fighting', 'poison'], h: ['psychic', 'steel'], z: ['dark'] },
  bug: { d2: ['grass', 'psychic', 'dark'], h: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'], z: [] },
  rock: { d2: ['fire', 'ice', 'flying', 'bug'], h: ['fighting', 'ground', 'steel'], z: [] },
  ghost: { d2: ['psychic', 'ghost'], h: ['dark'], z: ['normal'] },
  dragon: { d2: ['dragon'], h: ['steel'], z: ['fairy'] },
  dark: { d2: ['psychic', 'ghost'], h: ['fighting', 'dark', 'fairy'], z: [] },
  steel: { d2: ['ice', 'rock', 'fairy'], h: ['fire', 'water', 'electric', 'steel'], z: [] },
  fairy: { d2: ['fighting', 'dragon', 'dark'], h: ['fire', 'poison', 'steel'], z: [] },
}

/** Multiplier of an attacking type vs a single defending type. */
export function mult(atk: string, def: string): number {
  const r = REL[atk]
  if (!r) return 1
  if (r.d2.includes(def)) return 2
  if (r.h.includes(def)) return 0.5
  if (r.z.includes(def)) return 0
  return 1
}

/** Defensive matchup of a (1- or 2-type) Pokémon → { attackingType: combinedMultiplier }. */
export function defenseMatchup(defTypes: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const atk of ALL_TYPES) out[atk] = defTypes.reduce((m, d) => m * mult(atk, d), 1)
  return out
}

/** Group a matchup map into the buckets we render. */
export function groupMatchup(m: Record<string, number>) {
  const b: Record<string, string[]> = { '4': [], '2': [], '0.5': [], '0.25': [], '0': [] }
  for (const [t, v] of Object.entries(m)) {
    if (v === 4) b['4'].push(t)
    else if (v === 2) b['2'].push(t)
    else if (v === 0.5) b['0.5'].push(t)
    else if (v === 0.25) b['0.25'].push(t)
    else if (v === 0) b['0'].push(t)
  }
  return b
}
