import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Brain, Maximize2 } from 'lucide-react'
import { fetchPokemonDetails, fetchMoveDetails } from '../lib/pokemon-api'
import type { PokemonStats } from '../lib/pokemon-api'
import { buildMembers, analyzeTeam, analyzeSoulLinks, analyzeGym, analyzeTeamDetailed, recommendFromBox } from '../lib/analysis/teamAnalysis'
import { analyzeUtility } from '../lib/analysis/utility'
import TeamAnalysisDashboard from './TeamAnalysisDashboard'
import { getGymsForGame } from '../lib/analysis/gyms'
import { useEmuTeamStore } from '../store/emuTeamStore'
import type { Encounter, Player, SoulLinkPair, TeamSlot } from '../types/database'

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

  // Compact verdict for the small dock card — the FULL breakdown lives in the dashboard.
  const danger = detailed.defense.dangerous.length
  const verdict = analysis.synergy >= 70 && danger === 0
    ? { c: '#4ade80', label: 'Stark & ausgewogen' }
    : analysis.synergy >= 45
      ? { c: '#fbbf24', label: 'Solide mit Lücken' }
      : { c: '#f87171', label: 'Verwundbar' }

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
          <span className="text-slate-200 text-xs font-black uppercase tracking-widest">Team-Coach</span>
        </div>
        <div className="flex items-center gap-2">
          {!empty && <span className="text-[10px] font-bold tabular-nums" style={{ color: '#FFCB05' }}>{analysis.overall.toFixed(1)}/10</span>}
          {collapsible && (open
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />)}
        </div>
      </div>

      {open && (
        <div className="p-3 space-y-3" style={{ background: '#161620' }}>
          {empty ? (
            <p className="text-slate-500 text-xs text-center py-4">
              Noch keine Team-Pokémon. Nimm bestätigte SoulLinks ins Hauptteam auf, um die Analyse zu starten.
            </p>
          ) : (
            <>
              {/* Gesamtbewertung — kompakt (Details im großen Overlay) */}
              <div className="rounded-xl px-3 py-3 flex items-center gap-3" style={{ background: 'rgba(255,203,5,0.06)', border: '1px solid rgba(255,203,5,0.2)' }}>
                <div className="min-w-0">
                  <div className="text-pk-yellow text-base leading-none tracking-wide">
                    {'★'.repeat(analysis.stars)}<span className="text-slate-600">{'☆'.repeat(5 - analysis.stars)}</span>
                  </div>
                  <div className="text-[10px] font-bold mt-1 truncate" style={{ color: verdict.c }}>{verdict.label}</div>
                </div>
                <div className="ml-auto text-right shrink-0">
                  <div className="text-white font-black text-2xl leading-none">{analysis.overall.toFixed(1)}<span className="text-slate-500 text-sm"> / 10</span></div>
                  <div className="text-slate-500 text-[9px] mt-0.5">{combinedMembers.length} Pokémon</div>
                </div>
              </div>

              {/* Nächste Arena — Ein-Zeilen-Glance; volle Matchups im Overlay */}
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-slate-400 truncate">🏆 {gym?.name ?? '—'}</span>
                <span className="ml-auto shrink-0 font-black px-2 py-0.5 rounded-full" style={{ color: risk.color, background: `${risk.color}1e`, border: `1px solid ${risk.color}55` }}>
                  {risk.dot} {risk.label}
                </span>
              </div>

              {/* Volle Analyse im großen Hauptbereich (Overlay) öffnen */}
              <button
                onClick={() => setDashOpen(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:brightness-110 active:scale-[0.99]"
                style={{ background: 'var(--color-pk-red)' }}
              >
                <Maximize2 className="w-4 h-4" /> Analyse öffnen
              </button>
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
        gymInsight={gymInsight}
        gyms={gyms}
        gymIdx={gymIdx}
        onGymChange={setGymIdx}
        carries={analysis.carries}
        onSelectEncounter={onSelectEncounter}
        onClose={() => setDashOpen(false)}
      />
    )}
    </>
  )
}
