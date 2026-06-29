// Core strategy-analysis engine. Pure functions over the current team data —
// no side effects, no fetching. The panel feeds it encounters + (async-loaded)
// stats/move-types and renders the structured result. Modular: new battle
// targets or extra metrics can be layered on without changing existing output.
import type { Encounter, SoulLinkPair } from '../../types/database'
import type { PokemonStats } from '../pokemon-api'
import { TYPE_NAMES_DE } from '../pokemon-api'
import { ALL_TYPES, attackEffect, defenseMultiplier } from './typeMath'
import { dexEntry } from '../dex/dex'
import type { GymLeader } from './gyms'

const de = (t: string) => TYPE_NAMES_DE[t] ?? t

export interface AnalyzedMember {
  enc: Encounter
  types: string[]
  attackTypes: string[]   // STAB + known move types
  stats: PokemonStats | null
  bst: number
}

export interface CarryEntry {
  enc: Encounter
  score: number
  medal: string
  reasons: string[]
}

export interface FullAnalysis {
  count: number
  overall: number        // 0-10 (one decimal)
  stars: number          // 0-5
  synergy: number        // 0-100
  synergyNotes: string[]
  strengths: string[]
  weaknesses: string[]
  missingOffense: string[]
  missingDefense: string[]
  missingResistances: string[]
  recommendations: string[]
  carries: CarryEntry[]
}

export interface SoulLinkInsight {
  complement: string[]
  duplicateWeaknesses: string[]
  duplicateTypes: string[]
  missingTypes: string[]
  importantLinks: { pair: SoulLinkPair; reason: string }[]
  riskyLinks: { pair: SoulLinkPair; reason: string }[]
}

export interface GymInsight {
  gym: GymLeader
  risk: 'easy' | 'mid' | 'hard'
  riskReasons: { ok: boolean; text: string }[]
  excellent: Encounter[]
  good: Encounter[]
  bad: Encounter[]
  avoid: Encounter[]
  recommendedTypes: string[]
  dangers: string[]
}

// Defensive answer (resists / immune) to a given attacking weakness.
const COUNTER_FOR: Record<string, string[]> = {
  normal: ['rock', 'steel', 'ghost'],
  fire: ['water', 'rock', 'ground'],
  water: ['grass', 'electric'],
  electric: ['ground'],
  grass: ['fire', 'flying', 'poison'],
  ice: ['fire', 'steel', 'water'],
  fighting: ['flying', 'psychic'],
  poison: ['ground', 'psychic', 'steel'],
  ground: ['grass', 'flying'],
  flying: ['rock', 'electric', 'steel'],
  psychic: ['dark', 'steel'],
  bug: ['fire', 'flying', 'rock'],
  rock: ['fighting', 'ground', 'steel'],
  ghost: ['dark', 'normal'],
  dragon: ['ice', 'dragon', 'steel'],
  dark: ['fighting', 'bug'],
  steel: ['fire', 'fighting', 'ground'],
}

export function buildMembers(
  encs: Encounter[],
  statsMap: Record<number, PokemonStats>,
  moveTypesMap: Record<string, string[]>,
): AnalyzedMember[] {
  return encs.map((enc) => {
    const types = (enc.types ?? []).filter(Boolean)
    const stats = enc.pokemon_id != null ? statsMap[enc.pokemon_id] ?? null : null
    const moveTypes = moveTypesMap[enc.id] ?? []
    const attackTypes = [...new Set([...types, ...moveTypes])]
    const bst = stats
      ? stats.hp + stats.attack + stats.defense + stats.specialAttack + stats.specialDefense + stats.speed
      : 0
    return { enc, types, attackTypes, stats, bst }
  })
}

interface DefAgg {
  perType: Record<string, { weak: number; resist: number; immune: number }>
  sharedWeak: string[]
  anyResist: Set<string>
}

function defenseAgg(members: AnalyzedMember[]): DefAgg {
  const perType: DefAgg['perType'] = {}
  const anyResist = new Set<string>()
  for (const atk of ALL_TYPES) {
    let weak = 0, resist = 0, immune = 0
    for (const m of members) {
      if (m.types.length === 0) continue
      const mult = defenseMultiplier(atk, m.types)
      if (mult === 0) { immune++; anyResist.add(atk) }
      else if (mult > 1) weak++
      else if (mult < 1) { resist++; anyResist.add(atk) }
    }
    perType[atk] = { weak, resist, immune }
  }
  const sharedWeak = ALL_TYPES.filter((t) => perType[t].weak >= 2)
  return { perType, sharedWeak, anyResist }
}

