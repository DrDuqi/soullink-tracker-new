// Generates src/data/moves.json — a compact, bilingual, offline move index for the
// SoulDex moves browser (list + search + filter). Run: node scripts/gen-moves.mjs
import { writeFileSync } from 'node:fs'
const GQL = 'https://beta.pokeapi.co/graphql/v1beta'
const Q = `query($limit:Int!,$offset:Int!){ pokemon_v2_move(where:{id:{_lt:10000}}, order_by:{id:asc}, limit:$limit, offset:$offset){ id power accuracy pp priority pokemon_v2_movedamageclass{name} pokemon_v2_type{name} pokemon_v2_movenames(where:{language_id:{_in:[6,9]}}){name language_id} } }`
async function page(offset) {
  const r = await fetch(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: Q, variables: { limit: 1000, offset } }) })
  const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors)); return j.data.pokemon_v2_move
}
const nm = (a, id) => (a.find((n) => n.language_id === id)?.name || '')
const all = []
for (let o = 0; ; o += 1000) { const rows = await page(o); all.push(...rows); if (rows.length < 1000) break }
const out = all.map((m) => ({ id: m.id, de: nm(m.pokemon_v2_movenames, 6) || nm(m.pokemon_v2_movenames, 9), en: nm(m.pokemon_v2_movenames, 9) || nm(m.pokemon_v2_movenames, 6), t: m.pokemon_v2_type?.name || 'normal', c: m.pokemon_v2_movedamageclass?.name || 'status', pow: m.power ?? null, acc: m.accuracy ?? null, pp: m.pp ?? null, pri: m.priority ?? 0 }))
writeFileSync(new URL('../src/data/moves.json', import.meta.url), JSON.stringify(out))
console.log('✓', out.length, 'moves →', (JSON.stringify(out).length / 1024 | 0), 'KB')
