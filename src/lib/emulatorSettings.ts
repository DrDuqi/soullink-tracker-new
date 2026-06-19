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

/** Setup is complete once BizHawk + ROM + Lua are known. */
export function isConfigured(s: EmulatorSettings): boolean {
  return !!s.bizhawkPath.trim() && !!s.romPath.trim() && !!s.luaPath.trim()
}

/** Friendly file name (last path segment) — so the UI never shows full paths. */
export function fileName(p: string): string {
  const t = p.trim().replace(/[\\/]+$/, '')
  const seg = t.split(/[\\/]/).pop()
  return seg || t
}

export interface DetectResult {
  lua: string | null
  syncFolder: string
  bizhawk: string | null
  roms: { name: string; path: string }[]
}

/** Asks the dev server to auto-detect Lua / sync folder / BizHawk / ROMs (dev-only). */
export async function detectEmulator(): Promise<DetectResult | null> {
  try {
    const r = await fetch('/api/emulator-detect', { cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    if (!j?.ok) return null
    return {
      lua: j.lua ?? null,
      syncFolder: j.syncFolder ?? '',
      bizhawk: j.bizhawk ?? null,
      roms: Array.isArray(j.roms) ? j.roms : [],
    }
  } catch { return null }
}

/** Resolve a file the user picked in the browser dialog to an absolute path. */
export async function findFile(name: string): Promise<string | null> {
  try {
    const r = await fetch('/api/emulator-detect?find=' + encodeURIComponent(name), { cache: 'no-store' })
    const j = await r.json()
    return j?.path ?? null
  } catch { return null }
}

export interface LaunchResult {
  ok: boolean
  launched?: boolean   // a new BizHawk was started (with --lua)
  already?: boolean    // BizHawk was already running → Lua cannot be injected
  restarted?: boolean  // a running BizHawk was closed and relaunched with --lua
  error?: 'bizhawk_not_found' | 'rom_not_found' | 'lua_not_found' | 'launch_failed' | 'launch_exited' | 'unreachable'
  detail?: string      // human-readable failure detail (from the dev server)
}

/** Ask the dev server to start BizHawk with the saved ROM + Lua (dev-only).
 *  restart=true closes a running EmuHawk first (Lua only loads at startup). */
export async function launchEmulator(s: EmulatorSettings, restart = false): Promise<LaunchResult> {
  // Verifizierbar: exakt der gespeicherte Pfad wird gesendet (kein zweiter/alter Pfad).
  console.info('[launch] sende an Server:', { bizhawk: s.bizhawkPath, rom: s.romPath, lua: s.luaPath, restart })
  try {
    const r = await fetch('/api/emulator-launch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bizhawk: s.bizhawkPath, rom: s.romPath, lua: s.luaPath, restart }),
    })
    return (await r.json()) as LaunchResult
  } catch {
    return { ok: false, error: 'unreachable' }
  }
}

/** Windows .bat that launches BizHawk with the ROM and the Lua script preloaded.
 *  A browser can't start local programs, but this file can — save & double-click.
 *  Robust: validates the saved paths, prints a clear error and PAUSES so the
 *  window never vanishes on failure, quotes everything (spaces) and falls back to
 *  a no-Lua launch (with manual instructions) if the script path isn't found. */
export function buildStartBat(s: EmulatorSettings): string {
  const biz = s.bizhawkPath.trim()
  const rom = s.romPath.trim()
  const lua = s.luaPath.trim()
  const L: string[] = [
    '@echo off',
    'setlocal',
    'REM ─────────────────────────────────────────────────────────────',
    'REM  start-soullink.bat — von SoulLink Tracker generiert',
    'REM  Startet BizHawk mit deiner ROM und laedt das Lua-Sync-Script.',
    'REM  Voraussetzung: die Website laeuft bereits (npm run dev).',
    'REM ─────────────────────────────────────────────────────────────',
    '',
    `set "BIZHAWK=${biz}"`,
    `set "ROM=${rom}"`,
    `set "LUA=${lua}"`,
    '',
    'if "%BIZHAWK%"=="" (',
    '  echo [FEHLER] Kein BizHawk/EmuHawk-Pfad gesetzt.',
    '  echo Bitte in den Emulator-Einstellungen der Website eintragen.',
    '  echo.',
    '  pause',
    '  exit /b 1',
    ')',
    'if not exist "%BIZHAWK%" (',
    '  echo [FEHLER] BizHawk/EmuHawk nicht gefunden:',
    '  echo   "%BIZHAWK%"',
    '  echo Bitte den Pfad in den Emulator-Einstellungen pruefen.',
    '  echo.',
    '  pause',
    '  exit /b 1',
    ')',
    'if "%ROM%"=="" (',
    '  echo [FEHLER] Kein ROM-Pfad gesetzt.',
    '  echo Bitte in den Emulator-Einstellungen der Website eintragen.',
    '  echo.',
    '  pause',
    '  exit /b 1',
    ')',
    'if not exist "%ROM%" (',
    '  echo [FEHLER] ROM nicht gefunden:',
    '  echo   "%ROM%"',
    '  echo Bitte den ROM-Pfad in den Emulator-Einstellungen pruefen.',
    '  echo.',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'if not "%LUA%"=="" if exist "%LUA%" (',
    '  echo Starte BizHawk mit ROM + Lua-Sync-Script ...',
    '  start "" "%BIZHAWK%" "%ROM%" --lua="%LUA%"',
    '  goto :done',
    ')',
    '',
    'echo [HINWEIS] Lua-Script nicht gefunden oder kein Lua-Pfad gesetzt.',
    'echo BizHawk wird OHNE automatisches Lua gestartet.',
    'echo Lua manuell laden: Tools - Lua Console - Open Script - soullink_sync.lua',
    'echo.',
    'start "" "%BIZHAWK%" "%ROM%"',
    '',
    ':done',
    'endlocal',
    '',
  ]
  return L.join('\r\n')
}
