import { useEffect, useState } from 'react'
import { EMU_BASE } from './companion'

// ── Background DATABASE (data-driven, manifest 2.0) ──────────────────────────
// The companion scans /backgrounds/dashboard, merges a shipped seed manifest.json with a
// writable metadata store, and serves the structured DB at /api/backgrounds. Each NEW
// image (no metadata yet) is analysed ONCE in the browser (avg brightness/contrast →
// per-image overlay/vignette/panelOpacity + tags), then the values are persisted server
// side — so known images are never re-analysed. Nothing is hard-coded: drop images into
// the folder and they appear, get analysed once, and join the gallery + random pool.

export const BG_DIR = '/backgrounds/dashboard'
export const DEFAULT_BG = 'default.webp'
export const bgUrl = (file: string) => `${BG_DIR}/${file.split('/').map(encodeURIComponent).join('/')}`

export interface BgEntry {
  id: string
  file: string
  name: string
  tags: string[]
  brightness: string | null
  contrast: string | null
  overlay: number | null
  vignette: number | null
  panelOpacity: number | null
  analyzed: boolean
}
export interface AnalyzedMeta { brightness: string; contrast: string; overlay: number; vignette: number; panelOpacity: number; tags: string[] }

// Sensible defaults until a brand-new image is analysed (one frame later).
export const DEFAULT_READABILITY = { overlay: 0.5, vignette: 0.3, panelOpacity: 0.65 }

// ── readability mapping: brighter image → stronger overlay/vignette/darker panels ───
function readabilityFor(meanLum: number) {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const round = (v: number) => Math.round(v * 100) / 100
  return {
    overlay: round(clamp(0.3 + meanLum * 0.45, 0.3, 0.7)),       // dark .30–.42 · normal .45–.55 · bright .60–.70
    vignette: round(clamp(0.15 + meanLum * 0.42, 0.15, 0.5)),
    panelOpacity: round(clamp(0.5 + meanLum * 0.38, 0.5, 0.8)),
    brightness: meanLum > 0.6 ? 'high' : meanLum < 0.33 ? 'low' : 'medium',
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = url })
}

// Analyse one image (downscaled to 64×36) → readability values + crude tags. Same-origin
// images don't taint the canvas. Returns null on any failure (never throws).
export async function analyzeImage(url: string): Promise<AnalyzedMeta | null> {
  try {
    const img = await loadImage(url)
    const w = 64, h = 36
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const ctx = cv.getContext('2d', { willReadFrequently: true }); if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    const d = ctx.getImageData(0, 0, w, h).data
    const n = w * h
    let sum = 0, sumSq = 0, rs = 0, gs = 0, bs = 0
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      sum += lum; sumSq += lum * lum; rs += r; gs += g; bs += b
    }
    const mean = sum / n
    const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean))
    const contrast = std > 0.24 ? 'high' : std < 0.13 ? 'low' : 'medium'
    const r = readabilityFor(mean)
    const avgR = rs / n, avgG = gs / n, avgB = bs / n
    const tags: string[] = []
    if (avgR >= avgG && avgR >= avgB) tags.push('warm')
    else if (avgB >= avgR && avgB >= avgG) tags.push('cool')
    else tags.push('green')
    tags.push(r.brightness === 'high' ? 'bright' : r.brightness === 'low' ? 'dark' : 'mid')
    return { brightness: r.brightness, contrast, overlay: r.overlay, vignette: r.vignette, panelOpacity: r.panelOpacity, tags }
  } catch { return null }
}

