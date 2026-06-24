export const GAME_LIST = [
  'Rot', 'Blau', 'Gelb',
  'Gold', 'Silber', 'Kristall',
  'Rubin', 'Saphir', 'Smaragd',
  'Feuerrot', 'Blattgrün',
  'Diamant', 'Perl', 'Platin',
  'HeartGold', 'SoulSilver',
  'Schwarz', 'Weiß',
  'Schwarz 2', 'Weiß 2',
  'PokéMMO',
]

const KANTO_ROUTES = [
  'Route 1', 'Route 2', 'Route 3', 'Route 4', 'Route 5',
  'Route 6', 'Route 7', 'Route 8', 'Route 9', 'Route 10',
  'Route 11', 'Route 12', 'Route 13', 'Route 14', 'Route 15',
  'Route 16', 'Route 17', 'Route 18', 'Route 19', 'Route 20',
  'Route 21', 'Route 22', 'Route 23', 'Route 24', 'Route 25',
  'Vertania-Wald', 'Mondberg', 'Felstunnel', 'S.S. Anne',
  'Safari-Zone', 'Kraftwerk', 'Pokémon-Turm', 'Seeschaum-Inseln',
  'Azureus-Höhle', 'Siegesstraße Kanto',
]

const JOHTO_ROUTES = [
  'Route 29', 'Route 30', 'Route 31', 'Route 32', 'Route 33',
  'Route 34', 'Route 35', 'Route 36', 'Route 37', 'Route 38',
  'Route 39', 'Route 40', 'Route 41', 'Route 42', 'Route 43',
  'Route 44', 'Route 45', 'Route 46', 'Route 47', 'Route 48',
  'Dunkelhöhle', 'Eulenwald', 'Nationaler Park', 'Magnetberg',
  'Eisweg', 'Drachenhöhle', 'Silber-Berg', 'Safari-Zone Johto',
  'Siegesstraße Johto',
]

const HOENN_ROUTES = [
  'Route 101', 'Route 102', 'Route 103', 'Route 104', 'Route 105',
  'Route 106', 'Route 107', 'Route 108', 'Route 109', 'Route 110',
  'Route 111', 'Route 112', 'Route 113', 'Route 114', 'Route 115',
  'Route 116', 'Route 117', 'Route 118', 'Route 119', 'Route 120',
  'Route 121', 'Route 122', 'Route 123', 'Route 124', 'Route 125',
  'Route 126', 'Route 127', 'Route 128', 'Route 129', 'Route 130',
  'Route 131', 'Route 132', 'Route 133', 'Route 134',
  'Petalburg-Wald', 'Granit-Höhle', 'Meteor-Wasserfall',
  'Schiefer-Tunnel', 'Safari-Zone Hoenn', 'Jägerwald',
  'Shoal-Höhle', 'Mt. Pyre', 'Aqua-Versteck', 'Magma-Versteck',
  'Himmelsturm', 'Trost-Tunnel', 'Siegesstraße Hoenn',
]

const SINNOH_ROUTES = [
  'Route 201', 'Route 202', 'Route 203', 'Route 204', 'Route 205',
  'Route 206', 'Route 207', 'Route 208', 'Route 209', 'Route 210',
  'Route 211', 'Route 212', 'Route 213', 'Route 214', 'Route 215',
  'Route 216', 'Route 217', 'Route 218', 'Route 219', 'Route 220',
  'Route 221', 'Route 222', 'Route 223', 'Route 224', 'Route 225',
  'Route 226', 'Route 227', 'Route 228', 'Route 229', 'Route 230',
  'Oreburgh-Mine', 'Ravaged Path', 'Ewig-Wald', 'Valley Windworks',
  'Komet-Berg', 'Trophäengarten', 'Großer Sumpf', 'Verlorener Turm',
  'Eisen-Insel', 'Vollmond-Insel', 'See Güte', 'See Stärke',
  'See Fleiß', 'Goldklüfte', 'Sternenruinen',
  'Siegesstraße Sinnoh',
]

const UNOVA_ROUTES = [
  'Route 1', 'Route 2', 'Route 3', 'Route 4', 'Route 5',
  'Route 6', 'Route 7', 'Route 8', 'Route 9', 'Route 10',
  'Route 11', 'Route 12', 'Route 13', 'Route 14', 'Route 15',
  'Route 16', 'Route 17', 'Route 18',
  'Dunkelwald', 'Quellengrotte', 'Rückenwald',
  'Elektrostein-Höhle', 'Winddreh-Stollen',
  'Drachenspirale', 'Felsenruinen', 'Riesengraben',
  'Triumphgrotte', 'Siegesstraße Einall',
]

const UNOVA2_ROUTES = [
  ...UNOVA_ROUTES,
  'Route 19', 'Route 20', 'Route 21', 'Route 22', 'Route 23',
  'Virbank-Anlage', 'Kluft-Tunnel', 'Meeresbucht',
  'Wendefall', 'Reiches Heiligtum', 'Unterwasser-Ruinen',
]

const POKEMMO_ROUTES = [
  ...KANTO_ROUTES,
  ...JOHTO_ROUTES,
  ...HOENN_ROUTES,
  ...SINNOH_ROUTES,
  ...UNOVA_ROUTES,
]

