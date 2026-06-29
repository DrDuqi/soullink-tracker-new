// ROM validation — reads the Nintendo DS header so the wizard can say "Pokémon
// Platin (USA) Rev 1 erkannt" and reject wrong files with a friendly reason. Only
// the 512-byte header is read (cheap, even for a 134 MB ROM).
//
// Generation-aware by design: GAMES maps the 3-char game-code prefix to an edition;
// adding a future game/generation is one entry, not a rewrite. SUPPORTED_GEN gates
// what live-sync handles today (Gen 4) without losing recognition of the rest.

import { openSync, readSync, closeSync, statSync } from 'node:fs'
import { extname } from 'node:path'

const REGION = {
  E: 'USA', O: 'USA', P: 'Europa', D: 'Deutschland', F: 'Frankreich',
  I: 'Italien', S: 'Spanien', J: 'Japan', K: 'Korea', U: 'Australien',
}
const GAMES = {
  ADA: { name: 'Pokémon Diamant',    edition: 'diamond',    gen: 4 },
  APA: { name: 'Pokémon Perl',       edition: 'pearl',      gen: 4 },
  CPU: { name: 'Pokémon Platin',     edition: 'platinum',   gen: 4 },
  IPK: { name: 'Pokémon HeartGold',  edition: 'heartgold',  gen: 4 },
  IPG: { name: 'Pokémon SoulSilver', edition: 'soulsilver', gen: 4 },
  IRB: { name: 'Pokémon Schwarz',    edition: 'black',      gen: 5 },
  IRA: { name: 'Pokémon Weiß',       edition: 'white',      gen: 5 },
  IRE: { name: 'Pokémon Schwarz 2',  edition: 'black2',     gen: 5 },
  IRD: { name: 'Pokémon Weiß 2',     edition: 'white2',     gen: 5 },
}
const SUPPORTED_GEN = 4   // live-sync currently reads Gen-4 NDS party data

// Game Boy Advance header: 4-char game code at 0xAC (prefix → edition), title at 0xA0.
const GBA_GAMES = {
  BPR: { name: 'Pokémon Feuerrot', edition: 'firered', gen: 3 },
  BPG: { name: 'Pokémon Blattgrün', edition: 'leafgreen', gen: 3 },
  AXV: { name: 'Pokémon Rubin', edition: 'ruby', gen: 3 },
  AXP: { name: 'Pokémon Saphir', edition: 'sapphire', gen: 3 },
  BPE: { name: 'Pokémon Smaragd', edition: 'emerald', gen: 3 },
}
const PLATFORM_OF_EXT = { '.nds': 'nds', '.gba': 'gba', '.gbc': 'gbc', '.gb': 'gb' }
const PLATFORM_LABEL = { gb: 'Game Boy', gbc: 'Game Boy Color', gba: 'Game Boy Advance', nds: 'Nintendo DS' }

// Edition-aware ROM validation. `opts` (from the chosen edition) makes the accepted
// extension AND every message edition-specific — a GBA edition never shows a DS message.
//   opts.exts: ['.gba'] · opts.editionLabel: 'Pokémon Feuerrot' · opts.platformLabel: 'Game Boy Advance'
export function validateRom(path, opts = {}) {
  if (!path) return { valid: false, code: 'no_path', message: 'Keine Datei angegeben.' }
  const ext = extname(path).toLowerCase()
  const exts = (Array.isArray(opts.exts) && opts.exts.length) ? opts.exts.map((e) => e.toLowerCase()) : ['.nds', '.gba', '.gbc', '.gb']
  const want = exts.join('/')
  const edLabel = opts.editionLabel || 'diese Edition'
  const platLabel = opts.platformLabel || (exts.length === 1 ? (PLATFORM_LABEL[PLATFORM_OF_EXT[exts[0]]] || 'ROM') : 'ROM')

  if (['.zip', '.rar', '.7z'].includes(ext))
    return { valid: false, code: 'archive', message: `Das ist ein Archiv (${ext}). Bitte entpacke es und wähle die ${want}-Datei darin.` }
  if (!exts.includes(ext))
    return { valid: false, code: 'wrong_platform', message: `${ext} passt nicht zu ${edLabel}. Erwartet wird eine ${want}-ROM (${platLabel}) — du hast eine ${ext}-Datei gewählt.` }

  const platform = PLATFORM_OF_EXT[ext]
  return platform === 'gba' ? parseGba(path, edLabel) : platform === 'nds' ? parseNds(path) : parseMinimal(path, ext, platLabel)
}

