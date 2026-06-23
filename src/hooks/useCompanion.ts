import { useEffect, useState } from 'react'
import { getPlatform } from '../platform'

// 'connected' – companion (prod) or dev plugin reachable
// 'checking'  – first probe in flight (prod only)
// 'absent'    – companion not running / not installed (prod only)
export type CompanionStatus = 'checking' | 'connected' | 'absent'

export interface CompanionState {
  status: CompanionStatus
  usesCompanion: boolean   // false in dev → no install needed, UI hides the banner
  recheck: () => void
}

/** Polls the local Companion's health so the UI can show "not started" guidance.
 *  In dev this stays 'connected' (the Vite plugin is the backend, no probing).
 *  Pass enabled=false for runs where live-sync is off (manual) to skip probing. */
export function useCompanion(enabled = true): CompanionState {
  const platform = getPlatform()
  const [status, setStatus] = useState<CompanionStatus>(platform.usesCompanion ? 'checking' : 'connected')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!platform.usesCompanion || !enabled) return   // dev backend always on; paused → don't probe
    let cancelled = false
    const ctrl = new AbortController()

    async function probe() {
      const ok = await platform.health(ctrl.signal)
      if (!cancelled) setStatus(ok ? 'connected' : 'absent')
    }

    probe()
    // Poll briskly so a freshly started Companion is picked up automatically —
    // the user never has to click "recheck".
    const id = setInterval(probe, 2000)
    return () => { cancelled = true; ctrl.abort(); clearInterval(id) }
  }, [enabled, nonce, platform])

  return { status, usesCompanion: platform.usesCompanion, recheck: () => setNonce((n) => n + 1) }
}
