// Offline AbilityDex index — bundled compact data for instant browse/search.
// fd = German in-game flavour (plain-German explanation). Detail (precise mechanic +
// holders) loads lazily in abilityDetail.ts.
import raw from '../../data/abilities.json'

export interface AbilityEntry { id: number; de: string; en: string; fd: string }

export const ABILITIES = raw as AbilityEntry[]
const byId = new Map(ABILITIES.map((a) => [a.id, a]))
export const abilityEntry = (id: number): AbilityEntry | null => byId.get(id) || null
export const abilityName = (a: AbilityEntry, lang: 'de' | 'en') => (lang === 'de' ? a.de || a.en : a.en || a.de)

export function searchAbilities(query: string): AbilityEntry[] {
  const q = query.trim().toLowerCase()
  const list = q ? ABILITIES.filter((a) => a.de.toLowerCase().includes(q) || a.en.toLowerCase().includes(q) || a.fd.toLowerCase().includes(q)) : ABILITIES
  return [...list]
}
