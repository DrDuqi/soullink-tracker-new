import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { dexEntry, dexName, artUrl, shinyArtUrl, typeLabel, typeColor, STAT_LABEL, statTotal } from '../../lib/dex/dex'

// SoulDex entry — instant, offline detail from the bundled index (artwork, shiny, types,
// base stats). Lazy sections (abilities, evolution line, moves, Pokédex text) load from
// PokéAPI + cache in the next release. No placeholder sections: only what's real shows.
const STAT_MAX = 200
const statColor = (v: number) => (v >= 120 ? '#4ade80' : v >= 90 ? '#a3e635' : v >= 60 ? '#fbbf24' : '#fb923c')

export default function DexEntryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const [shiny, setShiny] = useState(false)
  const e = dexEntry(Number(id))

  if (!e) {
    return (
      <div className="px-8 py-10 max-w-2xl mx-auto">
        <button onClick={() => navigate('/dex')} className="text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-sm"><ChevronLeft className="w-4 h-4" /> SoulDex</button>
        <p className="text-slate-400 mt-6">{lang === 'de' ? 'Pokémon nicht gefunden.' : 'Pokémon not found.'}</p>
      </div>
    )
  }

  return (
    <div className="px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-[920px] anim-fade-up">
        <button onClick={() => navigate('/dex')} className="text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-sm font-bold mb-4"><ChevronLeft className="w-4 h-4" /> SoulDex</button>

        <div className="rounded-3xl border border-white/[0.07] overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(22,22,31,0.92), rgba(12,12,18,0.92))' }}>
          <div className="relative p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(120% 120% at 30% 10%, ${typeColor(e.t[0])}22, transparent 60%)` }} />
            <div className="relative shrink-0 w-44 h-44 rounded-2xl bg-black/20 flex items-center justify-center">
              <img src={shiny ? shinyArtUrl(e.id) : artUrl(e.id)} alt="" draggable={false} className="w-40 h-40 object-contain" />
              <button onClick={() => setShiny((v) => !v)} aria-label="Shiny"
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[11px] font-bold rounded-lg px-2 py-1 border transition-colors"
                style={shiny ? { background: '#fbbf24', borderColor: '#fbbf24', color: '#3b2a02' } : { borderColor: '#3a3a4e', color: '#cbd5e1', background: 'rgba(0,0,0,0.4)' }}>
                <Sparkles className="w-3.5 h-3.5" /> Shiny
              </button>
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                <h1 className="text-white font-black text-3xl tracking-tight">{dexName(e, lang)}</h1>
                <span className="font-mono text-slate-500">#{String(e.id).padStart(4, '0')}</span>
              </div>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap justify-center sm:justify-start">
                {e.t.map((t) => <span key={t} className="text-xs font-bold rounded-full px-3 py-1" style={{ background: typeColor(t), color: '#0b0b10' }}>{typeLabel(t, lang)}</span>)}
                <span className="text-[11px] font-bold text-slate-400 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">{lang === 'de' ? 'Generation' : 'Generation'} {e.g}</span>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2"><span>{lang === 'de' ? 'Statuswerte' : 'Base stats'}</span><span>{lang === 'de' ? 'Gesamt' : 'Total'} {statTotal(e)}</span></div>
                <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2 items-center text-xs">
                  {e.s.map((v, i) => (
                    <div key={i} className="contents">
                      <span className="text-slate-400">{STAT_LABEL[lang][i]}</span>
                      <span className="h-2 rounded-full bg-white/[0.06] overflow-hidden"><span className="block h-2 rounded-full" style={{ width: `${Math.min(100, (v / STAT_MAX) * 100)}%`, background: statColor(v) }} /></span>
                      <span className="font-mono text-slate-300 w-8 text-right">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
