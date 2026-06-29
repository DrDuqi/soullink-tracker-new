import { useState } from 'react'
import { Grid3x3 } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { ALL_TYPES, typeColor, typeLabel } from '../../lib/dex/dex'
import { mult, defenseMatchup, groupMatchup } from '../../lib/dex/typechart'

// SoulDex → Typen. A full attack×defense matrix plus a per-type breakdown — the kind of
// reference you keep open while playing. Fully offline (bundled chart).
const cell = (v: number) =>
  v === 2 ? { bg: 'rgba(74,222,128,0.22)', fg: '#4ade80', t: '2' }
  : v === 0.5 ? { bg: 'rgba(248,113,113,0.18)', fg: '#f87171', t: '½' }
  : v === 0 ? { bg: 'rgba(100,116,139,0.28)', fg: '#94a3b8', t: '0' }
  : { bg: 'transparent', fg: '#334155', t: '' }

export default function TypesPage() {
  const lang = useSettings((s) => s.language)
  const [sel, setSel] = useState<string | null>(null)

  return (
    <div className="px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-[1080px] anim-fade-up">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-8 h-8 rounded-xl bg-pk-red/15 flex items-center justify-center"><Grid3x3 className="text-pk-red" style={{ width: 18, height: 18 }} /></span>
          <h1 className="text-white font-black text-3xl tracking-tight">{lang === 'de' ? 'Typen' : 'Types'}</h1>
        </div>
        <p className="text-slate-400 mb-5">{lang === 'de' ? 'Angriff (Zeile) gegen Verteidigung (Spalte). Tippe einen Typ für die Übersicht.' : 'Attacker (row) vs defender (column). Tap a type for its summary.'}</p>

        <div className="overflow-x-auto rounded-2xl border border-white/[0.07] p-3" style={{ background: 'rgba(18,18,26,0.7)' }}>
          <div className="inline-grid" style={{ gridTemplateColumns: `92px repeat(${ALL_TYPES.length}, 26px)` }}>
            <div />
            {ALL_TYPES.map((d) => (
              <div key={d} title={typeLabel(d, lang)} className="h-7 flex items-center justify-center rounded-sm mx-px" style={{ background: typeColor(d) }}>
                <span className="text-[9px] font-black text-black/80">{typeLabel(d, lang).slice(0, 2).toUpperCase()}</span>
              </div>
            ))}
            {ALL_TYPES.map((atk) => (
              <div key={atk} className="contents">
                <button onClick={() => setSel(atk)} className="h-6 pr-2 flex items-center justify-end text-[11px] font-bold rounded-sm hover:bg-white/5" style={{ color: typeColor(atk) }}>{typeLabel(atk, lang)}</button>
                {ALL_TYPES.map((def) => {
                  const c = cell(mult(atk, def))
                  return <div key={def} className="h-6 m-px flex items-center justify-center rounded-sm" style={{ background: c.bg }}><span className="text-[10px] font-black" style={{ color: c.fg }}>{c.t}</span></div>
                })}
              </div>
            ))}
          </div>
        </div>

        {sel && <TypeSummary type={sel} lang={lang} onClose={() => setSel(null)} />}
      </div>
    </div>
  )
}

function TypeSummary({ type, lang, onClose }: { type: string; lang: 'de' | 'en'; onClose: () => void }) {
  const off = groupMatchup(Object.fromEntries(ALL_TYPES.map((d) => [d, mult(type, d)])))
  const def = groupMatchup(defenseMatchup([type]))
  const Row = ({ label, color, types }: { label: string; color: string; types: string[] }) => types.length ? (
    <div className="flex items-start gap-2.5"><span className="text-xs font-black w-8 shrink-0 text-right" style={{ color }}>{label}</span>
      <div className="flex flex-wrap gap-1.5">{types.map((t) => <span key={t} className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: typeColor(t), color: '#0b0b10' }}>{typeLabel(t, lang)}</span>)}</div></div>
  ) : null
  return (
    <div className="mt-4 grid sm:grid-cols-2 gap-4">
      <section className="rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
        <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><span className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: typeColor(type), color: '#0b0b10' }}>{typeLabel(type, lang)}</span> {lang === 'de' ? 'greift an' : 'attacking'}</h2>
        <div className="space-y-2">
          <Row label="×2" color="#4ade80" types={off['2']} />
          <Row label="×½" color="#f87171" types={off['0.5']} />
          <Row label="×0" color="#94a3b8" types={off['0']} />
        </div>
      </section>
      <section className="rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-sm">{lang === 'de' ? 'verteidigt sich' : 'defending'}</h2>
          <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-white">{lang === 'de' ? 'Schließen' : 'Close'}</button>
        </div>
        <div className="space-y-2">
          <Row label="×2" color="#fb923c" types={def['2']} />
          <Row label="×½" color="#4ade80" types={def['0.5']} />
          <Row label="×0" color="#94a3b8" types={def['0']} />
        </div>
      </section>
    </div>
  )
}
