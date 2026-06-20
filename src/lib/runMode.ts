import { useEffect } from 'react'
import { create } from 'zustand'

// Per-run game mode: "manual" (everything entered by hand) vs "live_sync" (BizHawk
// emulator auto-sync). Stored locally per run — the emulator workflow is a local/dev
// concern and the partner may use a different setup, so this needs no Supabase column.

export type RunMode = 'manual' | 'live_sync'

// Existing runs (created before this feature) have no stored mode. Default to
// live_sync so their previous behaviour (emulator panel available) is preserved.
const DEFAULT_MODE: RunMode = 'live_sync'

const KEY = (runId: string) => `soullink-runmode-${runId}`

function load(runId: string): RunMode | null {
  try {
    const v = localStorage.getItem(KEY(runId))
    return v === 'manual' || v === 'live_sync' ? v : null
  } catch { return null }
}
function persist(runId: string, mode: RunMode) {
  try { localStorage.setItem(KEY(runId), mode) } catch { /* ignore */ }
}

interface RunModeStore {
  modes: Record<string, RunMode>
  hydrate: (runId: string) => void
  set: (runId: string, mode: RunMode) => void
}
export const useRunModeStore = create<RunModeStore>((set, get) => ({
  modes: {},
  hydrate: (runId) => {
    if (!runId || get().modes[runId]) return
    const v = load(runId)
    if (v) set((s) => ({ modes: { ...s.modes, [runId]: v } }))
  },
  set: (runId, mode) => {
    persist(runId, mode)
    set((s) => ({ modes: { ...s.modes, [runId]: mode } }))
  },
}))

/** Non-reactive read (defaults to live_sync for legacy runs). */
export function getRunMode(runId: string): RunMode {
  return load(runId) ?? DEFAULT_MODE
}
export function setRunMode(runId: string, mode: RunMode) {
  useRunModeStore.getState().set(runId, mode)
}

/** Reactive mode for a run (hydrates from localStorage on first use). */
export function useRunMode(runId: string | null | undefined): RunMode {
  const id = runId ?? ''
  const mode = useRunModeStore((s) => (id ? s.modes[id] : undefined))
  const hydrate = useRunModeStore((s) => s.hydrate)
  useEffect(() => { if (id) hydrate(id) }, [id, hydrate])
  return mode ?? (id ? getRunMode(id) : DEFAULT_MODE)
}
