import { AlertTriangle, ShieldCheck, Swords, Sparkles, Activity, Lightbulb, Link2, Star, Trophy } from 'lucide-react'
import { getSpriteUrl } from '../lib/pokemon-api'
import { typeColor, typeLabel } from '../lib/dex/dex'
import { useSettings } from '../store/settingsStore'
import { UTIL_LABEL, type UtilTag } from '../lib/analysis/utility'
import TypeEffectChart from './TypeEffectChart'
import type { TeamAnalysisData } from '../hooks/useTeamAnalysis'
import type { Encounter } from '../types/database'

// THE single analysis surface. Everything the coach knows lives here, inline in the
// SoulGuide workspace tab. Two tiers: PRIMARY coach advice (Empfehlungen + Arena) is
// dominant; everything else is supporting. A darker glass floor keeps the artwork subtle
// so the focus stays on the cards. The later live-SoulGuide updates only this component.
interface Props {
  data: TeamAnalysisData
  onSelectEncounter?: (enc: Encounter) => void
}

const GYM_RISK = {
  easy: { dot: '🟢', label: 'Einfach', color: '#4ade80' },
  mid:  { dot: '🟡', label: 'Mittel',  color: '#fbbf24' },
  hard: { dot: '🔴', label: 'Hoch',    color: '#f87171' },
} as const

