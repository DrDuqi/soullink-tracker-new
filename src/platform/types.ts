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

import type { CompanionConfig, RomInfo, RandomizerStatus, RandomizeInput, RandomizeResult, BizhawkStatus, FvxInstallState } from '../lib/companion'
import type { EmulatorSettings, LaunchResult } from '../lib/emulatorSettings'
import type { Profile, ProfileList, ProfilePatch, NewProfileInput, PrepareRunInput, PrepareRunResult, LocalRun } from '../lib/profiles'
import type { Preset, ImportPresetInput } from '../lib/presets'

export type { CompanionConfig, EmulatorSettings, LaunchResult }
export type { Profile, ProfileList, ProfilePatch, NewProfileInput, PrepareRunInput, PrepareRunResult, LocalRun }
export type { RomInfo, RandomizerStatus, RandomizeInput, RandomizeResult, BizhawkStatus }
export type { Preset, ImportPresetInput }

export type PlatformKind = 'web' | 'companion'
export type PickKind = 'biz' | 'rom' | 'preset'

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
  /** Start the emulator with the saved ROM + sync script. Passing `runId` launches
   *  the run in its own sandbox (per-run SaveRAM/State/…) and lets the Companion
   *  auto-restart BizHawk when it's currently on a different run. `autoContinue` (only
   *  honoured when a SaveRAM exists) makes the Lua tap A until the game has loaded. */
  launch(settings: EmulatorSettings, restart?: boolean, runId?: string, autoContinue?: boolean): Promise<LaunchResult>

  // ── profiles (local per-machine game profiles) ─────────────────────────────
  /** All profiles + which one is active. null when no Companion is present. */
  listProfiles(): Promise<ProfileList | null>
  createProfile(input: NewProfileInput): Promise<Profile | null>
  updateProfile(id: string, patch: ProfilePatch): Promise<Profile | null>
  deleteProfile(id: string): Promise<boolean>
  duplicateProfile(id: string): Promise<Profile | null>
  setActiveProfile(id: string): Promise<boolean>

  // ── auto-setup (Phase 3): ROM validation + randomizer ──────────────────────
  /** Inspect a picked ROM's NDS header (edition/region/revision) or reject it. */
  validateRom(path: string): Promise<RomInfo | null>
  /** Is FVX available (bundled / configured / detected)? */
  randomizerStatus(): Promise<RandomizerStatus | null>
  /** Start the automatic BizHawk download+extract (no manual install). */
  installBizhawk(): Promise<boolean>
  /** Poll the BizHawk auto-install progress. */
  bizhawkStatus(): Promise<BizhawkStatus | null>
  /** Start the automatic FVX (randomizer) download+extract. */
  installRandomizer(): Promise<boolean>
  /** Poll the FVX auto-install progress. */
  randomizerInstallStatus(): Promise<FvxInstallState | null>
  /** Run FVX to produce a randomized ROM (long-running). */
  randomize(input: RandomizeInput): Promise<RandomizeResult>
  /** Prepare a new SoulLink: randomize the profile's ROM into a per-run file. */
  prepareRun(input: PrepareRunInput): Promise<PrepareRunResult>
  /** The local launch data for a run prepared on this PC (null if not set up here). */
  getLocalRun(runId: string): Promise<LocalRun | null>
  /** All runs set up on this PC (keyed by runId). */
  listLocalRuns(): Promise<Record<string, LocalRun>>
  /** Hide/show a run locally (keeps files). */
  archiveRun(runId: string, archived: boolean): Promise<boolean>
  /** Remove a run's LOCAL files (folder + ROM + savegame). */
  deleteRun(runId: string): Promise<boolean>

  // ── presets (rules; separate from the seed) ────────────────────────────────
  listPresets(edition?: string): Promise<Preset[] | null>
  importPreset(input: ImportPresetInput): Promise<Preset | null>
  renamePreset(id: string, name: string): Promise<boolean>
  deletePreset(id: string): Promise<boolean>
  /** Auto-import the newest rules the user just saved in FVX (after sinceMs). */
  grabRules(sinceMs: number, opts?: { name?: string; edition?: string | null }): Promise<Preset | null>
  /** Open the FVX GUI as a preset editor (Stufe 1). */
  openRandomizer(): Promise<{ ok: boolean; error?: string }>
}
