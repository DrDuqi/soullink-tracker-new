// Public entry point for the platform layer. UI code imports from here:
//   import { getPlatform } from '../platform'
//
// Today getPlatform() always returns the WebBridge. When the app runs inside the
// Companion's own Electron window, a preload script will expose a native bridge on
// `window` and we return a CompanionBridge wrapping it — the only line that changes.
// No UI code is touched by that switch, which is the whole point of this seam.

import type { PlatformBridge } from './types'
import { webBridge } from './webBridge'

export * from './types'

let cached: PlatformBridge | null = null

export function getPlatform(): PlatformBridge {
  if (cached) return cached
  // Future (Companion window): if a native bridge was injected by the preload,
  // use it instead — same interface, IPC transport.
  //   const native = (window as unknown as { soullinkNative?: unknown }).soullinkNative
  //   if (native) return (cached = makeCompanionBridge(native))
  cached = webBridge
  return cached
}
