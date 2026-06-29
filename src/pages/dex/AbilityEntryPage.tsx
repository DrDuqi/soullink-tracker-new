import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Loader2, Search, X } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { abilityEntry, abilityName } from '../../lib/dex/abilities'
import { getAbilityDetail, type AbilityHolder } from '../../lib/dex/abilityDetail'
import { dexEntry, dexName, spriteUrl } from '../../lib/dex/dex'

// SoulDex → Fähigkeit-Detail. Plain-German explanation is instant/offline (bundled
// flavour); precise mechanic + holder list load lazily + cache. Holders deep-link back
// to the Pokédex; hidden abilities are clearly marked.
export default function AbilityEntryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const a = abilityEntry(Number(id))
  const t = (de: string, en: string) => (lang === 'de' ? de : en)

  if (!a) return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <button onClick={() => navigate('/abilities')} className="text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-sm"><ChevronLeft className="w-4 h-4" /> {t('Fähigkeiten', 'Abilities')}</button>
      <p className="text-slate-400 mt-6">{t('Fähigkeit nicht gefunden.', 'Ability not found.')}</p>
    </div>
  )

  return (
    <div className="px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-[920px] anim-fade-up">
        <button onClick={() => navigate('/abilities')} className="text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-sm font-bold mb-4"><ChevronLeft className="w-4 h-4" /> {t('Fähigkeiten', 'Abilities')}</button>

        <div className="rounded-3xl border border-white/[0.07] p-6" style={{ background: 'linear-gradient(160deg, rgba(22,22,31,0.92), rgba(12,12,18,0.92))' }}>
          <h1 className="text-white font-black text-3xl tracking-tight">{abilityName(a, lang)}</h1>
          <div className="text-slate-500 text-sm mt-1">{lang === 'de' ? a.en : a.de}</div>
          {a.fd && <p className="text-slate-200 text-sm leading-relaxed mt-4">{a.fd}</p>}
        </div>

        <AbilityExtras id={a.id} lang={lang} t={t} fallbackDe={a.fd} />
      </div>
    </div>
  )
}

function AbilityExtras({ id, lang, t, fallbackDe }: { id: number; lang: 'de' | 'en'; t: (de: string, en: string) => string; fallbackDe: string }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { data, isLoading, isError } = useQuery({ queryKey: ['ability-detail', id], queryFn: () => getAbilityDetail(id), staleTime: Infinity, gcTime: 60 * 60 * 1000, retry: 1 })

  if (isLoading) return <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm px-1"><Loader2 className="w-4 h-4 animate-spin" /> {t('Lädt Details …', 'Loading details …')}</div>
  if (isError || !data) return <div className="mt-4 text-slate-500 text-sm px-1">{t('Weitere Details konnten nicht geladen werden (offline?).', 'Could not load further details (offline?).')}</div>

  // Precise mechanic: prefer German effect (rare), else the German flavour, else English.
  const mech = lang === 'de' ? (data.effect.de || data.flavor.de || fallbackDe || data.effect.en) : (data.effect.en || data.flavor.en || data.effect.de)
  const query = q.trim().toLowerCase()
  const resolve = (h: AbilityHolder) => ({ ...h, e: dexEntry(h.id) })
  const holders = data.holders.map(resolve).filter((x): x is typeof x & { e: NonNullable<typeof x.e> } => !!x.e)
    .filter((x) => !query || dexName(x.e, lang).toLowerCase().includes(query))
    .sort((x, y) => dexName(x.e, lang).localeCompare(dexName(y.e, lang)))
  const normal = holders.filter((h) => !h.hidden)
  const hidden = holders.filter((h) => h.hidden)

  const Grid = ({ list }: { list: typeof holders }) => (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
      {list.map((h) => (
        <button key={h.id} onClick={() => navigate(`/dex/pokemon/${h.id}`)} className="flex flex-col items-center rounded-xl px-1 py-1.5 hover:bg-white/[0.06] transition-colors" style={{ contentVisibility: 'auto', containIntrinsicSize: '76px' } as React.CSSProperties}>
          <img src={spriteUrl(h.id)} alt="" loading="lazy" draggable={false} className="w-12 h-12 object-contain" style={{ imageRendering: 'pixelated' }} />
          <span className="text-[11px] font-bold text-slate-300 truncate max-w-full">{dexName(h.e, lang)}</span>
        </button>
      ))}
    </div>
  )

  return (
    <>
      {mech && (
        <section className="mt-4 rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
          <h2 className="text-white font-bold text-sm mb-2">{t('Wirkung & Auslöser', 'Effect & trigger')}</h2>
          <p className="text-slate-300 text-sm leading-relaxed">{mech}</p>
          {lang === 'de' && !data.effect.de && data.effect.en && <p className="text-slate-500 text-xs mt-2 leading-relaxed"><span className="font-bold">Genauer Mechanik-Text (EN):</span> {data.effect.en}</p>}
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
        <h2 className="text-white font-bold text-sm mb-3">{t('Pokémon mit dieser Fähigkeit', 'Pokémon with this ability')} <span className="text-slate-500 font-mono">({data.holders.length})</span></h2>
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Pokémon suchen …', 'Search Pokémon …')}
            className="w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none pl-9 pr-9 py-2 text-sm text-white" />
          {q ? <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button> : null}
        </div>
        {normal.length > 0 && (
          <>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{t('Reguläre Fähigkeit', 'Regular ability')}</div>
            <Grid list={normal} />
          </>
        )}
        {hidden.length > 0 && (
          <>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-1.5 mt-3" style={{ color: '#b9a8ff' }}>{t('Versteckte Fähigkeit', 'Hidden ability')}</div>
            <Grid list={hidden} />
          </>
        )}
        {normal.length === 0 && hidden.length === 0 && <p className="text-slate-500 text-sm">{t('Kein Treffer.', 'No match.')}</p>}
      </section>
    </>
  )
}
