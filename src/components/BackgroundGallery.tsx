import { Star, Check, Loader2 } from 'lucide-react'
import { useSettings } from '../store/settingsStore'
import { useBackgroundDb, bgUrl, resolveActiveBackground } from '../lib/backgrounds'

// The background gallery — built ENTIRELY from the structured DB (manifest 2.0). Responsive
// grid, preview + name, hover zoom + glow, glassmorphism, a clear ring on the selected
// image, a star to (un)favourite, click-to-apply (instant, no restart). No hard-coded
// images or count.
export default function BackgroundGallery() {
  const { list, loading } = useBackgroundDb()
  const bg = useSettings((s) => s.background)
  const setBg = useSettings((s) => s.setBg)
  const toggleFav = useSettings((s) => s.toggleBgFavorite)

  if (loading && !list.length) return <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Hintergründe werden geladen…</div>
  if (!list.length) return (
    <div className="rounded-2xl border border-dashed border-[#2e2e42] bg-[#16161f] p-6 text-center text-slate-400 text-sm">
      Keine Hintergründe gefunden. Lege Bilder in <code className="text-slate-300">public/backgrounds/dashboard/</code> ab.
    </div>
  )
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {list.map((entry) => {
        const selected = bg.mode === 'selected' && bg.selected === entry.file
        const fav = bg.favorites.includes(entry.file)
        return (
          <div key={entry.file} role="button" tabIndex={0}
            onClick={() => setBg({ mode: 'selected', selected: entry.file })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setBg({ mode: 'selected', selected: entry.file }) } }}
            className="group relative aspect-video rounded-xl overflow-hidden border cursor-pointer transition-transform hover:-translate-y-0.5 outline-none"
            style={{ borderColor: selected ? 'var(--color-pk-red)' : 'rgba(255,255,255,0.08)', boxShadow: selected ? '0 0 0 2px var(--color-pk-red), 0 12px 32px -12px rgba(204,0,0,0.65)' : 'none' }}>
            <img src={bgUrl(entry.file)} alt={entry.name} loading="lazy" draggable={false}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: '#0c0c12' }} />
            {/* hover glow + bottom scrim for the name */}
            <span aria-hidden className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'radial-gradient(120% 130% at 50% 130%, color-mix(in srgb, var(--color-pk-red) 30%, transparent), transparent 62%)' }} />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-9" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.65), transparent)' }} />
            <span className="absolute bottom-1.5 left-2 right-8 text-[11px] font-bold text-white truncate drop-shadow">{entry.name}</span>
            {selected && (
              <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-lg" style={{ background: 'var(--color-pk-red)' }}>
                <Check className="w-4 h-4 text-white" />
              </span>
            )}
            <button type="button" onClick={(e) => { e.stopPropagation(); toggleFav(entry.file) }} aria-label={fav ? 'Favorit entfernen' : 'Als Favorit markieren'}
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
  const { list, loading } = useBackgroundDb()
  const bg = useSettings((s) => s.background)
  const active = resolveActiveBackground(bg, list)
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 h-16 rounded-xl overflow-hidden border border-[#2e2e42] shrink-0" style={{ background: '#0c0c12' }}>
        {active && <img src={bgUrl(active.file)} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="min-w-0 text-sm">
        <div className="text-white font-bold truncate">{active?.name || (loading ? '…' : '—')}</div>
        <div className="text-slate-500 text-xs">{bg.mode === 'selected' ? 'Festes Bild' : (bg.randomFavoritesOnly ? 'Zufällig (Favoriten)' : 'Zufällig (diese Sitzung)')}</div>
      </div>
    </div>
  )
}
