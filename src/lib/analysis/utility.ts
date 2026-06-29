// Deterministic utility-move detection for the team coach. We resolve each encounter's
// stored move names → the bundled move index → classify by a curated English-name set
// (+ the move's own priority flag). Offline, no fetch, no LLM.
import type { Encounter } from '../../types/database'
import { moveEntry, moveIdByName } from '../dex/moves'

export type UtilTag = 'hazardSet' | 'hazardRemove' | 'recovery' | 'pivot' | 'screens' | 'weather' | 'status' | 'priority' | 'support'

export const UTIL_LABEL: Record<'de' | 'en', Record<UtilTag, string>> = {
  de: { hazardSet: 'Hazard-Setter', hazardRemove: 'Hazard-Entfernung', recovery: 'Heilung/Recovery', pivot: 'Pivot-Moves', screens: 'Schutzschilde', weather: 'Wetter', status: 'Statusattacken', priority: 'Prioritätsattacken', support: 'Support' },
  en: { hazardSet: 'Hazard setter', hazardRemove: 'Hazard removal', recovery: 'Recovery', pivot: 'Pivot moves', screens: 'Screens', weather: 'Weather', status: 'Status moves', priority: 'Priority moves', support: 'Support' },
}
// Important roles a balanced team usually wants — drives the "missing utility" hint.
export const IMPORTANT_TAGS: UtilTag[] = ['hazardSet', 'hazardRemove', 'recovery', 'pivot', 'status']

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
const SETS: Record<Exclude<UtilTag, 'priority'>, string[]> = {
  hazardSet: ['stealthrock', 'spikes', 'toxicspikes', 'stickyweb', 'stoneaxe', 'ceaselessedge'],
  hazardRemove: ['rapidspin', 'defog', 'mortalspin', 'tidyup', 'courtchange'],
  recovery: ['recover', 'roost', 'synthesis', 'moonlight', 'morningsun', 'slackoff', 'softboiled', 'milkdrink', 'wish', 'rest', 'shoreup', 'strengthsap', 'lifedew', 'junglehealing', 'healorder', 'aquaring'],
  pivot: ['uturn', 'voltswitch', 'flipturn', 'partingshot', 'teleport', 'batonpass', 'chillyreception', 'shedtail'],
  screens: ['reflect', 'lightscreen', 'auroraveil'],
  weather: ['raindance', 'sunnyday', 'sandstorm', 'hail', 'snowscape', 'chillyreception'],
  status: ['thunderwave', 'willowisp', 'toxic', 'toxicspikes', 'spore', 'sleeppowder', 'stunspore', 'glare', 'nuzzle', 'yawn', 'hypnosis', 'sing', 'darkvoid', 'poisonpowder', 'confuseray', 'grasswhistle', 'lovelykiss'],
  support: ['helpinghand', 'tailwind', 'trickroom', 'healbell', 'aromatherapy', 'safeguard', 'coaching', 'decorate', 'mist'],
}
const SET_TAGS = Object.keys(SETS) as Exclude<UtilTag, 'priority'>[]

export interface UtilHit { enc: Encounter; move: string }
export interface UtilityReport {
  found: Partial<Record<UtilTag, UtilHit[]>>
  present: UtilTag[]
  missingImportant: UtilTag[]
}

export function analyzeUtility(encs: Encounter[]): UtilityReport {
  const found: Partial<Record<UtilTag, UtilHit[]>> = {}
  const push = (tag: UtilTag, hit: UtilHit) => { (found[tag] ||= []).push(hit) }
  for (const enc of encs) {
    for (const raw of [enc.move_1, enc.move_2, enc.move_3, enc.move_4]) {
      const name = (raw || '').trim()
      if (!name) continue
      const m = moveEntry(moveIdByName(name) ?? -1)
      const key = norm(m ? m.en : name)
      for (const tag of SET_TAGS) if (SETS[tag].includes(key)) push(tag, { enc, move: name })
      if (m && m.pri > 0 && m.c !== 'status') push('priority', { enc, move: name })
    }
  }
  const present = (Object.keys(found) as UtilTag[]).filter((t) => found[t]!.length)
  const missingImportant = IMPORTANT_TAGS.filter((t) => !present.includes(t))
  return { found, present, missingImportant }
}
