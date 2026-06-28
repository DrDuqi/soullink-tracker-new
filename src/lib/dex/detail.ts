// SoulDex detail (P1b) — abilities (incl. hidden), egg groups, evolution line, level-up
// moves and the Pokédex text. ONE PokéAPI GraphQL request per Pokémon (bilingual), then
// cached in IndexedDB → offline on every later view.
import { cacheGet, cacheSet } from './dexCache'

export interface DexAbility { de: string; en: string; hidden: boolean }
export interface DexMove { level: number; de: string; en: string; type: string }
export interface DexEvo { id: number; de: string; en: string; from: number | null; level: number | null; trigger: string | null; item: string | null }
export interface DexDetail {
  abilities: DexAbility[]
  eggGroups: { de: string; en: string }[]
  flavor: { de: string; en: string }
  moves: DexMove[]
  evo: DexEvo[]
}

const GQL = 'https://beta.pokeapi.co/graphql/v1beta'
const QUERY = `query D($id: Int!) {
  pokemon_v2_pokemon_by_pk(id: $id) {
    pokemon_v2_pokemonabilities {
      is_hidden
      pokemon_v2_ability { pokemon_v2_abilitynames(where: {language_id: {_in: [6, 9]}}) { name language_id } }
    }
    pokemon_v2_pokemonmoves(where: {pokemon_v2_movelearnmethod: {name: {_eq: "level-up"}}}, distinct_on: move_id, order_by: [{move_id: asc}, {level: asc}]) {
      level
      pokemon_v2_move { pokemon_v2_type { name } pokemon_v2_movenames(where: {language_id: {_in: [6, 9]}}) { name language_id } }
    }
    pokemon_v2_pokemonspecy {
      pokemon_v2_pokemonegggroups { pokemon_v2_egggroup { pokemon_v2_egggroupnames(where: {language_id: {_in: [6, 9]}}) { name language_id } } }
      pokemon_v2_pokemonspeciesflavortexts(where: {language_id: {_in: [6, 9]}}, distinct_on: language_id, order_by: [{language_id: asc}, {version_id: desc}]) { flavor_text language_id }
      pokemon_v2_evolutionchain {
        pokemon_v2_pokemonspecies(order_by: {id: asc}) {
          id evolves_from_species_id
          pokemon_v2_pokemonspeciesnames(where: {language_id: {_in: [6, 9]}}) { name language_id }
          pokemon_v2_pokemonevolutions { min_level pokemon_v2_evolutiontrigger { name } pokemon_v2_item { name } }
        }
      }
    }
  }
}`

type Named = { name: string; language_id: number }
const nm = (a: Named[] = []) => ({ de: a.find((n) => n.language_id === 6)?.name || a.find((n) => n.language_id === 9)?.name || '', en: a.find((n) => n.language_id === 9)?.name || a.find((n) => n.language_id === 6)?.name || '' })
const clean = (t?: string) => (t || '').replace(/[\f\n\r­]/g, ' ').replace(/\s+/g, ' ').trim()

export async function getDexDetail(id: number): Promise<DexDetail | null> {
  const ck = `detail:${id}`
  const cached = await cacheGet<DexDetail>(ck)
  if (cached) return cached
  try {
    const r = await fetch(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: QUERY, variables: { id } }) })
    const j = await r.json()
    const p = j?.data?.pokemon_v2_pokemon_by_pk
    if (!p) return null
    const spec = p.pokemon_v2_pokemonspecy
    const ft = spec?.pokemon_v2_pokemonspeciesflavortexts || []
    const detail: DexDetail = {
      abilities: (p.pokemon_v2_pokemonabilities || []).map((a: { is_hidden: boolean; pokemon_v2_ability: { pokemon_v2_abilitynames: Named[] } }) => ({ ...nm(a.pokemon_v2_ability?.pokemon_v2_abilitynames), hidden: a.is_hidden })),
      eggGroups: (spec?.pokemon_v2_pokemonegggroups || []).map((g: { pokemon_v2_egggroup: { pokemon_v2_egggroupnames: Named[] } }) => nm(g.pokemon_v2_egggroup?.pokemon_v2_egggroupnames)),
      flavor: { de: clean(ft.find((x: { language_id: number }) => x.language_id === 6)?.flavor_text), en: clean(ft.find((x: { language_id: number }) => x.language_id === 9)?.flavor_text) },
      moves: (p.pokemon_v2_pokemonmoves || []).map((m: { level: number; pokemon_v2_move: { pokemon_v2_type: { name: string }; pokemon_v2_movenames: Named[] } }) => ({ level: m.level, ...nm(m.pokemon_v2_move?.pokemon_v2_movenames), type: m.pokemon_v2_move?.pokemon_v2_type?.name || 'normal' })).sort((a: DexMove, b: DexMove) => a.level - b.level || a.en.localeCompare(b.en)),
      evo: (spec?.pokemon_v2_evolutionchain?.pokemon_v2_pokemonspecies || []).map((s: { id: number; evolves_from_species_id: number | null; pokemon_v2_pokemonspeciesnames: Named[]; pokemon_v2_pokemonevolutions: { min_level: number | null; pokemon_v2_evolutiontrigger?: { name: string }; pokemon_v2_item?: { name: string } }[] }) => {
        const ev = s.pokemon_v2_pokemonevolutions?.[0]
        return { id: s.id, ...nm(s.pokemon_v2_pokemonspeciesnames), from: s.evolves_from_species_id, level: ev?.min_level ?? null, trigger: ev?.pokemon_v2_evolutiontrigger?.name ?? null, item: ev?.pokemon_v2_item?.name ?? null }
      }),
    }
    await cacheSet(ck, detail)
    return detail
  } catch { return null }
}
