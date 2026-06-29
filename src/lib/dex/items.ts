// Offline item index (P2) — bundled compact data for instant browse/search/filter.
// Lazy detail (effect, flavour, buy/sell, fling) lives in itemDetail.ts.
import raw from '../../data/items.json'

export interface ItemEntry { id: number; n: string; de: string; en: string; c: string; p: string; cost: number }

// Drop placeholder / non-usable entries (missing names, "★…" glitch items, unused data).
const HIDDEN_CATS = new Set(['unused', 'all-machines', 'data-cards', 'dynamax-crystals'])
const isReal = (it: ItemEntry) => !!it.en && !/^[★☆?]/.test(it.en) && !/^[★☆?]/.test(it.de || '') && !HIDDEN_CATS.has(it.c)
export const ITEMS = (raw as ItemEntry[]).filter(isReal)

const byId = new Map(ITEMS.map((it) => [it.id, it]))
export const itemEntry = (id: number): ItemEntry | null => byId.get(id) || null
export const itemName = (it: ItemEntry, lang: 'de' | 'en') => (lang === 'de' ? it.de || it.en : it.en || it.de)
export const itemSprite = (n: string) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${n}.png`

// High-level pockets → clean, fully-translated filter groups (instead of ~50 raw categories).
export const POCKETS = ['pokeballs', 'medicine', 'battle', 'berries', 'machines', 'key', 'misc'] as const
const POCKET_LABEL: Record<'de' | 'en', Record<string, string>> = {
  de: { pokeballs: 'Pokébälle', medicine: 'Medizin', battle: 'Kampf-Items', berries: 'Beeren', machines: 'TM/VM', key: 'Schlüssel-Items', misc: 'Sonstiges' },
  en: { pokeballs: 'Poké Balls', medicine: 'Medicine', battle: 'Battle items', berries: 'Berries', machines: 'TMs/HMs', key: 'Key items', misc: 'Misc' },
}
export const pocketLabel = (p: string, lang: 'de' | 'en') => POCKET_LABEL[lang][p] || POCKET_LABEL[lang].misc

// German labels for the granular categories; English just title-cases the slug.
const CAT_DE: Record<string, string> = {
  'standard-balls': 'Pokébälle', 'special-balls': 'Spezialbälle', 'apricorn-balls': 'Apricorn-Bälle',
  healing: 'Heilung', 'status-cures': 'Statusheilung', revival: 'Belebung', 'pp-recovery': 'AP-Heilung', vitamins: 'Vitamine', medicine: 'Medizin',
  evolution: 'Entwicklung', 'mega-stones': 'Mega-Steine', 'z-crystals': 'Z-Kristalle', plates: 'Tafeln', memories: 'Disketten', 'nature-mints': 'Wesen-Minzen',
  'held-items': 'Tragbare Items', choice: 'Wahl-Items', 'type-enhancement': 'Typ-Verstärker', 'type-protection': 'Typ-Schutz', 'bad-held-items': 'Negative Items', scarves: 'Schals', jewels: 'Juwelen',
  berries: 'Beeren', 'in-a-pinch': 'Notfall-Beeren', 'picky-healing': 'Heil-Beeren', 'baking-only': 'Back-Beeren', 'effort-drop': 'EV-Senker', 'stat-boosts': 'Statuswert-Booster', 'effort-training': 'EV-Training',
  machines: 'TM/VM', 'plot-advancement': 'Story-Items', 'event-items': 'Event-Items', gameplay: 'Spielhilfen', collectibles: 'Sammelobjekte', loot: 'Wertgegenstände', mulch: 'Dünger', flutes: 'Flöten',
  'species-specific': 'Spezies-Items', 'species-candies': 'Bonbons', training: 'Training', 'catching-bonus': 'Fang-Bonus', 'dex-completion': 'Dex-Hilfe', spelunking: 'Höhlen-Items', 'curry-ingredients': 'Curry-Zutaten',
  'all-mail': 'Briefe', 'tera-shard': 'Tera-Stücke', 'miracle-shooter': 'Wundershooter', other: 'Sonstiges',
}
const titleize = (c: string) => c.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
export const catLabel = (it: ItemEntry, lang: 'de' | 'en') => (lang === 'de' ? CAT_DE[it.c] || pocketLabel(it.p, 'de') : titleize(it.c))

export function searchItems(query: string, opts: { pocket?: string } = {}): ItemEntry[] {
  const q = query.trim().toLowerCase()
  const pocket = opts.pocket || null
  return ITEMS.filter((it) => {
    if (pocket && it.p !== pocket) return false
    if (q && !(it.de.toLowerCase().includes(q) || it.en.toLowerCase().includes(q))) return false
    return true
  })
}
