import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { typeLabel, typeColor, spriteUrl, dexEntry, dexName } from '../../lib/dex/dex'
import { moveEntry, moveName, CAT_LABEL, catColor } from '../../lib/dex/moves'
import { getMoveDetail } from '../../lib/dex/moveDetail'

// SoulDex → Attacke-Detail. Base data (type, power, accuracy, pp, category, priority) is
// instant/offline; effect, flavour and the learner list load lazily + cache for offline.
export default function MoveEntryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const m = moveEntry(Number(id))
  const t = (de: string, en: string) => (lang === 'de' ? de : en)

  if (!m) return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <button onClick={() => navigate('/moves')} className="text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-sm"><ChevronLeft className="w-4 h-4" /> {t('Attacken', 'Moves')}</button>
      <p className="text-slate-400 mt-6">{t('Attacke nicht gefunden.', 'Move not found.')}</p>
    </div>
  )

  const stats = [
    { label: t('Stärke', 'Power'), value: m.pow ?? '—' },
    { label: t('Genauigkeit', 'Accuracy'), value: m.acc != null ? `${m.acc}%` : '—' },
    { label: 'AP', value: m.pp ?? '—' },
    { label: t('Priorität', 'Priority'), value: m.pri > 0 ? `+${m.pri}` : m.pri },
  ]

  return (
    <div className="px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-[920px] anim-fade-up">
        <button onClick={() => navigate('/moves')} className="text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-sm font-bold mb-4"><ChevronLeft className="w-4 h-4" /> {t('Attacken', 'Moves')}</button>

        <div className="rounded-3xl border border-white/[0.07] p-6" style={{ background: 'linear-gradient(160deg, rgba(22,22,31,0.92), rgba(12,12,18,0.92))' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-white font-black text-3xl tracking-tight">{moveName(m, lang)}</h1>
            <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: typeColor(m.t), color: '#0b0b10' }}>{typeLabel(m.t, lang)}</span>
            <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: `${catColor(m.c)}22`, color: catColor(m.c) }}>{CAT_LABEL[lang][m.c]}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="text-[11px] text-slate-500">{s.label}</div>
                <div className="text-slate-100 font-bold text-lg mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        <MoveExtras id={m.id} lang={lang} t={t} />
      </div>
    </div>
  )
}

function MoveExtras({ id, lang, t }: { id: number; lang: 'de' | 'en'; t: (de: string, en: string) => string }) {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({ queryKey: ['move-detail', id], queryFn: () => getMoveDetail(id), staleTime: Infinity, gcTime: 60 * 60 * 1000, retry: 1 })
  if (isLoading) return <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm px-1"><Loader2 className="w-4 h-4 animate-spin" /> {t('Lädt Details …', 'Loading details …')}</div>
  if (isError || !data) return <div className="mt-4 text-slate-500 text-sm px-1">{t('Weitere Details konnten nicht geladen werden (offline?).', 'Could not load further details (offline?).')}</div>

  const effect = lang === 'de' ? data.effect.de || data.effect.en : data.effect.en || data.effect.de
  const flavor = lang === 'de' ? data.flavor.de || data.flavor.en : data.flavor.en || data.flavor.de
  const learners = data.learners.map((lid) => dexEntry(lid)).filter((e): e is NonNullable<typeof e> => !!e)
  return (
    <>
      {(effect || flavor) && (
        <section className="mt-4 rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
          <h2 className="text-white font-bold text-sm mb-2">{t('Effekt', 'Effect')}</h2>
          <p className="text-slate-300 text-sm leading-relaxed">{effect || flavor}</p>
          {effect && flavor && flavor !== effect && <p className="text-slate-500 text-xs mt-2 leading-relaxed">{flavor}</p>}
        </section>
      )}
      {learners.length > 0 && (
        <section className="mt-4 rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
          <h2 className="text-white font-bold text-sm mb-3">{t('Lernt diese Attacke', 'Learned by')} <span className="text-slate-500 font-mono">({learners.length})</span></h2>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
            {learners.map((e) => (
              <button key={e.id} onClick={() => navigate(`/dex/pokemon/${e.id}`)} className="flex flex-col items-center rounded-xl px-1 py-1.5 hover:bg-white/[0.06] transition-colors" style={{ contentVisibility: 'auto', containIntrinsicSize: '76px' } as React.CSSProperties}>
                <img src={spriteUrl(e.id)} alt="" loading="lazy" draggable={false} className="w-12 h-12 object-contain" style={{ imageRendering: 'pixelated' }} />
                <span className="text-[11px] font-bold text-slate-300 truncate max-w-full">{dexName(e, lang)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
