import { useEffect, useMemo, useRef, useState } from 'react'
import { typeLabel } from '../lib/dex/dex'
import type { CoachContext, CoachReport, CoachEvent } from '../lib/coach/types'
import { getActiveCoachProvider, ruleBasedProvider } from '../lib/coach/engine'
import type { TeamAnalysisData } from './useTeamAnalysis'

export interface CoachInput {
  analysis: TeamAnalysisData
  boxCount: number
  deadCount: number
  route: string | null
  recentEvent: CoachEvent | null
  hasPartner: boolean
  lang: 'de' | 'en'
}

// Produces the live CoachReport. It recomputes automatically whenever the run state changes
// (team/box/dead/route/analysis/event) — no buttons. The deterministic rule-based report is
// the instant, always-available baseline; if an async provider (OpenAI/Claude/local) is
// active AND available, its result replaces the baseline when it resolves.
export function useCoachReport(input: CoachInput): CoachReport {
  const tl = useMemo(() => (t: string) => typeLabel(t, input.lang), [input.lang])

  const ctx: CoachContext = {
    analysis: input.analysis,
    boxCount: input.boxCount,
    deadCount: input.deadCount,
    route: input.route,
    recentEvent: input.recentEvent,
    hasPartner: input.hasPartner,
    tl,
  }

  // Instant deterministic baseline (cheap — pure string building).
  const baseline = ruleBasedProvider.generate(ctx) as CoachReport

  // A stable key of the meaningful inputs → only re-run an async provider on real change.
  const key = [
    input.analysis.empty ? 'e' : 'x',
    input.analysis.analysis.synergy,
    input.analysis.analysis.overall,
    input.analysis.gymIdx,
    input.boxCount,
    input.deadCount,
    input.route ?? '',
    input.recentEvent ? `${input.recentEvent.kind}:${input.recentEvent.name}` : '',
    input.hasPartner ? 'p' : '',
    input.lang,
  ].join('|')

  const [asyncReport, setAsyncReport] = useState<CoachReport | null>(null)
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx

  useEffect(() => {
    const provider = getActiveCoachProvider()
    if (provider.id === ruleBasedProvider.id) { setAsyncReport(null); return }
    let cancelled = false
    Promise.resolve(provider.generate(ctxRef.current))
      .then((r) => { if (!cancelled) setAsyncReport(r) })
      .catch(() => { if (!cancelled) setAsyncReport(null) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return asyncReport ?? baseline
}