const ROUTE_MAP: Record<string, string[]> = {
  'Rot': KANTO_ROUTES,
  'Blau': KANTO_ROUTES,
  'Gelb': KANTO_ROUTES,
  'Gold': JOHTO_ROUTES,
  'Silber': JOHTO_ROUTES,
  'Kristall': JOHTO_ROUTES,
  'Rubin': HOENN_ROUTES,
  'Saphir': HOENN_ROUTES,
  'Smaragd': HOENN_ROUTES,
  'Feuerrot': [...KANTO_ROUTES, 'Insel 1-Höhle', 'Insel 2-Höhle', 'Insel 4-Höhle', 'Insel 5-Höhle', 'Insel 6-Höhle', 'Insel 7-Höhle', 'Wehrburg'],
  'Blattgrün': [...KANTO_ROUTES, 'Insel 1-Höhle', 'Insel 2-Höhle', 'Insel 4-Höhle', 'Insel 5-Höhle', 'Insel 6-Höhle', 'Insel 7-Höhle', 'Wehrburg'],
  'Diamant': SINNOH_ROUTES,
  'Perl': SINNOH_ROUTES,
  'Platin': SINNOH_ROUTES,
  'HeartGold': [...JOHTO_ROUTES, ...KANTO_ROUTES],
  'SoulSilver': [...JOHTO_ROUTES, ...KANTO_ROUTES],
  'Schwarz': UNOVA_ROUTES,
  'Weiß': UNOVA_ROUTES,
  'Schwarz 2': UNOVA2_ROUTES,
  'Weiß 2': UNOVA2_ROUTES,
  'PokéMMO': POKEMMO_ROUTES,
}

export function getRoutesForGame(game: string): string[] {
  const routes = ROUTE_MAP[game] ?? KANTO_ROUTES
  return [...new Set(routes), 'Eigene Route...']
}

// Set of every official route name across all editions (built once). Used to tell
// "route of another edition" apart from a user's free-text custom route.
let _allOfficial: Set<string> | null = null
function allOfficialRoutes(): Set<string> {
  if (!_allOfficial) {
    _allOfficial = new Set<string>()
    for (const g of GAME_LIST) {
      for (const r of getRoutesForGame(g)) if (r !== 'Eigene Route...') _allOfficial.add(r)
    }
  }
  return _allOfficial
}

/** True when `location` is an official route of a DIFFERENT edition than `game`
 *  (i.e. it no longer fits the current edition). Custom/free-text routes that are
 *  not official in ANY edition are never flagged — they are intentional. */
export function routeMismatchesEdition(location: string | null | undefined, game: string): boolean {
  if (!location) return false
  const fitsCurrent = getRoutesForGame(game).some((r) => r !== 'Eigene Route...' && r === location)
  if (fitsCurrent) return false
  return allOfficialRoutes().has(location)
}

// Emulator game codes (Lua CONFIG.game, lowercase English) → run edition label (German).
const EMU_GAME_TO_LABEL: Record<string, string> = {
  red: 'Rot', blue: 'Blau', yellow: 'Gelb',
  gold: 'Gold', silver: 'Silber', crystal: 'Kristall',
  ruby: 'Rubin', sapphire: 'Saphir', emerald: 'Smaragd',
  firered: 'Feuerrot', leafgreen: 'Blattgrün',
  diamond: 'Diamant', pearl: 'Perl', platinum: 'Platin',
  heartgold: 'HeartGold', soulsilver: 'SoulSilver',
  black: 'Schwarz', white: 'Weiß', black2: 'Schwarz 2', white2: 'Weiß 2',
}

/** Map an emulator game code (e.g. "platinum") to the run-edition label (e.g. "Platin"). */
export function emulatorGameLabel(emuGame: string | null | undefined): string | null {
  if (!emuGame) return null
  return EMU_GAME_TO_LABEL[emuGame.toLowerCase()] ?? null
}

/** True only when we are SURE the emulator game does not match the run edition.
 *  Unknown emulator codes or PokéMMO (multi-region) never count as a mismatch.
 *  Tolerant to how the run edition is stored: an emulator code ("platinum"), the
 *  German label ("Platin") or a "Pokémon Platin" display string all match — so a
 *  Platinum run on a Platinum emulator is never flagged. Still distinguishes the
 *  paired editions (Schwarz ≠ Schwarz 2). */
export function isGameMismatch(runGame: string | null | undefined, emuGame: string | null | undefined): boolean {
  if (!runGame || !emuGame) return false
  if (runGame === 'PokéMMO') return false
  const emuLabel = EMU_GAME_TO_LABEL[emuGame.toLowerCase()]
  if (!emuLabel) return false                                  // unknown emu code → never a mismatch
  if (runGame.toLowerCase() === emuGame.toLowerCase()) return false   // both the same code
  const stripped = runGame.replace(/^pok[eé]mon\s+/i, '').trim().toLowerCase()
  if (stripped === emuLabel.toLowerCase()) return false        // label / "Pokémon <Label>"
  return true
}

// Normalize a location label for tolerant comparison (case/spaces/diacritics/punct).
function normalizeLoc(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

/** Match a (possibly differently-spelled) location name to a route of the game's
 *  checklist. Exact normalized match only — never forces a wrong match. */
export function matchRoute(input: string | null | undefined, game: string): string | null {
  if (!input) return null
  const target = normalizeLoc(input)
  if (!target) return null
  for (const r of getRoutesForGame(game)) {
    if (r === 'Eigene Route...') continue
    if (normalizeLoc(r) === target) return r
  }
  return null
}
