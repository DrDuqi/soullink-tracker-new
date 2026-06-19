import { useEffect } from 'react'
import { create } from 'zustand'

// Local emulator settings — paths to BizHawk, the ROM, the Lua script and the
// sync folder. Stored ONLY in localStorage (no account, no Supabase): paths are
// machine-specific and the live-sync is a local/dev concern.

export interface EmulatorSettings {
  bizhawkPath: string   // …\EmuHawk.exe
  romPath: string       // …\game.nds
  luaPath: string       // …\soullink_sync.lua
  syncFolder: string    // folder that holds soullink_team.json
}

const DEFAULTS: EmulatorSettings = {
  bizhawkPath: '',
  romPath: '',
  luaPath: 'emulator/bizhawk/soullink_sync.lua',
  syncFolder: '',
}

const KEY = 'soullink-emu-settings'

function load(): EmulatorSettings {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return { ...DEFAULTS, ...(parsed && typeof parsed === 'object' ? parsed : {}) }
  } catch {
    return { ...DEFAULTS }
  }
}
function persist(s: EmulatorSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore quota/private mode */ }
}

interface SettingsStore {
  settings: EmulatorSettings
  hydrated: boolean
  hydrate: () => void
  update: (patch: Partial<EmulatorSettings>) => void
  reset: () => void
}

export const useEmulatorSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULTS,
  hydrated: false,
  hydrate: () => { if (!get().hydrated) set({ settings: load(), hydrated: true }) },
  update: (patch) => set((st) => { const next = { ...st.settings, ...patch }; persist(next); return { settings: next } }),
  reset: () => { persist(DEFAULTS); set({ settings: { ...DEFAULTS } }) },
}))

/** Reactive settings (hydrates from localStorage on first use). */
export function useEmulatorSettings(): EmulatorSettings {
  const settings = useEmulatorSettingsStore((s) => s.settings)
  const hydrated = useEmulatorSettingsStore((s) => s.hydrated)
  const hydrate = useEmulatorSettingsStore((s) => s.hydrate)
  useEffect(() => { if (!hydrated) hydrate() }, [hydrated, hydrate])
  return settings
}

/** Per-field "is it set?" status for the ✅/❌ indicators. */
export function settingsStatus(s: EmulatorSettings) {
  return {
    bizhawk: !!s.bizhawkPath.trim(),
    rom: !!s.romPath.trim(),
    lua: !!s.luaPath.trim(),
    sync: !!s.syncFolder.trim(),
  }
}

/** Windows .bat that launches BizHawk with the ROM and the Lua script preloaded.
 *  A browser can't start local programs, but this file can — save & double-click. */
export function buildStartBat(s: EmulatorSettings): string {
  const q = (p: string) => `"${p.trim()}"`
  const parts = [q(s.bizhawkPath || 'EmuHawk.exe')]
  if (s.romPath.trim()) parts.push(q(s.romPath))
  if (s.luaPath.trim()) parts.push(`--lua=${q(s.luaPath)}`)
  const cmd = parts.join(' ')
  return [
    '@echo off',
    'REM ── Von SoulLink Tracker generiert ─────────────────────────────',
    'REM Startet BizHawk mit ROM und lädt das Lua-Sync-Script automatisch.',
    'REM Voraussetzung: die Website läuft bereits (npm run dev).',
    '',
    `start "" ${cmd}`,
    '',
  ].join('\r\n')
}
