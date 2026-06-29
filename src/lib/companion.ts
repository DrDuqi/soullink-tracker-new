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

/** Running INSIDE the Companion's own window? The preload exposes this flag before
 *  any app code runs. There the app is served same-origin BY the Companion, so API
 *  calls are relative and a local Companion is always present. */
export const IN_COMPANION_WINDOW =
  typeof window !== 'undefined' &&
  (window as unknown as { soullinkNative?: { kind?: string } }).soullinkNative?.kind === 'companion'

// Same-origin in dev (Vite plugin) and in the Companion window; only the public
// website (Vercel) talks cross-origin to a separately-running local Companion.
export const EMU_BASE = (import.meta.env.DEV || IN_COMPANION_WINDOW) ? '' : `http://127.0.0.1:${COMPANION_PORT}`

/** True when a local Companion backs the app (its own window, or the website with a
 *  running Companion). false only in the Vite dev server, where no install is needed. */
export const USES_COMPANION = IN_COMPANION_WINDOW || !import.meta.env.DEV

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
  detected: { bizhawk: string | null; bizhawkCandidates?: string[]; roms: { name: string; path: string }[]; lua: string | null; syncFolder: string }
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
export async function pickCompanionFile(kind: 'biz' | 'rom' | 'preset'): Promise<{ path?: string; error?: string }> {
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

// ── ROM validation + randomizer (FVX) — the Phase-3 auto-setup capabilities ───
export interface RomInfo {
  valid: boolean
  recognized?: boolean
  supported?: boolean        // live-sync can read this generation
  game?: string
  edition?: string
  region?: string
  revision?: number
  gameCode?: string
  gen?: number
  logoOk?: boolean
  code?: string              // failure code (archive / wrong_platform / not_nds / …)
  message: string
}

/** Read a picked file's NDS header → edition/region/revision (or a friendly reject). */
export interface RomValidateOpts { exts?: string[]; editionLabel?: string | null; platformLabel?: string | null }
export async function validateRomHttp(path: string, opts?: RomValidateOpts): Promise<RomInfo | null> {
  if (!USES_COMPANION) return null
  try {
    const q = new URLSearchParams({ path })
    if (opts?.exts?.length) q.set('exts', opts.exts.join(','))
    if (opts?.editionLabel) q.set('editionLabel', opts.editionLabel)
    if (opts?.platformLabel) q.set('platformLabel', opts.platformLabel)
    const r = await fetch(`${EMU_BASE}/api/rom/validate?${q.toString()}`, { cache: 'no-store' })
    const j = await r.json().catch(() => null)
    return j?.ok ? (j as RomInfo) : null
  } catch { return null }
}

export interface RandomizerStatus { found: boolean; source?: string; version?: string; dir?: string }

/** Is FVX available (bundled / configured / detected)? */
export async function randomizerStatusHttp(): Promise<RandomizerStatus | null> {
  if (!USES_COMPANION) return null
  try {
    const r = await fetch(`${EMU_BASE}/api/randomizer/detect`, { cache: 'no-store' })
    const j = await r.json().catch(() => null)
    return j?.ok ? (j as RandomizerStatus) : null
  } catch { return null }
}

export interface BizhawkStatus { state: 'idle' | 'downloading' | 'extracting' | 'done' | 'error'; percent: number; exe: string | null; error: string | null; version?: string }

/** Start the automatic BizHawk download+extract (idempotent — re-uses an in-flight one). */
export async function installBizhawkHttp(): Promise<boolean> {
  if (!USES_COMPANION) return false
  try {
    const r = await fetch(`${EMU_BASE}/api/bizhawk/install`, { method: 'POST' })
    const j = await r.json().catch(() => null)
    return !!j?.ok
  } catch { return false }
}

/** Poll the auto-install progress (the UI shows a percent + swaps to "fertig"). */
export async function bizhawkStatusHttp(): Promise<BizhawkStatus | null> {
  if (!USES_COMPANION) return null
  try {
    const r = await fetch(`${EMU_BASE}/api/bizhawk/status`, { cache: 'no-store' })
    const j = await r.json().catch(() => null)
    return j?.ok ? (j as BizhawkStatus) : null
  } catch { return null }
}

export interface FvxInstallState { state: 'idle' | 'downloading' | 'extracting' | 'done' | 'error'; percent: number; dir: string | null; error: string | null }

/** Start the automatic FVX (randomizer) download+extract — mirrors the BizHawk one. */
export async function installRandomizerHttp(): Promise<boolean> {
  if (!USES_COMPANION) return false
  try {
    const r = await fetch(`${EMU_BASE}/api/randomizer/install`, { method: 'POST' })
    const j = await r.json().catch(() => null)
    return !!j?.ok
  } catch { return false }
}

/** Poll the FVX auto-install progress. */
export async function randomizerInstallStatusHttp(): Promise<FvxInstallState | null> {
  if (!USES_COMPANION) return null
  try {
    const r = await fetch(`${EMU_BASE}/api/randomizer/install-status`, { cache: 'no-store' })
    const j = await r.json().catch(() => null)
    return j?.ok ? (j as FvxInstallState) : null
  } catch { return null }
}

/** Open the FVX GUI as a preset editor (the user saves a .rnqs to import). */
export async function openRandomizerHttp(): Promise<{ ok: boolean; error?: string }> {
  if (!USES_COMPANION) return { ok: false, error: 'no_companion' }
  try {
    const r = await fetch(`${EMU_BASE}/api/randomizer/open`, { method: 'POST' })
    return (await r.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string }
  } catch { return { ok: false, error: 'unreachable' } }
}

export interface RandomizeInput { inputRom: string; outputRom: string; settingsFile?: string; settingsString?: string; seed?: number | string | null }
export interface RandomizeResult { ok: boolean; outputRom?: string; version?: string; error?: string; code?: number; log?: string }

/** Run FVX (long-running: ~30-60 s). Resolves when the output ROM is produced. */
export async function randomizeHttp(input: RandomizeInput): Promise<RandomizeResult> {
  if (!USES_COMPANION) return { ok: false, error: 'no_companion' }
  try {
    const r = await fetch(`${EMU_BASE}/api/randomize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
    return (await r.json()) as RandomizeResult
  } catch { return { ok: false, error: 'unreachable' } }
}
