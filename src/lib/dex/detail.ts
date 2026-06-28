/* eslint-disable @typescript-eslint/no-explicit-any */
// SoulDex detail (P1) — abilities (incl. hidden), egg groups, evolution line, level-up
// moves, Pokédex text, species meta (size/weight/capture/gender/…) and per-edition
// encounter locations. ONE PokéAPI GraphQL request per Pokémon (bilingual), cached in
// IndexedDB → fully offline on every later view.
import { cacheGet, cacheSet } from './dexCache'
import { bucketMethod, type LearnMethod } from './learn'

export interface DexAbility { de: string; en: string; hidden: boolean; effectDe: string; effectEn: string }
export interface DexMove { id: number; level: number; de: string; en: string; type: string; method: LearnMethod }
export interface DexEvo { id: number; de: string; en: string; from: number | null; level: number | null; trigger: string | null; item: string | null; happiness: number | null; time: string | null }
export interface DexEncounter { version: { de: string; en: string }; location: { de: string; en: string }; min: number; max: number; chance: number }
export interface DexMeta { height: number; weight: number; baseExp: number; captureRate: number; baseHappiness: number; genderRate: number; hatchCounter: number; growth: string; legendary: boolean; mythical: boolean; baby: boolean }
export interface DexDetail {
  abilities: DexAbility[]
  eggGroups: { de: string; en: string }[]
  flavor: { de: string; en: string }
  moves: DexMove[]
  evo: DexEvo[]
  meta: DexMeta | null
  encounters: DexEncounter[]
}

const GQL = 'https://beta.pokeapi.co/graphql/v1beta'
const L = '(where: {language_id: {_in: [6, 9]}})'
const QUERY = `query D($id: Int!) {
  pokemon_v2_pokemon_by_pk(id: $id) {
    height weight base_experience
    pokemon_v2_pokemonabilities { is_hidden pokemon_v2_ability { pokemon_v2_abilitynames${L} { name language_id } pokemon_v2_abilityeffecttexts${L} { short_effect language_id } } }
    pokemon_v2_pokemonmoves(distinct_on: [move_id, move_learn_method_id], order_by: [{move_id: asc}, {move_learn_method_id: asc}, {level: asc}]) {
      level move_id pokemon_v2_movelearnmethod { name } pokemon_v2_move { pokemon_v2_type { name } pokemon_v2_movenames${L} { name language_id } }
    }
    pokemon_v2_encounters {
      min_level max_level
      pokemon_v2_version { pokemon_v2_versionnames${L} { name language_id } }
      pokemon_v2_locationarea { pokemon_v2_location { pokemon_v2_locationnames${L} { name language_id } } }
      pokemon_v2_encounterslot { rarity }
    }
    pokemon_v2_pokemonspecy {
      capture_rate base_happiness gender_rate hatch_counter is_legendary is_mythical is_baby
      pokemon_v2_growthrate { name }
      pokemon_v2_pokemonegggroups { pokemon_v2_egggroup { pokemon_v2_egggroupnames${L} { name language_id } } }
      pokemon_v2_pokemonspeciesflavortexts${L.replace('}}', '}}, distinct_on: language_id, order_by: [{language_id: asc}, {version_id: desc}]')} { flavor_text language_id }
      pokemon_v2_evolutionchain {
        pokemon_v2_pokemonspecies(order_by: {id: asc}) {
          id evolves_from_species_id
          pokemon_v2_pokemonspeciesnames${L} { name language_id }
          pokemon_v2_pokemonevolutions { min_level min_happiness time_of_day pokemon_v2_evolutiontrigger { name } pokemon_v2_item { pokemon_v2_itemnames${L} { name language_id } } }
        }
      }
    }
  }
}`

type Named = { name: string; language_id: number }
const nm = (a: Named[] = []) => ({ de: a.find((n) => n.language_id === 6)?.name || a.find((n) => n.language_id === 9)?.name || '', en: a.find((n) => n.language_id === 9)?.name || a.find((n) => n.language_id === 6)?.name || '' })
const clean = (t?: string) => (t || '').replace(/[\f\n\r­]/g, ' ').replace(/\s+/g, ' ').trim()

