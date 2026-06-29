// Generates src/data/abilities.json — compact, bilingual, offline AbilityDex index.
// fd = the German in-game flavour text (our primary plain-German explanation; PokéAPI
// has no German *effect* text, but the German flavour reads naturally). Run:
//   node scripts/gen-abilities.mjs
import { writeFileSync } from 'node:fs'
const GQL = 'https://beta.pokeapi.co/graphql/v1beta'
const Q = `{ pokemon_v2_ability(where: {is_main_series: {_eq: true}, id: {_lt: 10000}}, order_by: {id: asc}) {
  id
  pokemon_v2_abilitynames(where: {language_id: {_in: [6, 9]}}) { name language_id }
  pokemon_v2_abilityflavortexts(where: {language_id: {_eq: 6}}, distinct_on: language_id, order_by: [{language_id: asc}, {version_group_id: desc}]) { flavor_text }
} }`
const r = await fetch(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: Q }) })
const j = await r.json()
if (j.errors) { console.error(JSON.stringify(j.errors)); process.exit(1) }
const nm = (a, id) => (a.find((n) => n.language_id === id)?.name || '')
const clean = (t) => (t || '').replace(/[\f\n\r­]/g, ' ').replace(/\s+/g, ' ').trim()
const out = j.data.pokemon_v2_ability
  .map((a) => ({ id: a.id, de: nm(a.pokemon_v2_abilitynames, 6) || nm(a.pokemon_v2_abilitynames, 9), en: nm(a.pokemon_v2_abilitynames, 9) || nm(a.pokemon_v2_abilitynames, 6), fd: clean(a.pokemon_v2_abilityflavortexts[0]?.flavor_text) }))
  .filter((a) => a.en)
writeFileSync(new URL('../src/data/abilities.json', import.meta.url), JSON.stringify(out))
console.log('✓', out.length, 'abilities →', (JSON.stringify(out).length / 1024 | 0), 'KB')
