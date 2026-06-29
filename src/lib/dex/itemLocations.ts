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

// External, full-detail reference (we link, never scrape). PokéWiki for DE, Bulbapedia for EN.
export const sourceUrl = (name: string, lang: 'de' | 'en') =>
  lang === 'de'
    ? `https://www.pokewiki.de/${encodeURIComponent(name.replace(/ /g, '_'))}`
    : `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`
