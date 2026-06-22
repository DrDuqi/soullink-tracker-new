// Data model for the interactive Story Guide. A Story is an ordered list of
// chapters; the live emulator location auto-selects the current chapter, so the
// guide advances by itself while the user plays. Designed to be extended easily
// (more editions = more Story objects; future trainer/move/dex data hangs off the
// same chapter shape).

export type ChapterKind = 'town' | 'route' | 'cave' | 'forest' | 'gym' | 'misc'

export interface StoryMon { name: string; level: number }

export interface StoryTrainer {
  name: string
  title?: string
  team: StoryMon[]
  danger?: boolean   // flag tough fights so the UI can warn
}

export interface StoryItem { name: string; note?: string }

export interface GymInfo {
  leader: string
  type: string                 // German type name, e.g. "Gestein"
  badge: string                // e.g. "Kohle-Orden"
  recommendedTypes: string[]   // types that do well here
  dangerMons: string[]         // ace / problematic mons
  keyMoves?: string[]          // moves to watch out for
}

export interface StoryChapter {
  id: string
  title: string                // "Erzelingen"
  kind: ChapterKind
  /** Location names that map this chapter to the live emulator location (+ aliases). */
  locations: string[]
  /** Optional emulator map IDs (filled in as they are confirmed) for ID-based matching. */
  mapIds?: number[]
  goal: string                 // next main objective, "Besiege Veit"
  recommendedLevel?: [number, number]
  todos: string[]
  trainers?: StoryTrainer[]
  items?: StoryItem[]
  hiddenItems?: StoryItem[]
  /** Route names (matching the app's route list) to cross-check caught encounters. */
  encounters?: string[]
  gym?: GymInfo
}

export interface Story {
  game: string                 // emulator code, e.g. "platinum"
  label: string                // "Pokémon Platin"
  region: string               // "Sinnoh"
  chapters: StoryChapter[]
}
