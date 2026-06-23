// Profile transport — the HTTP layer for the Companion's /api/profiles endpoints.
// Mirrors lib/companion.ts (low-level fetch); the PlatformBridge delegates here, so
// UI code never calls these directly. Returns null when no Companion is present
// (dev / browser without Companion) — same convention as companionConfig().

import { EMU_BASE, USES_COMPANION } from './companion'

export interface ProfilePaths {
  originalRom: string | null
  bizhawk: string | null
  randomizer: string | null
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

/** Fields a caller may change. id/createdAt/updatedAt are server-owned. */
export type ProfilePatch = Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>
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
