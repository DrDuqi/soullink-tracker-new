// WebBridge — the PlatformBridge implementation for the app running in a browser
// tab. It delegates to the existing HTTP helpers (lib/companion, lib/emulatorSettings)
// so this introduces the abstraction with ZERO behavior change: same requests, same
// responses. The HTTP helpers stay as the "web transport"; a future CompanionBridge
// will implement the same interface over IPC instead.

import { USES_COMPANION, companionHealth, companionConfig, saveCompanionConfig, pickCompanionFile } from '../lib/companion'
import { findFile, launchEmulator } from '../lib/emulatorSettings'
import type { PlatformBridge } from './types'

export const webBridge: PlatformBridge = {
  kind: 'web',
  usesCompanion: USES_COMPANION,
  health: (signal) => companionHealth(signal),
  getConfig: (signal) => companionConfig(signal),
  saveConfig: (patch) => saveCompanionConfig(patch),
  pickFile: (kind) => pickCompanionFile(kind),
  resolveFileByName: (name) => findFile(name),
  launch: (settings, restart) => launchEmulator(settings, restart),
}
