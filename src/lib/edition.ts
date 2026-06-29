// Central edition registry — the SINGLE source of truth for "which game is this run".
// Every edition-scoped feature (routes/encounters now; SoulDex locations, trainers,
// gyms, story, legends, items, NPCs later) must resolve the run's edition through
// `resolveEdition()` so nothing ever mixes data from another game. The run stores its
// edition in several shapes over time — a German label ("Platin"), a display string
// ("Pokémon Platin"), or an emulator code ("platinum") — and this resolver normalises
// all of them to one canonical EditionKey.

export type EditionKey =
  | 'Rot' | 'Blau' | 'Gelb'
  | 'Gold' | 'Silber' | 'Kristall'
  | 'Rubin' | 'Saphir' | 'Smaragd'
  | 'Feuerrot' | 'Blattgrün'
  | 'Diamant' | 'Perl' | 'Platin'
  | 'HeartGold' | 'SoulSilver'
  | 'Schwarz' | 'Weiß' | 'Schwarz 2' | 'Weiß 2'
  | 'PokéMMO'

export type Region = 'kanto' | 'johto' | 'hoenn' | 'sinnoh' | 'unova' | 'multi'

export interface Edition { key: EditionKey; region: Region; gen: number; emuCodes: string[] }

export const EDITIONS: Record<EditionKey, Edition> = {
  Rot: { key: 'Rot', region: 'kanto', gen: 1, emuCodes: ['red'] },
  Blau: { key: 'Blau', region: 'kanto', gen: 1, emuCodes: ['blue'] },
  Gelb: { key: 'Gelb', region: 'kanto', gen: 1, emuCodes: ['yellow'] },
  Gold: { key: 'Gold', region: 'johto', gen: 2, emuCodes: ['gold'] },
  Silber: { key: 'Silber', region: 'johto', gen: 2, emuCodes: ['silver'] },
  Kristall: { key: 'Kristall', region: 'johto', gen: 2, emuCodes: ['crystal'] },
  Rubin: { key: 'Rubin', region: 'hoenn', gen: 3, emuCodes: ['ruby'] },
  Saphir: { key: 'Saphir', region: 'hoenn', gen: 3, emuCodes: ['sapphire'] },
  Smaragd: { key: 'Smaragd', region: 'hoenn', gen: 3, emuCodes: ['emerald'] },
  Feuerrot: { key: 'Feuerrot', region: 'kanto', gen: 3, emuCodes: ['firered'] },
  Blattgrün: { key: 'Blattgrün', region: 'kanto', gen: 3, emuCodes: ['leafgreen'] },
  Diamant: { key: 'Diamant', region: 'sinnoh', gen: 4, emuCodes: ['diamond'] },
  Perl: { key: 'Perl', region: 'sinnoh', gen: 4, emuCodes: ['pearl'] },
  Platin: { key: 'Platin', region: 'sinnoh', gen: 4, emuCodes: ['platinum'] },
  HeartGold: { key: 'HeartGold', region: 'johto', gen: 4, emuCodes: ['heartgold'] },
  SoulSilver: { key: 'SoulSilver', region: 'johto', gen: 4, emuCodes: ['soulsilver'] },
  Schwarz: { key: 'Schwarz', region: 'unova', gen: 5, emuCodes: ['black'] },
  Weiß: { key: 'Weiß', region: 'unova', gen: 5, emuCodes: ['white'] },
  'Schwarz 2': { key: 'Schwarz 2', region: 'unova', gen: 5, emuCodes: ['black2'] },
  'Weiß 2': { key: 'Weiß 2', region: 'unova', gen: 5, emuCodes: ['white2'] },
  PokéMMO: { key: 'PokéMMO', region: 'multi', gen: 0, emuCodes: [] },
}

const KEYS = Object.keys(EDITIONS) as EditionKey[]
const norm = (s: string) => s.normalize('NFC').replace(/^pok[eé]mon\s+/i, '').trim().toLowerCase()
const code = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')

/** Normalise any game identifier (label · "Pokémon X" · emulator code) → EditionKey. */
export function resolveEdition(game: string | null | undefined): EditionKey | null {
  if (!game) return null
  const raw = String(game)
  if ((raw as EditionKey) in EDITIONS) return raw as EditionKey
  const label = norm(raw)
  const c = code(raw)
  for (const k of KEYS) {
    if (k.toLowerCase() === label) return k
    if (EDITIONS[k].emuCodes.includes(label) || EDITIONS[k].emuCodes.includes(c)) return k
  }
  return null
}

export const editionRegion = (game: string | null | undefined): Region | null => { const k = resolveEdition(game); return k ? EDITIONS[k].region : null }
export const editionGen = (game: string | null | undefined): number | null => { const k = resolveEdition(game); return k ? EDITIONS[k].gen : null }

/** Emulator code → canonical edition label (or null). */
export const emulatorGameLabel = (emuGame: string | null | undefined): EditionKey | null => resolveEdition(emuGame)

/** True only when we are SURE the emulator game is a DIFFERENT edition than the run.
 *  Unknown codes and PokéMMO (multi-region) never count; paired editions differ. */
export function isGameMismatch(runGame: string | null | undefined, emuGame: string | null | undefined): boolean {
  const r = resolveEdition(runGame), e = resolveEdition(emuGame)
  if (!r || !e) return false
  if (r === 'PokéMMO' || e === 'PokéMMO') return false
  return r !== e
}
