import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Backpack } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { searchItems, itemName, catLabel, POCKETS, pocketLabel, type ItemEntry } from '../../lib/dex/items'
import ItemSprite from '../../components/ItemSprite'

// SoulDex → Items. Bundled index → instant, offline browse/search/filter (category).
// Detail (effect, buy/sell, fling) loads lazily on the entry page.
export default function ItemsPage() {
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const [q, setQ] = useState('')
  const [pocket, setPocket] = useState('')

  const results = useMemo(() => {
    const r = searchItems(q, { pocket: pocket || undefined })
    return [...r].sort((a, b) => itemName(a, lang).localeCompare(itemName(b, lang)))
  }, [q, pocket, lang])
  const active = q || pocket

  return (
    <div className="px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-[1080px] anim-fade-up">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="w-8 h-8 rounded-xl bg-pk-red/15 flex items-center justify-center"><Backpack className="text-pk-red" style={{ width: 18, height: 18 }} /></span>
          <h1 className="text-white font-black text-3xl tracking-tight">Items</h1>
        </div>
        <p className="text-slate-400 mb-5">{searchItems('', {}).length} {lang === 'de' ? 'Items — Wirkung, Preise, Kategorien. Offline, sofort durchsuchbar.' : 'items — effect, prices, categories. Offline, instant search.'}</p>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === 'de' ? 'Item suchen …' : 'Search item …'}
              className="w-full rounded-2xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none pl-10 pr-10 py-3 text-sm text-white" />
            {active ? <button onClick={() => { setQ(''); setPocket('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Reset"><X className="w-4 h-4" /></button> : null}
          </div>
          <select value={pocket} onChange={(e) => setPocket(e.target.value)} className="rounded-2xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3 py-3 text-sm text-white sm:w-56">
            <option value="">{lang === 'de' ? 'Alle Gruppen' : 'All groups'}</option>
            {POCKETS.map((p) => <option key={p} value={p}>{pocketLabel(p, lang)}</option>)}
          </select>
        </div>
        <div className="text-right text-xs text-slate-500 mt-2">{results.length} {lang === 'de' ? 'Treffer' : 'results'}</div>

        {results.length === 0 ? (
          <div className="mt-8 text-center text-slate-500 text-sm">{lang === 'de' ? 'Keine Items gefunden.' : 'No items found.'}</div>
        ) : (
          <div className="mt-3 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {results.map((it) => <ItemCard key={it.id} it={it} lang={lang} onClick={() => navigate(`/items/${it.id}`)} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function ItemCard({ it, lang, onClick }: { it: ItemEntry; lang: 'de' | 'en'; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-pk-red/40"
      style={{ background: 'linear-gradient(160deg, rgba(22,22,31,0.9), rgba(13,13,19,0.9))', contentVisibility: 'auto', containIntrinsicSize: '64px' } as React.CSSProperties}>
      <span className="w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
        <ItemSprite name={it.n} size={32} />
      </span>
      <span className="min-w-0">
        <span className="block text-slate-100 font-bold text-sm truncate">{itemName(it, lang)}</span>
        <span className="block text-slate-500 text-xs truncate">{catLabel(it, lang)}</span>
      </span>
    </button>
  )
}
