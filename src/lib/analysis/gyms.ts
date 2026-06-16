// Gym-leader data per region. Used by the Nuzlocke-risk / arena analysis.
// Modular by design: future modules (rival, Elite Four, champion, ROM hacks)
// can add their own `BattleTarget` lists without touching the analysis core.

export interface GymLeader {
  name: string
  /** Primary type used for matchup math. */
  type: string
  /** Signature / ace Pokémon (flavour + danger note). */
  ace?: string
  /** Short special-danger note. */
  note?: string
}

const KANTO: GymLeader[] = [
  { name: 'Rocko (Marmoria)',   type: 'rock',     ace: 'Onix',      note: 'Onix hat hohe Verteidigung – spezielle Angriffe helfen.' },
  { name: 'Misty (Azuria)',     type: 'water',    ace: 'Starmie',   note: 'Starmie ist schnell und schlägt hart zu.' },
  { name: 'Major Bob (Orania)', type: 'electric', ace: 'Raichu',    note: 'Boden-Pokémon sind immun gegen Elektro.' },
  { name: 'Erika (Prismania)',  type: 'grass',    ace: 'Vileplume', note: 'Setzt auf Status (Schlaf/Gift).' },
  { name: 'Koga (Fuchsania)',   type: 'poison',   ace: 'Weezing',   note: 'Gift-Status und Explosion.' },
  { name: 'Sabrina (Saffronia)',type: 'psychic',  ace: 'Alakazam',  note: 'Extrem hohe Spezial-Werte und Initiative.' },
  { name: 'Pyro (Zinnoberins.)',type: 'fire',     ace: 'Arkani',    note: 'Schnelle, hart treffende Feuer-Pokémon.' },
  { name: 'Giovanni (Viridian)',type: 'ground',   ace: 'Rhydon',    note: 'Boden/Gestein – Wasser & Pflanze sind stark.' },
]

const JOHTO: GymLeader[] = [
  { name: 'Falk (Neuborkia)',   type: 'flying',   ace: 'Dodri',     note: 'Elektro & Gestein decken Flug gut ab.' },
  { name: 'Kai (Azalea)',       type: 'bug',      ace: 'Scoppel',   note: 'Feuer & Flug sind sehr effektiv.' },
  { name: 'Bianka (Dukatia)',   type: 'normal',   ace: 'Miltank',   note: 'Miltank mit Walzer & Milchgetränk – sehr zäh.' },
  { name: 'Jens (Teak City)',   type: 'ghost',    ace: 'Nebulak',   note: 'Setzt auf Fluch & Hypnose.' },
  { name: 'Hartwig (Oliviana)', type: 'fighting', ace: 'Primape',   note: 'Psycho & Flug schlagen Kampf.' },
  { name: 'Yvette (Oliviana)',  type: 'steel',    ace: 'Stahlos',   note: 'Feuer & Boden sind sehr effektiv.' },
  { name: 'Norbert (Mahagonia)',type: 'ice',      ace: 'Botogel',   note: 'Stahl, Feuer & Kampf helfen gegen Eis.' },
  { name: 'Sandra (Ebenholz)',  type: 'dragon',   ace: 'Dragoran',  note: 'Eis ist die sicherste Antwort gegen Drachen.' },
]

const HOENN: GymLeader[] = [
  { name: 'Felizia (Rosaltern)',type: 'rock',     ace: 'Nasgnet',   note: 'Wasser, Pflanze & Kampf brechen Gestein.' },
  { name: 'Kamillo (Faustau)',  type: 'fighting', ace: 'Makuhita',  note: 'Psycho & Flug sind sehr effektiv.' },
  { name: 'Walter (Malvenfr.)', type: 'electric', ace: 'Magneton',  note: 'Boden-Pokémon sind immun.' },
  { name: 'Flavia (Frizzo)',    type: 'fire',     ace: 'Camerupt',  note: 'Wasser & Boden sind stark.' },
  { name: 'Norman (Blütenb.)',  type: 'normal',   ace: 'Slaking',   note: 'Slaking ist extrem stark – Kampf hilft.' },
  { name: 'Wibke (Wolkenkr.)',  type: 'flying',   ace: 'Altaria',   note: 'Elektro, Eis & Gestein decken Flug ab.' },
  { name: 'Ben & Svenja (Mond.)',type: 'psychic', ace: 'Symbiosis', note: 'Doppelkampf – Unlicht & Käfer helfen.' },
  { name: 'Wassili/Juan (Xener.)',type: 'water',  ace: 'Aquana',    note: 'Pflanze & Elektro sind sehr effektiv.' },
]

