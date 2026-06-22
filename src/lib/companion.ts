// Where the emulator endpoints live.
//
//  • Development (`npm run dev`): the Vite dev-server plugin serves /api/emulator-*
//    on the SAME origin → EMU_BASE = '' (relative). Nothing changes vs. before.
//  • Production (Vercel): the browser sandbox can't run BizHawk, so a local
//    Companion process (emulator/companion/server.mjs) serves the identical
//    endpoints on 127.0.0.1 → EMU_BASE points there.
//
// Every emulator fetch in the app prepends EMU_BASE, so the exact same client
// code drives both transports.

export const COMPANION_PORT = 8787
export const EMU_BASE = import.meta.env.DEV ? '' : `http://127.0.0.1:${COMPANION_PORT}`

/** True when the app talks to a local Companion (prod) rather than the dev server. */
export const USES_COMPANION = !import.meta.env.DEV

/** Quick reachability probe for the Companion's health endpoint.
 *  In dev the Vite plugin is the backend, so this is treated as always reachable. */
export async function companionHealth(signal?: AbortSignal): Promise<boolean> {
  if (!USES_COMPANION) return true
  try {
    const r = await fetch(`${EMU_BASE}/api/companion/health`, { cache: 'no-store', signal })
    if (!r.ok) return false
    const j = await r.json().catch(() => null)
    return !!j?.ok
  } catch {
    return false
  }
}

// The Companion remembers BizHawk/ROM/Lua paths machine-side (survives a browser
// change), so the website can pull them instead of re-running the wizard.
export interface CompanionConfig {
  config: { bizhawk: string | null; rom: string | null; lua: string | null; syncFolder: string | null }
  detected: { bizhawk: string | null; roms: { name: string; path: string }[]; lua: string | null; syncFolder: string }
  ready: boolean   // companion already knows BizHawk + ROM + Lua → wizard can be skipped
}

/** Fetch the Companion's saved+detected paths. null in dev (no companion). */
export async function companionConfig(signal?: AbortSignal): Promise<CompanionConfig | null> {
  if (!USES_COMPANION) return null
  try {
    const r = await fetch(`${EMU_BASE}/api/companion/config`, { cache: 'no-store', signal })
    if (!r.ok) return null
    const j = await r.json().catch(() => null)
    return j?.ok ? (j as CompanionConfig) : null
  } catch {
    return null
  }
}

/** Open the Companion's NATIVE file dialog (Electron) and return the absolute path.
 *  `{ error: 'no_dialog' }` means the running Companion can't show a dialog (CLI/dev)
 *  → caller falls back to the browser picker; `'cancelled'` means the user closed it. */
export async function pickCompanionFile(kind: 'biz' | 'rom'): Promise<{ path?: string; error?: string }> {
  if (!USES_COMPANION) return { error: 'no_dialog' }
  try {
    const r = await fetch(`${EMU_BASE}/api/companion/pick?kind=${kind}`, { cache: 'no-store' })
    const j = await r.json().catch(() => null)
    if (j?.ok && j.path) return { path: j.path as string }
    return { error: (j?.error as string) || 'failed' }
  } catch {
    return { error: 'failed' }
  }
}

/** Persist picked paths in the Companion so the next start needs no wizard. */
export async function saveCompanionConfig(patch: { bizhawk?: string; rom?: string; lua?: string }): Promise<boolean> {
  if (!USES_COMPANION) return false
  try {
    const r = await fetch(`${EMU_BASE}/api/companion/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return r.ok
  } catch {
    return false
  }
}
