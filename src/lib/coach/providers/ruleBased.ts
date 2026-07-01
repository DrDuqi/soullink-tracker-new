import type { CoachProvider } from '../provider'
import type { CoachContext, CoachReport, CoachLine, CoachTone, CoachPriority, CoachMood } from '../types'
import type { TeamAnalysisData } from '../../../hooks/useTeamAnalysis'
import type { GymInsight } from '../../analysis/teamAnalysis'

// The always-available, deterministic coach. It NEVER computes analysis itself — it only
// interprets `ctx.analysis` plus the live/run context into short, prioritised, human advice.
// This is the reliable baseline (product decision: deterministic-first); LLM providers layer
// on top and fall back to exactly this when unavailable.

const PRIO_ORDER: Record<CoachPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 }

function arenaChanceFor(g: GymInsight): number {
  const base = g.risk === 'easy' ? 82 : g.risk === 'mid' ? 58 : 34
  const adj = g.excellent.length * 7 + g.good.length * 3 - g.bad.length * 5 - g.avoid.length * 8
  return Math.max(8, Math.min(95, Math.round(base + adj)))
}

function emptyReport(): CoachReport {
  return {
    intro: 'Sobald dein Team steht, denke ich für dich mit.',
    lines: [{ id: 'empty', icon: '🧠', tone: 'info', priority: 'low', category: 'general', text: 'Nimm bestätigte SoulLinks in dein Hauptteam auf — dann prüfe ich Typen, Coverage und die nächste Arena für dich.' }],
    headline: 'Stell dein Team zusammen, dann lege ich los.',
    arenaChance: null,
    mood: 'calm',
    generatedBy: 'rule-based',
  }
}

function headlineFor(top: CoachLine | undefined, a: TeamAnalysisData, chance: number | null, tl: (t: string) => string): string {
  if (!top) return `${a.verdict.label}.`
  switch (top.category) {
    case 'event': return top.tone === 'danger' ? 'Ein Pokémon ist gefallen — ich rechne neu.' : 'Neue Lage — ich habe neu bewertet.'
    case 'defense': return a.detailed.defense.dangerous.length ? `Dir fehlt ein ${tl(a.detailed.defense.dangerous[0])}-Check.` : 'Achte auf deine Schwächen.'
    case 'arena': return a.gym && chance != null ? (chance >= 70 ? `Bereit für ${a.gym.name}.` : `${a.gym.name}: ~${chance}%.`) : 'Nächste Arena im Blick.'
    case 'carry': return a.carries[0] ? `${a.carries[0].enc.nickname ?? a.carries[0].enc.pokemon_name} trägt dein Team.` : `${a.verdict.label}.`
    case 'box': return 'Deine Box hat eine Verstärkung.'
    default: return `${a.verdict.label}.`
  }
}

function introFor(mood: CoachMood, ctx: CoachContext): string {
  if (mood === 'urgent') return 'Kurz aufpassen — das ist gerade das Wichtige.'
  if (mood === 'alert') return 'Ich habe deinen Run geprüft. Ein paar Dinge solltest du wissen.'
  return ctx.recentEvent ? 'Ich beobachte deinen Run live — hier ist mein Eindruck.' : 'Alles im Blick. Hier ist mein aktueller Eindruck.'
}