function parseNds(path) {
  let fd
  try {
    if (statSync(path).size < 0x200) return { valid: false, code: 'too_small', message: 'Die Datei ist zu klein für eine DS-ROM.' }
    fd = openSync(path, 'r')
    const buf = Buffer.alloc(0x200); readSync(fd, buf, 0, 0x200, 0)
    const title = buf.toString('ascii', 0x00, 0x0C).replace(/\0+$/, '').trim()
    const gameCode = buf.toString('ascii', 0x0C, 0x10)
    const revision = buf.readUInt8(0x1E)
    const logoOk = buf.readUInt16LE(0x15C) === 0xCF56
    if (!/^[A-Z0-9]{4}$/.test(gameCode)) return { valid: false, code: 'unknown', message: 'Diese Datei wirkt nicht wie eine gültige DS-ROM.' }
    const g = GAMES[gameCode.slice(0, 3)]; const region = REGION[gameCode[3]] || gameCode[3]
    if (!g) return { valid: true, recognized: false, supported: false, gameCode, title, region, revision, logoOk, message: `Unbekanntes DS-Spiel (${gameCode}). SoulLink ist für Pokémon-Editionen gedacht.` }
    const supported = g.gen === SUPPORTED_GEN
    return { valid: true, recognized: true, supported, gameCode, title, region, revision, logoOk, game: g.name, edition: g.edition, gen: g.gen,
      message: `${g.name} (${region})${revision ? ` Rev ${revision}` : ''} erkannt` + (supported ? '' : ' — diese Generation wird für Live-Sync noch nicht unterstützt.') }
  } catch { return { valid: false, code: 'read_error', message: 'Die Datei konnte nicht gelesen werden.' } }
  finally { if (fd !== undefined) { try { closeSync(fd) } catch { /* ignore */ } } }
}

function parseGba(path, edLabel) {
  let fd
  try {
    if (statSync(path).size < 0x100) return { valid: false, code: 'too_small', message: 'Die Datei ist zu klein für eine GBA-ROM.' }
    fd = openSync(path, 'r')
    const buf = Buffer.alloc(0xC0); readSync(fd, buf, 0, 0xC0, 0)
    const title = buf.toString('ascii', 0xA0, 0xAC).replace(/\0+$/, '').trim()
    const gameCode = buf.toString('ascii', 0xAC, 0xB0)
    const fixed = buf.readUInt8(0xB2) === 0x96   // GBA fixed header byte
    if (!/^[A-Z0-9]{4}$/.test(gameCode) || !fixed) return { valid: false, code: 'unknown', message: 'Diese Datei wirkt nicht wie eine gültige GBA-ROM.' }
    const g = GBA_GAMES[gameCode.slice(0, 3)]; const region = REGION[gameCode[3]] || gameCode[3]
    if (!g) return { valid: true, recognized: false, supported: false, gameCode, title, region, message: `Unbekanntes GBA-Spiel (${gameCode}) — passt das zu ${edLabel}?` }
    return { valid: true, recognized: true, supported: false, gameCode, title, region, game: g.name, edition: g.edition, gen: g.gen,
      message: `${g.name} (${region}) erkannt — Live-Sync für GBA folgt noch.` }
  } catch { return { valid: false, code: 'read_error', message: 'Die Datei konnte nicht gelesen werden.' } }
  finally { if (fd !== undefined) { try { closeSync(fd) } catch { /* ignore */ } } }
}

function parseMinimal(path, ext, platLabel) {
  try {
    if (statSync(path).size < 0x100) return { valid: false, code: 'too_small', message: `Die Datei ist zu klein für eine ${platLabel}-ROM.` }
    return { valid: true, recognized: false, supported: false, message: `${ext.toUpperCase().slice(1)}-ROM erkannt.` }
  } catch { return { valid: false, code: 'read_error', message: 'Die Datei konnte nicht gelesen werden.' } }
}
