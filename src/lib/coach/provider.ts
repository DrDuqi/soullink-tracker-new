import type { CoachContext, CoachReport } from './types'

// The provider abstraction — the SoulGuide never talks to a specific AI vendor. Swap the
// active provider (rule-based fallback ⇄ OpenAI ⇄ Claude ⇄ local LLM) without touching the
// analysis engine or the UI. Deterministic providers return synchronously; remote/LLM
// providers return a Promise. `isAvailable()` gates whether a provider can run right now
// (e.g. an API key is configured / the endpoint is reachable).
export interface CoachProvider {
  readonly id: string
  readonly label: string
  isAvailable(): boolean
  generate(ctx: CoachContext): CoachReport | Promise<CoachReport>
}
