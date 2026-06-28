// Shared learn-method buckets for the SoulDex move sections (Pokémon detail + move
// learners). PokéAPI has many niche methods; we keep the four players care about.
export type LearnMethod = 'level-up' | 'machine' | 'tutor' | 'egg'
export const LEARN_METHODS: LearnMethod[] = ['level-up', 'machine', 'tutor', 'egg']
export const bucketMethod = (name: string): LearnMethod | null => (LEARN_METHODS.includes(name as LearnMethod) ? (name as LearnMethod) : null)
export const METHOD_LABEL: Record<'de' | 'en', Record<LearnMethod, string>> = {
  de: { 'level-up': 'Level-Up', machine: 'TM/VM', tutor: 'Lehrer', egg: 'Ei-Attacken' },
  en: { 'level-up': 'Level-up', machine: 'TM/HM', tutor: 'Tutor', egg: 'Egg moves' },
}