// Darker glass floor — artwork stays faintly visible but recedes behind the cards.
const SURFACE = { background: 'rgba(9,9,13,0.74)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as const

export default function SoulGuidePanel({ data, onSelectEncounter }: Props) {
  const lang = useSettings((s) => s.language)
  const tl = (t: string) => typeLabel(t, lang)
  const { analysis, detailed: dashboard, utility, sl, hasPartner, boxRecs, gymInsight, gyms, gymIdx, setGymIdx, carries, verdict, status, memberCount, empty } = data

  if (empty) {
    return (
      <div className="rounded-3xl border border-white/10 p-12 text-center" style={SURFACE}>
        <Sparkles className="w-12 h-12 mx-auto text-slate-600 mb-4" />
        <h3 className="text-white font-black text-lg mb-1">SoulGuide bereit</h3>
        <p className="text-slate-400 text-sm max-w-md mx-auto">Nimm bestätigte SoulLinks in dein Hauptteam auf — dann analysiert der SoulGuide Balance, Typen, Coverage, Arena-Matchups und empfiehlt die besten Pokémon.</p>
      </div>
    )
  }

  const b = dashboard.balance

  return (
    <div className="rounded-3xl border border-white/10 p-5 sm:p-6 space-y-6 anim-fade-up" style={SURFACE}>
      {/* ─ Header / Gesamtverdikt ─ */}
      <div className="rounded-2xl border border-white/10 p-5 flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${verdict.c}1f`, color: verdict.c }}><Sparkles className="w-7 h-7" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-white font-black text-xl">SoulGuide</h2>
            <span className="text-xs font-black rounded-full px-2.5 py-0.5" style={{ background: `${verdict.c}22`, color: verdict.c }}>{verdict.label}</span>
            <span className="text-slate-500 text-xs">· {memberCount} Pokémon</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-white font-black text-lg">{analysis.overall.toFixed(1)}<span className="text-slate-500 text-sm">/10</span></span>
            <span className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="w-4 h-4" style={{ color: i < analysis.stars ? '#FFCB05' : '#3a3a4e', fill: i < analysis.stars ? '#FFCB05' : 'none' }} />)}</span>
            <div className="flex-1 max-w-[220px]"><Bar value={analysis.synergy} max={100} color={verdict.c} /></div>
            <span className="text-slate-400 text-xs font-mono">{analysis.synergy}%</span>
          </div>
          <p className="text-slate-400 text-xs mt-1.5">{status}</p>
        </div>
      </div>

      {/* ═ PRIMARY — der Coach spricht: Empfehlungen + Arena-Vorbereitung ═ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <Card icon={<Lightbulb className="w-5 h-5" />} title="Empfehlungen" accent="#FFCB05" dominant>
          <ul className="space-y-2">
            {analysis.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-100"><span className="text-pk-yellow mt-0.5">→</span> {r}</li>
            ))}
          </ul>
          {boxRecs.length > 0 && (
            <div className="mt-4">
              <SubLabel>Empfohlen aus deiner Box</SubLabel>
              <div className="space-y-2 mt-1.5">
                {boxRecs.map((rec) => (
                  <div key={rec.enc.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {rec.enc.pokemon_id && <img src={getSpriteUrl(rec.enc.pokemon_id)} alt="" className="w-10 h-10 object-contain shrink-0" style={{ imageRendering: 'pixelated' }} />}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-100 capitalize">{rec.enc.nickname ?? rec.enc.pokemon_name}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rec.reasons.map((r, i) => <span key={i} className="text-[10px] font-bold rounded px-1.5 py-0.5" style={{ background: '#4ade8018', color: '#86efac' }}>{r}</span>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {gyms.length > 0 && (
          <Card icon={<Trophy className="w-5 h-5" />} title="Arena-Vorbereitung" accent="#FFCB05" dominant>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <select value={gymIdx} onChange={(e) => setGymIdx(Number(e.target.value))} className="bg-[#16161f] border border-[#2e2e42] rounded-lg px-2.5 py-1.5 text-white text-xs font-bold outline-none focus:border-pk-red">
                {gyms.map((g, i) => <option key={i} value={i}>{i + 1}. {g.name} ({tl(g.type)})</option>)}
              </select>
              {(() => { const r = GYM_RISK[gymInsight.risk]; return (
                <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ color: r.color, background: `${r.color}1e`, border: `1px solid ${r.color}55` }}>{r.dot} {r.label}</span>
              ) })()}
              <div className="flex flex-wrap gap-1">{gymInsight.recommendedTypes.map((t) => <TypeChip key={t} type={t} label={tl(t)} />)}</div>
            </div>
            <ul className="space-y-1 mb-3">
              {gymInsight.riskReasons.map((r, i) => (
                <li key={i} className="text-sm text-slate-100 flex items-start gap-2"><span className={r.ok ? 'text-green-400' : 'text-amber-400'}>{r.ok ? '✔' : '⚠'}</span>{r.text}</li>
              ))}
            </ul>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: 'Sehr gut', list: gymInsight.excellent, color: '#4ade80' },
                { label: 'Geeignet', list: gymInsight.good, color: '#86efac' },
                { label: 'Schlechtes Matchup', list: gymInsight.bad, color: '#fbbf24' },
                { label: 'Nicht mitnehmen', list: gymInsight.avoid, color: '#f87171' },
              ].filter((g) => g.list.length > 0).map((g) => (
                <div key={g.label}>
                  <div className="text-[11px] font-bold mb-1.5" style={{ color: g.color }}>{g.label}</div>
                  <div className="flex flex-wrap gap-1.5">{g.list.map((enc) => <MonChip key={enc.id} enc={enc} onClick={onSelectEncounter ? () => onSelectEncounter(enc) : undefined} />)}</div>
                </div>
              ))}
            </div>
            {gymInsight.dangers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <SubLabel>Besondere Gefahren</SubLabel>
                <ul className="mt-1 space-y-0.5">{gymInsight.dangers.map((d, i) => <li key={i} className="text-xs text-slate-400">• {d}</li>)}</ul>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* ─ SUPPORTING — Detailanalyse, dezenter & schmaler ─ */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 shrink-0">Detailanalyse</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.1), transparent)' }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4 items-start">
          {/* Top-Carry */}
          {carries.length > 0 && (
            <Card icon={<Star className="w-4 h-4" />} title="Top-Carry" accent="#FFCB05">
              <div className="space-y-2">
                {carries.map((c) => (
                  <button key={c.enc.id} onClick={onSelectEncounter ? () => onSelectEncounter(c.enc) : undefined} className="w-full flex items-center gap-2.5 rounded-xl border border-white/[0.07] px-2.5 py-2 text-left hover:border-white/20 transition-colors" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <span className="text-base shrink-0">{c.medal}</span>
                    {c.enc.pokemon_id != null && <img src={getSpriteUrl(c.enc.pokemon_id)} className="w-9 h-9 object-contain shrink-0" alt="" style={{ imageRendering: 'pixelated' }} />}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-slate-100 capitalize truncate">{c.enc.nickname ?? c.enc.pokemon_name}</div>
                      <div className="text-slate-500 text-[10px] truncate">{c.reasons.join(' · ')}</div>
                    </div>
                    <span className="text-xs font-black tabular-nums shrink-0" style={{ color: '#FFCB05' }}>{c.score}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Balance + Rollen */}
          <Card icon={<Activity className="w-4 h-4" />} title="Balance · Rollen" accent="#60a5fa">
            {b.withStats === 0 ? <Empty /> : (
              <>
                <SplitBar leftLabel={`Phys ${b.physical}`} rightLabel={`Spez ${b.special}`} left={b.physical} right={b.special} leftColor="#f87171" rightColor="#60a5fa" />
                <div className="grid grid-cols-2 gap-2 mt-2.5">
                  <MiniStat label="Offensive" value={b.offensive} color="#fb923c" />
                  <MiniStat label="Defensive" value={b.defensive} color="#4ade80" />
                </div>
                <SubLabel className="mt-2.5">Rollen</SubLabel>
                <div className="flex flex-wrap gap-1.5 mt-1">{b.roles.map((r) => <Badge key={r.role}>{r.role} {r.count > 1 ? `×${r.count}` : ''}</Badge>)}</div>
                <SubLabel className="mt-2.5">Typen</SubLabel>
                <div className="flex flex-wrap gap-1 mt-1">{b.typeDist.map((t) => <TypeChip key={t.type} type={t.type} label={`${tl(t.type)}${t.count > 1 ? ` ×${t.count}` : ''}`} />)}</div>
                <SubLabel className="mt-2.5">Ø Werte (BST {b.avg.bst})</SubLabel>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
                  {([['KP', b.avg.hp], ['Ang', b.avg.atk], ['Vert', b.avg.def], ['SpA', b.avg.spa], ['SpV', b.avg.spd], ['Init', b.avg.spe]] as const).map(([l, v]) => (
                    <div key={l} className="flex items-center gap-1.5 text-[11px]"><span className="text-slate-500 w-7">{l}</span><div className="flex-1"><Bar value={v} max={180} color="#64748b" thin /></div><span className="font-mono text-slate-400 w-6 text-right">{v}</span></div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* Typanalyse (Defensive) */}
          <Card icon={<ShieldCheck className="w-4 h-4" />} title="Typanalyse" accent="#f87171">
            {dashboard.defense.dangerous.length > 0 && (
              <Warn>Gefährlich: {dashboard.defense.dangerous.map(tl).join(', ')} — mehrfach schwach & nichts resistiert.</Warn>
            )}
            <ChipRow label="Gemeinsame Schwächen" items={dashboard.defense.weaknesses.filter((w) => w.count >= 2)} tl={tl} tone="bad" />
            <ChipRow label="Resistenzen" items={dashboard.defense.resistances.slice(0, 10)} tl={tl} tone="good" />
            {dashboard.defense.immunities.length > 0 && <ChipRow label="Immunitäten" items={dashboard.defense.immunities} tl={tl} tone="info" />}
            {dashboard.defense.missingResist.length > 0 && (
              <><SubLabel className="mt-2.5">Fehlende Resistenzen</SubLabel><div className="flex flex-wrap gap-1 mt-1">{dashboard.defense.missingResist.map((t) => <TypeChip key={t} type={t} label={tl(t)} dim />)}</div></>
            )}
          </Card>

          {/* Offensive Coverage */}
          <Card icon={<Swords className="w-4 h-4" />} title="Coverage" accent="#fb923c">
            <SubLabel>Trifft super-effektiv</SubLabel>
            <div className="flex flex-wrap gap-1 mt-1">{dashboard.offense.hitsWell.length ? dashboard.offense.hitsWell.map((t) => <TypeChip key={t} type={t} label={tl(t)} />) : <Empty />}</div>
            {dashboard.offense.problematic.length > 0 && (
              <><SubLabel className="mt-2.5">Problematisch</SubLabel><div className="flex flex-wrap gap-1 mt-1">{dashboard.offense.problematic.map((t) => <TypeChip key={t} type={t} label={tl(t)} dim />)}</div></>
            )}
            {dashboard.offense.missingAttackTypes.length > 0 && (
              <p className="text-slate-500 text-[11px] mt-2.5">Fehlt: {dashboard.offense.missingAttackTypes.map(tl).slice(0, 8).join(', ')}{dashboard.offense.missingAttackTypes.length > 8 ? ' …' : ''}</p>
            )}
          </Card>

          {/* Utility */}
          <Card icon={<Sparkles className="w-4 h-4" />} title="Utility" accent="#c084fc">
            {utility.present.length === 0 ? <Empty /> : (
              <div className="flex flex-wrap gap-1.5">
                {utility.present.map((tag) => (
                  <span key={tag} className="text-xs font-bold rounded-lg px-2 py-1" style={{ background: '#4ade8018', color: '#86efac' }} title={utility.found[tag]!.map((h) => `${h.enc.nickname ?? h.enc.pokemon_name}: ${h.move}`).join('\n')}>
                    {UTIL_LABEL[lang][tag as UtilTag]} <span className="opacity-60">×{utility.found[tag]!.length}</span>
                  </span>
                ))}
              </div>
            )}
            {utility.missingImportant.length > 0 && (
              <><SubLabel className="mt-2.5">Fehlt im Team</SubLabel><div className="flex flex-wrap gap-1.5 mt-1">{utility.missingImportant.map((tag) => <span key={tag} className="text-xs font-bold rounded-lg px-2 py-1" style={{ background: '#fbbf2418', color: '#fcd34d' }}>{UTIL_LABEL[lang][tag]}</span>)}</div></>
            )}
          </Card>

          {/* SoulLink */}
          {hasPartner && (
            <Card icon={<Link2 className="w-4 h-4" />} title="SoulLink · Synergie" accent="#a78bfa">
              {sl.complement.map((c, i) => <p key={i} className="text-sm text-slate-200 mb-1.5">{c}</p>)}
              {sl.duplicateWeaknesses.length > 0 && <ChipRow label="Gemeinsame Schwächen" items={sl.duplicateWeaknesses.map((t) => ({ type: t, count: 0 }))} tl={tl} tone="bad" />}
              {sl.duplicateTypes.length > 0 && <ChipRow label="Typ-Überschneidungen" items={sl.duplicateTypes.map((t) => ({ type: t, count: 0 }))} tl={tl} tone="info" />}
              {sl.riskyLinks.length > 0 && (
                <><SubLabel className="mt-2.5">Gefährdete SoulLinks</SubLabel>
                  {sl.riskyLinks.map(({ pair, reason }, i) => (
                    <div key={i} className="flex items-center gap-2 mt-1.5 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-slate-300 capitalize">{pair.encounter1.pokemon_name} ⟷ {pair.encounter2.pokemon_name}</span>
                      <span className="text-slate-500">— {reason}</span>
                    </div>
                  ))}
                </>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Typeffektivität — aufklappbarer Abschnitt (unterstützend, kein Dauerplatz) */}
      <TypeEffectChart collapsible defaultOpen={false} />
    </div>
  )
}

// ── primitives ─────────────────────────────────────────────────────────────
function Card({ icon, title, accent, children, dominant }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode; dominant?: boolean }) {
  return (
    <section
      className={`rounded-2xl border ${dominant ? 'p-5' : 'p-3.5'}`}
      style={dominant
        ? { background: 'rgba(255,255,255,0.045)', borderColor: `${accent}45`, boxShadow: `inset 0 0 0 1px ${accent}12, 0 20px 54px -32px ${accent}66` }
        : { background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      <div className={`flex items-center gap-2 ${dominant ? 'mb-4' : 'mb-2.5'}`}>
        <span className={`${dominant ? 'w-9 h-9' : 'w-7 h-7'} rounded-xl flex items-center justify-center shrink-0`} style={{ background: `${accent}22`, color: accent }}>{icon}</span>
        <h3 className={`text-white ${dominant ? 'font-black text-base' : 'font-bold text-[13px]'}`}>{title}</h3>
      </div>
      {children}
    </section>
  )
}
const SubLabel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={`text-[11px] font-bold uppercase tracking-wide text-slate-500 ${className}`}>{children}</div>
const Empty = () => <p className="text-slate-500 text-sm">Noch keine Daten – Team zusammenstellen.</p>
const Badge = ({ children }: { children: React.ReactNode }) => <span className="text-[11px] font-bold rounded-lg px-2 py-0.5 border border-white/10 text-slate-200" style={{ background: 'rgba(255,255,255,0.03)' }}>{children}</span>
function MonChip({ enc, onClick }: { enc: Encounter; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#16161f] border border-[#2e2e42] hover:border-slate-600 transition-colors">
      {enc.pokemon_id != null && <img src={getSpriteUrl(enc.pokemon_id)} className="w-6 h-6 object-contain shrink-0" alt="" />}
      <span className="text-[11px] text-slate-200 capitalize truncate max-w-[90px]">{enc.nickname ?? enc.pokemon_name}</span>
    </button>
  )
}
function Bar({ value, max, color, thin }: { value: number; max: number; color: string; thin?: boolean }) {
  return <span className={`block rounded-full bg-white/[0.07] overflow-hidden ${thin ? 'h-1.5' : 'h-2'}`}><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} /></span>
}
function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="rounded-xl border border-white/[0.06] px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}><div className="flex items-center justify-between text-[11px] mb-1"><span className="text-slate-400">{label}</span><span className="font-mono text-slate-300">{value}</span></div><Bar value={value} max={150} color={color} thin /></div>
}
function SplitBar({ left, right, leftColor, rightColor, leftLabel, rightLabel }: { left: number; right: number; leftColor: string; rightColor: string; leftLabel: string; rightLabel: string }) {
  const total = Math.max(1, left + right)
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1"><span style={{ color: leftColor }} className="font-bold">{leftLabel}</span><span style={{ color: rightColor }} className="font-bold">{rightLabel}</span></div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-white/[0.07]"><span style={{ width: `${(left / total) * 100}%`, background: leftColor }} /><span style={{ width: `${(right / total) * 100}%`, background: rightColor }} /></div>
    </div>
  )
}
function TypeChip({ type, label, dim }: { type: string; label: string; dim?: boolean }) {
  return <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={dim ? { background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: `1px solid ${typeColor(type)}55` } : { background: typeColor(type), color: '#0b0b10' }}>{label}</span>
}
function ChipRow({ label, items, tl, tone }: { label: string; items: { type: string; count: number }[]; tl: (t: string) => string; tone: 'bad' | 'good' | 'info' }) {
  if (!items.length) return null
  return (
    <div className="mt-2.5">
      <SubLabel>{label}</SubLabel>
      <div className="flex flex-wrap gap-1 mt-1">
        {items.map((it) => (
          <span key={it.type} className="inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: typeColor(it.type), color: '#0b0b10' }}>
            {tl(it.type)}{it.count >= 2 ? <span className="rounded-full px-1" style={{ background: tone === 'bad' ? '#7f1d1d' : 'rgba(0,0,0,0.25)', color: '#fff' }}>{it.count}</span> : null}
          </span>
        ))}
      </div>
    </div>
  )
}
function Warn({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-2 rounded-xl px-3 py-2 mb-2 text-[13px]" style={{ background: '#f8717115', border: '1px solid #f8717133', color: '#fca5a5' }}><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{children}</span></div>
}
