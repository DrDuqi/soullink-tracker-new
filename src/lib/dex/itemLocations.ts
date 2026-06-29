// SoulDex item-acquisition overlay — our own curated, license-clean data for where/how
// an item is obtained (PokéAPI has none of this). Bundled JSON keyed by item id → offline
// and instant, exactly like the rest of the SoulDex. Quality over completeness: only
// confidently-correct entries are added; the set grows item by item.
//
// Schema (one entry = one acquisition path):
//   how : the method (shop/gift/ground/pickup/reward/raid/craft/event)
//   ed  : edition codes the entry applies to (see EDITIONS below)
//   loc : route / cave / town (optional)
//   npc : shop or person (optional)
//   note: free-text condition, e.g. "nach dem 5. Orden" (optional)
import raw from '../../data/item-locations.json'

export type AcqHow = 'shop' | 'gift' | 'ground' | 'pickup' | 'reward' | 'raid' | 'craft' | 'event'
export interface AcqEntry { how: AcqHow; loc?: string; npc?: string; ed: string[]; note?: string }

const DATA = raw as Record<string, AcqEntry[]>
export const getItemLocations = (id: number): AcqEntry[] => DATA[String(id)] || []
export const hasItemLocations = (id: number): boolean => !!DATA[String(id)]?.length

export const HOW_LABEL: Record<'de' | 'en', Record<AcqHow, string>> = {
  de: { shop: 'Shop', gift: 'Geschenk', ground: 'Fund am Boden', pickup: 'Aufsammeln', reward: 'Belohnung', raid: 'Raid', craft: 'Crafting', event: 'Event' },
  en: { shop: 'Shop', gift: 'Gift', ground: 'On the ground', pickup: 'Pickup', reward: 'Reward', raid: 'Raid', craft: 'Crafting', event: 'Event' },
}
export const HOW_COLOR: Record<AcqHow, string> = { shop: '#fbbf24', gift: '#f472b6', ground: '#4ade80', pickup: '#a3e635', reward: '#60a5fa', raid: '#c084fc', craft: '#fb923c', event: '#f87171' }

const EDITIONS: Record<string, { de: string; en: string }> = {
  rby: { de: 'Rot/Blau/Gelb', en: 'Red/Blue/Yellow' },
  gsc: { de: 'Gold/Silber/Kristall', en: 'Gold/Silver/Crystal' },
  rse: { de: 'Rubin/Saphir/Smaragd', en: 'Ruby/Sapphire/Emerald' },
  frlg: { de: 'Feuerrot/Blattgrün', en: 'FireRed/LeafGreen' },
  dppt: { de: 'Diamant/Perl/Platin', en: 'Diamond/Pearl/Platinum' },
  hgss: { de: 'HeartGold/SoulSilver', en: 'HeartGold/SoulSilver' },
  bw: { de: 'Schwarz/Weiß', en: 'Black/White' },
  b2w2: { de: 'Schwarz 2/Weiß 2', en: 'Black 2/White 2' },
  xy: { de: 'X/Y', en: 'X/Y' },
  oras: { de: 'Omega Rubin/Alpha Saphir', en: 'Omega Ruby/Alpha Sapphire' },
  sm: { de: 'Sonne/Mond', en: 'Sun/Moon' },
  usum: { de: 'Ultrasonne/Ultramond', en: 'Ultra Sun/Ultra Moon' },
  swsh: { de: 'Schwert/Schild', en: 'Sword/Shield' },
  bdsp: { de: 'Strahlender Diamant/Leuchtende Perl', en: 'Brilliant Diamond/Shining Pearl' },
  la: { de: 'Legenden: Arceus', en: 'Legends: Arceus' },
  sv: { de: 'Karmesin/Purpur', en: 'Scarlet/Violet' },
  all: { de: 'Mehrere Editionen', en: 'Multiple games' },
}
export const editionLabel = (code: string, lang: 'de' | 'en') => EDITIONS[code]?.[lang] || code.toUpperCase()

