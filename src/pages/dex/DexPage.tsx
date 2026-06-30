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
    <button onClick={onClick} className="text-xs font-bold rounded-full px-3 py-1.5 border transition-all duration-200 hover:scale-105"
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
    <div className="px-6 lg:px-10 py-10">
      <div className="mx-auto max-w-[1320px] anim-fade-up">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-11 h-11 rounded-2xl bg-pk-red/15 flex items-center justify-center"><BookOpen className="text-pk-red" style={{ width: 24, height: 24 }} /></span>
          <h1 className="text-white font-black text-4xl tracking-tight">SoulDex</h1>
        </div>
        <p className="text-slate-400 text-base mb-6">Alle {searchDex('', {}).length} Pokémon — Typen, Werte, Sprites. Offline, sofort durchsuchbar.</p>

        {/* Search */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'de' ? 'Pokémon suchen … (Name oder Nr.)' : 'Search Pokémon … (name or no.)'}
            className="w-full rounded-2xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none pl-12 pr-12 py-4 text-base text-white transition-colors duration-200" />
          {active ? <button onClick={reset} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors" aria-label="Zurücksetzen"><X className="w-5 h-5" /></button> : null}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {ALL_TYPES.map((t) => <TypeChip key={t} slug={t} lang={lang} on={types.includes(t)} onClick={() => toggle(types, t, setTypes)} />)}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <span className="text-xs font-bold text-slate-500 mr-1">{lang === 'de' ? 'Gen' : 'Gen'}</span>
          {GENS.map((g) => (
            <button key={g} onClick={() => toggle(gens, g, setGens)}
              className={`text-xs font-bold rounded-full px-3 py-1.5 border transition-all duration-200 hover:scale-105 ${gens.includes(g) ? 'text-white border-pk-red/60 bg-pk-red/15' : 'text-slate-400 border-[#2e2e42] hover:bg-white/5'}`}>{g}</button>
          ))}
          <span className="ml-auto text-sm text-slate-500">{results.length} {lang === 'de' ? 'Treffer' : 'results'}</span>
        </div>

        {/* Grid */}
        {results.length === 0 ? (
          <div className="mt-12 text-center text-slate-500 text-base">{lang === 'de' ? 'Keine Pokémon gefunden.' : 'No Pokémon found.'}</div>
        ) : (
          <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
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
      className="group relative rounded-2xl border border-white/[0.07] p-4 text-left transition-all duration-200 ease-out hover:-translate-y-1 hover:border-pk-red/45 hover:shadow-[0_16px_40px_-18px_rgba(204,0,0,0.55)]"
      style={{ background: 'linear-gradient(160deg, rgba(22,22,31,0.9), rgba(13,13,19,0.9))', contentVisibility: 'auto', containIntrinsicSize: '250px' } as React.CSSProperties}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-600">#{String(e.id).padStart(4, '0')}</span>
        <span className="text-[11px] font-bold text-slate-600">{lang === 'de' ? 'Gen' : 'Gen'} {e.g}</span>
      </div>
      <div className="h-28 flex items-center justify-center">
        <img src={spriteUrl(e.id)} alt="" loading="lazy" draggable={false} className="h-28 w-28 object-contain transition-transform duration-200 group-hover:scale-110" style={{ imageRendering: 'pixelated' }} />
      </div>
      <div className="text-white font-bold text-base truncate text-center">{dexName(e, lang)}</div>
      <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
        {e.t.map((t) => <span key={t} className="text-[11px] font-bold rounded px-2 py-0.5" style={{ background: typeColor(t), color: '#0b0b10' }}>{typeLabel(t, lang)}</span>)}
      </div>
    </button>
  )
}
