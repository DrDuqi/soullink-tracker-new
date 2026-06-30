import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Swords } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { typeLabel, typeColor, ALL_TYPES, type Lang } from '../../lib/dex/dex'
import { searchMoves, moveName, MOVE_CATS, CAT_LABEL, catColor, type MoveCat, type MoveEntry } from '../../lib/dex/moves'

// SoulDex → Attacken. Bundled index → instant, offline browse/search/filter (type +
// category). Detail (effect, learners) loads lazily on the entry page.
export default function MovesPage() {
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const [q, setQ] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [cats, setCats] = useState<MoveCat[]>([])

  const results = useMemo(() => {
    const r = searchMoves(q, { types, cats })
    return [...r].sort((a, b) => moveName(a, lang).localeCompare(moveName(b, lang)))
  }, [q, types, cats, lang])
  const toggle = <T,>(arr: T[], v: T, set: (a: T[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const active = q || types.length || cats.length

  return (
    <div className="px-6 lg:px-10 py-10">
      <div className="mx-auto max-w-[1180px] anim-fade-up">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-11 h-11 rounded-2xl bg-pk-red/15 flex items-center justify-center"><Swords className="text-pk-red" style={{ width: 24, height: 24 }} /></span>
          <h1 className="text-white font-black text-4xl tracking-tight">{lang === 'de' ? 'Attacken' : 'Moves'}</h1>
        </div>
        <p className="text-slate-400 text-base mb-6">{searchMoves('', {}).length} {lang === 'de' ? 'Attacken — Typ, Kategorie, Werte. Offline, sofort durchsuchbar.' : 'moves — type, category, stats. Offline, instant search.'}</p>

        <div className="relative">
          <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'de' ? 'Attacke suchen …' : 'Search move …'}
            className="w-full rounded-2xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none pl-12 pr-12 py-4 text-base text-white transition-colors duration-200" />
          {active ? <button onClick={() => { setQ(''); setTypes([]); setCats([]) }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors" aria-label="Reset"><X className="w-5 h-5" /></button> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {ALL_TYPES.map((t) => {
            const on = types.includes(t); const c = typeColor(t)
            return <button key={t} onClick={() => toggle(types, t, setTypes)} className="text-xs font-bold rounded-full px-3 py-1.5 border transition-all duration-200 hover:scale-105" style={on ? { background: c, borderColor: c, color: '#0b0b10' } : { borderColor: '#2e2e42', color: '#cbd5e1' }}>{typeLabel(t, lang as Lang)}</button>
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {MOVE_CATS.map((c) => {
            const on = cats.includes(c)
            return <button key={c} onClick={() => toggle(cats, c, setCats)} className="text-xs font-bold rounded-full px-3 py-1.5 border transition-all duration-200 hover:scale-105" style={on ? { background: catColor(c), borderColor: catColor(c), color: '#0b0b10' } : { borderColor: '#2e2e42', color: '#cbd5e1' }}>{CAT_LABEL[lang][c]}</button>
          })}
          <span className="ml-auto text-sm text-slate-500">{results.length} {lang === 'de' ? 'Treffer' : 'results'}</span>
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(18,18,26,0.7)' }}>
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-white/[0.06]">
            <span>{lang === 'de' ? 'Attacke' : 'Move'}</span><span className="w-16 text-right">{lang === 'de' ? 'Stärke' : 'Power'}</span><span className="w-16 text-right">{lang === 'de' ? 'Gen.' : 'Acc.'}</span><span className="w-12 text-right">AP</span><span className="w-20 text-right">Kat.</span>
          </div>
          {results.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-base">{lang === 'de' ? 'Keine Attacken gefunden.' : 'No moves found.'}</div>
          ) : results.map((m) => <MoveRow key={m.id} m={m} lang={lang} onClick={() => navigate(`/moves/${m.id}`)} />)}
        </div>
      </div>
    </div>
  )
}

function MoveRow({ m, lang, onClick }: { m: MoveEntry; lang: 'de' | 'en'; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 gap-y-1 items-center px-5 py-3.5 text-left border-b border-white/[0.04] hover:bg-white/[0.05] transition-colors duration-200"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '56px' } as React.CSSProperties}>
      <span className="flex items-center gap-2.5 min-w-0">
        <span className="text-xs font-bold rounded px-2 py-0.5 shrink-0" style={{ background: typeColor(m.t), color: '#0b0b10' }}>{typeLabel(m.t, lang)}</span>
        <span className="text-slate-100 font-bold text-base truncate">{moveName(m, lang)}</span>
      </span>
      <span className="sm:w-16 text-right font-mono text-sm text-slate-400">{m.pow ?? '—'}</span>
      <span className="hidden sm:block w-16 text-right font-mono text-sm text-slate-400">{m.acc != null ? `${m.acc}%` : '—'}</span>
      <span className="hidden sm:block w-12 text-right font-mono text-sm text-slate-400">{m.pp ?? '—'}</span>
      <span className="hidden sm:block w-20 text-right text-xs font-bold" style={{ color: catColor(m.c) }}>{CAT_LABEL[lang][m.c]}</span>
    </button>
  )
}
