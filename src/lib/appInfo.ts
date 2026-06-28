import { EMU_BASE, USES_COMPANION } from './companion'

// App identity, external links and a Companion probe — used by Settings → Über/Companion.

export const APP_VERSION = '1.0.0'

const REPO = 'https://github.com/DrDuqi/soullink-tracker-new'
const REPO_API = 'https://api.github.com/repos/DrDuqi/soullink-tracker-new'
export const LINKS = {
  github: REPO,
  changelog: `${REPO}/releases`,
  // Always-newest installer (GitHub serves the latest release's asset by name).
  download: `${REPO}/releases/latest/download/SoulLink-Companion-Setup.exe`,
  // No public Discord invite yet. Paste it here to light up the Discord menu entry.
  discord: '',
}

/** Newest published Companion version from GitHub Releases (e.g. "1.0.8"). null on error. */
export async function latestCompanionVersion(signal?: AbortSignal): Promise<string | null> {
  try {
    // cache:'no-store' so a freshly published release is seen immediately (GitHub's
    // API responses are otherwise HTTP-cached → the version could read stale).
    const r = await fetch(`${REPO_API}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store', signal })
    if (!r.ok) return null
    const j = await r.json().catch(() => null)
    const tag = (j?.tag_name as string) || ''
    return tag.replace(/^v/, '') || null
  } catch {
    return null
  }
}

export type UpdateState = 'current' | 'outdated' | 'unknown'

function cmpSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d < 0 ? -1 : 1 }
  return 0
}

/** Compare an installed Companion version against the latest published one. */
export function updateState(installed: string | null, latest: string | null): UpdateState {
  if (!installed || installed === 'dev' || !latest) return 'unknown'
  return cmpSemver(installed, latest) < 0 ? 'outdated' : 'current'
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
