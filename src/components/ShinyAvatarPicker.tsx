import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Star, Check, Loader2 } from 'lucide-react'
import { TYPE_NAMES_DE, getTypeColor } from '../lib/pokemon-api'
import {
  POKE_API, SHINY_MAX, GENERATIONS, generationOf, shinySpriteUrl,
  loadFavorites, saveFavorites,
} from '../lib/shinyAvatar'
import ShinyAvatar from './ShinyAvatar'

interface Mon { id: number; name: string }

// Gallery of all Gen I–V shiny Pokémon. Search by name, filter by generation /
// type, favorites (per device). Picks a shiny sprite URL → handed back via onSelect.
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

  // All Gen I–V names (one cached request; ids are in order from offset 0).
  const { data: mons = [], isLoading } = useQuery<Mon[]>({
    queryKey: ['shiny-names', SHINY_MAX],
    staleTime: Infinity,
    queryFn: async () => {
      const r = await fetch(`${POKE_API}/pokemon?limit=${SHINY_MAX}&offset=0`)
      const j = await r.json()
      return (j.results as { name: string }[]).map((p, i) => ({ id: i + 1, name: p.name }))
    },
  })

  // Ids of the selected type (one cached request per type).
  const { data: typeIds, isFetching: typeLoading } = useQuery<Set<number>>({
    queryKey: ['shiny-type', type],
    enabled: !!type,
    staleTime: Infinity,
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

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[220] p-4 anim-fade" onClick={onClose}>
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-2xl border border-[#2e2e42] shadow-2xl anim-pop flex flex-col" style={{ maxHeight: '88vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2e2e42]">
          <h2 className="text-white font-black text-lg flex items-center gap-2"><Star className="w-5 h-5 text-pk-yellow" /> Shiny-Avatar wählen</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pokémon suchen…" className="pk-input pl-10" autoFocus />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!gen} onClick={() => setGen(null)}>Alle Gen</Chip>
            {GENERATIONS.map((g) => <Chip key={g.gen} active={gen === g.gen} onClick={() => setGen(gen === g.gen ? null : g.gen)}>{g.label}</Chip>)}
            <span className="w-px self-stretch bg-[#2e2e42] mx-1" />
            <Chip active={favOnly} onClick={() => setFavOnly((v) => !v)}><Star className="w-3 h-3" /> Favoriten</Chip>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!type} onClick={() => setType(null)}>Alle Typen</Chip>
            {Object.entries(TYPE_NAMES_DE).map(([en, de]) => (
              <button key={en} onClick={() => setType(type === en ? null : en)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-all"
                style={type === en
                  ? { background: getTypeColor(en), color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }
                  : { background: '#16161f', color: '#94a3b8', border: '1px solid #2e2e42' }}>
                {de}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[200px]">
          {isLoading || (type && typeLoading) ? (
            <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">Keine Pokémon gefunden.</div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {filtered.map((m) => {
                const sel = selected === m.id
                const fav = favSet.has(m.id)
                return (
                  <button key={m.id} onClick={() => setSelected(m.id)} title={m.name}
                    className="relative flex flex-col items-center gap-1 rounded-xl p-1.5 border transition-all"
                    style={sel ? { borderColor: '#CC0000', background: 'rgba(204,0,0,0.1)' } : { borderColor: '#2e2e42', background: '#16161f' }}>
                    <ShinyAvatar src={shinySpriteUrl(m.id)} size={48} ring={false} />
                    <span className="text-[9px] text-slate-400 capitalize truncate w-full text-center leading-tight">{m.name}</span>
                    <span onClick={(e) => { e.stopPropagation(); toggleFav(m.id) }}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                      title={fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}>
                      <Star className="w-3.5 h-3.5" style={{ color: fav ? '#FFCB05' : '#475569', fill: fav ? '#FFCB05' : 'transparent' }} />
                    </span>
                    {sel && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-pk-red flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#2e2e42]">
          <span className="text-slate-500 text-xs">{filtered.length} Pokémon</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost px-5">Abbrechen</button>
            <button onClick={() => selected && onSelect(shinySpriteUrl(selected))} disabled={!selected} className="btn-primary px-6 disabled:opacity-50">Übernehmen</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full transition-all"
      style={active ? { background: '#CC0000', color: '#fff', border: '1px solid rgba(204,0,0,0.5)' } : { background: '#16161f', color: '#94a3b8', border: '1px solid #2e2e42' }}>
      {children}
    </button>
  )
}
