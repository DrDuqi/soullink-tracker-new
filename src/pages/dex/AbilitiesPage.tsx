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
    <div className="px-6 lg:px-10 py-10">
      <div className="mx-auto max-w-[1180px] anim-fade-up">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-11 h-11 rounded-2xl bg-pk-red/15 flex items-center justify-center"><Sparkles className="text-pk-red" style={{ width: 24, height: 24 }} /></span>
          <h1 className="text-white font-black text-4xl tracking-tight">{lang === 'de' ? 'Fähigkeiten' : 'Abilities'}</h1>
        </div>
        <p className="text-slate-400 text-base mb-6">{searchAbilities('').length} {lang === 'de' ? 'Fähigkeiten — Erklärung, Auslöser, welche Pokémon sie besitzen. Offline.' : 'abilities — effect, trigger, which Pokémon have them. Offline.'}</p>

        <div className="relative">
          <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'de' ? 'Fähigkeit suchen … (auch im Text)' : 'Search ability …'}
            className="w-full rounded-2xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none pl-12 pr-12 py-4 text-base text-white transition-colors duration-200" />
          {q ? <button onClick={() => setQ('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors" aria-label="Reset"><X className="w-5 h-5" /></button> : null}
        </div>
        <div className="text-right text-sm text-slate-500 mt-2.5">{results.length} {lang === 'de' ? 'Treffer' : 'results'}</div>

        {results.length === 0 ? (
          <div className="mt-10 text-center text-slate-500 text-base">{lang === 'de' ? 'Keine Fähigkeit gefunden.' : 'No ability found.'}</div>
        ) : (
          <div className="mt-4 grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' }}>
            {results.map((a) => <AbilityCard key={a.id} a={a} lang={lang} onClick={() => navigate(`/abilities/${a.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function AbilityCard({ a, lang, onClick }: { a: AbilityEntry; lang: 'de' | 'en'; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left rounded-2xl border border-white/[0.07] px-5 py-4 transition-all duration-200 ease-out hover:-translate-y-1 hover:border-pk-red/45 hover:shadow-[0_16px_40px_-18px_rgba(204,0,0,0.5)]"
      style={{ background: 'linear-gradient(160deg, rgba(22,22,31,0.9), rgba(13,13,19,0.9))', contentVisibility: 'auto', containIntrinsicSize: '110px' } as React.CSSProperties}>
      <div className="text-white font-bold text-lg">{abilityName(a, lang)}</div>
      {a.fd && <div className="text-slate-400 text-sm mt-1.5 leading-relaxed line-clamp-3">{a.fd}</div>}
    </button>
  )
}
