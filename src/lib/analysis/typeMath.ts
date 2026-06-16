// Type-effectiveness math built on the shared Gen 2-5 attack chart.
import { ALL_TYPES, ATTACK_CHART } from '../type-chart'

export { ALL_TYPES }

/** Effectiveness multiplier of one attacking type vs one defending type. */
export function attackEffect(atk: string, def: string): number {
  const m = ATTACK_CHART[atk]
  if (!m) return 1
  if (m.no.includes(def)) return 0
  if (m.sup.includes(def)) return 2
  if (m.not.includes(def)) return 0.5
  return 1
}

/** Combined multiplier of an attacking type vs a defender with one or two types. */
export function defenseMultiplier(atk: string, defenderTypes: string[]): number {
  if (defenderTypes.length === 0) return 1
  return defenderTypes.reduce((mult, dt) => mult * attackEffect(atk, dt), 1)
}

/** Best multiplier any of the attacker's types achieves vs a defender. */
export function bestOffenseVs(attackTypes: string[], defenderTypes: string[]): number {
  let best = 0
  for (const at of attackTypes) best = Math.max(best, defenseMultiplier(at, defenderTypes))
  return best
}
