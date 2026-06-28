// Offline item index (P2) — bundled compact data for instant browse/search/filter.
// Lazy detail (effect, flavour, buy/sell, fling) lives in itemDetail.ts.
import raw from '../../data/items.json'

export interface ItemEntry { id: number; n: string; de: string; en: string; c: string; cost: number }

export const ITEMS = raw as ItemEntry[]
const byId = new Map(ITEMS.map((it) => [it.id, it]))
export const itemEntry = (id: number): ItemEntry | null => byId.get(id) || null
export const itemName = (it: ItemEntry, lang: 'de' | 'en') => (lang === 'de' ? it.de || it.en : it.en || it.de)
export const itemSprite = (n: string) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${n}.png`
export const catLabel = (c: string) => c.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())

// All distinct categories (sorted) for the filter dropdown.
export const ITEM_CATEGORIES = [...new Set(ITEMS.map((it) => it.c))].sort((a, b) => a.localeCompare(b))

export function searchItems(query: string, opts: { cat?: string } = {}): ItemEntry[] {
  const q = query.trim().toLowerCase()
  const cat = opts.cat || null
  return ITEMS.filter((it) => {
    if (cat && it.c !== cat) return false
    if (q && !(it.de.toLowerCase().includes(q) || it.en.toLowerCase().includes(q))) return false
    return true
  })
}
