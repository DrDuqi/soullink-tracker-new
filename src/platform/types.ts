// The PlatformBridge — the single seam between the UI and the local machine.
//
// UI code depends ONLY on this interface, never on fetch()/IPC directly, so the
// exact same React app can run in two homes without any UI change:
//   • a browser tab            → WebBridge       (HTTP to a local Companion)
//   • the Companion's window    → CompanionBridge (in-process IPC) — future
// Swapping the transport is then a one-line change in getPlatform(), not a rewrite.
//
// This is the abstraction that lets "Setup + Spielen" move into a native Companion
// window later (the agreed Hybrid architecture) without rebuilding the wizard.

import type { CompanionConfig } from '../lib/companion'
import type { EmulatorSettings, LaunchResult } from '../lib/emulatorSettings'
import type { Profile, ProfileList, ProfilePatch, NewProfileInput } from '../lib/profiles'

export type { CompanionConfig, EmulatorSettings, LaunchResult }
export type { Profile, ProfileList, ProfilePatch, NewProfileInput }

export type PlatformKind = 'web' | 'companion'
export type PickKind = 'biz' | 'rom'

export interface PickResult {
  path?: string
  /** 'no_dialog' = no native dialog available → fall back to browser picker;
   *  'cancelled' = user closed it; 'failed' = transport error. */
  error?: string
}

export type ConfigPatch = { bizhawk?: string; rom?: string; lua?: string }

export interface PlatformBridge {
  /** Where the UI is running. */
  readonly kind: PlatformKind
  /** True in prod (a real local Companion serves the endpoints); false in the
   *  Vite dev server. Mirrors the old USES_COMPANION flag for callers that branch. */
  readonly usesCompanion: boolean

  /** Is a local backend reachable right now? */
  health(signal?: AbortSignal): Promise<boolean>
  /** Saved + detected local paths, or null when no Companion is present. */
  getConfig(signal?: AbortSignal): Promise<CompanionConfig | null>
  /** Persist picked paths so the next start needs no wizard. */
  saveConfig(patch: ConfigPatch): Promise<boolean>
  /** Native file dialog → absolute path (or an error code). */
  pickFile(kind: PickKind): Promise<PickResult>
  /** Resolve a bare filename (browser-picker fallback) to an absolute path. */
  resolveFileByName(name: string): Promise<string | null>
  /** Start the emulator with the saved ROM + sync script. */
  launch(settings: EmulatorSettings, restart?: boolean): Promise<LaunchResult>

  // ── profiles (local per-machine game profiles) ─────────────────────────────
  /** All profiles + which one is active. null when no Companion is present. */
  listProfiles(): Promise<ProfileList | null>
  createProfile(input: NewProfileInput): Promise<Profile | null>
  updateProfile(id: string, patch: ProfilePatch): Promise<Profile | null>
  deleteProfile(id: string): Promise<boolean>
  duplicateProfile(id: string): Promise<Profile | null>
  setActiveProfile(id: string): Promise<boolean>
}
