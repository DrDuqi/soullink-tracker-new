import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Grid3x3, Swords, Shield, ChevronRight } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { ALL_TYPES, typeColor, typeLabel, dexName, spriteUrl, DEX, type Lang } from '../../lib/dex/dex'
import { MOVES, moveName } from '../../lib/dex/moves'
import { mult, defenseMatchup, groupMatchup } from '../../lib/dex/typechart'

// SoulDex → Typen. Player-first: pick a type (big chips) → a clear card answers "what do
// I hit / what hits me" in 2 seconds, plus this type's Pokémon and strongest moves with
// deep-links. The full attack×defense matrix stays one click away as the expert view.
export default function TypesPage() {
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const [sel, setSel] = useState<string>('water')
  const [matrix, setMatrix] = useState(false)

  return (
    <div className="px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-[1080px] anim-fade-up">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-pk-red/15 flex items-center justify-center"><Grid3x3 className="text-pk-red" style={{ width: 18, height: 18 }} /></span>
            <h1 className="text-white font-black text-3xl tracking-tight">{lang === 'de' ? 'Typen' : 'Types'}</h1>
          </div>
          <button onClick={() => setMatrix((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 text-slate-200 hover:bg-white/5">
            <Grid3x3 className="w-3.5 h-3.5" /> {matrix ? (lang === 'de' ? 'Typ-Übersicht' : 'Type overview') : (lang === 'de' ? 'Matrix anzeigen' : 'Show matrix')}
          </button>
        </div>
        <p className="text-slate-400 mb-5">{lang === 'de' ? 'Wähle einen Typ — sofort siehst du Stärken, Schwächen, Pokémon und starke Attacken.' : 'Pick a type — instantly see strengths, weaknesses, Pokémon and strong moves.'}</p>

        {/* Big type chips */}
        <div className="flex flex-wrap gap-2">
          {ALL_TYPES.map((t) => {
            const on = sel === t
            return (
              <button key={t} onClick={() => setSel(t)}
                className="text-sm font-black rounded-xl px-3.5 py-2 transition-all"
                style={on ? { background: typeColor(t), color: '#0b0b10', boxShadow: `0 0 0 2px #0b0b10, 0 0 0 4px ${typeColor(t)}` } : { background: `${typeColor(t)}26`, color: typeColor(t) }}>
                {typeLabel(t, lang)}
              </button>
            )
          })}
        </div>

        {matrix ? <Matrix lang={lang} onPick={(t) => { setSel(t); setMatrix(false) }} /> : <TypeDetail type={sel} lang={lang} navigate={navigate} />}
      </div>
    </div>
  )
}

function TypeDetail({ type, lang, navigate }: { type: string; lang: Lang; navigate: (to: string) => void }) {
  const off = groupMatchup(Object.fromEntries(ALL_TYPES.map((d) => [d, mult(type, d)])))
  const def = groupMatchup(defenseMatchup([type]))
  const mons = DEX.filter((e) => e.t.includes(type))
  const moves = MOVES.filter((m) => m.t === type && m.pow != null && m.c !== 'status').sort((a, b) => (b.pow || 0) - (a.pow || 0)).slice(0, 8)

  return (
    <div className="mt-5 anim-fade-up">
      {/* Type banner */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: `linear-gradient(110deg, ${typeColor(type)}, ${typeColor(type)}44)` }}>
        <div className="text-black/85 font-black text-2xl">{typeLabel(type, lang)}</div>
        <div className="text-black/70 text-sm font-bold mt-0.5">
          {off['2'].length ? `${lang === 'de' ? 'Stark gegen' : 'Strong vs'} ${off['2'].slice(0, 3).map((t) => typeLabel(t, lang)).join(', ')}` : (lang === 'de' ? 'Keine super-effektiven Ziele' : 'No super-effective targets')}
          {def['2'].length ? ` · ${lang === 'de' ? 'schwach gegen' : 'weak to'} ${def['2'].slice(0, 3).map((t) => typeLabel(t, lang)).join(', ')}` : ''}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card icon={<Swords className="w-4 h-4" />} title={lang === 'de' ? 'Im Angriff' : 'Attacking'} accent="#fb923c">
          <Row label={lang === 'de' ? 'Sehr effektiv' : 'Super effective'} sub="×2" color="#4ade80" types={off['2']} lang={lang} />
          <Row label={lang === 'de' ? 'Wenig effektiv' : 'Not very effective'} sub="×½" color="#f87171" types={off['0.5']} lang={lang} />
          <Row label={lang === 'de' ? 'Wirkungslos' : 'No effect'} sub="×0" color="#94a3b8" types={off['0']} lang={lang} />
        </Card>
        <Card icon={<Shield className="w-4 h-4" />} title={lang === 'de' ? 'In der Verteidigung' : 'Defending'} accent="#60a5fa">
          <Row label={lang === 'de' ? 'Schwach gegen' : 'Weak to'} sub="×2" color="#fb923c" types={def['2']} lang={lang} />
          <Row label={lang === 'de' ? 'Resistent gegen' : 'Resists'} sub="×½" color="#4ade80" types={def['0.5']} lang={lang} />
          <Row label={lang === 'de' ? 'Immun gegen' : 'Immune to'} sub="×0" color="#94a3b8" types={def['0']} lang={lang} />
        </Card>
      </div>

      {moves.length > 0 && (
        <Card icon={<Swords className="w-4 h-4" />} title={lang === 'de' ? 'Starke Attacken dieses Typs' : 'Strong moves of this type'} accent={typeColor(type)} className="mt-4">
          <div className="flex flex-wrap gap-1.5">
            {moves.map((m) => (
              <button key={m.id} onClick={() => navigate(`/moves/${m.id}`)} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-2.5 py-1.5 border border-white/10 hover:bg-white/5 text-slate-200">
                {moveName(m, lang)} <span className="text-slate-500 font-mono">{m.pow}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card icon={<Grid3x3 className="w-4 h-4" />} title={`${lang === 'de' ? 'Pokémon dieses Typs' : 'Pokémon of this type'} (${mons.length})`} accent={typeColor(type)} className="mt-4">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))' }}>
          {mons.slice(0, 30).map((e) => (
            <button key={e.id} onClick={() => navigate(`/dex/pokemon/${e.id}`)} className="flex flex-col items-center rounded-xl px-1 py-1.5 hover:bg-white/[0.06] transition-colors" style={{ contentVisibility: 'auto', containIntrinsicSize: '72px' } as React.CSSProperties}>
              <img src={spriteUrl(e.id)} alt="" loading="lazy" draggable={false} className="w-11 h-11 object-contain" style={{ imageRendering: 'pixelated' }} />
              <span className="text-[10px] font-bold text-slate-300 truncate max-w-full">{dexName(e, lang)}</span>
            </button>
          ))}
        </div>
        {mons.length > 30 && <button onClick={() => navigate('/dex')} className="inline-flex items-center gap-1 text-xs font-bold text-pk-red hover:underline mt-2">{lang === 'de' ? `Alle ${mons.length} im SoulDex` : `All ${mons.length} in SoulDex`} <ChevronRight className="w-3.5 h-3.5" /></button>}
      </Card>
    </div>
  )
}

function Card({ icon, title, accent, children, className = '' }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-white/[0.07] p-4 ${className}`} style={{ background: 'rgba(22,22,31,0.7)' }}>
      <div className="flex items-center gap-2 mb-3"><span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}22`, color: accent }}>{icon}</span><h2 className="text-white font-bold text-sm">{title}</h2></div>
      {children}
    </section>
  )
}

function Row({ label, sub, color, types, lang }: { label: string; sub: string; color: string; types: string[]; lang: Lang }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="w-24 shrink-0"><span className="text-[11px] font-black" style={{ color }}>{label}</span> <span className="text-[10px] text-slate-600 font-mono">{sub}</span></span>
      <div className="flex flex-wrap gap-1 min-h-[20px]">
        {types.length ? types.map((t) => <span key={t} className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: typeColor(t), color: '#0b0b10' }}>{typeLabel(t, lang)}</span>)
          : <span className="text-slate-600 text-xs">—</span>}
      </div>
    </div>
  )
}

