// WebBridge — the PlatformBridge implementation for the app running in a browser
// tab. It delegates to the existing HTTP helpers (lib/companion, lib/emulatorSettings)
// so this introduces the abstraction with ZERO behavior change: same requests, same
// responses. The HTTP helpers stay as the "web transport"; a future CompanionBridge
// will implement the same interface over IPC instead.

import { USES_COMPANION, companionHealth, companionConfig, saveCompanionConfig, pickCompanionFile, validateRomHttp, randomizerStatusHttp, randomizeHttp, openRandomizerHttp, installBizhawkHttp, bizhawkStatusHttp } from '../lib/companion'
import { findFile, launchEmulator } from '../lib/emulatorSettings'
import { fetchProfiles, createProfileHttp, updateProfileHttp, deleteProfileHttp, duplicateProfileHttp, setActiveProfileHttp, prepareRunHttp, getLocalRunHttp, listLocalRunsHttp, archiveRunHttp, deleteRunHttp } from '../lib/profiles'
import { fetchPresets, importPresetHttp, renamePresetHttp, deletePresetHttp, grabRulesHttp } from '../lib/presets'
import type { PlatformBridge } from './types'

export const webBridge: PlatformBridge = {
  kind: 'web',
  usesCompanion: USES_COMPANION,
  health: (signal) => companionHealth(signal),
  getConfig: (signal) => companionConfig(signal),
  saveConfig: (patch) => saveCompanionConfig(patch),
  pickFile: (kind) => pickCompanionFile(kind),
  resolveFileByName: (name) => findFile(name),
  launch: (settings, restart, runId, autoContinue) => launchEmulator(settings, restart, runId, autoContinue),
  listProfiles: () => fetchProfiles(),
  createProfile: (input) => createProfileHttp(input),
  updateProfile: (id, patch) => updateProfileHttp(id, patch),
  deleteProfile: (id) => deleteProfileHttp(id),
  duplicateProfile: (id) => duplicateProfileHttp(id),
  setActiveProfile: (id) => setActiveProfileHttp(id),
  validateRom: (path) => validateRomHttp(path),
  randomizerStatus: () => randomizerStatusHttp(),
  installBizhawk: () => installBizhawkHttp(),
  bizhawkStatus: () => bizhawkStatusHttp(),
  randomize: (input) => randomizeHttp(input),
  prepareRun: (input) => prepareRunHttp(input),
  getLocalRun: (runId) => getLocalRunHttp(runId),
  listLocalRuns: () => listLocalRunsHttp(),
  archiveRun: (runId, archived) => archiveRunHttp(runId, archived),
  deleteRun: (runId) => deleteRunHttp(runId),
  listPresets: (edition) => fetchPresets(edition),
  importPreset: (input) => importPresetHttp(input),
  grabRules: (sinceMs, opts) => grabRulesHttp(sinceMs, opts),
  renamePreset: (id, name) => renamePresetHttp(id, name),
  deletePreset: (id) => deletePresetHttp(id),
  openRandomizer: () => openRandomizerHttp(),
}