function generate(ctx: CoachContext): CoachReport {
  const a = ctx.analysis
  const tl = ctx.tl
  if (a.empty) return emptyReport()

  const { detailed: d, gymInsight, gym, boxRecs, carries, verdict } = a
  const arenaChance = gym ? arenaChanceFor(gymInsight) : null
  const dangerous = d.defense.dangerous
  const lines: CoachLine[] = []

  // ── EVENT REACTION — the coach "just saw" this; highest priority ──
  const ev = ctx.recentEvent
  if (ev?.kind === 'death') lines.push({ id: 'ev', icon: '⚰️', tone: 'danger', priority: 'critical', category: 'event', text: `${ev.name || 'Ein Pokémon'} ist gefallen. Ich habe dein Team neu bewertet — spiel jetzt bewusst defensiver.` })
  else if (ev?.kind === 'evolve') lines.push({ id: 'ev', icon: '✨', tone: 'good', priority: 'high', category: 'event', text: `${ev.name || 'Dein Pokémon'} hat sich entwickelt — ich habe die Analyse aktualisiert.` })
  else if (ev?.kind === 'catch') lines.push({ id: 'ev', icon: '🆕', tone: 'info', priority: 'high', category: 'event', text: `${ev.name || 'Neuer Fang'} ist dabei — die Empfehlungen sind aktualisiert.` })
  else if (ev?.kind === 'revive') lines.push({ id: 'ev', icon: '💚', tone: 'good', priority: 'normal', category: 'event', text: `${ev.name || 'Dein Pokémon'} ist zurück im Rennen. Weiter geht's.` })
  else if (ev?.kind === 'link') lines.push({ id: 'ev', icon: '🔗', tone: 'good', priority: 'normal', category: 'event', text: 'Neuer SoulLink steht — das stärkt euren Run.' })

  // ── DEFENSE ──
  const weak2 = d.defense.weaknesses.filter((w) => w.count >= 2).map((w) => w.type)
  if (dangerous.length) lines.push({ id: 'def', icon: '⚠️', tone: 'danger', priority: 'critical', category: 'defense', text: `Dir fehlt weiterhin eine sichere Antwort gegen ${dangerous.slice(0, 2).map(tl).join(' und ')}. Ein Treffer kann den Run kosten.` })
  else if (weak2.length) lines.push({ id: 'def', icon: '⚠️', tone: 'warn', priority: 'high', category: 'defense', text: `Pass auf ${weak2.slice(0, 2).map(tl).join(' und ')} auf — dort bist du doppelt anfällig.` })

  // ── ARENA ──
  if (gym && arenaChance != null) {
    const tone: CoachTone = arenaChance >= 70 ? 'good' : arenaChance >= 45 ? 'info' : 'warn'
    const priority: CoachPriority = arenaChance < 45 ? 'high' : 'normal'
    const tail = arenaChance >= 70 ? 'Ich würde es wagen.' : arenaChance >= 45 ? 'Machbar — geh mit Plan rein.' : 'Ich würde vorher noch nachlegen.'
    lines.push({ id: 'arena', icon: '🏆', tone, priority, category: 'arena', text: `Gegen ${gym.name} schätze ich deine Chancen auf etwa ${arenaChance}%. ${tail}` })
  }

  // ── CARRY ──
  if (carries[0]) {
    const c = carries[0]
    lines.push({ id: 'carry', icon: '💡', tone: 'tip', priority: 'normal', category: 'carry', text: `${c.enc.nickname ?? c.enc.pokemon_name} ist gerade dein wichtigstes Pokémon — schütz ihn gut.` })
  }

  // ── BOX ──
  if (boxRecs[0]) {
    const r = boxRecs[0]
    lines.push({ id: 'box', icon: '📦', tone: 'tip', priority: 'normal', category: 'box', text: `Aus deiner Box würde ${r.enc.nickname ?? r.enc.pokemon_name} dein Team verstärken (${r.reasons.slice(0, 1).join('')}).` })
  } else if (ctx.boxCount > 0) {
    lines.push({ id: 'box', icon: '📦', tone: 'info', priority: 'low', category: 'box', text: `In deiner Box (${ctx.boxCount}) sehe ich gerade keine klar bessere Alternative fürs Team.` })
  }

  // ── COVERAGE / next find ──
  const problem = d.offense.problematic
  const missAtk = d.offense.missingAttackTypes
  if (problem.length) lines.push({ id: 'cov', icon: '🗡️', tone: 'info', priority: 'low', category: 'offense', text: `Gegen ${problem.slice(0, 2).map(tl).join(' und ')} triffst du niemanden hart — ein ${tl(missAtk[0] ?? problem[0])}-Angreifer würde viel helfen.` })
  else if (missAtk.length) lines.push({ id: 'cov', icon: '🧭', tone: 'info', priority: 'low', category: 'offense', text: `Wenn du ein ${tl(missAtk[0])}-Pokémon findest, verbessert sich deine Coverage spürbar.` })

  // ── PARTNER ──
  if (ctx.hasPartner && missAtk.length) lines.push({ id: 'partner', icon: '🤝', tone: 'info', priority: 'low', category: 'partner', text: `Dein Partner sollte als Nächstes einen ${tl(missAtk[0])}-Angreifer suchen — das schließt eure gemeinsame Lücke.` })

  // ── calm fallback when nothing pressing ──
  if (!lines.some((l) => l.priority === 'critical' || l.priority === 'high')) {
    lines.push({ id: 'ok', icon: '🟢', tone: 'good', priority: 'low', category: 'progress', text: verdict.label.startsWith('Stark') ? 'Dein Team läuft rund. Spiel weiter sauber — ich behalte alles im Blick.' : 'Aktuell nichts Kritisches. Spiel entspannt weiter, ich melde mich, wenn etwas ansteht.' })
  }

  lines.sort((x, y) => PRIO_ORDER[x.priority] - PRIO_ORDER[y.priority])
  const top = lines.slice(0, 6)
  const mood: CoachMood = top.some((l) => l.priority === 'critical') ? 'urgent' : top.some((l) => l.priority === 'high') ? 'alert' : 'calm'

  return {
    intro: introFor(mood, ctx),
    lines: top,
    headline: headlineFor(top[0], a, arenaChance, tl),
    arenaChance,
    mood,
    generatedBy: 'rule-based',
  }
}

export const ruleBasedProvider: CoachProvider = {
  id: 'rule-based',
  label: 'Regelbasierter Coach',
  isAvailable: () => true,
  generate,
}
