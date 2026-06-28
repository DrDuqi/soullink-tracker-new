import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, BookOpen } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { searchDex, dexName, spriteUrl, typeLabel, typeColor, ALL_TYPES, GENS, type DexEntry, type Lang } from '../../lib/dex/dex'

// SoulDex — universal Pokédex. The bundled index makes browse + search INSTANT and
// fully offline; sprites lazy-load from the CDN. Deep-links into a run / SoulGuide come
// next. Matches the AAA dark look of the rest of the Companion.
function TypeChip({ slug, lang, on, onClick }: { slug: string; lang: Lang; on: boolean; onClick: () => void }) {
  const c = typeColor(slug)
  return (
    <button onClick={onClick} className="text-[11px] font-bold rounded-full px-2.5 py-1 border transition-all"
      style={on ? { background: c, borderColor: c, color: '#0b0b10' } : { borderColor: '#2e2e42', color: '#cbd5e1' }}>
      {typeLabel(slug, lang)}
    </button>
  )
}

export default function DexPage() {
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const [q, setQ] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [gens, setGens] = useState<number[]>([])

  const results = useMemo(() => searchDex(q, { types, gens }), [q, types, gens])
  const toggle = <T,>(arr: T[], v: T, set: (a: T[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const reset = () => { setQ(''); setTypes([]); setGens([]) }
  const active = q || types.length || gens.length

  return (
    <div className="px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-[1180px] anim-fade-up">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-8 h-8 rounded-xl bg-pk-red/15 flex items-center justify-center"><BookOpen className="w-4.5 h-4.5 text-pk-red" style={{ width: 18, height: 18 }} /></span>
          <h1 className="text-white font-black text-3xl tracking-tight">SoulDex</h1>
        </div>
        <p className="text-slate-400 mb-5">Alle {searchDex('', {}).length} Pokémon — Typen, Werte, Sprites. Offline, sofort durchsuchbar.</p>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'de' ? 'Pokémon suchen … (Name oder Nr.)' : 'Search Pokémon … (name or no.)'}
            className="w-full rounded-2xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none pl-10 pr-10 py-3 text-sm text-white" />
          {active ? <button onClick={reset} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Zurücksetzen"><X className="w-4 h-4" /></button> : null}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {ALL_TYPES.map((t) => <TypeChip key={t} slug={t} lang={lang} on={types.includes(t)} onClick={() => toggle(types, t, setTypes)} />)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[11px] font-bold text-slate-500 mr-1">{lang === 'de' ? 'Gen' : 'Gen'}</span>
          {GENS.map((g) => (
            <button key={g} onClick={() => toggle(gens, g, setGens)}
              className={`text-[11px] font-bold rounded-full px-2.5 py-1 border transition-colors ${gens.includes(g) ? 'text-white border-pk-red/60 bg-pk-red/15' : 'text-slate-400 border-[#2e2e42] hover:bg-white/5'}`}>{g}</button>
          ))}
          <span className="ml-auto text-xs text-slate-500">{results.length} {lang === 'de' ? 'Treffer' : 'results'}</span>
        </div>

        {/* Grid */}
        {results.length === 0 ? (
          <div className="mt-10 text-center text-slate-500 text-sm">{lang === 'de' ? 'Keine Pokémon gefunden.' : 'No Pokémon found.'}</div>
        ) : (
          <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {results.map((e) => <DexCard key={e.id} e={e} lang={lang} onClick={() => navigate(`/dex/pokemon/${e.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function DexCard({ e, lang, onClick }: { e: DexEntry; lang: Lang; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="group relative rounded-2xl border border-white/[0.07] p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-pk-red/40"
      style={{ background: 'linear-gradient(160deg, rgba(22,22,31,0.9), rgba(13,13,19,0.9))', contentVisibility: 'auto', containIntrinsicSize: '180px' } as React.CSSProperties}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-600">#{String(e.id).padStart(4, '0')}</span>
        <span className="text-[10px] font-bold text-slate-600">{lang === 'de' ? 'Gen' : 'Gen'} {e.g}</span>
      </div>
      <div className="h-20 flex items-center justify-center">
        <img src={spriteUrl(e.id)} alt="" loading="lazy" draggable={false} className="h-20 w-20 object-contain transition-transform group-hover:scale-110" style={{ imageRendering: 'pixelated' }} />
      </div>
      <div className="text-white font-bold text-sm truncate text-center">{dexName(e, lang)}</div>
      <div className="flex items-center justify-center gap-1 mt-1.5 flex-wrap">
        {e.t.map((t) => <span key={t} className="text-[10px] font-bold rounded px-1.5 py-0.5" style={{ background: typeColor(t), color: '#0b0b10' }}>{typeLabel(t, lang)}</span>)}
      </div>
    </button>
  )
}