function offenseCovered(members: AnalyzedMember[]): Set<string> {
  const covered = new Set<string>()
  for (const def of ALL_TYPES) {
    for (const m of members) {
      if (m.attackTypes.some((at) => attackEffect(at, def) === 2)) { covered.add(def); break }
    }
  }
  return covered
}

export function roleOf(stats: PokemonStats | null): string {
  if (!stats) return 'Unbekannt'
  const phys = stats.attack, spec = stats.specialAttack
  const bulk = stats.hp + stats.defense + stats.specialDefense
  const off = Math.max(phys, spec)
  if (off >= 100 && stats.speed >= 95) return 'Schneller Sweeper'
  if (bulk >= 260 && off < 95) return 'Defensiv-Wall'
  if (phys >= spec + 15) return 'Physischer Angreifer'
  if (spec >= phys + 15) return 'Spezial-Angreifer'
  if (stats.speed >= 95) return 'Schneller Angreifer'
  return 'Allrounder'
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function analyzeTeam(members: AnalyzedMember[], linkedEncIds: Set<string>): FullAnalysis {
  const count = members.length
  if (count === 0) {
    return {
      count: 0, overall: 0, stars: 0, synergy: 0, synergyNotes: [],
      strengths: [], weaknesses: [], missingOffense: [...ALL_TYPES],
      missingDefense: [], missingResistances: [...ALL_TYPES],
      recommendations: ['Nimm zuerst bestätigte SoulLinks ins Team auf.'], carries: [],
    }
  }

  const def = defenseAgg(members)
  const covered = offenseCovered(members)
  const presentTypes = new Set<string>()
  members.forEach((m) => m.types.forEach((t) => presentTypes.add(t)))

  const missingOffense: string[] = ALL_TYPES.filter((t) => !covered.has(t))
  const missingResistances: string[] = ALL_TYPES.filter((t) => !def.anyResist.has(t))
  const missingDefense: string[] = ALL_TYPES.filter((t) => !def.anyResist.has(t) && def.perType[t].weak > 0)

  const withStats = members.filter((m) => m.stats)
  const avg = (sel: (s: PokemonStats) => number) =>
    withStats.length ? Math.round(withStats.reduce((a, m) => a + sel(m.stats!), 0) / withStats.length) : 0
  const avgDef = avg((s) => s.defense)
  const avgSpDef = avg((s) => s.specialDefense)
  const avgSpd = avg((s) => s.speed)

  // ── Strengths ──────────────────────────────────────────────
  const strengths: string[] = []
  if (presentTypes.size >= Math.min(8, count + 2)) strengths.push('Gute Typenvielfalt')
  if (covered.size >= 12) strengths.push('Breite offensive Abdeckung')
  const totalResist = ALL_TYPES.reduce((a, t) => a + def.perType[t].resist + def.perType[t].immune, 0)
  if (totalResist >= count * 4) strengths.push('Viele Resistenzen')
  if (avgDef >= 90) strengths.push('Gute physische Defensive')
  if (avgSpDef >= 90) strengths.push('Gute spezielle Defensive')
  if (avgSpd >= 90) strengths.push('Gute Initiative')
  if (strengths.length === 0) strengths.push('Solide Basis – Team noch im Aufbau')

  // ── Weaknesses ─────────────────────────────────────────────
  const weaknesses: string[] = []
  for (const t of def.sharedWeak) weaknesses.push(`${def.perType[t].weak} Pokémon schwach gegen ${de(t)}`)
  for (const t of ['ground', 'fire', 'ice', 'fighting']) {
    if (missingOffense.includes(t)) weaknesses.push(`Keine ${de(t)}-Offensive`)
  }
  if (withStats.length && avgSpDef < 70) weaknesses.push('Kaum spezielle Defensive')
  if (withStats.length && avgSpd < 65) weaknesses.push('Geringe durchschnittliche Initiative')
  const dragonAnswer = members.some((m) => m.attackTypes.some((at) => at === 'ice' || at === 'dragon'))
  if (!dragonAnswer) weaknesses.push('Keine sichere Antwort gegen Drachen')
  if (weaknesses.length === 0) weaknesses.push('Keine gravierenden Schwächen erkennbar')

  // ── Recommendations ────────────────────────────────────────
  const recommendations: string[] = []
  for (const t of def.sharedWeak) {
    const counter = (COUNTER_FOR[t] ?? [])[0]
    if (counter) recommendations.push(`Ein ${de(counter)}-Pokémon würde eure ${de(t)}-Schwäche entschärfen.`)
  }
  if (missingOffense.includes('ground')) recommendations.push('Eine Boden-Attacke verbessert die Abdeckung gegen Stahl, Elektro & Gestein.')
  if (missingOffense.includes('fire')) recommendations.push('Ein Feuer-Pokémon würde Stahl, Pflanze & Eis deutlich besser abdecken.')
  if (withStats.length) {
    const sweepers = members.filter((m) => m.stats && m.stats.speed >= 95 && Math.max(m.stats.attack, m.stats.specialAttack) >= 95)
    if (sweepers.length === 0) recommendations.push('Ein schneller Sweeper fehlt.')
    const specials = members.filter((m) => m.stats && m.stats.specialAttack > m.stats.attack)
    if (specials.length <= 1) recommendations.push('Ein spezieller Angreifer würde das Team ausgleichen.')
  }
  if (recommendations.length === 0) recommendations.push('Gut aufgestellt – halte die SoulLinks am Leben.')

  // ── Synergy score (0-100) ──────────────────────────────────
  const coverageScore = (covered.size / ALL_TYPES.length) * 40
  const resistScore = (def.anyResist.size / ALL_TYPES.length) * 30
  const roleVariety = new Set(withStats.map((m) => roleOf(m.stats))).size
  const roleScore = Math.min(15, roleVariety * 4)
  const weaknessPenalty = Math.min(20, def.sharedWeak.length * 5)
  const synergy = clamp(Math.round(coverageScore + resistScore + roleScore + 15 - weaknessPenalty), 5, 99)

  const synergyNotes: string[] = []
  if (covered.size >= 12) synergyNotes.push('✔ Gute Typenabdeckung')
  else synergyNotes.push('⚠ Lückenhafte offensive Abdeckung')
  if (roleVariety >= 3) synergyNotes.push('✔ Gute Rollenverteilung')
  else synergyNotes.push('⚠ Wenig Rollenvielfalt')
  if (def.sharedWeak.length === 0) synergyNotes.push('✔ Keine geteilten Schwächen')
  else synergyNotes.push(`⚠ Geteilte Schwäche: ${def.sharedWeak.map(de).join(', ')}`)

  const overall = Math.round((synergy / 10) * 10) / 10
  const stars = clamp(Math.round(synergy / 20), 0, 5)

  // ── Carries ────────────────────────────────────────────────
  const medals = ['🥇', '🥈', '🥉']
  const scored = members.map((m) => {
    let score = 0
    const reasons: string[] = []
    if (m.stats) {
      score += Math.min(40, (m.bst / 600) * 38)
      if (m.bst >= 500) reasons.push(`Starke Basiswerte (${m.bst})`)
      if (m.stats.speed >= 95) { score += 8; reasons.push('Hohe Initiative') }
      if (Math.max(m.stats.attack, m.stats.specialAttack) >= 100) { score += 8; reasons.push('Hoher Angriff') }
    }
    const resisted = ALL_TYPES.filter((t) => defenseMultiplier(t, m.types) < 1).length
    score += Math.min(18, resisted * 1.8)
    if (resisted >= 6) reasons.push('Viele Resistenzen')
    const hits = ALL_TYPES.filter((d) => m.attackTypes.some((at) => attackEffect(at, d) === 2)).length
    score += Math.min(16, hits * 1.5)
    if (hits >= 6) reasons.push('Breite Angriffsabdeckung')
    if (linkedEncIds.has(m.enc.id)) { score += 10; reasons.push('Wertvoller SoulLink') }
    if (reasons.length === 0) reasons.push('Solider Allrounder')
    return { enc: m.enc, score: Math.round(score), reasons: reasons.slice(0, 3) }
  }).sort((a, b) => b.score - a.score)

  const carries: CarryEntry[] = scored.slice(0, 3).map((c, i) => ({ ...c, medal: medals[i] }))

  return {
    count, overall, stars, synergy, synergyNotes,
    strengths, weaknesses, missingOffense, missingDefense, missingResistances,
    recommendations, carries,
  }
}

export function analyzeSoulLinks(
  myMembers: AnalyzedMember[],
  partnerMembers: AnalyzedMember[],
  pairs: SoulLinkPair[],
): SoulLinkInsight {
  const myDef = defenseAgg(myMembers)
  const pDef = defenseAgg(partnerMembers)

  const myUnresolved = ALL_TYPES.filter((t) => myDef.perType[t].weak > 0 && !myDef.anyResist.has(t))
  const pUnresolved = ALL_TYPES.filter((t) => pDef.perType[t].weak > 0 && !pDef.anyResist.has(t))

  const complement: string[] = []
  const coveredByPartner = myUnresolved.filter((t) => pDef.anyResist.has(t))
  const coveredByMe = pUnresolved.filter((t) => myDef.anyResist.has(t))
  if (coveredByPartner.length) complement.push(`Partner deckt deine Schwächen ab: ${coveredByPartner.map(de).join(', ')}`)
  if (coveredByMe.length) complement.push(`Du deckst die Schwächen des Partners ab: ${coveredByMe.map(de).join(', ')}`)
  if (complement.length === 0 && (myMembers.length || partnerMembers.length))
    complement.push('Die Teams ergänzen sich defensiv kaum – auf geteilte Schwächen achten.')

  const duplicateWeaknesses = ALL_TYPES.filter((t) => myUnresolved.includes(t) && pUnresolved.includes(t))

  const myTypes = new Set<string>(); myMembers.forEach((m) => m.types.forEach((t) => myTypes.add(t)))
  const pTypes = new Set<string>(); partnerMembers.forEach((m) => m.types.forEach((t) => pTypes.add(t)))
  const duplicateTypes = [...myTypes].filter((t) => pTypes.has(t))

  const combined = [...myMembers, ...partnerMembers]
  const covered = offenseCovered(combined)
  const missingTypes = ALL_TYPES.filter((t) => !covered.has(t))

  // Active links where BOTH members are currently teamed
  const byId = new Map(combined.map((m) => [m.enc.id, m]))
  const teamPairs = pairs.filter((p) => byId.has(p.encounter1.id) && byId.has(p.encounter2.id))

  const importantLinks = [...teamPairs]
    .map((p) => ({ pair: p, value: (byId.get(p.encounter1.id)?.bst ?? 0) + (byId.get(p.encounter2.id)?.bst ?? 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map(({ pair, value }) => ({ pair, reason: value > 0 ? `Hoher Gesamtwert (BST ${value})` : 'Aktiv im Team beider Spieler' }))

  const riskyLinks = [...teamPairs]
    .map((p) => {
      const a = byId.get(p.encounter1.id)!, b = byId.get(p.encounter2.id)!
      const resA = ALL_TYPES.filter((t) => defenseMultiplier(t, a.types) < 1).length
      const resB = ALL_TYPES.filter((t) => defenseMultiplier(t, b.types) < 1).length
      return { pair: p, fragility: -(resA + resB) }
    })
    .sort((a, b) => b.fragility - a.fragility)
    .slice(0, 2)
    .map(({ pair }) => ({ pair, reason: 'Wenige Resistenzen – dieser Link sollte nicht fallen.' }))

  return { complement, duplicateWeaknesses, duplicateTypes, missingTypes, importantLinks, riskyLinks }
}

// ── Detailed dashboard analysis (the "coach" view) ─────────────────────────────
// Same engine/inputs as analyzeTeam — just a richer, structured breakdown for the
// full-screen dashboard. No duplicate logic: reuses defenseAgg/offenseCovered/roleOf.
export interface TeamBalance {
  physical: number; special: number
  offensive: number; defensive: number            // averaged 0-~150 for bars
  roles: { role: string; count: number }[]
  typeDist: { type: string; count: number }[]
  avg: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number; bst: number }
  withStats: number
}
export interface TypeAnalysis {
  weaknesses: { type: string; count: number }[]
  resistances: { type: string; count: number }[]
  immunities: { type: string; count: number }[]
  dangerous: string[]
  missingResist: string[]
}
export interface OffenseAnalysis { hitsWell: string[]; problematic: string[]; missingAttackTypes: string[] }
export interface TeamDashboard { count: number; balance: TeamBalance; defense: TypeAnalysis; offense: OffenseAnalysis }
export interface BoxRec { enc: Encounter; score: number; reasons: string[] }

export function analyzeTeamDetailed(members: AnalyzedMember[]): TeamDashboard {
  const count = members.length
  const def = defenseAgg(members)
  const covered = offenseCovered(members)
  const withStats = members.filter((m) => m.stats)
  const avgOf = (sel: (s: PokemonStats) => number) => (withStats.length ? Math.round(withStats.reduce((a, m) => a + sel(m.stats!), 0) / withStats.length) : 0)
  const avg = { hp: avgOf((s) => s.hp), atk: avgOf((s) => s.attack), def: avgOf((s) => s.defense), spa: avgOf((s) => s.specialAttack), spd: avgOf((s) => s.specialDefense), spe: avgOf((s) => s.speed), bst: withStats.length ? Math.round(withStats.reduce((a, m) => a + m.bst, 0) / withStats.length) : 0 }
  let physical = 0, special = 0
  for (const m of withStats) { if (m.stats!.attack >= m.stats!.specialAttack) physical++; else special++ }
  const offensive = avgOf((s) => Math.max(s.attack, s.specialAttack))
  const defensive = withStats.length ? Math.round(withStats.reduce((a, m) => a + (m.stats!.hp + m.stats!.defense + m.stats!.specialDefense) / 3, 0) / withStats.length) : 0
  const roleCount = new Map<string, number>()
  for (const m of withStats) { const r = roleOf(m.stats); roleCount.set(r, (roleCount.get(r) || 0) + 1) }
  const roles = [...roleCount.entries()].map(([role, c]) => ({ role, count: c })).sort((a, b) => b.count - a.count)
  const typeCount = new Map<string, number>()
  for (const m of members) for (const t of m.types) typeCount.set(t, (typeCount.get(t) || 0) + 1)
  const typeDist = [...typeCount.entries()].map(([type, c]) => ({ type, count: c })).sort((a, b) => b.count - a.count)

  const weaknesses = ALL_TYPES.map((t) => ({ type: t, count: def.perType[t].weak })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count)
  const resistances = ALL_TYPES.map((t) => ({ type: t, count: def.perType[t].resist + def.perType[t].immune })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count)
  const immunities = ALL_TYPES.map((t) => ({ type: t, count: def.perType[t].immune })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count)
  const dangerous = ALL_TYPES.filter((t) => def.perType[t].weak >= 2 && !def.anyResist.has(t))
  const missingResist = ALL_TYPES.filter((t) => !def.anyResist.has(t))

  const presentAttack = new Set<string>(); members.forEach((m) => m.attackTypes.forEach((t) => presentAttack.add(t)))
  return {
    count,
    balance: { physical, special, offensive, defensive, roles, typeDist, avg, withStats: withStats.length },
    defense: { weaknesses, resistances, immunities, dangerous, missingResist },
    offense: { hitsWell: [...covered], problematic: ALL_TYPES.filter((t) => !covered.has(t)), missingAttackTypes: ALL_TYPES.filter((t) => !presentAttack.has(t)) },
  }
}

// Box recommendations: which available (non-teamed) Pokémon improve the team and WHY.
// Uses the bundled dex for instant offline stats/types — no fetch.
export function recommendFromBox(team: AnalyzedMember[], boxEncs: Encounter[]): BoxRec[] {
  const def = defenseAgg(team)
  const covered = offenseCovered(team)
  const unresolved = ALL_TYPES.filter((t) => def.perType[t].weak >= 1 && !def.anyResist.has(t))
  const missingResist = ALL_TYPES.filter((t) => !def.anyResist.has(t))
  const withStats = team.filter((m) => m.stats)
  const avgOf = (sel: (s: PokemonStats) => number) => (withStats.length ? withStats.reduce((a, m) => a + sel(m.stats!), 0) / withStats.length : 0)
  const avgSpa = avgOf((s) => s.specialAttack), avgAtk = avgOf((s) => s.attack), avgSpd = avgOf((s) => s.speed)
  const avgBulk = avgOf((s) => (s.hp + s.defense + s.specialDefense) / 3)
  const presentRoles = new Set(withStats.map((m) => roleOf(m.stats)))
  const teamIds = new Set(team.map((m) => m.enc.id))

  const recs: BoxRec[] = []
  for (const enc of boxEncs) {
    if (teamIds.has(enc.id)) continue
    const e = enc.pokemon_id != null ? dexEntry(enc.pokemon_id) : undefined
    const types = (enc.types && enc.types.length ? enc.types : e?.t) ?? []
    if (!types.length) continue
    const s = e ? { hp: e.s[0], attack: e.s[1], defense: e.s[2], specialAttack: e.s[3], specialDefense: e.s[4], speed: e.s[5] } : null
    let score = 0; const reasons: string[] = []
    for (const t of unresolved) if (defenseMultiplier(t, types) < 1) { score += 14; reasons.push(`deckt ${de(t)}-Schwäche`) }
    for (const t of missingResist) if (defenseMultiplier(t, types) === 0) { score += 12; reasons.push(`bringt ${de(t)}-Immunität`) }
    const newCover = ALL_TYPES.filter((d2) => !covered.has(d2) && types.some((at) => attackEffect(at, d2) === 2))
    if (newCover.length) { score += Math.min(12, newCover.length * 4); reasons.push(`verbessert Coverage (${newCover.slice(0, 3).map(de).join(', ')})`) }
    if (s) {
      if (s.specialAttack >= avgSpa + 25 && s.specialAttack >= 100) { score += 8; reasons.push('erhöht Spezialangriff') }
      if (s.attack >= avgAtk + 25 && s.attack >= 100) { score += 8; reasons.push('erhöht Angriff') }
      if (s.speed >= avgSpd + 25 && s.speed >= 95) { score += 6; reasons.push('erhöht Initiative') }
      if ((s.hp + s.defense + s.specialDefense) / 3 >= avgBulk + 25) { score += 6; reasons.push('mehr Bulk') }
      const role = roleOf(s); if (!presentRoles.has(role)) { score += 6; reasons.push(`ergänzt Rolle: ${role}`) }
    }
    if (reasons.length) recs.push({ enc, score, reasons: [...new Set(reasons)].slice(0, 4) })
  }
  return recs.sort((a, b) => b.score - a.score).slice(0, 5)
}

export function analyzeGym(members: AnalyzedMember[], gym: GymLeader): GymInsight {
  const t = gym.type
  const recommendedTypes = ALL_TYPES.filter((at) => attackEffect(at, t) === 2)

  const excellent: Encounter[] = [], good: Encounter[] = [], bad: Encounter[] = [], avoid: Encounter[] = []
  for (const m of members) {
    const dmgTaken = defenseMultiplier(t, m.types)
    const off = m.attackTypes.length ? Math.max(...m.attackTypes.map((at) => attackEffect(at, t))) : 1
    const resists = dmgTaken < 1
    const superOff = off === 2
    if (resists && superOff) excellent.push(m.enc)
    else if (superOff && dmgTaken <= 1) good.push(m.enc)
    else if (resists) good.push(m.enc)
    else if (dmgTaken >= 2 && !superOff) avoid.push(m.enc)
    else bad.push(m.enc)
  }

  const offCount = members.filter((m) => m.attackTypes.some((at) => attackEffect(at, t) === 2)).length
  const safeCount = members.filter((m) => m.types.length && defenseMultiplier(t, m.types) < 1).length
  const vulnCount = members.filter((m) => defenseMultiplier(t, m.types) > 1).length

  let risk: GymInsight['risk']
  if (members.length === 0 || offCount === 0 || (vulnCount > members.length / 2 && safeCount === 0)) risk = 'hard'
  else if (offCount >= 2 && safeCount >= 1 && vulnCount <= 1) risk = 'easy'
  else risk = 'mid'

  const riskReasons: GymInsight['riskReasons'] = [
    { ok: offCount > 0, text: offCount > 0 ? `Super-effektive Antwort vorhanden (${offCount})` : `Keine super-effektive Antwort gegen ${de(t)}` },
    { ok: safeCount > 0, text: safeCount > 0 ? `${safeCount} Pokémon resistieren ${de(t)}` : `Niemand resistiert ${de(t)}` },
    { ok: vulnCount === 0, text: vulnCount === 0 ? `Keine Anfälligkeit gegen ${de(t)}` : `${vulnCount} Pokémon anfällig gegen ${de(t)}` },
  ]

  const dangers: string[] = []
  if (gym.ace) dangers.push(`Ass: ${gym.ace}`)
  if (gym.note) dangers.push(gym.note)

  return { gym, risk, riskReasons, excellent, good, bad, avoid, recommendedTypes, dangers }
}
