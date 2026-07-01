import type { TeamAnalysisData } from '../../hooks/useTeamAnalysis'

// ── Shared coach vocabulary ──────────────────────────────────────────────────
// The Coach layer is strictly split from the analysis engine:
//   Analyse (TeamAnalysisData) = FACTS · Coach (CoachReport) = INTERPRETATION.
// Providers turn a CoachContext (facts + live state + run context) into a CoachReport.

export type CoachTone = 'info' | 'good' | 'warn' | 'danger' | 'tip'
export type CoachPriority = 'critical' | 'high' | 'normal' | 'low'
export type CoachCategory = 'defense' | 'offense' | 'arena' | 'carry' | 'box' | 'partner' | 'progress' | 'event' | 'general'
export type CoachMood = 'calm' | 'alert' | 'urgent'

export interface CoachLine {
  id: string
  icon: string
  tone: CoachTone
  priority: CoachPriority
  category: CoachCategory
  text: string
}

export interface CoachReport {
  intro: string
  lines: CoachLine[]          // already prioritised (critical → low) and capped
  headline: string            // ONE short line for the hero / dock preview
  arenaChance: number | null  // deterministic % for the next gym (also shown as data)
  mood: CoachMood             // drives the coach's accent/voice
  generatedBy: string         // provider id — 'rule-based' | 'openai' | 'claude' | …
}

export type CoachEventKind = 'death' | 'evolve' | 'catch' | 'link' | 'revive'
export interface CoachEvent { kind: CoachEventKind; name: string }

// Everything a provider needs to reason about the CURRENT run. The analysis engine
// stays the single source of computed facts; the rest is live/run context.
export interface CoachContext {
  analysis: TeamAnalysisData
  boxCount: number
  deadCount: number
  route: string | null
  recentEvent: CoachEvent | null
  hasPartner: boolean
  tl: (t: string) => string   // localised type name
}
