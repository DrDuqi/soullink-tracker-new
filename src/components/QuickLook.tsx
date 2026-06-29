import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ExternalLink, Sparkles, BarChart3 } from 'lucide-react'
import { useQuickLook, type QuickLookTarget } from '../store/quickLookStore'
import { useSettings } from '../store/settingsStore'
import { dexEntry, dexName, artUrl, typeColor, typeLabel, STAT_LABEL, statTotal } from '../lib/dex/dex'
import { moveEntry, moveName, CAT_LABEL, catColor } from '../lib/dex/moves'
import { itemEntry, itemName, catLabel } from '../lib/dex/items'
import { abilityEntry, abilityName } from '../lib/dex/abilities'
import { defenseMatchup, groupMatchup, mult } from '../lib/dex/typechart'
import { ALL_TYPES } from '../lib/dex/dex'

// Slide-in Quick-Look drawer — instant, offline, from the bundled SoulDex data. Closing
// returns to the run with zero context loss (pure overlay). Deep-links jump to the full
// SoulDex page; the open() store also carries an optional "Im Run analysieren" action.
export default function QuickLook() {
  const { target, open, close } = useQuickLook()
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const t = (de: string, en: string) => (lang === 'de' ? de : en)

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [target, close])

  if (!target) return null
  const go = (to: string) => { close(); navigate(to) }
  const body = renderBody(target, lang, t, { go, open })

  return (
    <div className="fixed inset-0 z-[400] flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <aside className="relative w-[380px] max-w-[90vw] h-full overflow-y-auto modal-scroll border-l border-white/10 shadow-2xl anim-slide-r"
        style={{ background: 'linear-gradient(180deg, rgba(20,20,28,0.99), rgba(12,12,18,0.99))' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 backdrop-blur" style={{ background: 'rgba(16,16,22,0.85)' }}>
          <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-pk-red"><Sparkles className="w-3.5 h-3.5" /> Quick-Look</span>
          <button onClick={close} aria-label="close" className="text-slate-400 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">{body.content}</div>
        <div className="px-4 pb-5 space-y-2">
          {target.analyze && (
            <button onClick={() => { const a = target.analyze!; close(); a.run() }} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-sm text-slate-100 border border-white/10 hover:bg-white/5">
              <BarChart3 className="w-4 h-4" /> {target.analyze.label}
            </button>
          )}
          {body.fullHref && (
            <button onClick={() => go(body.fullHref!)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-black text-sm text-white" style={{ background: '#CC0000' }}>
              <ExternalLink className="w-4 h-4" /> {t('Volle SoulDex-Seite öffnen', 'Open full SoulDex page')}
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}

type Ctx = { go: (to: string) => void; open: (t: QuickLookTarget) => void }
function renderBody(target: QuickLookTarget, lang: 'de' | 'en', t: (de: string, en: string) => string, ctx: Ctx): { content: React.ReactNode; fullHref?: string } {
  const TypeChips = ({ types }: { types: string[] }) => (
    <div className="flex flex-wrap gap-1.5">
      {types.map((ty) => <button key={ty} onClick={() => ctx.open({ kind: 'type', key: ty })} className="text-[11px] font-bold rounded-full px-2.5 py-0.5 hover:opacity-80" style={{ background: typeColor(ty), color: '#0b0b10' }}>{typeLabel(ty, lang)}</button>)}
    </div>
  )

  if (target.kind === 'pokemon') {
    const e = dexEntry(Number(target.key))
    if (!e) return { content: <Missing t={t} /> }
    const g = groupMatchup(defenseMatchup(e.t))
    const weak = [...g['4'], ...g['2']], resist = [...g['0.5'], ...g['0.25'], ...g['0']]
    return {
      fullHref: `/dex/pokemon/${e.id}`,
      content: (
        <>
          <div className="flex items-center gap-3">
            <img src={artUrl(e.id)} alt="" className="w-20 h-20 object-contain" draggable={false} />
            <div>
              <div className="text-white font-black text-xl">{dexName(e, lang)}</div>
              <div className="font-mono text-slate-500 text-xs">#{String(e.id).padStart(4, '0')} · Gen {e.g}</div>
            </div>
          </div>
          <div className="mt-3"><TypeChips types={e.t} /></div>
          <div className="mt-4">
            <Label>{t('Basiswerte', 'Base stats')} <span className="text-slate-500">· {statTotal(e)}</span></Label>
            <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-1 items-center text-xs mt-1">
              {e.s.map((v, i) => (
                <div key={i} className="contents">
                  <span className="text-slate-400">{STAT_LABEL[lang][i]}</span>
                  <span className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><span className="block h-1.5 rounded-full" style={{ width: `${Math.min(100, (v / 200) * 100)}%`, background: v >= 100 ? '#4ade80' : v >= 70 ? '#fbbf24' : '#fb923c' }} /></span>
                  <span className="font-mono text-slate-300 w-7 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
          {weak.length > 0 && <div className="mt-4"><Label>{t('Schwach gegen', 'Weak to')}</Label><div className="mt-1"><TypeChips types={weak} /></div></div>}
          {resist.length > 0 && <div className="mt-3"><Label>{t('Resistent gegen', 'Resists')}</Label><div className="mt-1"><TypeChips types={resist} /></div></div>}
        </>
      ),
    }
  }

  if (target.kind === 'move') {
    const m = moveEntry(Number(target.key))
    if (!m) return { content: <Missing t={t} /> }
    return {
      fullHref: `/moves/${m.id}`,
      content: (
        <>
          <div className="text-white font-black text-xl">{moveName(m, lang)}</div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => ctx.open({ kind: 'type', key: m.t })} className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: typeColor(m.t), color: '#0b0b10' }}>{typeLabel(m.t, lang)}</button>
            <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: `${catColor(m.c)}22`, color: catColor(m.c) }}>{CAT_LABEL[lang][m.c]}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
            <Fact label={t('Stärke', 'Power')} value={m.pow ?? '—'} />
            <Fact label={t('Genauigkeit', 'Accuracy')} value={m.acc != null ? `${m.acc}%` : '—'} />
            <Fact label="AP" value={m.pp ?? '—'} />
            <Fact label={t('Priorität', 'Priority')} value={m.pri > 0 ? `+${m.pri}` : m.pri} />
          </div>
        </>
      ),
    }
  }

  if (target.kind === 'item') {
    const it = itemEntry(Number(target.key))
    if (!it) return { content: <Missing t={t} /> }
    return {
      fullHref: `/items/${it.id}`,
      content: (
        <>
          <div className="text-white font-black text-xl">{itemName(it, lang)}</div>
          <div className="text-slate-400 text-sm mt-1">{catLabel(it, lang)}</div>
          {it.cost > 0 && <div className="text-slate-500 text-xs mt-2 font-mono">{t('Kaufpreis', 'Buy')}: {it.cost} ₽</div>}
          <p className="text-slate-500 text-xs mt-3">{t('Wirkung, Fundorte und mehr auf der vollen Seite.', 'Effect, locations and more on the full page.')}</p>
        </>
      ),
    }
  }

  if (target.kind === 'ability') {
    const a = abilityEntry(Number(target.key))
    if (!a) return { content: <Missing t={t} /> }
    return {
      fullHref: `/abilities/${a.id}`,
      content: (
        <>
          <div className="text-white font-black text-xl">{abilityName(a, lang)}</div>
          <div className="text-slate-500 text-xs mt-1">{lang === 'de' ? a.en : a.de}</div>
          {a.fd && <p className="text-slate-300 text-sm leading-relaxed mt-3">{a.fd}</p>}
        </>
      ),
    }
  }

  // type
  const ty = String(target.key)
  const off = groupMatchup(Object.fromEntries(ALL_TYPES.map((d) => [d, mult(ty, d)])))
  const def = groupMatchup(defenseMatchup([ty]))
  const Row = ({ label, types }: { label: string; types: string[] }) => types.length ? (
    <div className="mt-2"><Label>{label}</Label><div className="mt-1 flex flex-wrap gap-1.5">{types.map((x) => <button key={x} onClick={() => ctx.open({ kind: 'type', key: x })} className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: typeColor(x), color: '#0b0b10' }}>{typeLabel(x, lang)}</button>)}</div></div>
  ) : null
  return {
    fullHref: '/types',
    content: (
      <>
        <span className="text-[11px] font-bold rounded-full px-3 py-1" style={{ background: typeColor(ty), color: '#0b0b10' }}>{typeLabel(ty, lang)}</span>
        <div className="mt-4 text-xs font-black uppercase tracking-wider text-slate-400">{t('Angriff', 'Attacking')}</div>
        <Row label={t('Sehr effektiv', 'Super effective')} types={off['2']} />
        <Row label={t('Wenig effektiv', 'Not very effective')} types={off['0.5']} />
        <Row label={t('Wirkungslos', 'No effect')} types={off['0']} />
        <div className="mt-4 text-xs font-black uppercase tracking-wider text-slate-400">{t('Verteidigung', 'Defending')}</div>
        <Row label={t('Schwach gegen', 'Weak to')} types={def['2']} />
        <Row label={t('Resistent gegen', 'Resists')} types={def['0.5']} />
        <Row label={t('Immun gegen', 'Immune to')} types={def['0']} />
      </>
    ),
  }
}

const Label = ({ children }: { children: React.ReactNode }) => <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</div>
const Fact = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-xl border border-white/[0.06] px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
    <div className="text-[11px] text-slate-500">{label}</div>
    <div className="text-slate-100 font-bold text-sm mt-0.5">{value}</div>
  </div>
)
const Missing = ({ t }: { t: (de: string, en: string) => string }) => <p className="text-slate-400 text-sm">{t('Kein SoulDex-Eintrag gefunden.', 'No SoulDex entry found.')}</p>
