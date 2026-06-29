// Generates src/data/items.json — a compact, bilingual, offline item index for the
// SoulDex items browser (list + search + filter). Run: node scripts/gen-items.mjs
import { writeFileSync } from 'node:fs'
const GQL = 'https://beta.pokeapi.co/graphql/v1beta'
const Q = `query($limit:Int!,$offset:Int!){ pokemon_v2_item(order_by:{id:asc}, limit:$limit, offset:$offset){ id name cost pokemon_v2_itemcategory{name pokemon_v2_itempocket{name}} pokemon_v2_itemnames(where:{language_id:{_in:[6,9]}}){name language_id} } }`
async function page(offset) {
  const r = await fetch(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: Q, variables: { limit: 1000, offset } }) })
  const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors)); return j.data.pokemon_v2_item
}
const nm = (a, id) => (a.find((n) => n.language_id === id)?.name || '')
const all = []
for (let o = 0; ; o += 1000) { const rows = await page(o); all.push(...rows); if (rows.length < 1000) break }
const out = all.map((it) => ({ id: it.id, n: it.name, de: nm(it.pokemon_v2_itemnames, 6) || nm(it.pokemon_v2_itemnames, 9), en: nm(it.pokemon_v2_itemnames, 9) || nm(it.pokemon_v2_itemnames, 6), c: it.pokemon_v2_itemcategory?.name || 'other', p: it.pokemon_v2_itemcategory?.pokemon_v2_itempocket?.name || 'misc', cost: it.cost ?? 0 }))
writeFileSync(new URL('../src/data/items.json', import.meta.url), JSON.stringify(out))
console.log('✓', out.length, 'items →', (JSON.stringify(out).length / 1024 | 0), 'KB')
