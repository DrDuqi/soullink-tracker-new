import { useEffect, useState } from 'react'

// ── Background gallery: the SINGLE source of truth ───────────────────────────
// Everything (random pick, gallery, selection) is driven ONLY by
// /public/backgrounds/dashboard/manifest.json. No filename or count is ever
// hard-coded — drop images into that folder, add their names to manifest.json,
// and they appear automatically in the gallery + random pool. Zero code changes.

export const BG_DIR = '/backgrounds/dashboard'
export const DEFAULT_BG = 'default.webp'
export const bgUrl = (name: string) => `${BG_DIR}/${name.split('/').map(encodeURIComponent).join('/')}`

const IMG_RE = /\.(webp|png|jpe?g|avif|gif)$/i

// Load + validate the manifest ONCE (cached promise). Returns the filenames that
// actually exist (each is probe-loaded so a listed-but-missing entry is dropped).
// Never throws; an absent/broken manifest yields [].
let _cache: Promise<string[]> | null = null
export function loadBackgrounds(force = false): Promise<string[]> {
  if (_cache && !force) return _cache
  _cache = (async () => {
    let names: string[] = []
    try {
      const r = await fetch(`${BG_DIR}/manifest.json`, { cache: 'no-store' })
      if (r.ok) {
        const j = await r.json()
        if (Array.isArray(j)) names = j.filter((n): n is string => typeof n === 'string' && IMG_RE.test(n))
      }
    } catch { /* no/invalid manifest → empty pool */ }
    names = [...new Set(names)]   // de-dupe, preserve order
    const probed = await Promise.all(names.map((n) => new Promise<string | null>((res) => {
      const img = new Image(); img.onload = () => res(n); img.onerror = () => res(null); img.src = bgUrl(n)
    })))
    return probed.filter((n): n is string => !!n)
  })()
  return _cache
}

// React hook: the validated background list (loads once, cached across the app).
export function useBackgrounds(): { images: string[]; loading: boolean } {
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let on = true
    loadBackgrounds().then((l) => { if (on) { setImages(l); setLoading(false) } })
    return () => { on = false }
  }, [])
  return { images, loading }
}

// ── Per-session random pick ──────────────────────────────────────────────────
// One random image chosen at app start and kept for the WHOLE session (stable
// across dashboard/page switches and reloads); a fresh app start re-rolls it. The
// pick is held in sessionStorage, which is per-window-session → exactly that.
const SESSION_KEY = 'soullink:bgSession'
export function sessionRandom(pool: string[]): string | null {
  if (!pool.length) return null
  try {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved && pool.includes(saved)) return saved   // already chosen this session (+ still valid)
  } catch { /* sessionStorage unavailable */ }
  const pick = pool[Math.floor(Math.random() * pool.length)]
  try { sessionStorage.setItem(SESSION_KEY, pick) } catch { /* ignore */ }
  return pick
}

// Resolve which background is active right now from the prefs + available images.
// Structural input (no store import → no coupling). 'selected' wins when valid; else the
// per-session random pick from the eligible pool (all, or favourites if so configured).
export interface ActiveBgInput { mode: 'random' | 'selected'; selected: string | null; favorites: string[]; randomFavoritesOnly: boolean }
export function resolveActiveBackground(bg: ActiveBgInput, images: string[]): string | null {
  if (!images.length) return null
  if (bg.mode === 'selected' && bg.selected && images.includes(bg.selected)) return bg.selected
  const favPool = bg.favorites.filter((f) => images.includes(f))
  const pool = (bg.randomFavoritesOnly && favPool.length) ? favPool : images
  return sessionRandom(pool)
}
