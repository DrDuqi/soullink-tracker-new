// SoulDex build pipeline (P0) — generates the bundled core Pokédex index from PokéAPI
// GraphQL in ONE query. Run with `node scripts/gen-dex.mjs`; commits a compact JSON that
// ships with the app for instant, OFFLINE browse + search. Heavy detail (moves, evos,
// dex text, shiny) is fetched lazily at runtime via lib/pokemon-api.ts and cached.
//
// Compact shape per entry: { id, de, en, t:[types], s:[hp,atk,def,spa,spd,spe], g:gen }.
// Names are bilingual from day one (language_id 6 = German, 9 = English).

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'src', 'data', 'pokedex.json')
const GQL = 'https://beta.pokeapi.co/graphql/v1beta'

const query = `query Dex {
  pokemon_v2_pokemon(where: {is_default: {_eq: true}}, order_by: {id: asc}) {
    id
    pokemon_v2_pokemontypes(order_by: {slot: asc}) { pokemon_v2_type { name } }
    pokemon_v2_pokemonstats(order_by: {stat_id: asc}) { base_stat }
    pokemon_v2_pokemonspecy {
      generation_id
      pokemon_v2_pokemonspeciesnames(where: {language_id: {_in: [6, 9]}}) { name language_id }
    }
  }
}`

const res = await fetch(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
if (!res.ok) { console.error('GraphQL HTTP', res.status); process.exit(1) }
const json = await res.json()
if (json.errors) { console.error('GraphQL errors:', JSON.stringify(json.errors).slice(0, 500)); process.exit(1) }

const rows = json.data.pokemon_v2_pokemon
const out = rows
  .filter((p) => p.id < 10000)   // default national-dex entries only (skip alt-form ids)
  .map((p) => {
    const names = p.pokemon_v2_pokemonspecy?.pokemon_v2_pokemonspeciesnames || []
    const de = names.find((n) => n.language_id === 6)?.name
    const en = names.find((n) => n.language_id === 9)?.name
    return {
      id: p.id,
      de: de || en || `#${p.id}`,
      en: en || de || `#${p.id}`,
      t: p.pokemon_v2_pokemontypes.map((x) => x.pokemon_v2_type.name),
      s: p.pokemon_v2_pokemonstats.map((x) => x.base_stat),
      g: p.pokemon_v2_pokemonspecy?.generation_id || 0,
    }
  })

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(out))
console.log(`✓ ${out.length} Pokémon → ${OUT} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`)
console.log('   first:', JSON.stringify(out[0]))
console.log('   last :', JSON.stringify(out[out.length - 1]))
