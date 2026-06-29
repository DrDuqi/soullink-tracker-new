/* eslint-disable @typescript-eslint/no-explicit-any */
// Lazy ability detail — precise mechanic (English short/long effect), bilingual flavour,
// and the full holder list (incl. hidden flag). ONE GraphQL request per ability, cached
// in IndexedDB. Holder ids resolve to names/sprites from the bundled dex (cross-linkable).
import { cacheGet, cacheSet } from './dexCache'

export interface AbilityHolder { id: number; hidden: boolean }
export interface AbilityDetail { effect: { de: string; en: string }; flavor: { de: string; en: string }; holders: AbilityHolder[] }

const GQL = 'https://beta.pokeapi.co/graphql/v1beta'
const L = '(where: {language_id: {_in: [6, 9]}})'
const QUERY = `query A($id: Int!) {
  pokemon_v2_ability_by_pk(id: $id) {
    pokemon_v2_abilityeffecttexts${L} { short_effect effect language_id }
    pokemon_v2_abilityflavortexts${L.replace('}}', '}}, distinct_on: language_id, order_by: [{language_id: asc}, {version_group_id: desc}]')} { flavor_text language_id }
    pokemon_v2_pokemonabilities(order_by: {pokemon_id: asc}) { pokemon_id is_hidden }
  }
}`
const pick = (a: any[] = [], id: number, f: string) => (a.find((x) => x.language_id === id)?.[f] || '')
const clean = (t?: string) => (t || '').replace(/[\f\n\r­]/g, ' ').replace(/\s+/g, ' ').trim()

export async function getAbilityDetail(id: number): Promise<AbilityDetail | null> {
  const ck = `ability:${id}`
  const cached = await cacheGet<AbilityDetail>(ck)
  if (cached) return cached
  try {
    const r = await fetch(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: QUERY, variables: { id } }) })
    const j = await r.json()
    const a = j?.data?.pokemon_v2_ability_by_pk
    if (!a) return null
    const ef = a.pokemon_v2_abilityeffecttexts || []
    const fl = a.pokemon_v2_abilityflavortexts || []
    // Dedupe by pokemon; a Pokémon listing the ability as a normal slot wins over hidden.
    const map = new Map<number, boolean>()
    for (const p of (a.pokemon_v2_pokemonabilities || [])) {
      if (p.pokemon_id <= 0 || p.pokemon_id >= 10000) continue
      const prev = map.get(p.pokemon_id)
      map.set(p.pokemon_id, prev === false ? false : !!p.is_hidden)
    }
    const detail: AbilityDetail = {
      effect: { de: clean(pick(ef, 6, 'short_effect') || pick(ef, 6, 'effect')), en: clean(pick(ef, 9, 'short_effect') || pick(ef, 9, 'effect')) },
      flavor: { de: clean(pick(fl, 6, 'flavor_text')), en: clean(pick(fl, 9, 'flavor_text')) },
      holders: [...map.entries()].map(([id2, hidden]) => ({ id: id2, hidden })),
    }
    await cacheSet(ck, detail)
    return detail
  } catch { return null }
}
