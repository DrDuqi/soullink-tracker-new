import type { CoachProvider } from '../provider'
import type { CoachContext, CoachReport } from '../types'
import { ruleBasedProvider } from './ruleBased'

// SCAFFOLD ONLY — not wired to a real endpoint yet. `isAvailable()` stays false until a key
// is configured (nothing is shipped; game data stays local unless the user opts in). When
// implemented, `generate` will build a COMPACT facts-only prompt from `ctx` (never the ROM),
// call the API, and map the JSON answer to a CoachReport. Until then it falls back to the
// deterministic coach so the SoulGuide always has something to say.
export const openAIProvider: CoachProvider = {
  id: 'openai',
  label: 'OpenAI (später zuschaltbar)',
  isAvailable: () => false,
  async generate(ctx: CoachContext): Promise<CoachReport> {
    // TODO Phase 3.x: prompt = summarise(ctx) → fetch(OpenAI) → parse → CoachReport(generatedBy:'openai')
    return ruleBasedProvider.generate(ctx)
  },
}
