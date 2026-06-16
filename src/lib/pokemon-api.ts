const POKE_API = 'https://pokeapi.co/api/v2'
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'

export interface PokemonBasic {
  id: number
  name: string
  sprite: string
  types: string[]
}

export interface PokemonStats {
  hp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
}

export interface PokemonDetails extends PokemonBasic {
  stats: PokemonStats
  height: number  // decimetres
  weight: number  // hectograms
}

export interface EvolutionStage {
  id: number
  name: string
  trigger: string | null
  level: number | null
  item: string | null
  happiness: boolean
}

// Module-level caches
let listCache: { name: string; url: string }[] | null = null
const detailCache = new Map<string, PokemonBasic>()
const fullDetailCache = new Map<number, PokemonDetails>()
const evolutionCache = new Map<number, EvolutionStage[]>()
const movesCache = new Map<number, string[]>()

const GEN15_VERSION_GROUPS = new Set([
  'red-blue','yellow','gold-silver','crystal','ruby-sapphire','emerald',
  'firered-leafgreen','diamond-pearl','platinum','heartgold-soulsilver',
  'black-white','black-2-white-2',
])

async function getFullList(): Promise<{ name: string; url: string }[]> {
  if (listCache) return listCache
  const res = await fetch(`${POKE_API}/pokemon?limit=649&offset=0`)
  const data = await res.json()
  listCache = data.results as { name: string; url: string }[]
  return listCache
}

export async function searchPokemon(query: string): Promise<PokemonBasic[]> {
  if (!query || query.length < 2) return []
  try {
    const list = await getFullList()
    const q = query.toLowerCase().trim()
    const matches = list
      .filter((p) => p.name.startsWith(q) || p.name.includes(q))
      .slice(0, 12)
    const details = await Promise.all(matches.map((p) => fetchPokemon(p.name)))
    return details.filter(Boolean) as PokemonBasic[]
  } catch {
    return []
  }
}

export async function fetchPokemon(nameOrId: string | number): Promise<PokemonBasic | null> {
  const key = String(nameOrId)
  if (detailCache.has(key)) return detailCache.get(key)!
  try {
    const res = await fetch(`${POKE_API}/pokemon/${nameOrId}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.id > 649) return null
    const p: PokemonBasic = {
      id: data.id,
      name: data.name,
      sprite: data.sprites.front_default ?? getSpriteUrl(data.id),
      types: data.types.map((t: { type: { name: string } }) => t.type.name),
    }
    detailCache.set(key, p)
    detailCache.set(String(data.id), p)
    return p
  } catch {
    return null
  }
}

export async function fetchPokemonDetails(id: number): Promise<PokemonDetails | null> {
  if (fullDetailCache.has(id)) return fullDetailCache.get(id)!
  try {
    const res = await fetch(`${POKE_API}/pokemon/${id}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.id > 649) return null

    const statMap: Record<string, keyof PokemonStats> = {
      'hp': 'hp', 'attack': 'attack', 'defense': 'defense',
      'special-attack': 'specialAttack', 'special-defense': 'specialDefense', 'speed': 'speed',
    }
    const stats: PokemonStats = { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 }
    for (const s of data.stats) {
      const key = statMap[s.stat.name as string]
      if (key) stats[key] = s.base_stat as number
    }

    const details: PokemonDetails = {
      id: data.id,
      name: data.name,
      sprite: data.sprites.front_default ?? getSpriteUrl(data.id),
      types: data.types.map((t: { type: { name: string } }) => t.type.name),
      stats,
      height: data.height,
      weight: data.weight,
    }
    fullDetailCache.set(id, details)
    // Also populate basic cache
    detailCache.set(String(id), details)
    detailCache.set(data.name, details)
    return details
  } catch {
    return null
  }
}

export async function fetchEvolutionChain(pokemonId: number): Promise<EvolutionStage[]> {
  if (evolutionCache.has(pokemonId)) return evolutionCache.get(pokemonId)!
  try {
    const specRes = await fetch(`${POKE_API}/pokemon-species/${pokemonId}/`)
    if (!specRes.ok) return []
    const species = await specRes.json()
    const chainUrl = species.evolution_chain?.url as string | undefined
    if (!chainUrl) return []

    const chainRes = await fetch(chainUrl)
    if (!chainRes.ok) return []
    const chainData = await chainRes.json()

    const stages: EvolutionStage[] = []
    function parseNode(node: {
      species: { url: string; name: string }
      evolution_details: Array<{ trigger?: { name: string }; min_level?: number; item?: { name: string }; min_happiness?: number }>
      evolves_to: typeof node[]
    }) {
      const speciesUrl = node.species.url
      const id = parseInt(speciesUrl.split('/').filter(Boolean).pop() ?? '0')
      if (id > 0 && id <= 649) {
        const detail = node.evolution_details?.[0]
        stages.push({
          id,
          name: node.species.name,
          trigger: detail?.trigger?.name ?? null,
          level: detail?.min_level ?? null,
          item: detail?.item?.name ?? null,
          happiness: (detail?.min_happiness ?? 0) > 0,
        })
      }
      for (const next of node.evolves_to ?? []) parseNode(next)
    }
    parseNode(chainData.chain)

    // Cache for every stage in this chain so we don't re-fetch
    for (const stage of stages) evolutionCache.set(stage.id, stages)
    return stages
  } catch {
    return []
  }
}

