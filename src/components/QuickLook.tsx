import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X, ExternalLink, Sparkles, BarChart3, Loader2, ChevronRight } from 'lucide-react'
import { useQuickLook, type RunContext } from '../store/quickLookStore'
import { useSettings } from '../store/settingsStore'
import { dexEntry, dexName, artUrl, spriteUrl, typeColor, typeLabel, ALL_TYPES } from '../lib/dex/dex'
import { moveEntry, moveName, moveIdByName, CAT_LABEL, catColor } from '../lib/dex/moves'
import { itemEntry, itemName, catLabel } from '../lib/dex/items'
import { abilityEntry, abilityName } from '../lib/dex/abilities'
import { defenseMatchup, groupMatchup, mult } from '../lib/dex/typechart'
import { getDexDetail } from '../lib/dex/detail'
import { getMoveDetail } from '../lib/dex/moveDetail'
import { getAbilityDetail } from '../lib/dex/abilityDetail'
import { getItemDetail } from '../lib/dex/itemDetail'
import { getItemLocations, categoryUse, HOW_LABEL, HOW_COLOR, editionLabel } from '../lib/dex/itemLocations'

// In-run Quick-Look — built for a 2-3s combat decision, NOT a mini-Pokédex. Weaknesses,
// ability-explained, evolution-next, the encounter's CURRENT moves + soon-learned moves,
// run status. Heavy data loads lazily (same offline cache as full pages); the full-page
// deep-link is always one click away.
type Lang = 'de' | 'en'
type T = (de: string, en: string) => string

