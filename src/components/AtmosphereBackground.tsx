import { useMemo } from 'react'
import { useSettings } from '../store/settingsStore'
import { useBackgrounds, bgUrl, resolveActiveBackground, DEFAULT_BG } from '../lib/backgrounds'

// Dashboard backdrop = ONE of the manifest artworks (no edition binding, no CSS shapes,
// no sprites). The active image is driven entirely by Settings → Darstellung → Hintergrund:
//   • "Zufällig"      → one random image chosen at app start, stable for the whole session
//                       (optionally only from favourites). Re-rolls on the next app start.
//   • "Bild auswählen"→ the picked image, applied instantly.
// Rendering: cover / center / no-repeat / full window / responsive (no distortion) + a ~50%
// dark overlay + a subtle vignette. The UI sits fully on top; panel glass stays unchanged.

export default function AtmosphereBackground() {
  const { images } = useBackgrounds()
  const bg = useSettings((s) => s.background)
  const active = useMemo(() => resolveActiveBackground(bg, images), [bg, images])
  const src = active ? bgUrl(active) : null

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {src && (
        <img src={src} alt="" draggable={false}
          onError={(e) => { const t = e.currentTarget; const def = bgUrl(DEFAULT_BG); if (t.src.indexOf(def) === -1) t.src = def }}
          className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover', objectPosition: 'center', backgroundColor: '#06070B' }} />
      )}
      {/* readability — ~50% dark overlay + subtle vignette (panel glass stays unchanged) */}
      <div className="absolute inset-0" style={{ background: 'rgba(6,7,11,0.50)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 48%, transparent 38%, rgba(0,0,0,0.55) 100%)' }} />
    </div>
  )
}
