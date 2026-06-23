// Profile transport — the HTTP layer for the Companion's /api/profiles endpoints.
// Mirrors lib/companion.ts (low-level fetch); the PlatformBridge delegates here, so
// UI code never calls these directly. Returns null when no Companion is present
// (dev / browser without Companion) — same convention as companionConfig().

import { EMU_BASE, USES_COMPANION } from './companion'

export interface ProfilePaths {
  originalRom: string | null
  bizhawk: string | null
  randomizer: string | null   // FVX dir override (usually auto-detected/bundled)
  preset: string | null       // .rnqs randomizer settings for this pairing
  outputDir: string | null
}

export interface RunHistoryEntry { runId?: string; seed?: number; date?: string; code?: string }

export interface Profile {
  id: string
  name: string
  players: string[]            // array → 2/3/4-player SoulLinks need no schema change
  edition: string | null
  paths: ProfilePaths
  presetId: string | null
  lastSeed: number | null
  lastRandomizedRom: string | null
  runHistory: RunHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export interface ProfileList { activeProfileId: string | null; profiles: Profile[] }

/** Fields a caller may change. id/createdAt/updatedAt are server-owned. `paths` is
 *  a partial — the server deep-merges it, so callers set one path at a time. */
export type ProfilePatch = Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt' | 'paths'>> & { paths?: Partial<ProfilePaths> }
export interface NewProfileInput { name: string; players?: string[]; edition?: string }

async function reqJson(path: string, init?: RequestInit): Promise<any> {
  const r = await fetch(`${EMU_BASE}${path}`, { cache: 'no-store', ...init })
  return r.json().catch(() => null)
}
const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
  body: body !== undefined ? JSON.stringify(body) : undefined,
})

export async function fetchProfiles(): Promise<ProfileList | null> {
  if (!USES_COMPANION) return null
  try { const d = await reqJson('/api/profiles'); return d?.ok ? { activeProfileId: d.activeProfileId ?? null, profiles: d.profiles ?? [] } : null }
  catch { return null }
}

export async function createProfileHttp(input: NewProfileInput): Promise<Profile | null> {
  if (!USES_COMPANION) return null
  try { const d = await reqJson('/api/profiles', jsonInit('POST', input)); return d?.ok ? (d.profile as Profile) : null }
  catch { return null }
}

export async function updateProfileHttp(id: string, patch: ProfilePatch): Promise<Profile | null> {
  if (!USES_COMPANION) return null
  try { const d = await reqJson(`/api/profiles?id=${encodeURIComponent(id)}`, jsonInit('PATCH', patch)); return d?.ok ? (d.profile as Profile) : null }
  catch { return null }
}

export async function deleteProfileHttp(id: string): Promise<boolean> {
  if (!USES_COMPANION) return false
  try { const d = await reqJson(`/api/profiles?id=${encodeURIComponent(id)}`, jsonInit('DELETE')); return !!d?.ok }
  catch { return false }
}

export async function duplicateProfileHttp(id: string): Promise<Profile | null> {
  if (!USES_COMPANION) return null
  try { const d = await reqJson(`/api/profiles/duplicate?id=${encodeURIComponent(id)}`, jsonInit('POST')); return d?.ok ? (d.profile as Profile) : null }
  catch { return null }
}

export async function setActiveProfileHttp(id: string): Promise<boolean> {
  if (!USES_COMPANION) return false
  try { const d = await reqJson(`/api/profiles/active?id=${encodeURIComponent(id)}`, jsonInit('POST')); return !!d?.ok }
  catch { return false }
}

// ── run preparation (Phase 3): randomize a profile's ROM for a new SoulLink ────
export interface PrepareRunInput { profileId: string; runId?: string; presetId?: string; seed?: number | string | null; settingsString?: string }
export interface PrepareRunResult {
  ok: boolean
  runId?: string | null
  outputRom?: string
  seed?: number
  edition?: string | null
  bizhawk?: string
  players?: string[]
  error?: string
  log?: string
}

/** The local launch data for a run prepared on this PC (ROM/seed/preset/save). */
export interface LocalRun { runId: string; romPath: string; bizhawk?: string; seed?: number; presetId?: string; edition?: string | null; saveName?: string }
export async function getLocalRunHttp(runId: string): Promise<LocalRun | null> {
  if (!USES_COMPANION) return null
  try { const d = await reqJson(`/api/run/local?runId=${encodeURIComponent(runId)}`); return d?.found ? (d.run as LocalRun) : null }
  catch { return null }
}

/** Randomize the profile's original ROM (preset + seed) into a managed file.
 *  Long-running (~30-60 s). The caller then launches BizHawk with outputRom. */
export async function prepareRunHttp(input: PrepareRunInput): Promise<PrepareRunResult> {
  if (!USES_COMPANION) return { ok: false, error: 'no_companion' }
  try { return (await reqJson('/api/run/prepare', jsonInit('POST', input))) as PrepareRunResult }
  catch { return { ok: false, error: 'unreachable' } }
}
