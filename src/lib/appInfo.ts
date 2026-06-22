import { EMU_BASE, USES_COMPANION } from './companion'

// App identity, external links and a Companion probe — used by Settings → Über/Companion.

export const APP_VERSION = '1.0.0'

const REPO = 'https://github.com/DrDuqi/soullink-tracker-new'
export const LINKS = {
  github: REPO,
  changelog: `${REPO}/releases`,
  // No public Discord invite yet. Paste it here to light up the Discord menu entry.
  discord: '',
}

export interface CompanionInfo { ok: boolean; version: string | null }

/** Probe the local Companion: connection status + version (if the build reports one). */
export async function companionInfo(signal?: AbortSignal): Promise<CompanionInfo> {
  if (!USES_COMPANION) return { ok: true, version: 'dev' }
  try {
    const r = await fetch(`${EMU_BASE}/api/companion/health`, { cache: 'no-store', signal })
    if (!r.ok) return { ok: false, version: null }
    const j = await r.json().catch(() => null)
    return { ok: !!j?.ok, version: (j?.version as string) ?? null }
  } catch {
    return { ok: false, version: null }
  }
}