export async function fetchPokemonMoves(id: number): Promise<string[]> {
  if (movesCache.has(id)) return movesCache.get(id)!
  try {
    const res = await fetch(`${POKE_API}/pokemon/${id}`)
    if (!res.ok) return []
    const data = await res.json() as {
      moves: Array<{
        move: { name: string }
        version_group_details: Array<{ version_group: { name: string } }>
      }>
    }
    const moves = data.moves
      .filter((m) => m.version_group_details.some((vgd) => GEN15_VERSION_GROUPS.has(vgd.version_group.name)))
      .map((m) => m.move.name)
      .sort()
    movesCache.set(id, moves)
    return moves
  } catch {
    return []
  }
}

export function formatMoveName(name: string): string {
  return name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export interface MoveDetail {
  name: string
  type: string
  damageClass: 'physical' | 'special' | 'status'
  power: number | null
  accuracy: number | null
}

const moveDetailCache = new Map<string, MoveDetail | null>()

/** Fetch a move's type / category / power / accuracy from PokéAPI.
 *  Accepts either a raw slug ("thunder-punch") or a display name ("Thunder Punch"). */
export async function fetchMoveDetails(moveName: string): Promise<MoveDetail | null> {
  const slug = moveName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (!slug) return null
  if (moveDetailCache.has(slug)) return moveDetailCache.get(slug)!
  try {
    const res = await fetch(`${POKE_API}/move/${slug}`)
    if (!res.ok) { moveDetailCache.set(slug, null); return null }
    const data = (await res.json()) as {
      type?: { name: string }
      damage_class?: { name: string }
      power: number | null
      accuracy: number | null
    }
    const dc = data.damage_class?.name
    const detail: MoveDetail = {
      name: slug,
      type: data.type?.name ?? 'normal',
      damageClass: dc === 'physical' || dc === 'special' ? dc : 'status',
      power: data.power ?? null,
      accuracy: data.accuracy ?? null,
    }
    moveDetailCache.set(slug, detail)
    return detail
  } catch {
    return null
  }
}

export function getSpriteUrl(pokemonId: number): string {
  return `${SPRITE_BASE}/${pokemonId}.png`
}

export function getOfficialArtUrl(pokemonId: number): string {
  return `${SPRITE_BASE}/other/official-artwork/${pokemonId}.png`
}

export function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    normal: '#9099A1', fire: '#FF9D55', water: '#4F91D7', electric: '#F4D23C',
    grass: '#63BD5F', ice: '#74CEC0', fighting: '#CE4069', poison: '#AB6AC8',
    ground: '#D97846', flying: '#89AAE3', psychic: '#F97176', bug: '#90C12C',
    rock: '#C5B78C', ghost: '#5269AC', dragon: '#0A6DC4', dark: '#5A5465',
    steel: '#5A8EA1', fairy: '#EC8FE6',
  }
  return colors[type] ?? '#68A090'
}

export const TYPE_NAMES_DE: Record<string, string> = {
  normal: 'Normal', fire: 'Feuer', water: 'Wasser', electric: 'Elektro',
  grass: 'Pflanze', ice: 'Eis', fighting: 'Kampf', poison: 'Gift',
  ground: 'Boden', flying: 'Flug', psychic: 'Psycho', bug: 'Käfer',
  rock: 'Gestein', ghost: 'Geist', dragon: 'Drache', dark: 'Unlicht',
  steel: 'Stahl', fairy: 'Fee',
}

export const EVOLUTION_TRIGGERS_DE: Record<string, string> = {
  'level-up': 'Level-up',
  'use-item': 'Item',
  'trade': 'Tausch',
  'shed': 'Mauserung',
}

export function getTypeGradient(types: string[]): string {
  if (types.length === 0) return '#2a2a3a'
  if (types.length === 1) return getTypeColor(types[0])
  return `linear-gradient(135deg, ${getTypeColor(types[0])} 0%, ${getTypeColor(types[1])} 100%)`
}
