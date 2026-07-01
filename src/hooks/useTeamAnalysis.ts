import { useEffect, useMemo, useState } from 'react'
import { fetchPokemonDetails, fetchMoveDetails } from '../lib/pokemon-api'
import type { PokemonStats } from '../lib/pokemon-api'
import {
  buildMembers, analyzeTeam, analyzeSoulLinks, analyzeGym, analyzeTeamDetailed, recommendFromBox,
} from '../lib/analysis/teamAnalysis'
import type {
  FullAnalysis, TeamDashboard, SoulLinkInsight, BoxRec, GymInsight, CarryEntry,
} from '../lib/analysis/teamAnalysis'
import { analyzeUtility, type UtilityReport } from '../lib/analysis/utility'
import { getGymsForGame, type GymLeader } from '../lib/analysis/gyms'
import { typeLabel } from '../lib/dex/dex'
import { useSettings } from '../store/settingsStore'
import { useEmuTeamStore } from '../store/emuTeamStore'
import type { Encounter, Player, SoulLinkPair, TeamSlot } from '../types/database'

const RISK_CFG = {
  easy: { dot: '🟢', label: 'Einfach', color: '#4ade80' },
  mid:  { dot: '🟡', label: 'Mittel',  color: '#fbbf24' },
  hard: { dot: '🔴', label: 'Hoch',    color: '#f87171' },
} as const

// Everything the SoulGuide (and its small dock preview) needs — computed ONCE and shared,
// so there is exactly one analysis source in the whole app.
export interface TeamAnalysisData {
  analysis: FullAnalysis
  detailed: TeamDashboard
  utility: UtilityReport
  sl: SoulLinkInsight
  boxRecs: BoxRec[]
  carries: CarryEntry[]
  gymInsight: GymInsight
  gyms: GymLeader[]
  gymIdx: number
  setGymIdx: (i: number) => void
  gym: GymLeader | undefined
  risk: { dot: string; label: string; color: string }
  hasPartner: boolean
  memberCount: number
  empty: boolean
  verdict: { c: string; label: string }
  status: string
}

interface Params {
  runId: string
  game: string
  players: Player[]
  myPlayerId: string
  encounters: Encounter[]
  teamSlots: TeamSlot[]
  soulLinkPairs: SoulLinkPair[]
  /** Analyse the live emulator team (when connected) instead of team_slots. */
  useLiveTeam?: boolean
}

export function useTeamAnalysis({
  runId, game, players, myPlayerId, encounters, teamSlots, soulLinkPairs, useLiveTeam,
}: Params): TeamAnalysisData {
  const lang = useSettings((s) => s.language)
  const tl = (t: string) => typeLabel(t, lang)

  // Composition-only selector: recompute only when the line-up (pids) changes, not per HP tick.
  const liveTeamPids = useEmuTeamStore((s) =>
    useLiveTeam && s.connected ? s.team.filter((m) => m.pid != null).map((m) => String(m.pid)).sort().join(',') : '')
  const [statsMap, setStatsMap] = useState<Record<number, PokemonStats>>({})
  const [moveTypesMap, setMoveTypesMap] = useState<Record<string, string[]>>({})

  const gyms = useMemo(() => getGymsForGame(game), [game])
  const storeKey = `soullink-gym-${runId}`
  const [gymIdx, setGymIdx] = useState<number>(() => {
    const v = Number(localStorage.getItem(`soullink-gym-${runId}`))
    return Number.isFinite(v) && v >= 0 && v < getGymsForGame(game).length ? v : 0
  })
  useEffect(() => { localStorage.setItem(storeKey, String(gymIdx)) }, [storeKey, gymIdx])
  const gym: GymLeader | undefined = gyms.length ? gyms[Math.min(gymIdx, gyms.length - 1)] : undefined

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
  const linkedEncIds = useMemo(() => new Set(soulLinkPairs.flatMap((p) => [p.encounter1.id, p.encounter2.id])), [soulLinkPairs])

  const analysis = useMemo(() => analyzeTeam(combinedMembers, linkedEncIds), [combinedMembers, linkedEncIds])
  const sl = useMemo(() => analyzeSoulLinks(myMembers, partnerMembers, soulLinkPairs), [myMembers, partnerMembers, soulLinkPairs])
  const detailed = useMemo(() => analyzeTeamDetailed(combinedMembers), [combinedMembers])
  const utility = useMemo(() => analyzeUtility(combinedEncs), [combinedEncs])
  const gymInsight = useMemo<GymInsight>(
    () => (gym
      ? analyzeGym(combinedMembers, gym)
      : { gym: gym as unknown as GymLeader, risk: 'easy', riskReasons: [], excellent: [], good: [], bad: [], avoid: [], recommendedTypes: [], dangers: [] }),
    [combinedMembers, gym],
  )
  const boxCandidates = useMemo(() => {
    const teamIds = new Set(myTeamEncs.map((e) => e.id))
    return encounters.filter((e) => e.player_id === myPlayerId && e.status !== 'dead' && !teamIds.has(e.id))
  }, [encounters, myPlayerId, myTeamEncs])
  const boxRecs = useMemo(() => recommendFromBox(myMembers, boxCandidates), [myMembers, boxCandidates])

  const risk = RISK_CFG[gymInsight.risk]
  const empty = analysis.count === 0
  const danger = detailed.defense.dangerous.length
  const verdict = analysis.synergy >= 70 && danger === 0
    ? { c: '#4ade80', label: 'Stark & ausgewogen' }
    : analysis.synergy >= 45
      ? { c: '#fbbf24', label: 'Solide mit Lücken' }
      : { c: '#f87171', label: 'Verwundbar' }

  const status = useMemo(() => {
    if (empty) return 'Noch kein Team analysiert'
    if (detailed.defense.dangerous.length) return `Anfällig gegen ${detailed.defense.dangerous.slice(0, 2).map(tl).join(', ')}`
    const weak = detailed.defense.weaknesses.filter((w) => w.count >= 2)
    if (weak.length) return `Achte auf ${weak.slice(0, 2).map((w) => tl(w.type)).join(', ')}`
    return verdict.label
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty, detailed, verdict.label, lang])

  return {
    analysis, detailed, utility, sl, boxRecs, carries: analysis.carries,
    gymInsight, gyms, gymIdx, setGymIdx, gym, risk,
    hasPartner: !!partnerId && partnerMembers.length > 0,
    memberCount: combinedMembers.length, empty, verdict, status,
  }
}
