import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Sparkles, ChevronRight, Loader2 } from 'lucide-react'
import { useSettings } from '../../store/settingsStore'
import { dexEntry, dexName, artUrl, shinyArtUrl, spriteUrl, typeLabel, typeColor, STAT_LABEL, statTotal } from '../../lib/dex/dex'
import { getDexDetail, type DexDetail, type DexEvo, type DexMeta, type DexAbility } from '../../lib/dex/detail'
import { LEARN_METHODS, METHOD_LABEL, type LearnMethod } from '../../lib/dex/learn'
import { defenseMatchup, groupMatchup } from '../../lib/dex/typechart'

// SoulDex entry — instant, offline detail from the bundled index (artwork, shiny, types,
// base stats) plus lazy sections (Pokédex text, evolution line, abilities incl. hidden,
// egg groups, level-up moves) fetched once from PokéAPI and cached for offline reuse.
// No placeholder sections: a block only renders when it actually has data.
const STAT_MAX = 200
const statColor = (v: number) => (v >= 120 ? '#4ade80' : v >= 90 ? '#a3e635' : v >= 60 ? '#fbbf24' : '#fb923c')
const titleize = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function DexEntryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const lang = useSettings((s) => s.language)
  const [shiny, setShiny] = useState(false)
  const e = dexEntry(Number(id))

  if (!e) {
    return (
      <div className="px-8 py-10 max-w-2xl mx-auto">
        <button onClick={() => navigate('/dex')} className="text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-sm"><ChevronLeft className="w-4 h-4" /> SoulDex</button>
        <p className="text-slate-400 mt-6">{lang === 'de' ? 'Pokémon nicht gefunden.' : 'Pokémon not found.'}</p>
      </div>
    )
  }

  return (
    <div className="px-6 lg:px-8 py-8">
      <div className="mx-auto max-w-[920px] anim-fade-up">
        <button onClick={() => navigate('/dex')} className="text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-sm font-bold mb-4"><ChevronLeft className="w-4 h-4" /> SoulDex</button>

        <div className="rounded-3xl border border-white/[0.07] overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(22,22,31,0.92), rgba(12,12,18,0.92))' }}>
          <div className="relative p-6 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(120% 120% at 30% 10%, ${typeColor(e.t[0])}22, transparent 60%)` }} />
            <div className="relative shrink-0 w-44 h-44 rounded-2xl bg-black/20 flex items-center justify-center">
              <img src={shiny ? shinyArtUrl(e.id) : artUrl(e.id)} alt="" draggable={false} className="w-40 h-40 object-contain" />
              <button onClick={() => setShiny((v) => !v)} aria-label="Shiny"
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[11px] font-bold rounded-lg px-2 py-1 border transition-colors"
                style={shiny ? { background: '#fbbf24', borderColor: '#fbbf24', color: '#3b2a02' } : { borderColor: '#3a3a4e', color: '#cbd5e1', background: 'rgba(0,0,0,0.4)' }}>
                <Sparkles className="w-3.5 h-3.5" /> Shiny
              </button>
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                <h1 className="text-white font-black text-3xl tracking-tight">{dexName(e, lang)}</h1>
                <span className="font-mono text-slate-500">#{String(e.id).padStart(4, '0')}</span>
              </div>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap justify-center sm:justify-start">
                {e.t.map((t) => <span key={t} className="text-xs font-bold rounded-full px-3 py-1" style={{ background: typeColor(t), color: '#0b0b10' }}>{typeLabel(t, lang)}</span>)}
                <span className="text-[11px] font-bold text-slate-400 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">{lang === 'de' ? 'Generation' : 'Generation'} {e.g}</span>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2"><span>{lang === 'de' ? 'Statuswerte' : 'Base stats'}</span><span>{lang === 'de' ? 'Gesamt' : 'Total'} {statTotal(e)}</span></div>
                <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2 items-center text-xs">
                  {e.s.map((v, i) => (
                    <div key={i} className="contents">
                      <span className="text-slate-400">{STAT_LABEL[lang][i]}</span>
                      <span className="h-2 rounded-full bg-white/[0.06] overflow-hidden"><span className="block h-2 rounded-full" style={{ width: `${Math.min(100, (v / STAT_MAX) * 100)}%`, background: statColor(v) }} /></span>
                      <span className="font-mono text-slate-300 w-8 text-right">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <TypeMatchup types={e.t} lang={lang} />
        <DetailSections id={e.id} lang={lang} />
      </div>
    </div>
  )
}

function TypeMatchup({ types, lang }: { types: string[]; lang: 'de' | 'en' }) {
  const g = groupMatchup(defenseMatchup(types))
  const rows: { key: string; label: string; color: string }[] = [
    { key: '4', label: '×4', color: '#dc2626' },
    { key: '2', label: '×2', color: '#fb923c' },
    { key: '0.5', label: '×½', color: '#4ade80' },
    { key: '0.25', label: '×¼', color: '#22c55e' },
    { key: '0', label: '×0', color: '#64748b' },
  ].filter((r) => g[r.key].length)
  return (
    <section className="mt-4 rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
      <h2 className="text-white font-bold text-sm mb-3">{lang === 'de' ? 'Typ-Effektivität (Verteidigung)' : 'Type effectiveness (defense)'}</h2>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-start gap-2.5">
            <span className="text-xs font-black w-8 shrink-0 text-right" style={{ color: r.color }}>{r.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {g[r.key].map((t) => <span key={t} className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ background: typeColor(t), color: '#0b0b10' }}>{typeLabel(t, lang)}</span>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
      <h2 className="text-white font-bold text-sm mb-3">{title}</h2>
      {children}
    </section>
  )
}

function DetailSections({ id, lang }: { id: number; lang: 'de' | 'en' }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ['dex-detail', id], queryFn: () => getDexDetail(id), staleTime: Infinity, gcTime: 60 * 60 * 1000, retry: 1 })
  const t = (de: string, en: string) => (lang === 'de' ? de : en)

  if (isLoading) return <div className="mt-4 flex items-center gap-2 text-slate-400 text-sm px-1"><Loader2 className="w-4 h-4 animate-spin" /> {t('Lädt Details …', 'Loading details …')}</div>
  if (isError || !data) return <div className="mt-4 text-slate-500 text-sm px-1">{t('Weitere Details konnten nicht geladen werden (offline?).', 'Could not load further details (offline?).')}</div>

  const flavor = lang === 'de' ? data.flavor.de || data.flavor.en : data.flavor.en || data.flavor.de
  return (
    <>
      {flavor && <Section title={t('Pokédex-Eintrag', 'Pokédex entry')}><p className="text-slate-300 text-sm leading-relaxed">{flavor}</p></Section>}
      {data.meta && <MetaGrid meta={data.meta} t={t} />}
      {data.evo.length > 1 && <EvoLine evo={data.evo} lang={lang} t={t} />}
      <AbilitiesEgg data={data} lang={lang} t={t} />
      {data.encounters.length > 0 && <Encounters data={data} lang={lang} t={t} />}
      {data.moves.length > 0 && <Moves data={data} lang={lang} t={t} />}
    </>
  )
}

function MetaGrid({ meta, t }: { meta: DexMeta; t: (de: string, en: string) => string }) {
  const gender = meta.genderRate < 0
    ? t('Geschlechtslos', 'Genderless')
    : `♂ ${Math.round((1 - meta.genderRate / 8) * 100)}% · ♀ ${Math.round((meta.genderRate / 8) * 100)}%`
  const evShort = t('HP/Ang/Vert/SpA/SpV/Init', 'HP/Atk/Def/SpA/SpD/Spe').split('/')
  const evYield = (meta.evs || []).map((v, i) => (v > 0 ? `${v} ${evShort[i]}` : '')).filter(Boolean).join(', ')
  const cells: { label: string; value: string }[] = [
    { label: t('Größe', 'Height'), value: `${meta.height.toFixed(1)} m` },
    { label: t('Gewicht', 'Weight'), value: `${meta.weight.toFixed(1)} kg` },
    { label: t('Fangrate', 'Capture rate'), value: String(meta.captureRate) },
    { label: t('Geschlecht', 'Gender'), value: gender },
    { label: t('EV-Ertrag', 'EV yield'), value: evYield || '—' },
    { label: t('Basis-Freundschaft', 'Base friendship'), value: String(meta.baseHappiness) },
    { label: t('Ei-Zyklen', 'Egg cycles'), value: String(meta.hatchCounter) },
    { label: t('Wachstum', 'Growth'), value: meta.growth ? titleize(meta.growth) : '—' },
    { label: t('Basis-EP', 'Base exp.'), value: String(meta.baseExp) },
  ]
  return (
    <Section title={t('Pokédex-Daten', 'Pokédex data')}>
      {(meta.legendary || meta.mythical || meta.baby) && (
        <div className="flex gap-2 mb-3">
          {meta.legendary && <span className="text-[10px] font-black uppercase tracking-wide rounded px-2 py-1" style={{ background: '#fbbf2422', color: '#fbbf24' }}>{t('Legendär', 'Legendary')}</span>}
          {meta.mythical && <span className="text-[10px] font-black uppercase tracking-wide rounded px-2 py-1" style={{ background: '#c084fc22', color: '#c084fc' }}>{t('Mysteriös', 'Mythical')}</span>}
          {meta.baby && <span className="text-[10px] font-black uppercase tracking-wide rounded px-2 py-1" style={{ background: '#f472b622', color: '#f472b6' }}>{t('Baby', 'Baby')}</span>}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/[0.06] px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-[11px] text-slate-500">{c.label}</div>
            <div className="text-slate-100 font-bold text-sm mt-0.5">{c.value}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function Encounters({ data, lang, t }: { data: DexDetail; lang: 'de' | 'en'; t: (de: string, en: string) => string }) {
  const name = (x: { de: string; en: string }) => (lang === 'de' ? x.de || x.en : x.en || x.de)
  // Group locations under their edition.
  const byVersion = new Map<string, { version: string; rows: DexDetail['encounters'] }>()
  for (const e of data.encounters) {
    const v = name(e.version)
    const g = byVersion.get(v) || { version: v, rows: [] }
    g.rows.push(e); byVersion.set(v, g)
  }
  return (
    <Section title={t('Fundorte (nach Edition)', 'Encounters (by edition)')}>
      <div className="space-y-4">
        {[...byVersion.values()].map((g) => (
          <div key={g.version}>
            <div className="text-xs font-black uppercase tracking-wide text-pk-red mb-1.5">{g.version}</div>
            <div className="space-y-1">
              {g.rows.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-200 truncate">{name(e.location)}</span>
                  <span className="ml-auto font-mono text-xs text-slate-500 shrink-0">Lv {e.min === e.max ? e.min : `${e.min}–${e.max}`}</span>
                  <span className="font-mono text-xs text-slate-400 w-12 text-right shrink-0">{e.chance}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function EvoLine({ evo, lang, t }: { evo: DexEvo[]; lang: 'de' | 'en'; t: (de: string, en: string) => string }) {
  const navigate = useNavigate()
  const name = (e: DexEvo) => (lang === 'de' ? e.de || e.en : e.en || e.de)
  const cond = (e: DexEvo) => {
    if (e.item) return e.item
    if (e.level) return `Lv. ${e.level}`
    if (e.happiness) return lang === 'de' ? 'Freundschaft' : 'Friendship'
    if (e.time) return titleize(e.time)
    if (e.trigger && e.trigger !== 'level-up') return titleize(e.trigger)
    return ''
  }
  return (
    <Section title={t('Entwicklung', 'Evolution')}>
      <div className="flex items-center flex-wrap gap-1">
        {evo.map((e, i) => (
          <div key={e.id} className="contents">
            {i > 0 && (
              <div className="flex flex-col items-center text-slate-500 px-1">
                <ChevronRight className="w-4 h-4" />
                {cond(e) && <span className="text-[10px] font-bold text-slate-400">{cond(e)}</span>}
              </div>
            )}
            <button onClick={() => navigate(`/dex/pokemon/${e.id}`)} className="flex flex-col items-center rounded-xl px-2 py-1.5 hover:bg-white/[0.06] transition-colors">
              <img src={spriteUrl(e.id)} alt="" draggable={false} loading="lazy" className="w-14 h-14 object-contain" style={{ imageRendering: 'pixelated' }} />
              <span className="text-xs font-bold text-slate-200">{name(e)}</span>
            </button>
          </div>
        ))}
      </div>
    </Section>
  )
}

function AbilityItem({ a, lang, t }: { a: DexAbility; lang: 'de' | 'en'; t: (de: string, en: string) => string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const name = lang === 'de' ? a.de || a.en : a.en || a.de
  const effect = lang === 'de' ? a.effectDe || a.effectEn : a.effectEn || a.effectDe
  return (
    <div className="rounded-xl border" style={{ borderColor: a.hidden ? '#7c5cff44' : '#ffffff12', background: 'rgba(255,255,255,0.02)' }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <span className="text-sm font-bold text-slate-100">{name}</span>
        {a.hidden && <span className="text-[10px] font-bold rounded px-1.5 py-0.5" style={{ background: '#7c5cff22', color: '#b9a8ff' }}>{t('versteckt', 'hidden')}</span>}
        <ChevronRight className={`w-4 h-4 text-slate-500 ml-auto transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-2.5">
          <p className="text-xs text-slate-400 leading-relaxed">{effect || t('Keine Beschreibung verfügbar.', 'No description available.')}</p>
          {a.id != null && <button onClick={() => navigate(`/abilities/${a.id}`)} className="text-[11px] font-bold text-pk-red hover:underline mt-1.5">{t('Zur Fähigkeit-Seite →', 'Open ability page →')}</button>}
        </div>
      )}
    </div>
  )
}

function AbilitiesEgg({ data, lang, t }: { data: DexDetail; lang: 'de' | 'en'; t: (de: string, en: string) => string }) {
  const aName = (de: string, en: string) => (lang === 'de' ? de || en : en || de)
  if (!data.abilities.length && !data.eggGroups.length) return null
  return (
    <div className="grid sm:grid-cols-2 gap-4 mt-4">
      {data.abilities.length > 0 && (
        <section className="rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
          <h2 className="text-white font-bold text-sm mb-3">{t('Fähigkeiten', 'Abilities')}</h2>
          <div className="space-y-2">
            {data.abilities.map((a, i) => <AbilityItem key={i} a={a} lang={lang} t={t} />)}
          </div>
        </section>
      )}
      {data.eggGroups.length > 0 && (
        <section className="rounded-2xl border border-white/[0.07] p-5" style={{ background: 'rgba(22,22,31,0.7)' }}>
          <h2 className="text-white font-bold text-sm mb-3">{t('Ei-Gruppen', 'Egg groups')}</h2>
          <div className="flex flex-wrap gap-2">
            {data.eggGroups.map((g, i) => <span key={i} className="text-xs font-bold rounded-lg px-2.5 py-1.5 border border-white/10 text-slate-200" style={{ background: 'rgba(255,255,255,0.04)' }}>{aName(g.de, g.en)}</span>)}
          </div>
        </section>
      )}
    </div>
  )
}

function Moves({ data, lang, t }: { data: DexDetail; lang: 'de' | 'en'; t: (de: string, en: string) => string }) {
  const navigate = useNavigate()
  const mName = (de: string, en: string) => (lang === 'de' ? de || en : en || de)
  const byMethod = {} as Record<LearnMethod, typeof data.moves>
  LEARN_METHODS.forEach((m) => { byMethod[m] = [] })
  data.moves.forEach((m) => byMethod[m.method].push(m))
  const available = LEARN_METHODS.filter((m) => byMethod[m].length)
  const [tab, setTab] = useState<LearnMethod>(available[0] || 'level-up')
  const active = available.includes(tab) ? tab : available[0]
  const list = byMethod[active] || []
  return (
    <Section title={t('Attacken', 'Moves')}>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {available.map((m) => (
          <button key={m} onClick={() => setTab(m)} className="text-[11px] font-bold rounded-full px-3 py-1 border transition-colors"
            style={m === active ? { background: 'var(--color-pk-red)', borderColor: 'var(--color-pk-red)', color: '#fff' } : { borderColor: '#2e2e42', color: '#cbd5e1' }}>
            {METHOD_LABEL[lang][m]} <span className="opacity-60">{byMethod[m].length}</span>
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
        {list.map((m, i) => (
          <button key={i} onClick={() => navigate(`/moves/${m.id}`)} className="flex items-center gap-2.5 text-sm py-1 px-1 -mx-1 rounded-lg hover:bg-white/[0.05] transition-colors text-left">
            {active === 'level-up' && <span className="font-mono text-xs text-slate-500 w-9 text-right shrink-0">{m.level > 0 ? m.level : '—'}</span>}
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: typeColor(m.type) }} />
            <span className="text-slate-200 truncate">{mName(m.de, m.en)}</span>
            <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-wide shrink-0">{typeLabel(m.type, lang)}</span>
          </button>
        ))}
      </div>
    </Section>
  )
}
