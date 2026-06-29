import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Brain, Maximize2 } from 'lucide-react'
import {
  fetchPokemonDetails, fetchMoveDetails, getSpriteUrl, getTypeColor, TYPE_NAMES_DE,
} from '../lib/pokemon-api'
import type { PokemonStats } from '../lib/pokemon-api'
import { buildMembers, analyzeTeam, analyzeSoulLinks, analyzeGym, analyzeTeamDetailed, recommendFromBox } from '../lib/analysis/teamAnalysis'
import { analyzeUtility } from '../lib/analysis/utility'
import TeamAnalysisDashboard from './TeamAnalysisDashboard'
import { getGymsForGame } from '../lib/analysis/gyms'
import { useEmuTeamStore } from '../store/emuTeamStore'
import type { Encounter, Player, SoulLinkPair, TeamSlot } from '../types/database'

const de = (t: string) => TYPE_NAMES_DE[t] ?? t

function TypeTag({ t }: { t: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: getTypeColor(t) }}>
      {de(t)}
    </span>
  )
}

function MonChip({ enc, onClick }: { enc: Encounter; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-[#16161f] border border-[#2e2e42] hover:border-slate-600 transition-colors"
    >
      {enc.pokemon_id != null && <img src={getSpriteUrl(enc.pokemon_id)} className="w-6 h-6 object-contain shrink-0" alt="" />}
      <span className="text-[10px] text-slate-200 capitalize truncate max-w-[80px]">{enc.nickname ?? enc.pokemon_name}</span>
    </button>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">{children}</div>
}

const RISK_CFG = {
  easy: { dot: '🟢', label: 'Einfach', color: '#4ade80' },
  mid:  { dot: '🟡', label: 'Mittel',  color: '#fbbf24' },
  hard: { dot: '🔴', label: 'Hoch',    color: '#f87171' },
} as const

interface Props {
  runId: string
  game: string
  players: Player[]
  myPlayerId: string
  encounters: Encounter[]
  teamSlots: TeamSlot[]
  soulLinkPairs: SoulLinkPair[]
  onSelectEncounter?: (enc: Encounter) => void
  /** Analyse the current live emulator team (when connected) instead of team_slots. */
  useLiveTeam?: boolean
  collapsible?: boolean
  defaultOpen?: boolean
}

export default function TeamAnalysisPanel({
  runId, game, players, myPlayerId, encounters, teamSlots, soulLinkPairs,
  onSelectEncounter, useLiveTeam, collapsible = true, defaultOpen = true,
}: Props) {
  // Composition-only selector: re-renders the panel only when the team line-up
  // (pids) or connection changes — NOT on every HP tick.
  const liveTeamPids = useEmuTeamStore((s) =>
    useLiveTeam && s.connected ? s.team.filter((m) => m.pid != null).map((m) => String(m.pid)).sort().join(',') : '')
  const [open, setOpen] = useState(defaultOpen)
  const [statsMap, setStatsMap] = useState<Record<number, PokemonStats>>({})
  const [moveTypesMap, setMoveTypesMap] = useState<Record<string, string[]>>({})

  const gyms = useMemo(() => getGymsForGame(game), [game])
  const storeKey = `soullink-gym-${runId}`
  const [gymIdx, setGymIdx] = useState<number>(() => {
    const v = Number(localStorage.getItem(`soullink-gym-${runId}`))
    return Number.isFinite(v) && v >= 0 && v < getGymsForGame(game).length ? v : 0
  })
  useEffect(() => { localStorage.setItem(storeKey, String(gymIdx)) }, [storeKey, gymIdx])
  const gym = gyms[Math.min(gymIdx, gyms.length - 1)]

  const partnerId = players.find((p) => p.id !== myPlayerId)?.id

  const teamEncsFor = (pid: string | undefined) => {
    if (!pid) return [] as Encounter[]
    return teamSlots
      .filter((s) => s.player_id === pid)
      .sort((a, b) => a.slot_position - b.slot_position)
      .map((s) => encounters.find((e) => e.id === s.encounter_id))
      .filter((e): e is Encounter => !!e)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const myTeamEncs = useMemo(() => {
    if (useLiveTeam && liveTeamPids) {
      const pidSet = new Set(liveTeamPids.split(',').filter(Boolean))
      return encounters.filter((e) => e.player_id === myPlayerId && !!e.emu_pid && pidSet.has(e.emu_pid))
    }
    return teamEncsFor(myPlayerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useLiveTeam, liveTeamPids, teamSlots, encounters, myPlayerId])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const partnerTeamEncs = useMemo(() => teamEncsFor(partnerId), [teamSlots, encounters, partnerId])
  const combinedEncs = useMemo(() => [...myTeamEncs, ...partnerTeamEncs], [myTeamEncs, partnerTeamEncs])

  const teamKey = combinedEncs.map((e) => e.id).join(',')
  const movesKey = combinedEncs.map((e) => [e.move_1, e.move_2, e.move_3, e.move_4].join('|')).join(';')

  // Lazily load base stats + move types for the current team (cached in pokemon-api)
  useEffect(() => {
    let cancelled = false
    const ids = [...new Set(combinedEncs.map((e) => e.pokemon_id).filter((x): x is number => x != null))]
    Promise.all(ids.map((id) => fetchPokemonDetails(id))).then((list) => {
      if (cancelled) return
      const m: Record<number, PokemonStats> = {}
      list.forEach((d) => { if (d) m[d.id] = d.stats })
      setStatsMap((prev) => ({ ...prev, ...m }))
    })
    combinedEncs.forEach((e) => {
      const mv = [e.move_1, e.move_2, e.move_3, e.move_4].filter((x): x is string => !!x)
      if (mv.length === 0) return
      Promise.all(mv.map((name) => fetchMoveDetails(name))).then((dets) => {
        if (cancelled) return
        const types = [...new Set(dets.filter((d) => d != null).map((d) => d!.type))]
        setMoveTypesMap((prev) => ({ ...prev, [e.id]: types }))
      })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamKey, movesKey])

  const myMembers = useMemo(() => buildMembers(myTeamEncs, statsMap, moveTypesMap), [myTeamEncs, statsMap, moveTypesMap])
  const partnerMembers = useMemo(() => buildMembers(partnerTeamEncs, statsMap, moveTypesMap), [partnerTeamEncs, statsMap, moveTypesMap])
  const combinedMembers = useMemo(() => [...myMembers, ...partnerMembers], [myMembers, partnerMembers])
  const linkedEncIds = useMemo(
    () => new Set(soulLinkPairs.flatMap((p) => [p.encounter1.id, p.encounter2.id])),
    [soulLinkPairs],
  )

  const analysis = useMemo(() => analyzeTeam(combinedMembers, linkedEncIds), [combinedMembers, linkedEncIds])
  const sl = useMemo(() => analyzeSoulLinks(myMembers, partnerMembers, soulLinkPairs), [myMembers, partnerMembers, soulLinkPairs])
  const gymInsight = useMemo(() => analyzeGym(combinedMembers, gym), [combinedMembers, gym])

  // Detailed "coach" data for the full dashboard — same engine, richer breakdown.
  const detailed = useMemo(() => analyzeTeamDetailed(combinedMembers), [combinedMembers])
  const utility = useMemo(() => analyzeUtility(combinedEncs), [combinedEncs])
  const boxCandidates = useMemo(() => {
    const teamIds = new Set(myTeamEncs.map((e) => e.id))
    return encounters.filter((e) => e.player_id === myPlayerId && e.status !== 'dead' && !teamIds.has(e.id))
  }, [encounters, myPlayerId, myTeamEncs])
  const boxRecs = useMemo(() => recommendFromBox(myMembers, boxCandidates), [myMembers, boxCandidates])
  const [dashOpen, setDashOpen] = useState(false)

  const risk = RISK_CFG[gymInsight.risk]
  const empty = analysis.count === 0

  return (
    <>
    <div className="rounded-2xl border border-[#2e2e42] overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${collapsible ? 'cursor-pointer hover:bg-white/3 transition-colors' : ''}`}
        style={{ background: '#1c1c26' }}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-200 text-xs font-black uppercase tracking-widest">Team-Analyse</span>
        </div>
        <div className="flex items-center gap-2">
          {!empty && <span className="text-[10px] font-bold tabular-nums" style={{ color: '#FFCB05' }}>{analysis.overall.toFixed(1)}/10</span>}
          {collapsible && (open
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />)}
        </div>
      </div>

      {open && (
        <div className="p-3 space-y-4" style={{ background: '#161620' }}>
          {empty ? (
            <p className="text-slate-500 text-xs text-center py-4">
              Noch keine Team-Pokémon. Nimm bestätigte SoulLinks ins Hauptteam auf, um die Analyse zu starten.
            </p>
          ) : (
            <>
              {/* Gesamtbewertung */}
              <div className="rounded-xl px-3 py-2.5 flex items-center gap-3" style={{ background: 'rgba(255,203,5,0.06)', border: '1px solid rgba(255,203,5,0.2)' }}>
                <div>
                  <div className="text-pk-yellow text-base leading-none tracking-wide">
                    {'★'.repeat(analysis.stars)}<span className="text-slate-600">{'☆'.repeat(5 - analysis.stars)}</span>
                  </div>
                  <div className="text-slate-500 text-[9px] mt-1">{combinedMembers.length} Pokémon analysiert</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-white font-black text-xl leading-none">{analysis.overall.toFixed(1)}<span className="text-slate-500 text-sm"> / 10</span></div>
                  <div className="text-slate-500 text-[9px]">Gesamtbewertung</div>
                </div>
              </div>

              {/* Volle Analyse öffnen */}
              <button onClick={() => setDashOpen(true)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs text-white" style={{ background: 'var(--color-pk-red)' }}>
                <Maximize2 className="w-3.5 h-3.5" /> Analyse öffnen
              </button>

              {/* Stärken */}
              <div>
                <SubLabel>Team-Stärken</SubLabel>
                <ul className="space-y-1">
                  {analysis.strengths.map((s, i) => (
                    <li key={i} className="text-[11px] text-slate-300 flex gap-1.5"><span className="text-green-400">✔</span>{s}</li>
                  ))}
                </ul>
              </div>

              {/* Schwächen */}
              <div>
                <SubLabel>Team-Schwächen</SubLabel>
                <ul className="space-y-1">
                  {analysis.weaknesses.map((s, i) => (
                    <li key={i} className="text-[11px] text-slate-300 flex gap-1.5"><span className="text-amber-400">⚠</span>{s}</li>
                  ))}
                </ul>
              </div>

              {/* Fehlende Typen */}
              <div>
                <SubLabel>Fehlende Typen</SubLabel>
                <div className="space-y-1.5">
                  <div>
                    <div className="text-slate-500 text-[9px] mb-0.5">Fehlende Offensive</div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.missingOffense.length ? analysis.missingOffense.map((t) => <TypeTag key={t} t={t} />) : <span className="text-slate-600 text-[10px]">—</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[9px] mb-0.5">Fehlende Resistenzen</div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.missingResistances.length ? analysis.missingResistances.map((t) => <TypeTag key={t} t={t} />) : <span className="text-slate-600 text-[10px]">—</span>}
                    </div>
                  </div>
                  {analysis.missingDefense.length > 0 && (
                    <div>
                      <div className="text-slate-500 text-[9px] mb-0.5">Ungedeckte Schwächen</div>
                      <div className="flex flex-wrap gap-1">{analysis.missingDefense.map((t) => <TypeTag key={t} t={t} />)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Empfehlungen */}
              <div>
                <SubLabel>Empfehlungen</SubLabel>
                <ul className="space-y-1">
                  {analysis.recommendations.map((s, i) => (
                    <li key={i} className="text-[11px] text-slate-300 flex gap-1.5"><span>💡</span>{s}</li>
                  ))}
                </ul>
              </div>

              {/* SoulLink-Analyse */}
              {players.length === 2 && (
                <div className="rounded-xl p-2.5" style={{ background: 'rgba(204,0,0,0.05)', border: '1px solid rgba(204,0,0,0.18)' }}>
                  <SubLabel>🔗 SoulLink-Analyse</SubLabel>
                  <ul className="space-y-1 mb-2">
                    {sl.complement.map((s, i) => <li key={i} className="text-[11px] text-slate-300 flex gap-1.5"><span className="text-green-400">✔</span>{s}</li>)}
                  </ul>
                  {sl.duplicateWeaknesses.length > 0 && (
                    <div className="mb-1.5">
                      <div className="text-slate-500 text-[9px] mb-0.5">Doppelte Schwächen (beide Teams)</div>
                      <div className="flex flex-wrap gap-1">{sl.duplicateWeaknesses.map((t) => <TypeTag key={t} t={t} />)}</div>
                    </div>
                  )}
                  {sl.duplicateTypes.length > 0 && (
                    <div className="mb-1.5">
                      <div className="text-slate-500 text-[9px] mb-0.5">Doppelte Typen</div>
                      <div className="flex flex-wrap gap-1">{sl.duplicateTypes.map((t) => <TypeTag key={t} t={t} />)}</div>
                    </div>
                  )}
                  {sl.importantLinks.length > 0 && (
                    <div className="mb-1.5">
                      <div className="text-slate-500 text-[9px] mb-0.5">Wichtigste SoulLinks</div>
                      {sl.importantLinks.map(({ pair, reason }) => (
                        <div key={pair.id} className="text-[10px] text-slate-300">
                          <span className="text-pk-red">★</span> {pair.encounter1.nickname ?? pair.encounter1.pokemon_name} ↔ {pair.encounter2.nickname ?? pair.encounter2.pokemon_name} <span className="text-slate-500">· {reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {sl.riskyLinks.length > 0 && (
                    <div>
                      <div className="text-slate-500 text-[9px] mb-0.5">Riskanteste SoulLinks</div>
                      {sl.riskyLinks.map(({ pair, reason }) => (
                        <div key={pair.id} className="text-[10px] text-slate-300">
                          <span className="text-amber-400">⚠</span> {pair.encounter1.nickname ?? pair.encounter1.pokemon_name} ↔ {pair.encounter2.nickname ?? pair.encounter2.pokemon_name} <span className="text-slate-500">· {reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Nuzlocke-Risiko + Arena-Analyse */}
              <div className="rounded-xl p-2.5" style={{ background: '#1c1c26', border: '1px solid #2e2e42' }}>
                <div className="flex items-center justify-between mb-2">
                  <SubLabel>🏆 Nächster Arenaleiter</SubLabel>
                </div>
                <select
                  value={gymIdx}
                  onChange={(e) => setGymIdx(Number(e.target.value))}
                  className="w-full bg-[#16161f] border border-[#2e2e42] rounded-lg px-2 py-1.5 text-white text-[11px] font-bold outline-none focus:border-pk-red mb-2"
                >
                  {gyms.map((g, i) => <option key={i} value={i}>{i + 1}. {g.name} ({de(g.type)})</option>)}
                </select>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ color: risk.color, background: `${risk.color}1e`, border: `1px solid ${risk.color}55` }}>
                    {risk.dot} {risk.label}
                  </span>
                  <div className="flex flex-wrap gap-1">{gymInsight.recommendedTypes.map((t) => <TypeTag key={t} t={t} />)}</div>
                </div>

                <ul className="space-y-0.5 mb-2">
                  {gymInsight.riskReasons.map((r, i) => (
                    <li key={i} className="text-[11px] text-slate-300 flex gap-1.5">
                      <span className={r.ok ? 'text-green-400' : 'text-amber-400'}>{r.ok ? '✔' : '⚠'}</span>{r.text}
                    </li>
                  ))}
                </ul>

                {/* Arena matchups */}
                {[
                  { label: 'Sehr gut', list: gymInsight.excellent, color: '#4ade80' },
                  { label: 'Geeignet', list: gymInsight.good, color: '#86efac' },
                  { label: 'Schlechtes Matchup', list: gymInsight.bad, color: '#fbbf24' },
                  { label: 'Nicht mitnehmen', list: gymInsight.avoid, color: '#f87171' },
                ].filter((g) => g.list.length > 0).map((g) => (
                  <div key={g.label} className="mb-1.5">
                    <div className="text-[9px] font-bold mb-0.5" style={{ color: g.color }}>{g.label}</div>
                    <div className="flex flex-wrap gap-1">
                      {g.list.map((enc) => <MonChip key={enc.id} enc={enc} onClick={onSelectEncounter ? () => onSelectEncounter(enc) : undefined} />)}
                    </div>
                  </div>
                ))}

                {gymInsight.dangers.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-[#2e2e42]">
                    <div className="text-slate-500 text-[9px] mb-0.5">Besondere Gefahren</div>
                    {gymInsight.dangers.map((d, i) => <div key={i} className="text-[10px] text-slate-400">• {d}</div>)}
                  </div>
                )}
              </div>

              {/* Top-3 Carries */}
              <div>
                <SubLabel>Top-3 Carry-Pokémon</SubLabel>
                <div className="space-y-1.5">
                  {analysis.carries.map((c) => (
                    <button
                      key={c.enc.id}
                      onClick={onSelectEncounter ? () => onSelectEncounter(c.enc) : undefined}
                      className="w-full flex items-center gap-2 rounded-xl px-2 py-1.5 bg-[#1c1c26] border border-[#2e2e42] hover:border-slate-600 transition-colors text-left"
                    >
                      <span className="text-base shrink-0">{c.medal}</span>
                      {c.enc.pokemon_id != null && <img src={getSpriteUrl(c.enc.pokemon_id)} className="w-8 h-8 object-contain shrink-0" alt="" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-[11px] font-bold capitalize truncate">{c.enc.nickname ?? c.enc.pokemon_name}</div>
                        <div className="text-slate-500 text-[9px] truncate">{c.reasons.join(' · ')}</div>
                      </div>
                      <span className="text-[10px] font-black tabular-nums shrink-0" style={{ color: '#FFCB05' }}>{c.score}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Team-Synergie */}
              <div className="rounded-xl p-2.5" style={{ background: 'rgba(56,140,255,0.06)', border: '1px solid rgba(56,140,255,0.2)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <SubLabel>📊 Team-Synergie</SubLabel>
                  <span className="text-white font-black text-sm">{analysis.synergy}<span className="text-slate-500 text-[11px]"> / 100</span></span>
                </div>
                <div className="h-2 rounded-full bg-white/5 mb-2 overflow-hidden">
                  <div className="h-2 rounded-full" style={{ width: `${analysis.synergy}%`, background: 'linear-gradient(90deg,#388cff,#4ade80)' }} />
                </div>
                <ul className="space-y-0.5">
                  {analysis.synergyNotes.map((n, i) => (
                    <li key={i} className="text-[11px] text-slate-300">{n}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      )}
    </div>
    {dashOpen && (
      <TeamAnalysisDashboard
        analysis={analysis}
        dashboard={detailed}
        utility={utility}
        sl={sl}
        hasPartner={!!partnerId && partnerMembers.length > 0}
        boxRecs={boxRecs}
        onClose={() => setDashOpen(false)}
      />
    )}
    </>
  )
}
