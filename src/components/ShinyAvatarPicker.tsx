import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, X, Star, Check, Loader2, Sparkles } from 'lucide-react'
import { TYPE_NAMES_DE, getTypeColor } from '../lib/pokemon-api'
import {
  POKE_API, SHINY_MAX, GENERATIONS, generationOf, shinySpriteUrl,
  loadFavorites, saveFavorites,
} from '../lib/shinyAvatar'
import ShinyAvatar from './ShinyAvatar'

interface Mon { id: number; name: string }

const H_PAD = 44   // generous horizontal padding inside the scroll area
const TILE_MIN = 128
const ROW_H = 134

// A high-quality "Pokédex"-style shiny picker: large centered modal, sticky
// search + filters, a virtualized responsive grid (handles all 649 smoothly),
// rich hover/selection feedback, sticky footer.
export default function ShinyAvatarPicker({ currentId, onSelect, onClose }: {
  currentId: number | null
  onSelect: (url: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [gen, setGen] = useState<number | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [favOnly, setFavOnly] = useState(false)
  const [favs, setFavs] = useState<number[]>(() => loadFavorites())
  const [selected, setSelected] = useState<number | null>(currentId)
  const favSet = useMemo(() => new Set(favs), [favs])

  const { data: mons = [], isLoading } = useQuery<Mon[]>({
    queryKey: ['shiny-names', SHINY_MAX], staleTime: Infinity,
    queryFn: async () => {
      const r = await fetch(`${POKE_API}/pokemon?limit=${SHINY_MAX}&offset=0`)
      const j = await r.json()
      return (j.results as { name: string }[]).map((p, i) => ({ id: i + 1, name: p.name }))
    },
  })
  const { data: typeIds, isFetching: typeLoading } = useQuery<Set<number>>({
    queryKey: ['shiny-type', type], enabled: !!type, staleTime: Infinity,
    queryFn: async () => {
      const r = await fetch(`${POKE_API}/type/${type}`)
      const j = await r.json()
      const ids = new Set<number>()
      for (const e of j.pokemon as { pokemon: { url: string } }[]) {
        const m = /\/pokemon\/(\d+)\//.exec(e.pokemon.url)
        if (m) { const id = Number(m[1]); if (id <= SHINY_MAX) ids.add(id) }
      }
      return ids
    },
  })

  function toggleFav(id: number) {
    setFavs((prev) => { const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]; saveFavorites(next); return next })
  }

  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => mons.filter((m) => {
    if (gen && generationOf(m.id) !== gen) return false
    if (type && typeIds && !typeIds.has(m.id)) return false
    if (favOnly && !favSet.has(m.id)) return false
    if (q && !m.name.toLowerCase().includes(q)) return false
    return true
  }), [mons, gen, type, typeIds, favOnly, favSet, q])

  // Responsive columns from the live scroll width.
  const scrollRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(7)
  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    const update = () => setCols(Math.max(2, Math.min(12, Math.floor((el.clientWidth - H_PAD * 2) / TILE_MIN))))
    update()
    const ro = new ResizeObserver(update); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rowCount = Math.ceil(filtered.length / cols)
  const rowVirtualizer = useVirtualizer({
    count: rowCount, getScrollElement: () => scrollRef.current, estimateSize: () => ROW_H,
    overscan: 5, paddingStart: 26, paddingEnd: 26,
  })

  const busy = isLoading || (!!type && typeLoading)
  const selectedName = selected ? mons.find((m) => m.id === selected)?.name : null

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 sm:p-8 anim-fade" style={{ background: 'rgba(4,5,9,0.72)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }} onClick={onClose}>
      <div className="bg-[#14141d] rounded-3xl w-full border border-[#2e2e42] shadow-2xl anim-pop flex flex-col overflow-hidden"
        style={{ maxWidth: 1360, height: '88vh' }} onClick={(e) => e.stopPropagation()}>

        {/* ── Sticky header ── */}
        <div className="shrink-0 border-b border-[#2e2e42]" style={{ background: 'linear-gradient(180deg,#1c1c26,#16161f)' }}>
          <div className="flex items-center justify-between px-8 pt-6">
            <h2 className="text-white font-black text-2xl flex items-center gap-2.5"><Sparkles className="w-6 h-6 text-pk-yellow" /> Shiny-Avatar wählen</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-colors"><X className="w-6 h-6" /></button>
          </div>
          <div className="px-8 pt-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pokémon suchen…" autoFocus
                className="w-full bg-[#0e0e16] border border-[#2e2e42] rounded-2xl pl-12 pr-4 py-3.5 text-white text-base outline-none focus:border-pk-red/60 transition-colors" />
            </div>
          </div>
          <div className="px-8 py-4 space-y-2.5">
            <div className="flex flex-wrap gap-2">
              <Chip active={!favOnly} onClick={() => setFavOnly(false)}>🆕 Alle</Chip>
              <Chip active={favOnly} onClick={() => setFavOnly(true)}><Star className="w-3.5 h-3.5" /> Favoriten</Chip>
              <span className="w-px self-stretch bg-[#2e2e42] mx-1" />
              <Chip active={!gen} onClick={() => setGen(null)}>Alle Gen</Chip>
              {GENERATIONS.map((g) => <Chip key={g.gen} active={gen === g.gen} onClick={() => setGen(gen === g.gen ? null : g.gen)}>{g.label}</Chip>)}
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip active={!type} onClick={() => setType(null)}>Alle Typen</Chip>
              {Object.entries(TYPE_NAMES_DE).map(([en, de]) => (
                <button key={en} onClick={() => setType(type === en ? null : en)}
                  className="text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                  style={type === en ? { background: getTypeColor(en), color: '#fff', boxShadow: `0 0 12px ${getTypeColor(en)}66` } : { background: '#16161f', color: '#94a3b8', border: '1px solid #2e2e42' }}>
                  {de}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Virtualized scroll area ── */}
        <div ref={scrollRef} className="shiny-scroll flex-1 overflow-y-auto overflow-x-hidden">
          {busy ? (
            <div className="flex items-center justify-center h-full text-slate-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2"><Search className="w-8 h-8 opacity-40" /><span className="text-sm">Keine Pokémon gefunden.</span></div>
          ) : (
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
              {rowVirtualizer.getVirtualItems().map((vr) => {
                const items = filtered.slice(vr.index * cols, vr.index * cols + cols)
                return (
                  <div key={vr.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: vr.size, transform: `translateY(${vr.start}px)`, display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: 18, padding: `0 ${H_PAD}px`, boxSizing: 'border-box', alignItems: 'start' }}>
                    {items.map((m) => {
                      const sel = selected === m.id
                      const fav = favSet.has(m.id)
                      return (
                        <button key={m.id} onClick={() => setSelected(m.id)} title={m.name}
                          className="shiny-tile group relative flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 border"
                          style={sel
                            ? { borderColor: '#CC0000', borderWidth: 2, background: 'rgba(204,0,0,0.12)', boxShadow: '0 0 22px rgba(204,0,0,0.32)' }
                            : { borderColor: '#26263300', borderWidth: 2, background: '#181820' }}>
                          <ShinyAvatar src={shinySpriteUrl(m.id)} size={64} ring={false} />
                          <span className="text-[11px] text-slate-300 capitalize truncate w-full text-center leading-tight">{m.name}</span>
                          <span onClick={(e) => { e.stopPropagation(); toggleFav(m.id) }}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center hover:scale-125 transition-transform"
                            title={fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}>
                            <Star className="w-4 h-4" style={{ color: fav ? '#FFCB05' : '#3e3e52', fill: fav ? '#FFCB05' : 'transparent' }} />
                          </span>
                          {sel && <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-pk-red flex items-center justify-center shadow-lg anim-pop"><Check className="w-3.5 h-3.5 text-white" strokeWidth={3} /></span>}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Sticky footer ── */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-8 py-5 border-t border-[#2e2e42]" style={{ background: 'linear-gradient(0deg,#1c1c26,#16161f)' }}>
          <div className="flex items-center gap-3 min-w-0">
            {selected && <ShinyAvatar src={shinySpriteUrl(selected)} size={40} />}
            <div className="min-w-0">
              <div className="text-white text-sm font-bold capitalize truncate">{selectedName ?? 'Kein Pokémon gewählt'}</div>
              <div className="text-slate-500 text-xs">{filtered.length} von {SHINY_MAX} Pokémon</div>
            </div>
          </div>
          <div className="flex gap-3 shrink-0">
            <button onClick={onClose} className="btn-ghost px-6">Abbrechen</button>
            <button onClick={() => selected && onSelect(shinySpriteUrl(selected))} disabled={!selected} className="btn-primary px-8 disabled:opacity-50">Übernehmen</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full transition-all"
      style={active ? { background: '#CC0000', color: '#fff', boxShadow: '0 0 12px rgba(204,0,0,0.4)' } : { background: '#16161f', color: '#94a3b8', border: '1px solid #2e2e42' }}>
      {children}
    </button>
  )
}
