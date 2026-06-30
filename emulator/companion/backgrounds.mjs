import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'

// ── Background DATABASE (server side) ────────────────────────────────────────
// Scans the served image folder, merges an optional shipped seed manifest.json (authored
// name/tags) with a WRITABLE metadata store (the per-image analysis the browser computes
// once), and exposes the structured DB. Adding images = drop files in the folder; they are
// auto-detected here. Never throws: a missing folder / broken manifest just logs + degrades.

let IMG_DIR = null     // <web>/backgrounds/dashboard  (read-only resources)
let STORE = null       // userData/backgrounds.json     (writable analysis + metadata)

export function initBackgrounds({ imageDir = null, store = null } = {}) {
  IMG_DIR = imageDir
  STORE = store
  try { if (IMG_DIR && !existsSync(IMG_DIR)) console.warn('[backgrounds] Bildordner fehlt:', IMG_DIR) } catch { /* ignore */ }
}

const IMG_RE = /\.(webp|png|jpe?g|avif|gif)$/i
const idFor = (file) => basename(file).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// Friendly display name from a filename: cut at boilerplate (4k/wallpaper/uhdpaper/…) and
// trailing id codes (e.g. "260@5@d"), then title-case. Falls back to the first few tokens.
const JUNK = new Set(['4k', '5k', '8k', 'uhd', 'hd', 'wallpaper', 'wallpapers', 'uhdpaper', 'com', 'digital', 'art'])
function titleFor(idOrFile) {
  const base = String(idOrFile).replace(/\.[^.]+$/, '')
  const parts = base.split(/[-_.\s]+/).filter(Boolean)
  const out = []
  for (const p of parts) {
    if (JUNK.has(p.toLowerCase())) break
    if (/uhdpaper/i.test(p)) break
    if (/^\d+(@\d+)*[a-z]?$/i.test(p)) break       // trailing codes like 260@5@d
    out.push(p)
  }
  const tokens = out.length ? out : parts.slice(0, 3)
  return tokens.join(' ').replace(/\b\w/g, (c) => c.toUpperCase()) || base
}

function loadStore() {
  if (!STORE) return {}
  try { const j = JSON.parse(readFileSync(STORE, 'utf8')); return (j && typeof j === 'object') ? j : {} }
  catch { return {} }
}
function saveStore(obj) {
  if (!STORE) return false
  try { mkdirSync(dirname(STORE), { recursive: true }); writeFileSync(STORE, JSON.stringify(obj, null, 2)); return true }
  catch (e) { console.error('[backgrounds] Store-Schreiben fehlgeschlagen:', e?.message || e); return false }
}
// Optional shipped seed (authored name/tags/metadata). Tolerates the legacy string[] form.
function loadSeed() {
  const seed = {}
  if (!IMG_DIR) return seed
  const p = join(IMG_DIR, 'manifest.json')
  if (!existsSync(p)) return seed
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'))
    if (Array.isArray(j)) for (const e of j) { const o = typeof e === 'string' ? { file: e } : e; if (o && o.file) seed[o.file] = o }
    else console.warn('[backgrounds] manifest.json ist kein Array — ignoriert.')
  } catch (e) { console.error('[backgrounds] manifest.json defekt — ignoriert:', e?.message || e) }
  return seed
}

// The merged DB: every image file actually present in the folder + its metadata.
export function listBackgrounds() {
  let files = []
  try { files = readdirSync(IMG_DIR).filter((f) => IMG_RE.test(f)) }
  catch (e) { console.error('[backgrounds] Ordner nicht lesbar:', IMG_DIR, e?.message || e); return [] }
  const seed = loadSeed(), store = loadStore()
  return files.sort().map((file) => {
    const s = seed[file] || {}, m = store[file] || {}
    const id = s.id || idFor(file)
    const pick = (k) => (m[k] !== undefined && m[k] !== null ? m[k] : (s[k] !== undefined ? s[k] : null))
    return {
      id, file, name: s.name || m.name || titleFor(file),
      tags: m.tags || s.tags || [],
      brightness: pick('brightness'), contrast: pick('contrast'),
      overlay: pick('overlay'), vignette: pick('vignette'), panelOpacity: pick('panelOpacity'),
      analyzed: m.analyzed === true || pick('overlay') !== null,
    }
  })
}

// Persist the analysis the browser computed for one image (idempotent; only real files).
export function saveBackgroundMeta(file, meta = {}) {
  if (!file || !IMG_DIR) return false
  try { if (!existsSync(join(IMG_DIR, basename(file)))) return false } catch { return false }
  const clamp01 = (v) => (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(1, v)) : undefined
  const store = loadStore()
  const prev = store[file] || {}
  store[file] = {
    ...prev,
    brightness: typeof meta.brightness === 'string' ? meta.brightness : prev.brightness,
    contrast: typeof meta.contrast === 'string' ? meta.contrast : prev.contrast,
    overlay: clamp01(meta.overlay) ?? prev.overlay,
    vignette: clamp01(meta.vignette) ?? prev.vignette,
    panelOpacity: clamp01(meta.panelOpacity) ?? prev.panelOpacity,
    tags: Array.isArray(meta.tags) ? meta.tags.slice(0, 8) : prev.tags,
    analyzed: true, updatedAt: new Date().toISOString(),
  }
  return saveStore(store)
}