// ── Category knowledge layer ────────────────────────────────────────────────
// Systematic coverage: every visible item category gets a concise "Verwendung" (what
// it's for) and a broadly-correct, category-level acquisition hint. Item-specific
// overlay entries (above) always take precedence; this guarantees no item is empty
// without inventing false per-route data. Own short descriptions — not copied text.
export interface CatInfo { use: { de: string; en: string }; acq?: { de: string; en: string } }
export const CATEGORY_INFO: Record<string, CatInfo> = {
  // Pokébälle
  'standard-balls': { use: { de: 'Fängt wilde Pokémon.', en: 'Catches wild Pokémon.' }, acq: { de: 'In Pokémon-Märkten kaufbar.', en: 'Sold in Poké Marts.' } },
  'special-balls': { use: { de: 'Ball mit besonderem Fangverhalten.', en: 'Ball with a special catch effect.' }, acq: { de: 'Märkte, Belohnungen oder spezielle Händler.', en: 'Marts, rewards or special vendors.' } },
  'apricorn-balls': { use: { de: 'Aus Apfelkokos gefertigte Spezialbälle (Johto).', en: 'Apricorn-crafted balls (Johto).' }, acq: { de: 'Von Kurt aus Apfelkokos hergestellt.', en: 'Crafted by Kurt from Apricorns.' } },
  'apricorn-box': { use: { de: 'Aufbewahrung für Apfelkokos.', en: 'Holds Apricorns.' }, acq: { de: 'Geschenk in Johto (GSC/HGSS).', en: 'Gift in Johto (GSC/HGSS).' } },
  'catching-bonus': { use: { de: 'Verbessert Boni beim Fangen (z. B. Fang-Combo).', en: 'Improves catching bonuses.' }, acq: { de: 'Belohnungen / spezielle NPCs.', en: 'Rewards / special NPCs.' } },
  // Medizin
  healing: { use: { de: 'Stellt KP wieder her.', en: 'Restores HP.' }, acq: { de: 'In jedem Pokémon-Center/Markt kaufbar.', en: 'Sold in any Poké Mart.' } },
  'status-cures': { use: { de: 'Heilt Statusprobleme (Gift, Para usw.).', en: 'Cures status conditions.' }, acq: { de: 'Märkte und Pokémon-Center.', en: 'Marts and Pokémon Centers.' } },
  revival: { use: { de: 'Belebt kampfunfähige Pokémon.', en: 'Revives fainted Pokémon.' }, acq: { de: 'Märkte (höhere Ränge), Fundorte.', en: 'Marts and item finds.' } },
  'pp-recovery': { use: { de: 'Füllt die AP von Attacken auf.', en: 'Restores move PP.' }, acq: { de: 'Märkte, Belohnungen.', en: 'Marts, rewards.' } },
  vitamins: { use: { de: 'Erhöht EVs/Statuswerte dauerhaft.', en: 'Permanently raises EVs/stats.' }, acq: { de: 'Kaufhäuser, BP-Shops, Pickup.', en: 'Dept. stores, BP shops, Pickup.' } },
  medicine: { use: { de: 'Allgemeines Heilitem.', en: 'General healing item.' }, acq: { de: 'Pokémon-Center/Märkte.', en: 'Pokémon Centers/Marts.' } },
  'picky-healing': { use: { de: 'Heilt KP, kann aber Verwirrung auslösen (Beere).', en: 'Heals HP but may confuse (Berry).' }, acq: { de: 'Beerenbäume / Geschenke.', en: 'Berry trees / gifts.' } },
  'in-a-pinch': { use: { de: 'Wirkt in Notlagen bei niedrigen KP (Beere).', en: 'Triggers at low HP (Berry).' }, acq: { de: 'Beerenbäume / Geschenke.', en: 'Berry trees / gifts.' } },
  // Beeren & Anbau
  'baking-only': { use: { de: 'Backzutat (Pokériegel/Wettbewerb), kaum Kampfnutzen.', en: 'Baking ingredient; little battle use.' }, acq: { de: 'Beerenbäume.', en: 'Berry trees.' } },
  'effort-drop': { use: { de: 'Senkt EVs und erhöht die Freundschaft (Beere).', en: 'Lowers EVs, raises friendship (Berry).' }, acq: { de: 'Beerenbäume.', en: 'Berry trees.' } },
  mulch: { use: { de: 'Dünger für Beerenfelder.', en: 'Fertiliser for berry fields.' }, acq: { de: 'Gärtnereien / Märkte.', en: 'Berry shops / marts.' } },
  // Kampf
  'stat-boosts': { use: { de: 'Erhöht Statuswerte im Kampf (X-Item).', en: 'Raises stats in battle (X items).' }, acq: { de: 'Märkte, BP-Shops.', en: 'Marts, BP shops.' } },
  // Tragitems & Verstärker
  'held-items': { use: { de: 'Wird getragen und wirkt im Kampf.', en: 'Held item with a battle effect.' }, acq: { de: 'Diverse Fundorte, Shops, Geschenke.', en: 'Various finds, shops, gifts.' } },
  'type-enhancement': { use: { de: 'Verstärkt Attacken eines Typs (getragen).', en: 'Boosts a type’s moves (held).' }, acq: { de: 'Fundorte, Shops.', en: 'Finds, shops.' } },
  'type-protection': { use: { de: 'Schwächt eine super-effektive Attacke einmalig (Beere).', en: 'Weakens one super-effective hit (Berry).' }, acq: { de: 'Beerenbäume / Geschenke.', en: 'Berry trees / gifts.' } },
  choice: { use: { de: 'Erhöht einen Wert stark, sperrt aber auf eine Attacke.', en: 'Big boost but locks into one move.' }, acq: { de: 'Geschenk / seltener Fund.', en: 'Gift / rare find.' } },
  'bad-held-items': { use: { de: 'Tragitem mit Nachteil – für Trick/Strategien.', en: 'Negative held item for trick strategies.' }, acq: { de: 'Fundorte / Shops.', en: 'Finds / shops.' } },
  scarves: { use: { de: 'Erhöht Wettbewerbswerte (Kontakt).', en: 'Raises contest condition.' }, acq: { de: 'Wettbewerbs-NPCs.', en: 'Contest NPCs.' } },
  'mega-stones': { use: { de: 'Ermöglicht die Mega-Entwicklung eines bestimmten Pokémon.', en: 'Enables a specific Pokémon’s Mega Evolution.' }, acq: { de: 'Fundorte/Belohnungen (XY/ORAS).', en: 'Finds/rewards (XY/ORAS).' } },
  'z-crystals': { use: { de: 'Ermöglicht eine Z-Attacke (Gen 7).', en: 'Enables a Z-Move (Gen 7).' }, acq: { de: 'Fundorte / Geschenke (SM/USUM).', en: 'Finds / gifts (SM/USUM).' } },
  plates: { use: { de: 'Verstärkt einen Typ und ändert Arceus’ Typ.', en: 'Boosts a type; sets Arceus’ type.' }, acq: { de: 'Fundorte (u. a. Sinnoh).', en: 'Finds (e.g. Sinnoh).' } },
  memories: { use: { de: 'Ändert den Typ von Silvarro/Typ:Null.', en: 'Sets Silvally/Type: Null’s type.' }, acq: { de: 'Geschenke / Shops (Gen 7+).', en: 'Gifts / shops (Gen 7+).' } },
  jewels: { use: { de: 'Einmalige Typ-Verstärkung (wird verbraucht).', en: 'One-time type boost (consumed).' }, acq: { de: 'Fundorte.', en: 'Finds.' } },
  'tera-shard': { use: { de: 'Tera-Stücke zum Ändern des Tera-Typs (SV).', en: 'Tera Shards to change Tera type (SV).' }, acq: { de: 'Fundorte/Belohnungen (Karmesin/Purpur).', en: 'Finds/rewards (Scarlet/Violet).' } },
  'nature-mints': { use: { de: 'Ändert die Wesens-Statusverteilung (nicht das Wesen selbst).', en: 'Changes nature’s stat spread (not the nature).' }, acq: { de: 'BP-/Delikatessen-Shops, Chansey Supply.', en: 'BP / Chansey Supply shops.' } },
  'species-specific': { use: { de: 'Nur für bestimmte Pokémon nützlich (Tragitem).', en: 'Useful only for specific Pokémon.' }, acq: { de: 'Fundorte / Geschenke.', en: 'Finds / gifts.' } },
  'effort-training': { use: { de: 'Beeinflusst das EV-Training (Power-/Macho-Items).', en: 'Affects EV training (Power/Macho items).' }, acq: { de: 'BP-Shops / Fundorte.', en: 'BP shops / finds.' } },
  // Entwicklung
  evolution: { use: { de: 'Löst die Entwicklung bestimmter Pokémon aus.', en: 'Triggers certain Pokémon evolutions.' }, acq: { de: 'Fundorte, Shops, Geschenke.', en: 'Finds, shops, gifts.' } },
  // Schlüssel-Items & Story
  'plot-advancement': { use: { de: 'Handlungsrelevantes Schlüssel-Item.', en: 'Story-relevant key item.' }, acq: { de: 'Story-Fortschritt / NPCs.', en: 'Story progress / NPCs.' } },
  gameplay: { use: { de: 'Schlüssel-Item mit Spielfunktion (z. B. Fahrrad, Angel).', en: 'Key item with a gameplay function.' }, acq: { de: 'Geschenk von NPCs.', en: 'Gift from NPCs.' } },
  'event-items': { use: { de: 'Event- bzw. Verteilungs-Item.', en: 'Event / distribution item.' }, acq: { de: 'Events / Verteilungen.', en: 'Events / distributions.' } },
  'dex-completion': { use: { de: 'Hilft beim Vervollständigen des Pokédex.', en: 'Helps complete the Pokédex.' }, acq: { de: 'Fundorte / Belohnungen.', en: 'Finds / rewards.' } },
  spelunking: { use: { de: 'Hilfsmittel für Höhlen/Erkundung.', en: 'Aid for caves/exploration.' }, acq: { de: 'Fundorte / Shops.', en: 'Finds / shops.' } },
  training: { use: { de: 'Unterstützt Training und Level-Aufstieg.', en: 'Supports training/levelling.' }, acq: { de: 'Fundorte / Belohnungen.', en: 'Finds / rewards.' } },
  flutes: { use: { de: 'Flöte mit Effekt (weckt, beruhigt usw.).', en: 'Flute with an effect.' }, acq: { de: 'Fundorte / Shops.', en: 'Finds / shops.' } },
  // Wertgegenstände
  collectibles: { use: { de: 'Wertgegenstand zum Verkaufen oder Sammeln.', en: 'Valuable to sell or collect.' }, acq: { de: 'Fundorte / von Wild-Pokémon.', en: 'Finds / wild Pokémon.' } },
  loot: { use: { de: 'Beutestück, meist zum Verkaufen.', en: 'Loot, usually to sell.' }, acq: { de: 'Fundorte / von Wild-Pokémon.', en: 'Finds / wild Pokémon.' } },
  // Post
  'all-mail': { use: { de: 'Brief, den getragene Pokémon übergeben können.', en: 'Mail a held Pokémon can carry.' }, acq: { de: 'Märkte / Geschenke.', en: 'Marts / gifts.' } },
  // Bonbons & Materialien (Gen 8/9)
  'species-candies': { use: { de: 'Bonbons für schnellen Level-/Statusaufstieg (Gen 8+).', en: 'Candy for quick levels/stats (Gen 8+).' }, acq: { de: 'Naturzone, Raids, Belohnungen.', en: 'Wild Area, raids, rewards.' } },
  'tm-materials': { use: { de: 'Material zum Herstellen von TMs an der TM-Maschine (SV).', en: 'Materials to craft TMs (SV).' }, acq: { de: 'Drops von Wild-Pokémon (Karmesin/Purpur).', en: 'Wild Pokémon drops (Scarlet/Violet).' } },
  'curry-ingredients': { use: { de: 'Zutat zum Kochen von Curry (Galar).', en: 'Curry-cooking ingredient (Galar).' }, acq: { de: 'Naturzone / Shops / Fund.', en: 'Wild Area / shops / finds.' } },
  'sandwich-ingredients': { use: { de: 'Zutat für Sandwiches/Mahlzeiten (Paldea).', en: 'Sandwich ingredient (Paldea).' }, acq: { de: 'Shops / Fund (SV).', en: 'Shops / finds (SV).' } },
  picnic: { use: { de: 'Picknick-Zubehör (Paldea).', en: 'Picnic gear (Paldea).' }, acq: { de: 'Shops (SV).', en: 'Shops (SV).' } },
  'miracle-shooter': { use: { de: 'Munition für den Wundershooter (e-Reader, Gen 3).', en: 'Miracle Shooter ammo (e-Reader, Gen 3).' } },
  other: { use: { de: 'Sonstiges Item.', en: 'Miscellaneous item.' } },
}
export const categoryUse = (cat: string, lang: 'de' | 'en') => CATEGORY_INFO[cat]?.use[lang] || null
export const categoryAcq = (cat: string, lang: 'de' | 'en') => CATEGORY_INFO[cat]?.acq?.[lang] || null

// External, full-detail reference (we link, never scrape). PokéWiki for DE, Bulbapedia for EN.
export const sourceUrl = (name: string, lang: 'de' | 'en') =>
  lang === 'de'
    ? `https://www.pokewiki.de/${encodeURIComponent(name.replace(/ /g, '_'))}`
    : `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`
