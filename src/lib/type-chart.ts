// Gen 2-5 type chart (17 types — no Fairy)
// Each entry: sup = 2x, not = 0.5x, no = 0x (from attacker's perspective)
export const ALL_TYPES = [
  'normal','fire','water','electric','grass','ice',
  'fighting','poison','ground','flying','psychic',
  'bug','rock','ghost','dragon','dark','steel',
] as const

export type PkType = typeof ALL_TYPES[number]

interface Matchup { sup: string[]; not: string[]; no: string[] }

export const ATTACK_CHART: Record<string, Matchup> = {
  normal:   { sup: [],                                              not: ['rock','steel'],                                                no: ['ghost'] },
  fire:     { sup: ['grass','ice','bug','steel'],                   not: ['fire','water','rock','dragon'],                               no: [] },
  water:    { sup: ['fire','ground','rock'],                        not: ['water','grass','dragon'],                                     no: [] },
  electric: { sup: ['water','flying'],                              not: ['electric','grass','dragon'],                                  no: ['ground'] },
  grass:    { sup: ['water','ground','rock'],                       not: ['fire','grass','poison','flying','bug','dragon','steel'],       no: [] },
  ice:      { sup: ['grass','ground','flying','dragon'],            not: ['water','ice','steel'],                                        no: [] },
  fighting: { sup: ['normal','ice','rock','dark','steel'],          not: ['poison','flying','psychic','bug'],                            no: ['ghost'] },
  poison:   { sup: ['grass'],                                       not: ['poison','ground','rock','ghost'],                            no: ['steel'] },
  ground:   { sup: ['fire','electric','poison','rock','steel'],     not: ['grass','bug'],                                               no: ['flying'] },
  flying:   { sup: ['grass','fighting','bug'],                      not: ['electric','rock','steel'],                                   no: [] },
  psychic:  { sup: ['fighting','poison'],                           not: ['psychic','steel'],                                           no: ['dark'] },
  bug:      { sup: ['grass','psychic','dark'],                      not: ['fire','fighting','flying','ghost','steel'],                  no: [] },
  rock:     { sup: ['fire','ice','flying','bug'],                   not: ['fighting','ground','steel'],                                 no: [] },
  ghost:    { sup: ['psychic','ghost'],                             not: ['dark','steel'],                                              no: ['normal'] },
  dragon:   { sup: ['dragon'],                                      not: ['steel'],                                                     no: [] },
  dark:     { sup: ['psychic','ghost'],                             not: ['fighting','dark','steel'],                                   no: [] },
  steel:    { sup: ['ice','rock'],                                  not: ['fire','water','electric','steel'],                           no: [] },
}

export interface TypeMatchups {
  // Offensive (this type attacks)
  superVs:   string[]
  notVeryVs: string[]
  noEffectVs: string[]
  // Defensive (this type is attacked)
  weakTo:    string[]
  resistantTo: string[]
  immuneTo:  string[]
}

export function getTypeMatchups(type: string): TypeMatchups {
  const atk = ATTACK_CHART[type] ?? { sup: [], not: [], no: [] }
  const weakTo: string[] = []
  const resistantTo: string[] = []
  const immuneTo: string[] = []

  for (const attacker of ALL_TYPES) {
    const m = ATTACK_CHART[attacker]
    if (m.sup.includes(type))  weakTo.push(attacker)
    if (m.not.includes(type))  resistantTo.push(attacker)
    if (m.no.includes(type))   immuneTo.push(attacker)
  }

  return {
    superVs:     atk.sup,
    notVeryVs:   atk.not,
    noEffectVs:  atk.no,
    weakTo,
    resistantTo,
    immuneTo,
  }
}
