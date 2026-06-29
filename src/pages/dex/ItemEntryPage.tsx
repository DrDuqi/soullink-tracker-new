import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Loader2, Coins, Sparkles, MapPin, ExternalLink } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { itemEntry, itemName, catLabel } from '../../lib/dex/items'
import { getItemDetail } from '../../lib/dex/itemDetail'
import { getItemLocations, HOW_LABEL, HOW_COLOR, editionLabel, sourceUrl } from '../../lib/dex/itemLocations'
import { dexEntry, dexName, spriteUrl } from '../../lib/dex/dex'
import ItemSprite from '../../components/ItemSprite'

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
            <ItemSprite name={it.n} size={56} />
          </span>
          <div className="min-w-0">
            <h1 className="text-white font-black text-2xl tracking-tight">{itemName(it, lang)}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs font-bold rounded-full px-3 py-1 bg-white/5 border border-white/10 text-slate-300">{catLabel(it, lang)}</span>
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
  const navigate = useNavigate()
  const { data, isLoading, isError } = useQuery({ queryKey: ['item-detail', id], queryFn: () => getItemDetail(id), staleTime: Infinity, gcTime: 60 * 60 * 1000, retry: 1 })
  if (isLoading) return <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm px-1"><Loader2 className="w-4 h-4 animate-spin" /> {t('Lädt Details …', 'Loading details …')}</div>
  if (isError || !data) return <div className="mt-4 text-slate-500 text-sm px-1">{t('Weitere Details konnten nicht geladen werden (offline?).', 'Could not load further details (offline?).')}</div>

  // Prefer same-language text; for DE prefer the German flavour over an English effect.
  const desc = lang === 'de' ? (data.effect.de || data.flavor.de || data.effect.en || data.flavor.en) : (data.effect.en || data.flavor.en || data.effect.de || data.flavor.de)
  const flavor = lang === 'de' ? data.flavor.de : data.flavor.en
  const sell = Math.floor(data.cost / 2)
  return (
    <>
      <section className="mt-4 rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
        <h2 className="text-white font-bold text-sm mb-2">{t('Wirkung', 'Effect')}</h2>
        {desc ? (
          <>
            <p className="text-slate-300 text-sm leading-relaxed">{desc}</p>
            {flavor && flavor !== desc && <p className="text-slate-500 text-xs mt-2 leading-relaxed">{flavor}</p>}
          </>
        ) : (
          <p className="text-slate-400 text-sm">{t('Für dieses Item sind keine weiteren Informationen verfügbar.', 'No further information is available for this item.')}</p>
        )}
      </section>

      <Acquisition id={id} lang={lang} t={t} cost={data.cost} />

      {data.evolves.length > 0 && <PokeUsers title={t('Diese Pokémon entwickeln sich damit', 'Pokémon that evolve with this item')} ids={data.evolves} lang={lang} navigate={navigate} />}
      {data.holders.length > 0 && <PokeUsers title={t('Wird in der Wildnis getragen von', 'Held in the wild by')} ids={data.holders} lang={lang} navigate={navigate} />}

      {/* Preise & Schleuder — sekundär, daher unten und kompakt. */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="rounded-xl border border-white/[0.06] px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-[11px] text-slate-500 flex items-center gap-1"><Coins className="w-3 h-3" /> {t('Kaufpreis', 'Buy')}</div>
          <div className="text-slate-200 font-bold text-sm mt-0.5">{data.cost > 0 ? `${data.cost} ₽` : '—'}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-[11px] text-slate-500">{t('Verkaufspreis', 'Sell')}</div>
          <div className="text-slate-200 font-bold text-sm mt-0.5">{data.cost > 0 ? `${sell} ₽` : '—'}</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="text-[11px] text-slate-500">{t('Schleuder', 'Fling')}</div>
          <div className="text-slate-200 font-bold text-sm mt-0.5">{data.fling != null ? data.fling : '—'}</div>
        </div>
      </div>
    </>
  )
}

function Acquisition({ id, lang, t, cost }: { id: number; lang: 'de' | 'en'; t: (de: string, en: string) => string; cost: number }) {
  const entries = getItemLocations(id)
  const e = itemEntry(id)
  const src = e ? sourceUrl(lang === 'de' ? e.de || e.en : e.en || e.de, lang) : null
  const buyable = cost > 0 && !entries.some((x) => x.how === 'shop')
  return (
    <section className="mt-4 rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
      <h2 className="text-white font-bold text-sm mb-3 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-pk-red" /> {t('Wo & wie bekomme ich es?', 'Where & how to get it')}</h2>
      {entries.length > 0 ? (
        <div className="space-y-2.5">
          {entries.map((x, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-[10px] font-black uppercase tracking-wide rounded px-2 py-1 shrink-0" style={{ background: `${HOW_COLOR[x.how]}22`, color: HOW_COLOR[x.how] }}>{HOW_LABEL[lang][x.how]}</span>
              <div className="min-w-0 text-sm">
                <span className="text-slate-200">{[x.loc, x.npc].filter(Boolean).join(' · ') || '—'}</span>
                {x.note && <span className="text-slate-500"> — {x.note}</span>}
                <div className="flex flex-wrap gap-1 mt-1">
                  {x.ed.map((c) => <span key={c} className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-white/5 border border-white/10 text-slate-400">{editionLabel(c, lang)}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-400 text-sm">{buyable ? t('In Shops kaufbar.', 'Buyable in shops.') : t('Für dieses Item sind noch keine Fundorte erfasst.', 'No acquisition data recorded yet for this item.')}</p>
      )}
      {entries.length > 0 && buyable && <p className="text-slate-400 text-sm mt-2.5">{t('Außerdem in Shops kaufbar.', 'Also buyable in shops.')}</p>}
      {src && (
        <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white mt-3">
          <ExternalLink className="w-3.5 h-3.5" /> {t('Alle Fundorte', 'All locations')}: {lang === 'de' ? 'PokéWiki' : 'Bulbapedia'}
        </a>
      )}
    </section>
  )
}

function PokeUsers({ title, ids, lang, navigate }: { title: string; ids: number[]; lang: 'de' | 'en'; navigate: (to: string) => void }) {
  const list = ids.map((id) => dexEntry(id)).filter((e): e is NonNullable<typeof e> => !!e)
  if (!list.length) return null
  return (
    <section className="mt-4 rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
      <h2 className="text-white font-bold text-sm mb-3">{title} <span className="text-slate-500 font-mono">({list.length})</span></h2>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
        {list.map((e) => (
          <button key={e.id} onClick={() => navigate(`/dex/pokemon/${e.id}`)} className="flex flex-col items-center rounded-xl px-1 py-1.5 hover:bg-white/[0.06] transition-colors" style={{ contentVisibility: 'auto', containIntrinsicSize: '76px' } as React.CSSProperties}>
            <img src={spriteUrl(e.id)} alt="" loading="lazy" draggable={false} className="w-12 h-12 object-contain" style={{ imageRendering: 'pixelated' }} />
            <span className="text-[11px] font-bold text-slate-300 truncate max-w-full">{dexName(e, lang)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
