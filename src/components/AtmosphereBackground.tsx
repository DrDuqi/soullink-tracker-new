import { useEffect, useMemo, useState } from 'react'
import { useProfiles } from '../hooks/useProfiles'
import { resolveEdition } from '../lib/edition'

// Dashboard backdrop = a finished 16:9 ARTWORK image (no CSS shapes, no per-Pokémon PNGs).
// The UI sits on top; this layer only renders the art (cover / center / responsive, never
// distorted) plus a readability treatment (dark overlay + vignette + edge gradients) and a
// few optional dust motes. Edition-aware: the active edition swaps the artwork, otherwise
// default.webp. A missing edition image falls back to default.webp; a missing default just
// leaves the dark base — never a broken layout. Drop images into
// /public/backgrounds/dashboard/ (see the README there).

const BG_DIR = '/backgrounds/dashboard'
const DEFAULT_BG = `${BG_DIR}/default.webp`
// canonical EditionKey → artwork file. Add a line per edition as artworks arrive.
const EDITION_BG: Record<string, string> = {
  Feuerrot: 'fire-red.webp',
  Smaragd: 'emerald.webp',
  Platin: 'platinum.webp',
}
function bgFor(game?: string | null): string {
  const key = resolveEdition(game)
  const file = key ? EDITION_BG[key] : undefined
  return file ? `${BG_DIR}/${file}` : DEFAULT_BG
}

export default function AtmosphereBackground({ game }: { game?: string }) {
  const { active } = useProfiles()
  // Active edition: explicit prop → active profile → last chosen edition → default.
  const edition = useMemo(() => {
    if (game) return game
    if (active?.edition) return active.edition
    try { return localStorage.getItem('soullink:lastEdition') || undefined } catch { return undefined }
  }, [game, active?.edition])

  const [src, setSrc] = useState<string>(() => bgFor(edition))
  useEffect(() => { setSrc(bgFor(edition)) }, [edition])
  // Missing edition file → default; missing default → dark base (no broken image icon).
  const onError = () => setSrc((s) => (s !== DEFAULT_BG ? DEFAULT_BG : ''))

  const motes = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    left: `${(i * 37 + 8) % 100}%`, top: `${18 + ((i * 53) % 72)}%`,
    d: `${16 + (i % 5) * 4}s`, delay: `${(i * 1.7) % 14}s`, s: 0.7 + (i % 3) * 0.3,
  })), [])

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* the finished artwork — cover, centered, responsive, no distortion */}
      {src && (
        <img src={src} alt="" draggable={false} onError={onError}
          className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover', objectPosition: 'center' }} />
      )}

      {/* readability — dark overlay + vignette + edge gradients (panels stay crisp on top) */}
      <div className="absolute inset-0" style={{ background: 'rgba(6,7,11,0.42)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 76% 66% at 50% 46%, transparent 32%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.86) 100%)' }} />
      <div className="absolute inset-x-0 top-0 h-28" style={{ background: 'linear-gradient(180deg, rgba(4,5,9,0.70), transparent)' }} />
      <div className="absolute inset-x-0 bottom-0 h-36" style={{ background: 'linear-gradient(0deg, rgba(4,5,9,0.60), transparent)' }} />

      {/* optional, subtle dust motes (hidden by the no-fx toggle) */}
      <div className="atmo">
        {motes.map((m, i) => (
          <span key={i} className="atmo-p" style={{ left: m.left, top: m.top, animationDuration: m.d, animationDelay: m.delay, transform: `scale(${m.s})` }} />
        ))}
      </div>
    </div>
  )
}