export default function QuickLook() {
  const { target, close } = useQuickLook()
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const t: T = (de, en) => (lang === 'de' ? de : en)

  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [target, close])

  if (!target) return null
  const go = (to: string) => { close(); navigate(to) }

  return (
    <div className="fixed inset-0 z-[400] flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <aside className="relative w-[400px] max-w-[92vw] h-full overflow-y-auto modal-scroll border-l border-white/10 shadow-2xl anim-slide-r"
        style={{ background: 'linear-gradient(180deg, rgba(20,20,28,0.99), rgba(12,12,18,0.99))' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 backdrop-blur" style={{ background: 'rgba(16,16,22,0.85)' }}>
          <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-pk-red"><Sparkles className="w-3.5 h-3.5" /> Quick-Look</span>
          <button onClick={close} aria-label="close" className="text-slate-400 hover:text-white p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">
          {target.kind === 'pokemon' && <PokemonQL id={Number(target.key)} ctx={target.context} lang={lang} t={t} go={go} />}
          {target.kind === 'move' && <MoveQL id={Number(target.key)} lang={lang} t={t} go={go} />}
          {target.kind === 'ability' && <AbilityQL id={Number(target.key)} lang={lang} t={t} go={go} />}
          {target.kind === 'item' && <ItemQL id={Number(target.key)} lang={lang} t={t} go={go} />}
          {target.kind === 'type' && <TypeQL ty={String(target.key)} lang={lang} t={t} go={go} />}
        </div>
        {target.analyze && (
          <div className="px-4 pb-5 pt-1">
            <button onClick={() => { const a = target.analyze!; close(); a.run() }} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-sm text-slate-100 border border-white/10 hover:bg-white/5">
              <BarChart3 className="w-4 h-4" /> {target.analyze.label}
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}

// ── shared bits ──────────────────────────────────────────────────────────────
const Label = ({ children }: { children: React.ReactNode }) => <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{children}</div>
const Loading = ({ t }: { t: T }) => <div className="flex items-center gap-2 text-slate-500 text-xs py-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('lädt …', 'loading …')}</div>
const Missing = ({ t }: { t: T }) => <p className="text-slate-400 text-sm">{t('Kein SoulDex-Eintrag.', 'No SoulDex entry.')}</p>

function FullPage({ to, go, t }: { to: string; go: (to: string) => void; t: T }) {
  return (
    <button onClick={() => go(to)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-black text-sm text-white mt-4" style={{ background: '#CC0000' }}>
      <ExternalLink className="w-4 h-4" /> {t('Volle SoulDex-Seite', 'Full SoulDex page')}
    </button>
  )
}

function TypeChips({ types, lang, big }: { types: string[]; lang: Lang; big?: boolean }) {
  const { open } = useQuickLook()
  return (
    <div className="flex flex-wrap gap-1.5">
      {types.map((ty) => <button key={ty} onClick={() => open({ kind: 'type', key: ty })} className={`font-bold rounded-full hover:opacity-80 ${big ? 'text-xs px-3 py-1' : 'text-[11px] px-2.5 py-0.5'}`} style={{ background: typeColor(ty), color: '#0b0b10' }}>{typeLabel(ty, lang)}</button>)}
    </div>
  )
}

function PokeRow({ ids, lang, max = 18 }: { ids: number[]; lang: Lang; max?: number }) {
  const { open } = useQuickLook()
  const list = ids.map((id) => dexEntry(id)).filter((e): e is NonNullable<typeof e> => !!e)
  const shown = list.slice(0, max)
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((e) => (
        <button key={e.id} onClick={() => open({ kind: 'pokemon', key: e.id })} title={dexName(e, lang)} className="flex flex-col items-center rounded-lg px-1 py-0.5 hover:bg-white/[0.06]">
          <img src={spriteUrl(e.id)} alt="" loading="lazy" className="w-9 h-9 object-contain" style={{ imageRendering: 'pixelated' }} />
        </button>
      ))}
      {list.length > shown.length && <span className="text-slate-500 text-xs self-center">+{list.length - shown.length}</span>}
    </div>
  )
}

const STATUS: Record<string, { de: string; en: string; color: string }> = {
  alive: { de: 'Lebt', en: 'Alive', color: '#4ade80' },
  dead: { de: 'Besiegt', en: 'Fainted', color: '#f87171' },
  boxed: { de: 'In der Box', en: 'Boxed', color: '#60a5fa' },
  caught: { de: 'Gefangen', en: 'Caught', color: '#4ade80' },
  missed: { de: 'Verpasst', en: 'Missed', color: '#94a3b8' },
}

// ── Pokémon ──────────────────────────────────────────────────────────────────
function PokemonQL({ id, ctx, lang, t, go }: { id: number; ctx?: RunContext; lang: Lang; t: T; go: (to: string) => void }) {
  const { open } = useQuickLook()
  const e = dexEntry(id)
  const { data, isLoading } = useQuery({ queryKey: ['dex-detail', id], queryFn: () => getDexDetail(id), staleTime: Infinity, gcTime: 36e5, retry: 1 })
  if (!e) return <Missing t={t} />

  const g = groupMatchup(defenseMatchup(e.t))
  const st = ctx?.status ? STATUS[ctx.status] : null
  const curMoves = (ctx?.moves || []).map((m) => (m || '').trim()).filter(Boolean)
  const lvMoves = (data?.moves || []).filter((m) => m.method === 'level-up').sort((a, b) => a.level - b.level)
  const upcoming = ctx?.level ? lvMoves.filter((m) => m.level > (ctx.level || 0)).slice(0, 5) : lvMoves.slice(0, 6)
  const nextEvo = data?.evo?.find((x) => x.from === id)
  const evoCond = (x: NonNullable<typeof nextEvo>) => x.item || (x.level ? `Lv. ${x.level}` : x.happiness ? t('Freundschaft', 'Friendship') : x.trigger && x.trigger !== 'level-up' ? x.trigger : '')

  return (
    <>
      <div className="flex items-center gap-3">
        <img src={artUrl(e.id)} alt="" className="w-20 h-20 object-contain shrink-0" draggable={false} />
        <div className="min-w-0">
          <div className="text-white font-black text-xl truncate">{ctx?.nickname || dexName(e, lang)}</div>
          {ctx?.nickname && <div className="text-slate-400 text-xs truncate">{dexName(e, lang)}</div>}
          <div className="font-mono text-slate-500 text-xs">#{String(e.id).padStart(4, '0')} · Gen {e.g}</div>
          <div className="mt-1.5"><TypeChips types={e.t} lang={lang} big /></div>
        </div>
      </div>
      {st && (
        <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
          <span className="font-bold rounded-lg px-2 py-1" style={{ color: st.color, background: `${st.color}18` }}>{lang === 'de' ? st.de : st.en}</span>
          {ctx?.location && <span className="text-slate-400">📍 {ctx.location}</span>}
          {ctx?.soulLink && <span className="text-purple-300">🔗 {ctx.soulLink}</span>}
        </div>
      )}

      {/* Combat first: matchups */}
      <div className="mt-4 rounded-xl border border-white/[0.07] p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <Matchup label={t('Schwach gegen', 'Weak to')} color="#fb923c" types={[...g['4'], ...g['2']]} lang={lang} q4={g['4']} />
        <Matchup label={t('Resistent', 'Resists')} color="#4ade80" types={[...g['0.5'], ...g['0.25']]} lang={lang} />
        {g['0'].length > 0 && <Matchup label={t('Immun', 'Immune')} color="#94a3b8" types={g['0']} lang={lang} />}
      </div>

      {/* Ability explained */}
      <div className="mt-4">
        <Label>{t('Fähigkeiten', 'Abilities')}</Label>
        {isLoading ? <Loading t={t} /> : (data?.abilities || []).map((a, i) => {
          const eff = lang === 'de' ? a.effectDe || a.effectEn : a.effectEn || a.effectDe
          return (
            <button key={i} onClick={() => a.id != null && open({ kind: 'ability', key: a.id })} className="w-full text-left rounded-lg px-2.5 py-2 mb-1.5 hover:bg-white/[0.05]" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${a.hidden ? '#7c5cff33' : '#ffffff10'}` }}>
              <div className="flex items-center gap-1.5"><span className="text-sm font-bold text-slate-100">{lang === 'de' ? a.de : a.en}</span>{a.hidden && <span className="text-[9px] font-bold rounded px-1 py-0.5" style={{ background: '#7c5cff22', color: '#b9a8ff' }}>{t('versteckt', 'hidden')}</span>}</div>
              {eff && <div className="text-slate-400 text-xs leading-snug mt-0.5">{eff}</div>}
            </button>
          )
        })}
      </div>

      {/* Current moves */}
      {curMoves.length > 0 && (
        <div className="mt-3">
          <Label>{t('Aktuelle Attacken', 'Current moves')}</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {curMoves.map((mn, i) => {
              const mid = moveIdByName(mn); const m = mid ? moveEntry(mid) : null
              return (
                <button key={i} disabled={!mid} onClick={() => mid && open({ kind: 'move', key: mid })} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs disabled:cursor-default hover:bg-white/[0.05]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {m && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: typeColor(m.t) }} />}
                  <span className="text-slate-200 truncate">{m ? moveName(m, lang) : mn}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Next evolution */}
      {nextEvo && (
        <div className="mt-3">
          <Label>{t('Nächste Entwicklung', 'Next evolution')}</Label>
          <button onClick={() => open({ kind: 'pokemon', key: nextEvo.id })} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.05] w-full" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <img src={spriteUrl(nextEvo.id)} alt="" className="w-10 h-10 object-contain" style={{ imageRendering: 'pixelated' }} />
            <span className="text-sm font-bold text-slate-100">{lang === 'de' ? nextEvo.de : nextEvo.en}</span>
            {evoCond(nextEvo) && <span className="ml-auto text-[11px] font-bold text-pk-yellow">{evoCond(nextEvo)}</span>}
          </button>
        </div>
      )}

      {/* Soon-learned moves */}
      {upcoming.length > 0 && (
        <div className="mt-3">
          <Label>{ctx?.level ? t('Bald lernbar', 'Learned soon') : t('Level-Up-Attacken', 'Level-up moves')}</Label>
          <div className="space-y-0.5">
            {upcoming.map((m, i) => (
              <button key={i} onClick={() => open({ kind: 'move', key: m.id })} className="w-full flex items-center gap-2 text-xs px-1.5 py-1 rounded-lg hover:bg-white/[0.05]">
                <span className="font-mono text-slate-500 w-7 text-right">{m.level > 0 ? m.level : '—'}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: typeColor(m.type) }} />
                <span className="text-slate-200 truncate">{lang === 'de' ? m.de : m.en}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <FullPage to={`/dex/pokemon/${e.id}`} go={go} t={t} />
    </>
  )
}

function Matchup({ label, color, types, lang, q4 }: { label: string; color: string; types: string[]; lang: Lang; q4?: string[] }) {
  const { open } = useQuickLook()
  if (!types.length) return null
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-[11px] font-black w-20 shrink-0" style={{ color }}>{label}</span>
      <div className="flex flex-wrap gap-1">
        {types.map((ty) => <button key={ty} onClick={() => open({ kind: 'type', key: ty })} className="text-[11px] font-bold rounded-full px-2 py-0.5 hover:opacity-80" style={{ background: typeColor(ty), color: '#0b0b10' }}>{typeLabel(ty, lang)}{q4?.includes(ty) ? ' ×4' : ''}</button>)}
      </div>
    </div>
  )
}

// ── Move ─────────────────────────────────────────────────────────────────────
function MoveQL({ id, lang, t, go }: { id: number; lang: Lang; t: T; go: (to: string) => void }) {
  const m = moveEntry(id)
  const { data, isLoading } = useQuery({ queryKey: ['move-detail', id], queryFn: () => getMoveDetail(id), staleTime: Infinity, gcTime: 36e5, retry: 1 })
  if (!m) return <Missing t={t} />
  const eff = data && (lang === 'de' ? data.effect.de || data.flavor.de || data.effect.en : data.effect.en || data.flavor.en || data.effect.de)
  return (
    <>
      <div className="text-white font-black text-xl">{moveName(m, lang)}</div>
      <div className="flex items-center gap-2 mt-2"><TypeChips types={[m.t]} lang={lang} /><span className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: `${catColor(m.c)}22`, color: catColor(m.c) }}>{CAT_LABEL[lang][m.c]}</span></div>
      <div className="grid grid-cols-4 gap-1.5 mt-4 text-center">
        <Stat label={t('Stärke', 'Pow')} value={m.pow ?? '—'} />
        <Stat label={t('Gen.', 'Acc')} value={m.acc != null ? `${m.acc}` : '—'} />
        <Stat label="AP" value={m.pp ?? '—'} />
        <Stat label={t('Prio', 'Prio')} value={m.pri > 0 ? `+${m.pri}` : m.pri} />
      </div>
      <div className="mt-4"><Label>{t('Effekt', 'Effect')}</Label>{isLoading ? <Loading t={t} /> : <p className="text-slate-300 text-sm leading-relaxed">{eff || t('Verursacht Schaden.', 'Deals damage.')}</p>}</div>
      {data && data.learners.length > 0 && (
        <div className="mt-4"><Label>{t('Lernt diese Attacke', 'Learned by')} <span className="text-slate-500 font-mono">({data.learners.length})</span></Label><PokeRow ids={data.learners.map((l) => l.id)} lang={lang} /></div>
      )}
      <FullPage to={`/moves/${m.id}`} go={go} t={t} />
    </>
  )
}
const Stat = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-lg border border-white/[0.06] py-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
    <div className="text-[10px] text-slate-500">{label}</div>
    <div className="text-slate-100 font-bold text-sm">{value}</div>
  </div>
)

// ── Ability ──────────────────────────────────────────────────────────────────
function AbilityQL({ id, lang, t, go }: { id: number; lang: Lang; t: T; go: (to: string) => void }) {
  const a = abilityEntry(id)
  const { data, isLoading } = useQuery({ queryKey: ['ability-detail', id], queryFn: () => getAbilityDetail(id), staleTime: Infinity, gcTime: 36e5, retry: 1 })
  if (!a) return <Missing t={t} />
  return (
    <>
      <div className="text-white font-black text-xl">{abilityName(a, lang)}</div>
      <div className="text-slate-500 text-xs mt-0.5">{lang === 'de' ? a.en : a.de}</div>
      {a.fd && <p className="text-slate-200 text-sm leading-relaxed mt-3">{a.fd}</p>}
      <div className="mt-4">
        <Label>{t('Pokémon mit dieser Fähigkeit', 'Pokémon with it')} {data && <span className="text-slate-500 font-mono">({data.holders.length})</span>}</Label>
        {isLoading ? <Loading t={t} /> : data ? <PokeRow ids={data.holders.map((h) => h.id)} lang={lang} max={24} /> : null}
      </div>
      <FullPage to={`/abilities/${a.id}`} go={go} t={t} />
    </>
  )
}

// ── Item ─────────────────────────────────────────────────────────────────────
function ItemQL({ id, lang, t, go }: { id: number; lang: Lang; t: T; go: (to: string) => void }) {
  const it = itemEntry(id)
  const { data, isLoading } = useQuery({ queryKey: ['item-detail', id], queryFn: () => getItemDetail(id), staleTime: Infinity, gcTime: 36e5, retry: 1 })
  if (!it) return <Missing t={t} />
  const desc = data && (lang === 'de' ? data.effect.de || data.flavor.de || data.effect.en : data.effect.en || data.flavor.en)
  const use = categoryUse(it.c, lang)
  const loc = getItemLocations(it.id)[0]
  const pokes = [...(data?.evolves || []), ...(data?.heldEvolves || []), ...(data?.holders || [])]
  return (
    <>
      <div className="text-white font-black text-xl">{itemName(it, lang)}</div>
      <div className="text-slate-400 text-sm mt-0.5">{catLabel(it, lang)}</div>
      <div className="mt-3"><Label>{t('Wirkung', 'Effect')}</Label>{isLoading ? <Loading t={t} /> : <p className="text-slate-300 text-sm leading-relaxed">{desc || t('Keine Beschreibung.', 'No description.')}</p>}</div>
      {use && <div className="mt-3"><Label>{t('Verwendung', 'Usage')}</Label><p className="text-slate-300 text-sm">{use}</p></div>}
      {pokes.length > 0 && <div className="mt-3"><Label>{t('Wichtige Pokémon', 'Key Pokémon')}</Label><PokeRow ids={pokes} lang={lang} /></div>}
      {loc && (
        <div className="mt-3"><Label>{t('Fundort', 'Where')}</Label>
          <div className="flex items-start gap-2 text-sm"><span className="text-[10px] font-black uppercase rounded px-1.5 py-0.5 shrink-0" style={{ background: `${HOW_COLOR[loc.how]}22`, color: HOW_COLOR[loc.how] }}>{HOW_LABEL[lang][loc.how]}</span><span className="text-slate-300">{[loc.loc, loc.npc].filter(Boolean).join(' · ')} <span className="text-slate-500">({loc.ed.map((c) => editionLabel(c, lang)).join(', ')})</span></span></div>
        </div>
      )}
      <FullPage to={`/items/${it.id}`} go={go} t={t} />
    </>
  )
}

// ── Type ─────────────────────────────────────────────────────────────────────
function TypeQL({ ty, lang, t, go }: { ty: string; lang: Lang; t: T; go: (to: string) => void }) {
  const { open } = useQuickLook()
  const off = groupMatchup(Object.fromEntries(ALL_TYPES.map((d) => [d, mult(ty, d)])))
  const def = groupMatchup(defenseMatchup([ty]))
  const Row = ({ label, types }: { label: string; types: string[] }) => types.length ? (
    <div className="mt-2"><Label>{label}</Label><div className="flex flex-wrap gap-1.5">{types.map((x) => <button key={x} onClick={() => open({ kind: 'type', key: x })} className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: typeColor(x), color: '#0b0b10' }}>{typeLabel(x, lang)}</button>)}</div></div>
  ) : null
  return (
    <>
      <span className="text-sm font-bold rounded-full px-3 py-1" style={{ background: typeColor(ty), color: '#0b0b10' }}>{typeLabel(ty, lang)}</span>
      <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><ChevronRight className="w-3 h-3" /> {t('Angriff', 'Attacking')}</div>
      <Row label={t('Sehr effektiv', 'Super effective')} types={off['2']} />
      <Row label={t('Wenig effektiv', 'Not very effective')} types={off['0.5']} />
      <Row label={t('Wirkungslos', 'No effect')} types={off['0']} />
      <div className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"><ChevronRight className="w-3 h-3" /> {t('Verteidigung', 'Defending')}</div>
      <Row label={t('Schwach gegen', 'Weak to')} types={def['2']} />
      <Row label={t('Resistent gegen', 'Resists')} types={def['0.5']} />
      <Row label={t('Immun gegen', 'Immune to')} types={def['0']} />
      <FullPage to="/types" go={go} t={t} />
    </>
  )
}
