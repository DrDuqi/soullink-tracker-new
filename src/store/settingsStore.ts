import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RunMode } from '../lib/runMode'

// App-wide preferences (persisted on this device). Kept deliberately separate from
// per-run state and from the user's profile — these are client/app settings.

export type Accent = 'red' | 'blue' | 'purple' | 'green'
export type ThemeMode = 'dark' | 'oled'
export type Lang = 'de' | 'en'

export const ACCENTS: Record<Accent, { label: string; base: string; dark: string; light: string }> = {
  red:    { label: 'Rot',  base: '#CC0000', dark: '#990000', light: '#FF2222' },
  blue:   { label: 'Blau', base: '#2563EB', dark: '#1D4ED8', light: '#3B82F6' },
  purple: { label: 'Lila', base: '#7C3AED', dark: '#6D28D9', light: '#8B5CF6' },
  green:  { label: 'Grün', base: '#16A34A', dark: '#15803D', light: '#22C55E' },
}

export interface NotifPrefs { caught: boolean; partner: boolean; companion: boolean; updates: boolean }
export interface PerfPrefs { reduceMotion: boolean; disableBg: boolean }

// Dashboard background preferences (persisted). `selected`/`favorites` store manifest
// FILENAMES (not paths) so they survive folder/path changes; nothing is hard-coded.
export type BgMode = 'random' | 'selected'
export interface BgPrefs { mode: BgMode; selected: string | null; favorites: string[]; randomFavoritesOnly: boolean }

interface SettingsState {
  theme: ThemeMode
  accent: Accent
  language: Lang
  defaultRunMode: RunMode
  defaultPlayers: 2 | 3
  notif: NotifPrefs
  perf: PerfPrefs
  background: BgPrefs
  update: (patch: Partial<Pick<SettingsState, 'theme' | 'accent' | 'language' | 'defaultRunMode' | 'defaultPlayers'>>) => void
  setNotif: (k: keyof NotifPrefs, v: boolean) => void
  setPerf: (k: keyof PerfPrefs, v: boolean) => void
  setBg: (patch: Partial<BgPrefs>) => void
  toggleBgFavorite: (name: string) => void
}

export const useSettings = create<SettingsState>()(persist((set) => ({
  theme: 'dark',
  accent: 'red',
  language: 'de',
  defaultRunMode: 'manual',
  defaultPlayers: 2,
  notif: { caught: true, partner: true, companion: true, updates: true },
  perf: { reduceMotion: false, disableBg: false },
  background: { mode: 'random', selected: null, favorites: [], randomFavoritesOnly: false },
  update: (patch) => set(patch),
  setNotif: (k, v) => set((s) => ({ notif: { ...s.notif, [k]: v } })),
  setPerf: (k, v) => set((s) => ({ perf: { ...s.perf, [k]: v } })),
  setBg: (patch) => set((s) => ({ background: { ...s.background, ...patch } })),
  toggleBgFavorite: (name) => set((s) => ({
    background: { ...s.background, favorites: s.background.favorites.includes(name) ? s.background.favorites.filter((f) => f !== name) : [...s.background.favorites, name] },
  })),
}), {
  name: 'soullink-settings',
  // Merge so a freshly-added slice (e.g. `background`) keeps its defaults when older
  // persisted state lacks it — never leaves a sub-object undefined.
  merge: (persisted, current) => {
    const p = (persisted ?? {}) as Partial<SettingsState>
    return { ...current, ...p, background: { ...current.background, ...(p.background ?? {}) } }
  },
}))

/** Non-reactive read — handy for one-off checks (e.g. before showing a toast). */
export function notifEnabled(k: keyof NotifPrefs): boolean {
  return useSettings.getState().notif[k]
}

/** Push the current settings into the DOM (accent CSS vars + theme/perf classes). */
export function applySettings(s: Pick<SettingsState, 'theme' | 'accent' | 'language' | 'perf'>) {
  const root = document.documentElement
  const a = ACCENTS[s.accent]
  root.style.setProperty('--color-pk-red', a.base)
  root.style.setProperty('--color-pk-red-dark', a.dark)
  root.style.setProperty('--color-pk-red-light', a.light)
  root.classList.toggle('oled', s.theme === 'oled')
  root.classList.toggle('reduce-motion', s.perf.reduceMotion)
  root.classList.toggle('no-fx', s.perf.disableBg)
  root.lang = s.language
}

/** Mount-once hook (used at the app root) that keeps the DOM in sync with settings. */
export function useApplySettings() {
  const theme = useSettings((s) => s.theme)
  const accent = useSettings((s) => s.accent)
  const language = useSettings((s) => s.language)
  const perf = useSettings((s) => s.perf)
  useEffect(() => { applySettings({ theme, accent, language, perf }) }, [theme, accent, language, perf])
}
