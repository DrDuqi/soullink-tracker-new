/* eslint-disable @typescript-eslint/no-explicit-any */
// Lazy move detail (P2) — effect text, flavour and the list of Pokémon that learn it.
// ONE GraphQL request per move, cached in IndexedDB. Learner ids resolve to names/sprites
// from the bundled dex (instant, offline, cross-linkable).
import { cacheGet, cacheSet } from './dexCache'
import { bucketMethod, type LearnMethod } from './learn'

export interface MoveLearner { id: number; method: LearnMethod; level: number }
export interface MoveDetail { effect: { de: string; en: string }; flavor: { de: string; en: string }; learners: MoveLearner[] }

const GQL = 'https://beta.pokeapi.co/graphql/v1beta'
const L = '(where: {language_id: {_in: [6, 9]}})'
const QUERY = `query M($id: Int!) {
  pokemon_v2_move_by_pk(id: $id) {
    pokemon_v2_moveeffect { pokemon_v2_moveeffecteffecttexts${L} { short_effect language_id } }
    pokemon_v2_moveflavortexts${L.replace('}}', '}}, distinct_on: language_id, order_by: [{language_id: asc}, {version_group_id: desc}]')} { flavor_text language_id }
    pokemon_v2_pokemonmoves(distinct_on: [pokemon_id, move_learn_method_id], order_by: [{pokemon_id: asc}, {move_learn_method_id: asc}, {level: asc}]) { pokemon_id level pokemon_v2_movelearnmethod { name } }
  }
}`
const pick = (a: any[] = [], id: number, field: string) => (a.find((x) => x.language_id === id)?.[field] || '')
const clean = (t?: string) => (t || '').replace(/[\f\n\r­]/g, ' ').replace(/\s+/g, ' ').replace(/\$effect_chance/g, '?').trim()

export async function getMoveDetail(id: number): Promise<MoveDetail | null> {
  const ck = `move:v2:${id}`
  const cached = await cacheGet<MoveDetail>(ck)
  if (cached) return cached
  try {
    const r = await fetch(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: QUERY, variables: { id } }) })
    const j = await r.json()
    const m = j?.data?.pokemon_v2_move_by_pk
    if (!m) return null
    const eff = m.pokemon_v2_moveeffect?.pokemon_v2_moveeffecteffecttexts || []
    const fl = m.pokemon_v2_moveflavortexts || []
    const detail: MoveDetail = {
      effect: { de: clean(pick(eff, 6, 'short_effect')), en: clean(pick(eff, 9, 'short_effect')) },
      flavor: { de: clean(pick(fl, 6, 'flavor_text')), en: clean(pick(fl, 9, 'flavor_text')) },
      learners: (m.pokemon_v2_pokemonmoves || []).map((p: any) => { const method = bucketMethod(p.pokemon_v2_movelearnmethod?.name || ''); return method && p.pokemon_id > 0 && p.pokemon_id < 10000 ? { id: p.pokemon_id, method, level: p.level || 0 } : null }).filter(Boolean),
    }
    await cacheSet(ck, detail)
    return detail
  } catch { return null }
}
