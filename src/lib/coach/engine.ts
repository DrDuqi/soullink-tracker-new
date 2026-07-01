import type { CoachProvider } from './provider'
import { ruleBasedProvider } from './providers/ruleBased'
import { openAIProvider } from './providers/openai'
import { claudeProvider } from './providers/claude'

// The engine wires the providers together. The UI/hook asks the engine for the ACTIVE
// provider; if the chosen one can't run right now, it falls back to the always-available
// deterministic coach (product decision: deterministic-first, LLM optional).
const PROVIDERS: CoachProvider[] = [ruleBasedProvider, openAIProvider, claudeProvider]
let activeId = 'rule-based'

export function listCoachProviders() {
  return PROVIDERS.map((p) => ({ id: p.id, label: p.label, available: p.isAvailable() }))
}

export function setActiveCoachProvider(id: string) {
  if (PROVIDERS.some((p) => p.id === id)) activeId = id
}

export function getActiveCoachProvider(): CoachProvider {
  const p = PROVIDERS.find((x) => x.id === activeId)
  return p && p.isAvailable() ? p : ruleBasedProvider
}

export { ruleBasedProvider }
