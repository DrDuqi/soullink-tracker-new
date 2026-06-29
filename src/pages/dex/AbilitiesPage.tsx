import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Sparkles } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { searchAbilities, abilityName, type AbilityEntry } from '../../lib/dex/abilities'

// SoulDex → Fähigkeiten. Bundled index → instant, offline browse/search. Each row shows
// the plain-German in-game explanation; detail (precise mechanic + holders) is lazy.
export default function AbilitiesPage() {
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const [q, setQ] = useState('')
  const results = useMemo(() => searchAbilities(q).sort((a, b) => abilityName(a, lang).localeCompare(abilityName(b, lang))), [q, lang])

  return (
    <div className="px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-[1080px] anim-fade-up">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-8 h-8 rounded-xl bg-pk-red/15 flex items-center justify-center"><Sparkles className="text-pk-red" style={{ width: 18, height: 18 }} /></span>
          <h1 className="text-white font-black text-3xl tracking-tight">{lang === 'de' ? 'Fähigkeiten' : 'Abilities'}</h1>
        </div>
        <p className="text-slate-400 mb-5">{searchAbilities('').length} {lang === 'de' ? 'Fähigkeiten — Erklärung, Auslöser, welche Pokémon sie besitzen. Offline.' : 'abilities — effect, trigger, which Pokémon have them. Offline.'}</p>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'de' ? 'Fähigkeit suchen … (auch im Text)' : 'Search ability …'}
            className="w-full rounded-2xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none pl-10 pr-10 py-3 text-sm text-white" />
          {q ? <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Reset"><X className="w-4 h-4" /></button> : null}
        </div>
        <div className="text-right text-xs text-slate-500 mt-2">{results.length} {lang === 'de' ? 'Treffer' : 'results'}</div>

        {results.length === 0 ? (
          <div className="mt-8 text-center text-slate-500 text-sm">{lang === 'de' ? 'Keine Fähigkeit gefunden.' : 'No ability found.'}</div>
        ) : (
          <div className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {results.map((a) => <AbilityCard key={a.id} a={a} lang={lang} onClick={() => navigate(`/abilities/${a.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function AbilityCard({ a, lang, onClick }: { a: AbilityEntry; lang: 'de' | 'en'; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left rounded-2xl border border-white/[0.07] px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-pk-red/40"
      style={{ background: 'linear-gradient(160deg, rgba(22,22,31,0.9), rgba(13,13,19,0.9))', contentVisibility: 'auto', containIntrinsicSize: '88px' } as React.CSSProperties}>
      <div className="text-white font-bold text-sm">{abilityName(a, lang)}</div>
      {a.fd && <div className="text-slate-400 text-xs mt-1 leading-snug line-clamp-2">{a.fd}</div>}
    </button>
  )
}
