// Offline move index (P2) — bundled compact data for instant browse/search/filter.
// Lazy detail (effect, flavour, learners) lives in moveDetail.ts.
import raw from '../../data/moves.json'

export type MoveCat = 'physical' | 'special' | 'status'
export interface MoveEntry { id: number; de: string; en: string; t: string; c: MoveCat; pow: number | null; acc: number | null; pp: number | null; pri: number }

export const MOVES = raw as MoveEntry[]
const byId = new Map(MOVES.map((m) => [m.id, m]))
export const moveEntry = (id: number): MoveEntry | null => byId.get(id) || null

// Resolve a move NAME (DE or EN, case-insensitive) → move id (run surfaces store names).
const normName = (s: string) => s.toLowerCase().trim()
const NAME_TO_ID = new Map<string, number>()
for (const m of MOVES) { NAME_TO_ID.set(normName(m.de), m.id); NAME_TO_ID.set(normName(m.en), m.id) }
export const moveIdByName = (name: string | null | undefined): number | null => (name ? NAME_TO_ID.get(normName(name)) ?? null : null)
export const moveName = (m: MoveEntry, lang: 'de' | 'en') => (lang === 'de' ? m.de || m.en : m.en || m.de)

export const MOVE_CATS: MoveCat[] = ['physical', 'special', 'status']
export const CAT_LABEL: Record<'de' | 'en', Record<MoveCat, string>> = {
  de: { physical: 'Physisch', special: 'Spezial', status: 'Status' },
  en: { physical: 'Physical', special: 'Special', status: 'Status' },
}
export const catColor = (c: MoveCat) => (c === 'physical' ? '#f08030' : c === 'special' ? '#6890f0' : '#a8a8a8')

export function searchMoves(query: string, opts: { types?: string[]; cats?: MoveCat[] } = {}): MoveEntry[] {
  const q = query.trim().toLowerCase()
  const types = opts.types && opts.types.length ? new Set(opts.types) : null
  const cats = opts.cats && opts.cats.length ? new Set(opts.cats) : null
  return MOVES.filter((m) => {
    if (types && !types.has(m.t)) return false
    if (cats && !cats.has(m.c)) return false
    if (q && !(m.de.toLowerCase().includes(q) || m.en.toLowerCase().includes(q))) return false
    return true
  })
}
