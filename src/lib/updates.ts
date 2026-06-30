import { useQuery } from '@tanstack/react-query'
import { IN_COMPANION_WINDOW } from './companion'
import { companionInfo, latestCompanionVersion, updateState } from './appInfo'

// ── SINGLE source of truth for version + update state ────────────────────────
// Every consumer (Settings version card, update box, About, toasts) reads from THIS
// one query (shared key → one fetch, identical data everywhere — no contradictions).
//
//  • Companion window → electron-updater via IPC `app:check-updates`, which returns
//    BOTH the running app version (`current` = app.getVersion()) and the newest release
//    (`latest`, from the very same check the auto-updater/overlay use). Health is only
//    consulted for "is the local server reachable" — never for the installed version
//    (an old server process could linger after an update and report a stale version).
//  • Website → companion health (installed) + GitHub latest (no electron-updater there).

export type UpdView = 'current' | 'outdated' | 'dev' | 'error' | 'unknown'
export interface UpdateInfo {
  installed: string | null   // the running app version (authoritative)
  latest: string | null      // the newest published version (authoritative)
  state: UpdView
  running: boolean           // local companion server reachable
  code?: string | null
  detail?: string | null
}

interface NativeUpd {
  checkForUpdates?: () => Promise<{ state: string; current: string; latest?: string | null; notes?: string | null; code?: string; detail?: string }>
}
function native(): NativeUpd | null {
  return (typeof window !== 'undefined' ? (window as unknown as { soullinkNative?: NativeUpd }).soullinkNative : null) ?? null
}

async function fetchUpdateInfo(): Promise<UpdateInfo> {
  const n = native()
  if (IN_COMPANION_WINDOW && n?.checkForUpdates) {
    const [r, comp] = await Promise.all([n.checkForUpdates(), companionInfo()])
    const installed = r?.current || null
    const latest = r?.latest ?? (r?.state === 'current' ? installed : null)
    const state: UpdView = r?.state === 'available' ? 'outdated'
      : r?.state === 'current' ? 'current'
      : r?.state === 'dev' ? 'dev' : 'error'
    return { installed, latest, state, running: comp.ok, code: r?.code ?? null, detail: r?.detail ?? null }
  }
  // Website: no electron-updater → health (installed) + GitHub latest.
  const [comp, latest] = await Promise.all([companionInfo(), latestCompanionVersion()])
  const installed = comp.version && comp.version !== 'dev' ? comp.version : null
  return { installed, latest: latest ?? null, state: updateState(installed, latest ?? null), running: comp.ok, code: null, detail: null }
}

export function useUpdateInfo() {
  return useQuery({
    queryKey: ['update-info'],
    queryFn: fetchUpdateInfo,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  })
}
