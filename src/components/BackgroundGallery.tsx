import { Star, Check, Loader2 } from 'lucide-react'
import { useSettings } from '../store/settingsStore'
import { useBackgrounds, bgUrl, resolveActiveBackground } from '../lib/backgrounds'

// The background gallery — built ENTIRELY from manifest.json (no hard-coded images or
// count). Responsive grid, hover zoom + glow, glassmorphism, a clear ring on the selected
// image, a star to (un)favourite, and click-to-apply (instant, no restart).
export default function BackgroundGallery() {
  const { images, loading } = useBackgrounds()
  const bg = useSettings((s) => s.background)
  const setBg = useSettings((s) => s.setBg)
  const toggleFav = useSettings((s) => s.toggleBgFavorite)

  if (loading) return <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Hintergründe werden geladen…</div>
  if (!images.length) return (
    <div className="rounded-2xl border border-dashed border-[#2e2e42] bg-[#16161f] p-6 text-center text-slate-400 text-sm">
      Keine Hintergründe gefunden. Lege Bilder in <code className="text-slate-300">public/backgrounds/dashboard/</code> ab und trage sie in <code className="text-slate-300">manifest.json</code> ein.
    </div>
  )
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {images.map((name) => {
        const selected = bg.mode === 'selected' && bg.selected === name
        const fav = bg.favorites.includes(name)
        return (
          <div key={name} role="button" tabIndex={0}
            onClick={() => setBg({ mode: 'selected', selected: name })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBg({ mode: 'selected', selected: name }) } }}
            className="group relative aspect-video rounded-xl overflow-hidden border cursor-pointer transition-transform hover:-translate-y-0.5 outline-none"
            style={{ borderColor: selected ? 'var(--color-pk-red)' : 'rgba(255,255,255,0.08)', boxShadow: selected ? '0 0 0 2px var(--color-pk-red), 0 12px 32px -12px rgba(204,0,0,0.65)' : 'none' }}>
            <img src={bgUrl(name)} alt={name} loading="lazy" draggable={false}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: '#0c0c12' }} />
            {/* hover glow + readability for the corner controls */}
            <span aria-hidden className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'radial-gradient(120% 130% at 50% 130%, color-mix(in srgb, var(--color-pk-red) 30%, transparent), transparent 62%)' }} />
            <span aria-hidden className="absolute inset-x-0 top-0 h-9 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.45), transparent)' }} />
            {selected && (
              <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'var(--color-pk-red)' }}>
                <Check className="w-4 h-4 text-white" />
              </span>
            )}
            <button type="button" onClick={(e) => { e.stopPropagation(); toggleFav(name) }} aria-label={fav ? 'Favorit entfernen' : 'Als Favorit markieren'}
              className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center bg-black/45 backdrop-blur-sm hover:scale-110 transition-transform ${fav ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <Star className="w-3.5 h-3.5" style={{ color: fav ? '#fbbf24' : '#e2e8f0', fill: fav ? '#fbbf24' : 'none' }} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Small live preview of the CURRENTLY active background (for the settings header).
export function BackgroundPreview() {
  const { images, loading } = useBackgrounds()
  const bg = useSettings((s) => s.background)
  const active = resolveActiveBackground(bg, images)
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 h-16 rounded-xl overflow-hidden border border-[#2e2e42] shrink-0" style={{ background: '#0c0c12' }}>
        {active && <img src={bgUrl(active)} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="min-w-0 text-sm">
        <div className="text-white font-bold truncate">{active || (loading ? '…' : '—')}</div>
        <div className="text-slate-500 text-xs">{bg.mode === 'selected' ? 'Festes Bild' : 'Zufällig (diese Sitzung)'}</div>
      </div>
    </div>
  )
}
