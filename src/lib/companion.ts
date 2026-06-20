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
