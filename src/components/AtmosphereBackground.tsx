import { useEffect, useMemo } from 'react'
import { useSettings } from '../store/settingsStore'
import { useBackgroundDb, bgUrl, resolveActiveBackground, DEFAULT_BG, DEFAULT_READABILITY } from '../lib/backgrounds'

// Dashboard backdrop = the active artwork from the structured DB (no CSS shapes/sprites).
// Settings → Darstellung drives it (random / favourites-only / manual). Each image carries
// its own analysed readability: a per-image dark OVERLAY + VIGNETTE keep the UI legible
// (bright images get stronger treatment, dark ones lighter), and `--panel-opacity` is
// exposed for the glass panels. Rendering: cover / center / no-repeat, full window,
// responsive, no distortion. The UI sits fully on top.
export default function AtmosphereBackground() {
  const { list } = useBackgroundDb()
  const bg = useSettings((s) => s.background)
  const active = useMemo(() => resolveActiveBackground(bg, list), [bg, list])

  const overlay = active?.overlay ?? DEFAULT_READABILITY.overlay
  const vignette = active?.vignette ?? DEFAULT_READABILITY.vignette
  const panelOpacity = active?.panelOpacity ?? DEFAULT_READABILITY.panelOpacity
  const src = active ? bgUrl(active.file) : null

  // Expose the per-image panel opacity to the glass surfaces (CSS var).
  useEffect(() => { document.documentElement.style.setProperty('--panel-opacity', String(panelOpacity)) }, [panelOpacity])

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {src && (
        <img src={src} alt="" draggable={false}
          onError={(e) => { const t = e.currentTarget; const def = bgUrl(DEFAULT_BG); if (t.src.indexOf(def) === -1) t.src = def }}
          className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover', objectPosition: 'center', backgroundColor: '#06070B' }} />
      )}
      {/* per-image dark overlay + vignette — adapts to the image so the UI stays legible */}
      <div className="absolute inset-0 transition-[background] duration-300" style={{ background: `rgba(6,7,11,${overlay})` }} />
      <div className="absolute inset-0 transition-[background] duration-300" style={{ background: `radial-gradient(ellipse 82% 72% at 50% 48%, transparent 36%, rgba(0,0,0,${vignette}) 100%)` }} />
    </div>
  )
}
