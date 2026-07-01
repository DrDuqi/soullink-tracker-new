import type { CoachProvider } from '../provider'
import type { CoachContext, CoachReport } from '../types'
import { ruleBasedProvider } from './ruleBased'

// SCAFFOLD ONLY — same contract as the OpenAI provider. Kept vendor-neutral so the SoulGuide
// can switch between local/cloud models later without any UI or analysis change. Falls back
// to the deterministic coach until an endpoint + key are configured.
export const claudeProvider: CoachProvider = {
  id: 'claude',
  label: 'Claude (später zuschaltbar)',
  isAvailable: () => false,
  async generate(ctx: CoachContext): Promise<CoachReport> {
    // TODO Phase 3.x: prompt = summarise(ctx) → fetch(Anthropic) → parse → CoachReport(generatedBy:'claude')
    return ruleBasedProvider.generate(ctx)
  },
}