const cell = (v: number) =>
  v === 2 ? { bg: 'rgba(74,222,128,0.22)', fg: '#4ade80', t: '2' }
  : v === 0.5 ? { bg: 'rgba(248,113,113,0.18)', fg: '#f87171', t: '½' }
  : v === 0 ? { bg: 'rgba(100,116,139,0.28)', fg: '#94a3b8', t: '0' }
  : { bg: 'transparent', fg: '#334155', t: '' }

function Matrix({ lang, onPick }: { lang: Lang; onPick: (t: string) => void }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.07] p-3" style={{ background: 'rgba(18,18,26,0.7)' }}>
      <div className="text-slate-400 text-xs mb-2">{lang === 'de' ? 'Angriff (Zeile) gegen Verteidigung (Spalte).' : 'Attacker (row) vs defender (column).'}</div>
      <div className="inline-grid" style={{ gridTemplateColumns: `92px repeat(${ALL_TYPES.length}, 26px)` }}>
        <div />
        {ALL_TYPES.map((d) => (
          <div key={d} title={typeLabel(d, lang)} className="h-7 flex items-center justify-center rounded-sm mx-px" style={{ background: typeColor(d) }}>
            <span className="text-[9px] font-black text-black/80">{typeLabel(d, lang).slice(0, 2).toUpperCase()}</span>
          </div>
        ))}
        {ALL_TYPES.map((atk) => (
          <div key={atk} className="contents">
            <button onClick={() => onPick(atk)} className="h-6 pr-2 flex items-center justify-end text-[11px] font-bold rounded-sm hover:bg-white/5" style={{ color: typeColor(atk) }}>{typeLabel(atk, lang)}</button>
            {ALL_TYPES.map((def) => {
              const c = cell(mult(atk, def))
              return <div key={def} className="h-6 m-px flex items-center justify-center rounded-sm" style={{ background: c.bg }}><span className="text-[10px] font-black" style={{ color: c.fg }}>{c.t}</span></div>
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
