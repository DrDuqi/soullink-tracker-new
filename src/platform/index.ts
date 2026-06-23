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

/** The native bridge the Companion's preload injects (window.soullinkNative). */
function nativeBridge(): { kind?: string } | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { soullinkNative?: { kind?: string } }).soullinkNative ?? null
}

export function getPlatform(): PlatformBridge {
  if (cached) return cached
  // Inside the Companion window the app is served same-origin, so the WebBridge's
  // HTTP transport already works — we only flip `kind` to 'companion' so the UI
  // shows the desktop shell instead of the website landing. (No IPC needed.)
  if (nativeBridge()?.kind === 'companion') cached = { ...webBridge, kind: 'companion' }
  else cached = webBridge
  return cached
}
