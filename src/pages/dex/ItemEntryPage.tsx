import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Loader2, Coins, Sparkles } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { itemEntry, itemName, itemSprite, catLabel } from '../../lib/dex/items'
import { getItemDetail } from '../../lib/dex/itemDetail'

// SoulDex → Item-Detail. Name/category/sprite are instant/offline; effect, flavour,
// buy/sell price and fling power load lazily + cache for offline reuse.
export default function ItemEntryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const it = itemEntry(Number(id))
  const t = (de: string, en: string) => (lang === 'de' ? de : en)

  if (!it) return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <button onClick={() => navigate('/items')} className="text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-sm"><ChevronLeft className="w-4 h-4" /> Items</button>
      <p className="text-slate-400 mt-6">{t('Item nicht gefunden.', 'Item not found.')}</p>
    </div>
  )

  const isEvo = it.c.includes('evolution')
  return (
    <div className="px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-[760px] anim-fade-up">
        <button onClick={() => navigate('/items')} className="text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-sm font-bold mb-4"><ChevronLeft className="w-4 h-4" /> Items</button>

        <div className="rounded-3xl border border-white/[0.07] p-6 flex items-center gap-5" style={{ background: 'linear-gradient(160deg, rgba(22,22,31,0.92), rgba(12,12,18,0.92))' }}>
          <span className="w-20 h-20 rounded-2xl bg-black/25 flex items-center justify-center shrink-0">
            <img src={itemSprite(it.n)} alt="" draggable={false} className="w-14 h-14 object-contain" style={{ imageRendering: 'pixelated' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
          </span>
          <div className="min-w-0">
            <h1 className="text-white font-black text-2xl tracking-tight">{itemName(it, lang)}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs font-bold rounded-full px-3 py-1 bg-white/5 border border-white/10 text-slate-300">{catLabel(it.c)}</span>
              {isEvo && <span className="inline-flex items-center gap-1 text-xs font-bold rounded-full px-3 py-1" style={{ background: '#4ade8022', color: '#4ade80' }}><Sparkles className="w-3.5 h-3.5" /> {t('Entwicklungs-Item', 'Evolution item')}</span>}
            </div>
          </div>
        </div>

        <ItemExtras id={it.id} lang={lang} t={t} />
      </div>
    </div>
  )
}

function ItemExtras({ id, lang, t }: { id: number; lang: 'de' | 'en'; t: (de: string, en: string) => string }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ['item-detail', id], queryFn: () => getItemDetail(id), staleTime: Infinity, gcTime: 60 * 60 * 1000, retry: 1 })
  if (isLoading) return <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm px-1"><Loader2 className="w-4 h-4 animate-spin" /> {t('Lädt Details …', 'Loading details …')}</div>
  if (isError || !data) return <div className="mt-4 text-slate-500 text-sm px-1">{t('Weitere Details konnten nicht geladen werden (offline?).', 'Could not load further details (offline?).')}</div>

  const effect = lang === 'de' ? data.effect.de || data.effect.en : data.effect.en || data.effect.de
  const flavor = lang === 'de' ? data.flavor.de || data.flavor.en : data.flavor.en || data.flavor.de
  const sell = Math.floor(data.cost / 2)
  return (
    <>
      {(effect || flavor) && (
        <section className="mt-4 rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
          <h2 className="text-white font-bold text-sm mb-2">{t('Wirkung', 'Effect')}</h2>
          <p className="text-slate-300 text-sm leading-relaxed">{effect || flavor}</p>
          {effect && flavor && flavor !== effect && <p className="text-slate-500 text-xs mt-2 leading-relaxed">{flavor}</p>}
        </section>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        <div className="rounded-xl border border-white/[0.06] px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-[11px] text-slate-500 flex items-center gap-1"><Coins className="w-3 h-3" /> {t('Kaufpreis', 'Buy')}</div>
          <div className="text-slate-100 font-bold text-sm mt-0.5">{data.cost > 0 ? `${data.cost} ₽` : '—'}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-[11px] text-slate-500">{t('Verkaufspreis', 'Sell')}</div>
          <div className="text-slate-100 font-bold text-sm mt-0.5">{data.cost > 0 ? `${sell} ₽` : '—'}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-[11px] text-slate-500">{t('Schleuder-Stärke', 'Fling power')}</div>
          <div className="text-slate-100 font-bold text-sm mt-0.5">{data.fling != null ? data.fling : '—'}</div>
        </div>
      </div>
    </>
  )
}
