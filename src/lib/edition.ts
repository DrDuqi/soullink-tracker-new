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
export type RomPlatform = 'gb' | 'gbc' | 'gba' | 'nds'

export interface Edition { key: EditionKey; region: Region; gen: number; emuCodes: string[]; platform: RomPlatform; romExt: string[] }

export const EDITIONS: Record<EditionKey, Edition> = {
  Rot: { key: 'Rot', region: 'kanto', gen: 1, emuCodes: ['red'], platform: 'gb', romExt: ['.gb'] },
  Blau: { key: 'Blau', region: 'kanto', gen: 1, emuCodes: ['blue'], platform: 'gb', romExt: ['.gb'] },
  Gelb: { key: 'Gelb', region: 'kanto', gen: 1, emuCodes: ['yellow'], platform: 'gb', romExt: ['.gb'] },
  Gold: { key: 'Gold', region: 'johto', gen: 2, emuCodes: ['gold'], platform: 'gbc', romExt: ['.gbc'] },
  Silber: { key: 'Silber', region: 'johto', gen: 2, emuCodes: ['silver'], platform: 'gbc', romExt: ['.gbc'] },
  Kristall: { key: 'Kristall', region: 'johto', gen: 2, emuCodes: ['crystal'], platform: 'gbc', romExt: ['.gbc'] },
  Rubin: { key: 'Rubin', region: 'hoenn', gen: 3, emuCodes: ['ruby'], platform: 'gba', romExt: ['.gba'] },
  Saphir: { key: 'Saphir', region: 'hoenn', gen: 3, emuCodes: ['sapphire'], platform: 'gba', romExt: ['.gba'] },
  Smaragd: { key: 'Smaragd', region: 'hoenn', gen: 3, emuCodes: ['emerald'], platform: 'gba', romExt: ['.gba'] },
  Feuerrot: { key: 'Feuerrot', region: 'kanto', gen: 3, emuCodes: ['firered'], platform: 'gba', romExt: ['.gba'] },
  Blattgrün: { key: 'Blattgrün', region: 'kanto', gen: 3, emuCodes: ['leafgreen'], platform: 'gba', romExt: ['.gba'] },
  Diamant: { key: 'Diamant', region: 'sinnoh', gen: 4, emuCodes: ['diamond'], platform: 'nds', romExt: ['.nds'] },
  Perl: { key: 'Perl', region: 'sinnoh', gen: 4, emuCodes: ['pearl'], platform: 'nds', romExt: ['.nds'] },
  Platin: { key: 'Platin', region: 'sinnoh', gen: 4, emuCodes: ['platinum'], platform: 'nds', romExt: ['.nds'] },
  HeartGold: { key: 'HeartGold', region: 'johto', gen: 4, emuCodes: ['heartgold'], platform: 'nds', romExt: ['.nds'] },
  SoulSilver: { key: 'SoulSilver', region: 'johto', gen: 4, emuCodes: ['soulsilver'], platform: 'nds', romExt: ['.nds'] },
  Schwarz: { key: 'Schwarz', region: 'unova', gen: 5, emuCodes: ['black'], platform: 'nds', romExt: ['.nds'] },
  Weiß: { key: 'Weiß', region: 'unova', gen: 5, emuCodes: ['white'], platform: 'nds', romExt: ['.nds'] },
  'Schwarz 2': { key: 'Schwarz 2', region: 'unova', gen: 5, emuCodes: ['black2'], platform: 'nds', romExt: ['.nds'] },
  'Weiß 2': { key: 'Weiß 2', region: 'unova', gen: 5, emuCodes: ['white2'], platform: 'nds', romExt: ['.nds'] },
  PokéMMO: { key: 'PokéMMO', region: 'multi', gen: 0, emuCodes: [], platform: 'nds', romExt: ['.gba', '.nds'] },
}

export const PLATFORM_LABEL: Record<RomPlatform, string> = { gb: 'Game Boy', gbc: 'Game Boy Color', gba: 'Game Boy Advance', nds: 'Nintendo DS' }
export const editionPlatform = (game: string | null | undefined): RomPlatform | null => { const k = resolveEdition(game); return k ? EDITIONS[k].platform : null }
export const editionRomExts = (game: string | null | undefined): string[] => { const k = resolveEdition(game); return k ? EDITIONS[k].romExt : ['.gba', '.nds'] }
export const editionPlatformLabel = (game: string | null | undefined): string => { const p = editionPlatform(game); return p ? PLATFORM_LABEL[p] : 'ROM' }

// Display labels + the ordered option list every edition picker should use (single
// source — no more per-component edition maps). New games: add to EDITIONS + here.
export const EDITION_LABEL: Record<EditionKey, string> = {
  Rot: 'Pokémon Rot', Blau: 'Pokémon Blau', Gelb: 'Pokémon Gelb',
  Gold: 'Pokémon Gold', Silber: 'Pokémon Silber', Kristall: 'Pokémon Kristall',
  Feuerrot: 'Pokémon Feuerrot', Blattgrün: 'Pokémon Blattgrün',
  Rubin: 'Pokémon Rubin', Saphir: 'Pokémon Saphir', Smaragd: 'Pokémon Smaragd',
  Diamant: 'Pokémon Diamant', Perl: 'Pokémon Perl', Platin: 'Pokémon Platin',
  HeartGold: 'Pokémon HeartGold', SoulSilver: 'Pokémon SoulSilver',
  Schwarz: 'Pokémon Schwarz', Weiß: 'Pokémon Weiß', 'Schwarz 2': 'Pokémon Schwarz 2', 'Weiß 2': 'Pokémon Weiß 2',
  PokéMMO: 'PokéMMO',
}
export const editionLabel = (game: string | null | undefined): string => { const k = resolveEdition(game); return k ? EDITION_LABEL[k] : (game || 'Pokémon') }

export interface EditionOption { key: EditionKey; label: string }
// Picker order (newest-friendly grouping); PokéMMO excluded — it's multi-region.
const OPTION_ORDER: EditionKey[] = [
  'Feuerrot', 'Blattgrün', 'Rubin', 'Saphir', 'Smaragd',
  'Diamant', 'Perl', 'Platin', 'HeartGold', 'SoulSilver',
  'Schwarz', 'Weiß', 'Schwarz 2', 'Weiß 2',
  'Rot', 'Blau', 'Gelb', 'Gold', 'Silber', 'Kristall',
]
export const EDITION_OPTIONS: EditionOption[] = OPTION_ORDER.map((key) => ({ key, label: EDITION_LABEL[key] }))

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
