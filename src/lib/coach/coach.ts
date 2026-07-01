import type { TeamAnalysisData } from '../../hooks/useTeamAnalysis'
import type { GymInsight } from '../analysis/teamAnalysis'

// ── The interpretation layer ────────────────────────────────────────────────
// Turns the (unchanged) analysis RESULT into natural, companion-style language.
// This is the ONLY thing Phase 3 replaces: a live LLM will receive the same
// TeamAnalysisData and return the same CoachReport shape — the UI never changes.
// There is NO second analysis engine here; this only reads and interprets.

export type CoachTone = 'info' | 'good' | 'warn' | 'tip'
export interface CoachLine { icon: string; tone: CoachTone; text: string }
export interface CoachReport {
  intro: string               // the coach's opening line
  lines: CoachLine[]          // natural-language observations / advice
  headline: string            // ONE short line for the hero preview
  arenaChance: number | null  // deterministic % for the next gym (also shown as data)
}

function arenaChanceFor(g: GymInsight): number {
  const base = g.risk === 'easy' ? 82 : g.risk === 'mid' ? 58 : 34
  const adj = g.excellent.length * 7 + g.good.length * 3 - g.bad.length * 5 - g.avoid.length * 8
  return Math.max(8, Math.min(95, Math.round(base + adj)))
}

export function buildCoachReport(data: TeamAnalysisData, tl: (t: string) => string): CoachReport {
  if (data.empty) {
    return {
      intro: 'Sobald dein Team steht, denke ich für dich mit.',
      lines: [{ icon: '🧠', tone: 'info', text: 'Nimm bestätigte SoulLinks in dein Hauptteam auf — dann prüfe ich Typen, Coverage und die nächste Arena für dich.' }],
      headline: 'Stell dein Team zusammen, dann lege ich los.',
      arenaChance: null,
    }
  }

  const { detailed, gymInsight, gym, boxRecs, carries, verdict, analysis } = data
  const lines: CoachLine[] = []
  const arenaChance = gym ? arenaChanceFor(gymInsight) : null

  // 1) Defensive gap — the most important thing to warn about.
  const dangerous = detailed.defense.dangerous
  const weak2 = detailed.defense.weaknesses.filter((w) => w.count >= 2).map((w) => w.type)
  if (dangerous.length) {
    lines.push({ icon: '⚠', tone: 'warn', text: `Dir fehlt aktuell eine sichere Antwort gegen ${dangerous.slice(0, 2).map(tl).join(' und ')}. Mehrere deiner Pokémon sind schwach und nichts hält dagegen.` })
  } else if (weak2.length) {
    lines.push({ icon: '⚠', tone: 'warn', text: `Pass auf ${weak2.slice(0, 2).map(tl).join(' und ')} auf — da ist dein Team doppelt anfällig.` })
  } else {
    lines.push({ icon: '🛡', tone: 'good', text: 'Deine Defensive ist rund — keine offene Typ-Lücke, die dich sofort umwirft.' })
  }

  // 2) Offensive coverage gap.
  const problem = detailed.offense.problematic
  if (problem.length) {
    lines.push({ icon: '🗡', tone: 'info', text: `Gegen ${problem.slice(0, 2).map(tl).join(' und ')} triffst du niemanden super-effektiv — da fehlt dir Druck.` })
  }

  // 3) Next arena, as a chance estimate.
  if (gym && arenaChance != null) {
    const tone: CoachTone = arenaChance >= 70 ? 'good' : arenaChance >= 45 ? 'info' : 'warn'
    const verdictWord = arenaChance >= 70 ? 'Das sieht stark aus' : arenaChance >= 45 ? 'Machbar, aber bleib wachsam' : 'Das ist noch riskant'
    lines.push({ icon: '🏆', tone, text: `Für ${gym.name} schätze ich deine Chancen aktuell auf ca. ${arenaChance}%. ${verdictWord}.` })
  }

  // 4) Next concrete step (from the engine's recommendations).
  if (analysis.recommendations.length) {
    lines.push({ icon: '🎯', tone: 'tip', text: `Als Nächstes: ${analysis.recommendations[0]}` })
  }

  // 5) Your carry.
  if (carries.length) {
    const c = carries[0]
    lines.push({ icon: '💡', tone: 'tip', text: `${c.enc.nickname ?? c.enc.pokemon_name} ist gerade dein wichtigster Carry — bau deinen Plan um ihn herum.` })
  }

  // 6) Box alternative — yes/no.
  if (boxRecs.length) {
    const r = boxRecs[0]
    lines.push({ icon: '📦', tone: 'tip', text: `Aus deiner Box könnte ${r.enc.nickname ?? r.enc.pokemon_name} helfen: ${r.reasons.slice(0, 2).join(', ')}.` })
  } else {
    lines.push({ icon: '📦', tone: 'info', text: 'Deine Box hat aktuell keine klar bessere Alternative fürs Team.' })
  }

  // Hero headline — the single most pressing thing, in a few words.
  const headline = dangerous.length
    ? `Dir fehlt ein ${tl(dangerous[0])}-Check.`
    : (gym && arenaChance != null
        ? (arenaChance >= 70 ? `Bereit für ${gym.name}.` : `${gym.name}: ~${arenaChance}% — noch riskant.`)
        : (carries.length ? `${carries[0].enc.nickname ?? carries[0].enc.pokemon_name} trägt dein Team.` : `${verdict.label}.`))

  const intro = dangerous.length
    ? 'Ich habe deinen Run geprüft — es gibt eine Lücke, die du kennen solltest.'
    : verdict.label.startsWith('Stark')
      ? 'Ich habe deinen Run geprüft — dein Team steht richtig gut da.'
      : 'Ich habe deinen aktuellen Run geprüft. Darauf würde ich als Nächstes achten.'

  return { intro, lines, headline, arenaChance }
}
