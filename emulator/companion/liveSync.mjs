// ── LiveSync registry ────────────────────────────────────────────────────────
// SINGLE source of truth that maps a run's edition → which GENERATION parser, Lua
// engine and emulator RAM domain LiveSync must use. New editions are registered HERE
// with ONE line — never as if/else chains in the launcher. This mirrors the canonical
// keys/emu-codes of src/lib/edition.ts (the companion is .mjs and can't import the TS).
//
// Strict separation by generation: each generation has its OWN self-contained Lua
// engine (Gen3 ≠ Gen4 ≠ Gen5 — different RAM layouts, party/box structures, checksums,
// encryption). Adding a generation = add its engine file + flip `supported` here.

const GEN3_LUA = 'soullink_gen3.lua'   // GBA / Gen3 (FireRed · LeafGreen · Emerald · Ruby · Sapphire)
const GEN4_LUA = 'soullink_sync.lua'   // NDS / Gen4 (Platin · Diamant · Perl · HG · SS) — proven engine

// canonical EditionKey → live-sync descriptor.
//   gen        – generation (selects the parser family)
//   platform   – 'gba' | 'nds'
//   emu        – canonical emulator code the Lua reports as `game`
//   lua        – engine file basename, or null when no parser exists yet
//   domain     – BizHawk memory domain the engine reads
//   supported  – false → launch the ROM but DON'T attach a parser (no crash, clear note)
const EDITIONS = {
  Feuerrot:    { gen: 3, platform: 'gba', emu: 'firered',    lua: GEN3_LUA, domain: 'System Bus', supported: true },
  'Blattgrün': { gen: 3, platform: 'gba', emu: 'leafgreen',  lua: GEN3_LUA, domain: 'System Bus', supported: true },
  Smaragd:     { gen: 3, platform: 'gba', emu: 'emerald',    lua: GEN3_LUA, domain: 'System Bus', supported: true },
  Rubin:       { gen: 3, platform: 'gba', emu: 'ruby',       lua: GEN3_LUA, domain: 'System Bus', supported: true },
  Saphir:      { gen: 3, platform: 'gba', emu: 'sapphire',   lua: GEN3_LUA, domain: 'System Bus', supported: true },
  Platin:      { gen: 4, platform: 'nds', emu: 'platinum',   lua: GEN4_LUA, domain: 'Main RAM',   supported: true },
  Diamant:     { gen: 4, platform: 'nds', emu: 'diamond',    lua: GEN4_LUA, domain: 'Main RAM',   supported: true },
  Perl:        { gen: 4, platform: 'nds', emu: 'pearl',      lua: GEN4_LUA, domain: 'Main RAM',   supported: true },
  HeartGold:   { gen: 4, platform: 'nds', emu: 'heartgold',  lua: GEN4_LUA, domain: 'Main RAM',   supported: true },
  SoulSilver:  { gen: 4, platform: 'nds', emu: 'soulsilver', lua: GEN4_LUA, domain: 'Main RAM',   supported: true },
  // Gen5 is registered (so the system knows the edition) but has no parser yet → it
  // launches and plays, LiveSync is cleanly marked unsupported instead of blocking.
  Schwarz:     { gen: 5, platform: 'nds', emu: 'black',  lua: null, domain: 'Main RAM', supported: false },
  'Weiß':      { gen: 5, platform: 'nds', emu: 'white',  lua: null, domain: 'Main RAM', supported: false },
  'Schwarz 2': { gen: 5, platform: 'nds', emu: 'black2', lua: null, domain: 'Main RAM', supported: false },
  'Weiß 2':    { gen: 5, platform: 'nds', emu: 'white2', lua: null, domain: 'Main RAM', supported: false },
}

// alias (lower-cased, spaces removed): canonical key · emu code · display string → key.
const ALIAS = {}
const norm = (s) => String(s).normalize('NFC').replace(/^pok[eé]mon\s+/i, '').trim().toLowerCase().replace(/\s+/g, '')
for (const [key, e] of Object.entries(EDITIONS)) {
  ALIAS[norm(key)] = key
  if (e.emu) ALIAS[norm(e.emu)] = key
}

/** Normalise any game identifier (EditionKey · "Pokémon X" · emulator code) → key. */
export function resolveGame(game) {
  if (!game) return null
  const raw = String(game).normalize('NFC')
  if (EDITIONS[raw]) return raw
  return ALIAS[norm(raw)] || null
}

/** The full live-sync descriptor for a game (never throws). Unknown edition → a neutral
 *  descriptor with key=null so the launcher can fall back to legacy behaviour. */
export function liveSyncFor(game) {
  const key = resolveGame(game)
  if (!key) return { key: null, gen: null, platform: null, emu: null, lua: null, domain: null, supported: false }
  return { key, ...EDITIONS[key] }
}