const SINNOH: GymLeader[] = [
  { name: 'Veit (Erzelingen)',  type: 'rock',     ace: 'Koknodon',  note: 'Wasser, Pflanze & Kampf brechen Gestein.' },
  { name: 'Silvana (Ewigsmoor)',type: 'grass',    ace: 'Roserade',  note: 'Feuer, Flug & Eis sind stark.' },
  { name: 'Hilda (Schleiede)',  type: 'fighting', ace: 'Lucario',   note: 'Psycho & Flug schlagen Kampf.' },
  { name: 'Wino (Schleiede)',   type: 'water',    ace: 'Quagginarol',note: 'Pflanze & Elektro sind sehr effektiv.' },
  { name: 'Lamantis (Herzhofen)',type: 'ghost',   ace: 'Banette',   note: 'Unlicht & Geist decken Geist ab.' },
  { name: 'Adam (Fleetburg)',   type: 'steel',    ace: 'Stahlos',   note: 'Feuer, Boden & Kampf sind stark.' },
  { name: 'Frida (Blizzach)',   type: 'ice',      ace: 'Frosdedje', note: 'Stahl, Feuer & Kampf helfen gegen Eis.' },
  { name: 'Volkner (Sonnewik)', type: 'electric', ace: 'Elektrok',  note: 'Boden-Pokémon sind immun gegen Elektro.' },
]

const UNOVA: GymLeader[] = [
  { name: 'Trio-Arena (Striaton)',type: 'grass',  ace: 'Starter-Konter', note: 'Typ richtet sich nach deinem Starter (Pflanze/Feuer/Wasser).' },
  { name: 'Aloe (Rayono)',      type: 'normal',   ace: 'Bisofank',  note: 'Kampf-Attacken sind sehr effektiv.' },
  { name: 'Arti (Marea)',       type: 'bug',      ace: 'Hydragil',  note: 'Feuer, Flug & Gestein helfen.' },
  { name: 'Kamilla (Yanus)',    type: 'electric', ace: 'Zebritz',   note: 'Boden-Pokémon sind immun.' },
  { name: 'Turner (Wendelin)',  type: 'ground',   ace: 'Stalobor',  note: 'Wasser, Pflanze & Eis sind stark.' },
  { name: 'Mauve (Septerna)',   type: 'flying',   ace: 'Swaroness',  note: 'Elektro, Eis & Gestein decken Flug ab.' },
  { name: 'Senta (Frosdorf)',   type: 'ice',      ace: 'Frigometri',note: 'Stahl, Feuer & Kampf helfen gegen Eis.' },
  { name: 'Lilia/Lormus (Drachenfels)',type: 'dragon', ace: 'Trikephalo', note: 'Eis ist die sicherste Drachen-Antwort.' },
]

const UNOVA2: GymLeader[] = [
  { name: 'Cheren (Aspertia)',  type: 'normal',   ace: 'Herbaro',   note: 'Kampf-Attacken sind sehr effektiv.' },
  { name: 'Mateo (Virbank)',    type: 'poison',   ace: 'Habitak/Skorgla', note: 'Boden & Psycho helfen gegen Gift.' },
  { name: 'Arti (Marea)',       type: 'bug',      ace: 'Hydragil',  note: 'Feuer, Flug & Gestein helfen.' },
  { name: 'Kamilla (Yanus)',    type: 'electric', ace: 'Zebritz',   note: 'Boden-Pokémon sind immun.' },
  { name: 'Turner (Wendelin)',  type: 'ground',   ace: 'Stalobor',  note: 'Wasser, Pflanze & Eis sind stark.' },
  { name: 'Mauve (Septerna)',   type: 'flying',   ace: 'Swaroness',  note: 'Elektro, Eis & Gestein decken Flug ab.' },
  { name: 'Lilia (Drachenfels)',type: 'dragon',   ace: 'Trikephalo',note: 'Eis ist die sicherste Drachen-Antwort.' },
  { name: 'Benna (Seegrund)',   type: 'water',    ace: 'Aalabyss',  note: 'Pflanze & Elektro sind sehr effektiv.' },
]

const GYM_MAP: Record<string, GymLeader[]> = {
  'Rot': KANTO, 'Blau': KANTO, 'Gelb': KANTO, 'Feuerrot': KANTO, 'Blattgrün': KANTO,
  'Gold': JOHTO, 'Silber': JOHTO, 'Kristall': JOHTO, 'HeartGold': JOHTO, 'SoulSilver': JOHTO,
  'Rubin': HOENN, 'Saphir': HOENN, 'Smaragd': HOENN,
  'Diamant': SINNOH, 'Perl': SINNOH, 'Platin': SINNOH,
  'Schwarz': UNOVA, 'Weiß': UNOVA,
  'Schwarz 2': UNOVA2, 'Weiß 2': UNOVA2,
  'PokéMMO': KANTO,
}

export function getGymsForGame(game: string): GymLeader[] {
  return GYM_MAP[game] ?? KANTO
}