export async function getDexDetail(id: number): Promise<DexDetail | null> {
  const ck = `detail:v4:${id}`
  const cached = await cacheGet<DexDetail>(ck)
  if (cached) return cached
  try {
    const r = await fetch(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: QUERY, variables: { id } }) })
    const j = await r.json()
    const p = j?.data?.pokemon_v2_pokemon_by_pk
    if (!p) return null
    const spec = p.pokemon_v2_pokemonspecy
    const ft = spec?.pokemon_v2_pokemonspeciesflavortexts || []

    // Encounters → aggregate per (edition, location): widen level range, sum rarity.
    const encMap = new Map<string, DexEncounter>()
    for (const e of (p.pokemon_v2_encounters || [])) {
      const version = nm(e.pokemon_v2_version?.pokemon_v2_versionnames)
      const location = nm(e.pokemon_v2_locationarea?.pokemon_v2_location?.pokemon_v2_locationnames)
      if (!version.en && !location.en) continue
      const key = `${version.en}|${location.en}`
      const cur = encMap.get(key) || { version, location, min: e.min_level, max: e.max_level, chance: 0 }
      cur.min = Math.min(cur.min, e.min_level); cur.max = Math.max(cur.max, e.max_level)
      cur.chance = Math.min(100, cur.chance + (e.pokemon_v2_encounterslot?.rarity || 0))
      encMap.set(key, cur)
    }

    const detail: DexDetail = {
      abilities: (p.pokemon_v2_pokemonabilities || []).map((a: any) => {
        const ef = a.pokemon_v2_ability?.pokemon_v2_abilityeffecttexts || []
        return { ...nm(a.pokemon_v2_ability?.pokemon_v2_abilitynames), hidden: a.is_hidden, effectDe: clean(ef.find((x: any) => x.language_id === 6)?.short_effect), effectEn: clean(ef.find((x: any) => x.language_id === 9)?.short_effect) }
      }),
      eggGroups: (spec?.pokemon_v2_pokemonegggroups || []).map((g: any) => nm(g.pokemon_v2_egggroup?.pokemon_v2_egggroupnames)),
      flavor: { de: clean(ft.find((x: any) => x.language_id === 6)?.flavor_text), en: clean(ft.find((x: any) => x.language_id === 9)?.flavor_text) },
      moves: (p.pokemon_v2_pokemonmoves || []).map((m: any) => { const method = bucketMethod(m.pokemon_v2_movelearnmethod?.name || ''); return method ? { id: m.move_id, level: m.level, ...nm(m.pokemon_v2_move?.pokemon_v2_movenames), type: m.pokemon_v2_move?.pokemon_v2_type?.name || 'normal', method } : null }).filter(Boolean).sort((a: DexMove, b: DexMove) => a.level - b.level || a.en.localeCompare(b.en)),
      evo: (spec?.pokemon_v2_evolutionchain?.pokemon_v2_pokemonspecies || []).map((s: any) => {
        const ev = s.pokemon_v2_pokemonevolutions?.[0]
        const item = ev?.pokemon_v2_item ? nm(ev.pokemon_v2_item.pokemon_v2_itemnames) : null
        return { id: s.id, ...nm(s.pokemon_v2_pokemonspeciesnames), from: s.evolves_from_species_id, level: ev?.min_level ?? null, trigger: ev?.pokemon_v2_evolutiontrigger?.name ?? null, item: item ? (item.de || item.en) : null, happiness: ev?.min_happiness ?? null, time: ev?.time_of_day || null }
      }),
      meta: spec ? { height: (p.height || 0) / 10, weight: (p.weight || 0) / 10, baseExp: p.base_experience || 0, captureRate: spec.capture_rate ?? 0, baseHappiness: spec.base_happiness ?? 0, genderRate: spec.gender_rate ?? -1, hatchCounter: spec.hatch_counter ?? 0, growth: spec.pokemon_v2_growthrate?.name || '', legendary: !!spec.is_legendary, mythical: !!spec.is_mythical, baby: !!spec.is_baby } : null,
      encounters: [...encMap.values()].sort((a, b) => a.version.en.localeCompare(b.version.en) || b.chance - a.chance),
    }
    await cacheSet(ck, detail)
    return detail
  } catch { return null }
}
