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

export function validateRom(path) {
  if (!path) return { valid: false, code: 'no_path', message: 'Keine Datei angegeben.' }
  const ext = extname(path).toLowerCase()
  if (['.zip', '.rar', '.7z'].includes(ext))
    return { valid: false, code: 'archive', message: `Das ist ein Archiv (${ext}). Bitte entpacke es zuerst und wähle die .nds-Datei darin.` }
  if (['.gba', '.gbc', '.gb'].includes(ext))
    return { valid: false, code: 'wrong_platform', message: `${ext} ist kein Nintendo-DS-Spiel. Für Pokémon Platin/HGSS brauchst du eine .nds-Datei.` }
  if (ext !== '.nds')
    return { valid: false, code: 'not_nds', message: 'Bitte wähle eine Nintendo-DS-ROM (.nds).' }

  let fd
  try {
    if (statSync(path).size < 0x200)
      return { valid: false, code: 'too_small', message: 'Die Datei ist zu klein für eine DS-ROM.' }
    fd = openSync(path, 'r')
    const buf = Buffer.alloc(0x200)
    readSync(fd, buf, 0, 0x200, 0)
    const title = buf.toString('ascii', 0x00, 0x0C).replace(/\0+$/, '').trim()
    const gameCode = buf.toString('ascii', 0x0C, 0x10)
    const revision = buf.readUInt8(0x1E)
    const logoOk = buf.readUInt16LE(0x15C) === 0xCF56   // Nintendo logo CRC of genuine carts

    if (!/^[A-Z0-9]{4}$/.test(gameCode))
      return { valid: false, code: 'unknown', message: 'Diese Datei wirkt nicht wie eine gültige DS-ROM.' }

    const g = GAMES[gameCode.slice(0, 3)]
    const region = REGION[gameCode[3]] || gameCode[3]
    if (!g)
      return { valid: true, recognized: false, supported: false, gameCode, title, region, revision, logoOk,
        message: `Unbekanntes DS-Spiel (${gameCode}). SoulLink ist für Pokémon-Editionen gedacht.` }

    const supported = g.gen === SUPPORTED_GEN
    return {
      valid: true, recognized: true, supported, gameCode, title, region, revision, logoOk,
      game: g.name, edition: g.edition, gen: g.gen,
      message: `${g.name} (${region})${revision ? ` Rev ${revision}` : ''} erkannt`
        + (supported ? '' : ' — diese Generation wird für Live-Sync noch nicht unterstützt.'),
    }
  } catch {
    return { valid: false, code: 'read_error', message: 'Die Datei konnte nicht gelesen werden.' }
  } finally {
    if (fd !== undefined) { try { closeSync(fd) } catch { /* ignore */ } }
  }
}