function normalizeSeed(e: unknown): BgEntry | null {
  const o = (typeof e === 'string' ? { file: e } : e) as Record<string, unknown>
  const file = typeof o?.file === 'string' ? o.file : null
  if (!file) return null
  const id = (typeof o.id === 'string' ? o.id : file.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'))
  return {
    id, file, name: (typeof o.name === 'string' ? o.name : id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())),
    tags: Array.isArray(o.tags) ? (o.tags as string[]) : [],
    brightness: (o.brightness as string) ?? null, contrast: (o.contrast as string) ?? null,
    overlay: typeof o.overlay === 'number' ? o.overlay : null,
    vignette: typeof o.vignette === 'number' ? o.vignette : null,
    panelOpacity: typeof o.panelOpacity === 'number' ? o.panelOpacity : null,
    analyzed: typeof o.overlay === 'number',
  }
}

// Fetch the structured DB: companion API first (auto-detected folder + persisted meta);
// website fallback reads the seed manifest.json directly. Logs + survives a broken manifest.
export async function fetchBackgroundDb(): Promise<BgEntry[]> {
  try {
    const r = await fetch(`${EMU_BASE}/api/backgrounds`, { cache: 'no-store' })
    if (r.ok) { const j = await r.json(); if (j?.ok && Array.isArray(j.list)) return j.list as BgEntry[] }
  } catch { /* no companion → fall through */ }
  try {
    const r = await fetch(`${BG_DIR}/manifest.json`, { cache: 'no-store' })
    if (r.ok) {
      const j = await r.json()
      if (Array.isArray(j)) return j.map(normalizeSeed).filter((x): x is BgEntry => !!x)
    } else { console.warn('[backgrounds] manifest.json nicht erreichbar → Fallback default.webp') }
  } catch (e) { console.warn('[backgrounds] manifest.json defekt/fehlt:', e) }
  return []
}

async function postBackgroundMeta(file: string, meta: AnalyzedMeta): Promise<void> {
  try { await fetch(`${EMU_BASE}/api/backgrounds/meta`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file, ...meta }) }) } catch { /* best-effort */ }
}

// The DB hook: load it, then analyse any NOT-yet-analysed image exactly once (sequentially,
// gentle), persist the values, and reflect them in state. Known images are skipped.
export function useBackgroundDb(): { list: BgEntry[]; loading: boolean } {
  const [list, setList] = useState<BgEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let on = true
    ;(async () => {
      const db = await fetchBackgroundDb()
      if (!on) return
      setList(db); setLoading(false)
      for (const e of db) {
        if (!on) return
        if (e.analyzed && e.overlay != null) continue
        const meta = await analyzeImage(bgUrl(e.file))
        if (!on || !meta) continue
        postBackgroundMeta(e.file, meta)
        setList((prev) => prev.map((x) => (x.file === e.file ? { ...x, ...meta, analyzed: true } : x)))
      }
    })()
    return () => { on = false }
  }, [])
  return { list, loading }
}

// ── per-session random pick (stable across page switches; re-rolls on app start) ─────
const SESSION_KEY = 'soullink:bgSession'
function sessionRandom(pool: string[]): string | null {
  if (!pool.length) return null
  try { const saved = sessionStorage.getItem(SESSION_KEY); if (saved && pool.includes(saved)) return saved } catch { /* ignore */ }
  const pick = pool[Math.floor(Math.random() * pool.length)]
  try { sessionStorage.setItem(SESSION_KEY, pick) } catch { /* ignore */ }
  return pick
}

export interface ActiveBgInput { mode: 'random' | 'selected'; selected: string | null; favorites: string[]; randomFavoritesOnly: boolean }
export function resolveActiveBackground(bg: ActiveBgInput, list: BgEntry[]): BgEntry | null {
  if (!list.length) return null
  if (bg.mode === 'selected' && bg.selected) { const e = list.find((x) => x.file === bg.selected); if (e) return e }
  const favPool = bg.favorites.filter((f) => list.some((x) => x.file === f))
  const poolFiles = (bg.randomFavoritesOnly && favPool.length) ? favPool : list.map((x) => x.file)
  const pick = sessionRandom(poolFiles)
  return pick ? (list.find((x) => x.file === pick) ?? null) : null
}
