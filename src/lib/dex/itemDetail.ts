/* eslint-disable @typescript-eslint/no-explicit-any */
// Lazy item detail (P2) — effect, flavour, buy/sell price and fling power. ONE GraphQL
// request per item, cached in IndexedDB. Item locations aren't reliably exposed by the
// API, so they're shown only when present (here: none) — no placeholder section.
import { cacheGet, cacheSet } from './dexCache'

export interface ItemDetail { effect: { de: string; en: string }; flavor: { de: string; en: string }; cost: number; fling: number | null; category: string }

const GQL = 'https://beta.pokeapi.co/graphql/v1beta'
const L = '(where: {language_id: {_in: [6, 9]}})'
const QUERY = `query I($id: Int!) {
  pokemon_v2_item_by_pk(id: $id) {
    cost fling_power
    pokemon_v2_itemcategory { name }
    pokemon_v2_itemeffecttexts${L} { short_effect effect language_id }
    pokemon_v2_itemflavortexts${L.replace('}}', '}}, distinct_on: language_id, order_by: [{language_id: asc}, {version_group_id: desc}]')} { flavor_text language_id }
  }
}`
const pick = (a: any[] = [], id: number, field: string) => (a.find((x) => x.language_id === id)?.[field] || '')
const clean = (t?: string) => (t || '').replace(/[\f\n\r­]/g, ' ').replace(/\s+/g, ' ').trim()

export async function getItemDetail(id: number): Promise<ItemDetail | null> {
  const ck = `item:v3:${id}`
  const cached = await cacheGet<ItemDetail>(ck)
  if (cached) return cached
  try {
    const r = await fetch(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: QUERY, variables: { id } }) })
    const j = await r.json()
    const it = j?.data?.pokemon_v2_item_by_pk
    if (!it) return null
    const eff = it.pokemon_v2_itemeffecttexts || []
    const fl = it.pokemon_v2_itemflavortexts || []
    const detail: ItemDetail = {
      effect: { de: clean(pick(eff, 6, 'short_effect') || pick(eff, 6, 'effect')), en: clean(pick(eff, 9, 'short_effect') || pick(eff, 9, 'effect')) },
      flavor: { de: clean(pick(fl, 6, 'flavor_text')), en: clean(pick(fl, 9, 'flavor_text')) },
      cost: it.cost ?? 0,
      fling: it.fling_power ?? null,
      category: it.pokemon_v2_itemcategory?.name || 'other',
    }
    await cacheSet(ck, detail)
    return detail
  } catch { return null }
}
