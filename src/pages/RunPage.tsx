import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus, Link2, Copy, Check, ArrowLeft, Heart, Skull,
  LayoutGrid, List, Zap, Eye, Lock, Pencil, X, BookOpen, Archive, Sparkles,
} from 'lucide-react'
import { useRunStore } from '../store/runStore'
import { useEncounters, useReorderEncounters, useUpdateEncounterStatus } from '../hooks/useEncounters'
import { useSoulLinks, useSoulLinkPairs, useSoulLinkGroups, useDeleteSoulLink } from '../hooks/useSoulLinks'
import { useTeamSlots, useAddToTeam } from '../hooks/useTeamSlots'
import { useActivityLog } from '../hooks/useActivityLog'
import { useRealtime } from '../hooks/useRealtime'
import { usePendingRequests, useRequests, useCreateRequest } from '../hooks/useRequests'
import { useToastStore } from '../store/toastStore'
import { supabase } from '../lib/supabase'
import AddEncounterModal, { type EncounterPrefill } from '../components/AddEncounterModal'
import { isLiveSynced } from '../lib/liveSync'
import ShinyAvatar from '../components/ShinyAvatar'
import SoulLinkModal from '../components/SoulLinkModal'
import SoulLink3Modal from '../components/SoulLink3Modal'
import EncounterCard from '../components/EncounterCard'
import SoulLinkPairCard from '../components/SoulLinkPairCard'
import SoulLinkTripleCard from '../components/SoulLinkTripleCard'
import RequestsPanel from '../components/RequestsPanel'
import RunMonCard from '../components/RunMonCard'
import HeroCoachStrip from '../components/HeroCoachStrip'
import { buildCoachReport } from '../lib/coach/coach'
import { typeLabel } from '../lib/dex/dex'
import TeamPanel3 from '../components/TeamPanel3'
import RouteChecklist3 from '../components/RouteChecklist3'
import ActivityFeed from '../components/ActivityFeed'
import RouteChecklist from '../components/RouteChecklist'
import SoulGuidePreview from '../components/SoulGuidePreview'
import SoulGuidePanel from '../components/SoulGuidePanel'
import { useTeamAnalysis } from '../hooks/useTeamAnalysis'
import PokemonDetailModal from '../components/PokemonDetailModal'
import QuickLook from '../components/QuickLook'
import SlotPickerModal from '../components/SlotPickerModal'
import UserMenu from '../components/UserMenu'
import EmulatorLivePanel from '../components/EmulatorLivePanel'
import EmulatorReconciler from '../components/EmulatorReconciler'
import AtmosphereBackground from '../components/AtmosphereBackground'
import TeamOverview from '../components/TeamOverview'
import StoryGuide from '../components/StoryGuide'
import ChangeEditionModal from '../components/ChangeEditionModal'
import ChangeModeModal from '../components/ChangeModeModal'
import PlayersPanel from '../components/PlayersPanel'
import { useRunMode, setRunMode, type RunMode } from '../lib/runMode'
import { IN_COMPANION_WINDOW } from '../lib/companion'
import { LINKS } from '../lib/appInfo'
import { useEmuTeamStore } from '../store/emuTeamStore'
import { useSettings } from '../store/settingsStore'

// Emulator Live-Sync belongs to the Companion (it launches BizHawk). Show it only
// inside the Companion window (or the dev server for testing); on the public website
// the run is a manual tracker / spectator view, never a dead emulator panel.
const LIVE_SURFACE = IN_COMPANION_WINDOW || import.meta.env.DEV
import { usePresence } from '../hooks/usePresence'
import { useCompanion } from '../hooks/useCompanion'
import { useAuth } from '../contexts/AuthContext'
import type { Encounter, Run, Player, SoulLinkPair, LinkRequest, ActivityLogEntry } from '../types/database'

// ─── Small shared helpers ─────────────────────────────────────────────────────
function PokeBall({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M2,50 H98" stroke="currentColor" strokeWidth="4" />
      <path d="M2,50 Q2,2 50,2 Q98,2 98,50" fill="currentColor" opacity="0.8" />
      <circle cx="50" cy="50" r="14" fill="currentColor" stroke="currentColor" strokeWidth="4" />
      <circle cx="50" cy="50" r="8" fill="white" opacity="0.9" />
    </svg>
  )
}

function SectionLabel({ label, sub, className = '' }: { label: string; sub?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 mb-4 ${className}`}>
      <span className="text-slate-200 text-sm font-black uppercase tracking-widest shrink-0">{label}</span>
      {sub && <span className="text-slate-500 text-sm shrink-0">{sub}</span>}
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #2e2e42, transparent)' }} />
    </div>
  )
}

function PlayerStatCard({
  player, isMe, isActive, encounters, pairs, teamCount, onClick, avatarUrl,
}: {
  player: Player | undefined
  isMe: boolean
  isActive: boolean
  encounters: Encounter[]
  pairs: SoulLinkPair[]
  teamCount: number
  onClick: () => void
  avatarUrl?: string | null
}) {
  const alive = encounters.filter((e) => e.status === 'alive').length
  const dead = encounters.filter((e) => e.status === 'dead').length

  const accentColor = isMe ? '#CC0000' : '#FFCB05'

  return (
    <button
      onClick={onClick}
      className="rounded-2xl border p-5 lg:p-6 text-left transition-all duration-200 ease-out w-full group hover:-translate-y-0.5"
      style={{
        background: isActive ? `${accentColor}12` : '#1c1c26',
        borderColor: isActive ? accentColor : '#2e2e42',
        boxShadow: isActive ? `0 0 32px ${accentColor}26, inset 0 0 0 1px ${accentColor}20` : 'none',
      }}
    >
      <div className="flex items-start gap-3 mb-4">
        <ShinyAvatar src={avatarUrl} size={48} className="mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-black text-lg leading-tight truncate">{player?.name ?? '…'}</span>
            {isMe ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ background: '#CC000022', color: '#CC0000', border: '1px solid #CC000040' }}>
                DU
              </span>
            ) : (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 flex items-center gap-0.5" style={{ background: '#FFCB0518', color: '#FFCB05', border: '1px solid #FFCB0540' }}>
                <Eye className="w-3 h-3" /> PARTNER
              </span>
            )}
          </div>
          {isActive && (
            <div className="text-[11px] font-bold mt-1 flex items-center gap-1" style={{ color: accentColor }}>
              {isMe ? '● Meine Ansicht – bearbeitbar' : <><Lock className="w-3 h-3" /> Partner-Ansicht (Read-only)</>}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 lg:gap-4 text-sm font-bold flex-wrap">
        <span className="flex items-center gap-1.5 text-green-400">
          <Heart className="w-4 h-4" />{alive}
        </span>
        <span className="flex items-center gap-1.5 text-red-400">
          <Skull className="w-4 h-4" />{dead}
        </span>
        <span className="flex items-center gap-1.5 text-pk-red/60">
          <Link2 className="w-4 h-4" />{pairs.length}
        </span>
        <span className="ml-auto text-slate-500 tabular-nums text-base">{teamCount}/6</span>
      </div>
    </button>
  )
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="flex justify-center mb-4 opacity-25">{icon}</div>
      <h3 className="text-slate-300 font-bold text-base mb-2">{title}</h3>
      <p className="text-slate-600 text-sm max-w-xs mx-auto leading-relaxed">{desc}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RunPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const { currentRun, players, myPlayerId, setCurrentRun } = useRunStore()
  const { user, loading: authLoading } = useAuth()

  const [showAddEncounter, setShowAddEncounter] = useState(false)
  const [addEncounterRoute, setAddEncounterRoute] = useState<string | undefined>(undefined)
  const [emuPrefill, setEmuPrefill] = useState<EncounterPrefill | undefined>(undefined)
  const [showEditEdition, setShowEditEdition] = useState(false)
  const [savingEdition, setSavingEdition] = useState(false)
  const [showModeModal, setShowModeModal] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const runMode = useRunMode(runId ?? '')        // 'manual' | 'live_sync' (per run, local)
  const liveSyncMode = runMode === 'live_sync'
  // Online the live-sync runs through a local Companion; in dev this is always
  // 'connected' (Vite plugin). Gates the invisible reconciler so it only polls
  // when a backend is actually reachable.
  const companion = useCompanion(liveSyncMode && LIVE_SURFACE)

  // Run-Namen ändern (nur Owner). Verändert NICHTS an Encountern/SoulLinks.
  async function saveRunName() {
    const next = nameDraft.trim()
    if (!currentRun || !next || next === currentRun.name) { setEditingName(false); return }
    setSavingName(true)
    const { error } = await supabase.from('runs').update({ name: next }).eq('id', currentRun.id)
    setSavingName(false)
    if (error) { toast.show('Name konnte nicht geändert werden: ' + error.message, 'error'); return }
    setCurrentRun({ ...currentRun, name: next }, players, myPlayerId ?? '')
    setEditingName(false)
  }

  // Spielmodus wechseln. Manuell → Emulator-UI verschwindet + Live-Team verwerfen
  // (der Reconciler/Panel werden ausgehängt → Sync stoppt). Live-Sync → Panel kommt
  // zurück (Setup-Wizard öffnet sich dort automatisch, falls noch nicht eingerichtet).
  function applyMode(newMode: RunMode) {
    if (runId) setRunMode(runId, newMode)
    if (newMode === 'manual') useEmuTeamStore.getState().setTeam([], false)
    setShowModeModal(false)
  }
  const [showSoulLink, setShowSoulLink] = useState(false)
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [mainView, setMainView] = useState<'encounters' | 'pairs' | 'box' | 'story' | 'soulguide'>('encounters')
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null)
  const [slotPickerEncounter, setSlotPickerEncounter] = useState<Encounter | null>(null)
  const [dragOverEncId, setDragOverEncId] = useState<string | null>(null)
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const toast = useToastStore()
  const createRequest = useCreateRequest()
  const reorderEncounters = useReorderEncounters()

  const prevRequestsRef = useRef<LinkRequest[]>([])
  const prevActivityRef = useRef<ActivityLogEntry[]>([])

  useRealtime(runId ?? null)

  const { data: encounters = [] } = useEncounters(runId ?? null)
  const { data: soulLinks = [] } = useSoulLinks(runId ?? null)
  const { data: allRequests = [] } = useRequests(runId ?? null)
  const { data: teamSlots = [] } = useTeamSlots(runId ?? null)
  const { data: activityLog = [] } = useActivityLog(runId ?? null)
  const pairs = useSoulLinkPairs(runId ?? null, encounters as Encounter[])
  const updateStatus = useUpdateEncounterStatus()
  const deleteSoulLink = useDeleteSoulLink()
  const addToTeam = useAddToTeam()
  const pendingRequests = usePendingRequests(runId ?? null, encounters as Encounter[], players)

  const teamEncounterIds = new Set(teamSlots.map((s) => s.encounter_id))

  const myPlayer = players.find((p) => p.id === myPlayerId)
  const partnerPlayer = players.find((p) => p.id !== myPlayerId)

  // Route names where I already have a (non-missing) encounter — for the Story
  // Guide's read-only "Encounter gefangen?" check. Memoized so the guide doesn't
  // re-render on unrelated RunPage updates.
  const storyCaughtLocations = useMemo(
    () => new Set((encounters as Encounter[])
      .filter((e) => e.player_id === myPlayerId && e.status !== 'missing')
      .map((e) => e.location.toLowerCase().trim())),
    [encounters, myPlayerId],
  )

  // Member shiny avatars (profiles by auth_user_id) for the roster + focus cards.
  const [memberAvatars, setMemberAvatars] = useState<Record<string, string | null>>({})
  const memberKey = players.map((p) => p.auth_user_id).filter(Boolean).sort().join(',')
  useEffect(() => {
    const ids = players.map((p) => p.auth_user_id).filter(Boolean) as string[]
    if (ids.length === 0) { setMemberAvatars({}); return }
    let cancelled = false
    supabase.from('profiles').select('user_id, avatar_url').in('user_id', ids).then(({ data }) => {
      if (cancelled || !data) return
      const m: Record<string, string | null> = {}
      for (const pr of data as { user_id: string; avatar_url: string | null }[]) m[pr.user_id] = pr.avatar_url
      setMemberAvatars(m)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberKey])
  const avatarOf = (p?: Player) => (p?.auth_user_id ? memberAvatars[p.auth_user_id] : null)

  // Online-Status der Mitspieler (Supabase Realtime Presence) + Spieleranzahl des Runs.
  const onlinePlayers = usePresence(runId ?? null, myPlayer ? { playerId: myPlayer.id, name: myPlayer.name } : null)
  const maxPlayers = currentRun?.max_players ?? 2
  const is3 = maxPlayers === 3   // 3-Spieler-SoulLink-Logik nur bei max_players = 3
  // Triple-Gruppen (nur bei 3 Spielern genutzt; bei 2 Spielern bleibt alles wie bisher).
  const groups = useSoulLinkGroups(runId ?? null, encounters as Encounter[], players, maxPlayers)

  // THE single analysis source — computed once, shared by the dock preview + the SoulGuide tab.
  const guide = useTeamAnalysis({
    runId: runId ?? '',
    game: currentRun?.game ?? '',
    players,
    myPlayerId: myPlayerId ?? '',
    encounters: encounters as Encounter[],
    teamSlots,
    soulLinkPairs: is3 ? [] : pairs,
    useLiveTeam: true,
  })

  // Default focused player = me
  useEffect(() => {
    if (myPlayerId && focusedPlayerId === null) setFocusedPlayerId(myPlayerId)
  }, [myPlayerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Not logged in → back to the login/landing page.
  useEffect(() => {
    if (!authLoading && !user) navigate('/', { replace: true })
  }, [authLoading, user, navigate])

  // Identity comes from Supabase Auth: bind myPlayerId to the player row whose
  // auth_user_id matches the logged-in user (never a free-typed name).
  useEffect(() => {
    if (!user || !currentRun || players.length === 0) return
    const bound = players.find((p) => p.auth_user_id === user.id)
    if (bound && bound.id !== myPlayerId) setCurrentRun(currentRun, players, bound.id)
  }, [user, players, myPlayerId, currentRun, setCurrentRun])

  const isMember = !!user && players.some((p) => p.auth_user_id === user.id)
  // Only the run owner may change the edition (RLS allows owner-only run updates).
  const isOwner = !!user && !!currentRun?.owner_user_id && currentRun.owner_user_id === user.id

  // Change run edition after creation. Encounters are kept; routes that no longer
  // fit are only marked (EncounterCard badge). currentRun.game drives routes,
  // checklist, emulator compatibility and the region-based team analysis.
  async function changeEdition(newGame: string) {
    if (!currentRun || newGame === currentRun.game) { setShowEditEdition(false); return }
    setSavingEdition(true)
    const { error } = await supabase.from('runs').update({ game: newGame }).eq('id', currentRun.id)
    setSavingEdition(false)
    if (error) { toast.show('Edition konnte nicht geändert werden: ' + error.message, 'error'); return }
    setCurrentRun({ ...currentRun, game: newGame }, players, myPlayerId ?? '')
    setShowEditEdition(false)
    toast.show(`Run-Edition auf „${newGame}" geändert.`, 'success')
  }

  const isMyFocus = !focusedPlayerId || focusedPlayerId === myPlayerId
  const focusedPlayer = isMyFocus ? myPlayer : partnerPlayer

  const myEncounters = encounters.filter((e) => e.player_id === myPlayerId) as Encounter[]
  // Species already tracked by me → used to mark emulator mons as "already imported".
  const myEncounterSpeciesIds = new Set(
    myEncounters.map((e) => e.pokemon_id).filter((x): x is number => x != null)
  )
  // Stable PIDs already tracked → PID-based dedup that survives evolution.
  const myEncounterPids = new Set(
    myEncounters.map((e) => e.emu_pid).filter((x): x is string => !!x)
  )
  const partnerEncounters = encounters.filter((e) => e.player_id !== myPlayerId) as Encounter[]
  const focusedEncounters = isMyFocus ? myEncounters : partnerEncounters

  // Live party membership (pids only) → Team/Box follow the emulator WITHOUT re-rendering
  // this page on every HP tick. When connected, the party is the single truth: anything
  // alive that isn't in the party is in the Box (so team↔box moves reflect instantly).
  const livePidKey = useEmuTeamStore((s) => (s.connected ? s.team.filter((m) => m.pid != null).map((m) => String(m.pid)).sort().join(',') : ''))
  const liveConnected = useEmuTeamStore((s) => s.connected)
  const livePids = useMemo(() => new Set(livePidKey ? livePidKey.split(',') : []), [livePidKey])

  const focusedDead = focusedEncounters.filter((e) => e.status === 'dead')
  const focusedBox = (() => {
    const alive = focusedEncounters.filter((e) => e.status !== 'dead')
    if (isMyFocus && liveConnected) return alive.filter((e) => !(e.emu_pid && livePids.has(e.emu_pid)))
    const ownerId = isMyFocus ? myPlayerId : partnerPlayer?.id
    const slotSet = new Set(teamSlots.filter((s) => s.player_id === ownerId).map((s) => s.encounter_id))
    return alive.filter((e) => !slotSet.has(e.id))
  })()

  // Coach interpretation layer — the ONLY place natural-language coaching is produced.
  // Phase 3 swaps buildCoachReport() for a live LLM returning the same shape; the UI is ready.
  const coachLang = useSettings((s) => s.language)
  const coachReport = useMemo(() => buildCoachReport(guide, (t) => typeLabel(t, coachLang)), [guide, coachLang])

  const linkedIds = new Set(
    soulLinks.flatMap((l) => [l.encounter1_id, l.encounter2_id, l.encounter3_id]).filter(Boolean) as string[]
  )
  const pendingDeathLinkIds = new Set(
    pendingRequests.filter((r) => r.request_type === 'death' && r.soul_link_id).map((r) => r.soul_link_id as string)
  )

  // Encounters already part of a pending soul-link request (quick-link guard)
  const pendingLinkEncIds = new Set<string>()
  pendingRequests.forEach((r) => {
    if (r.request_type !== 'link') return
    if (r.encounter1_id) pendingLinkEncIds.add(r.encounter1_id)
    if (r.encounter2_id) pendingLinkEncIds.add(r.encounter2_id)
  })

  // ─ Scroll + flash a DOM target (used by the route checklist) ──────────────
  function flashTo(domId: string) {
    setHighlightId(domId)
    setTimeout(() => {
      document.getElementById(domId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
    setTimeout(() => setHighlightId((cur) => (cur === domId ? null : cur)), 2000)
  }

  // ─ Request resolution monitoring ─────────────────────────────────────────
  useEffect(() => {
    const prev = prevRequestsRef.current
    if (prev.length === 0 && allRequests.length > 0) { prevRequestsRef.current = allRequests; return }
    allRequests.forEach((r) => {
      if (r.requested_by_player_id !== myPlayerId) return
      if (r.status === 'pending') return
      const wasPending = prev.find((p) => p.id === r.id && p.status === 'pending')
      if (!wasPending) return
      if (r.status === 'accepted') {
        const msg =
          r.request_type === 'link'        ? '✓ Soul Link wurde akzeptiert!' :
          r.request_type === 'team_sync'   ? '✓ Team-Aufnahme wurde akzeptiert!' :
          r.request_type === 'team_remove' ? '✓ Pokémon wurde aus dem Hauptteam entfernt!' :
          r.request_type === 'team_move'   ? '✓ Pokémon wurde auf neuen Slot verschoben!' :
          r.request_type === 'revive'      ? '✓ Wiederbeleben wurde akzeptiert!' :
                                             '✓ Tod wurde bestätigt!'
        toast.show(msg, 'success')
        if (r.request_type === 'link') setShowSoulLink(false)
      } else {
        const msg =
          r.request_type === 'link'        ? 'Soul Link wurde abgelehnt.' :
          r.request_type === 'team_sync'   ? 'Team-Aufnahme wurde abgelehnt.' :
          r.request_type === 'team_remove' ? 'Entfernung wurde abgelehnt.' :
          r.request_type === 'team_move'   ? 'Slot-Wechsel wurde abgelehnt.' :
          r.request_type === 'revive'      ? 'Wiederbeleben wurde abgelehnt.' :
                                             'Tod wurde abgelehnt.'
        toast.show(msg, 'error')
        if (r.request_type === 'link') setShowSoulLink(false)
      }
    })
    prevRequestsRef.current = allRequests
  }, [allRequests, myPlayerId, toast])

  // ─ Partner activity notifications ────────────────────────────────────────
  useEffect(() => {
    const prev = prevActivityRef.current
    if (prev.length === 0 && activityLog.length > 0) { prevActivityRef.current = activityLog; return }
    activityLog.forEach((entry) => {
      if (entry.player_id === myPlayerId) return
      const isNew = !prev.find((p) => p.id === entry.id)
      if (isNew && prev.length > 0) {
        const type =
          entry.event_type === 'death_confirmed' || entry.event_type === 'pokemon_died' ? 'error' :
          entry.event_type === 'soul_link_created' || entry.event_type === 'pokemon_evolved' || entry.event_type === 'pokemon_revived' ? 'success' :
          'info'
        toast.show(entry.description, type)
      }
    })
    prevActivityRef.current = activityLog
  }, [activityLog, myPlayerId, toast])

  // ─ Direct URL navigation: load run ───────────────────────────────────────
  useEffect(() => {
    if (!runId || currentRun?.id === runId) return
    async function loadRun() {
      const { data: run } = await supabase.from('runs').select('*').eq('id', runId).single()
      const { data: runPlayers } = await supabase.from('players').select('*').eq('run_id', runId)
      if (run && runPlayers) {
        const ps = runPlayers as Player[]
        const bound = ps.find((p) => p.auth_user_id === user?.id)
        setCurrentRun(run as Run, ps, bound?.id ?? '')
      } else if (user) {
        // Run not found / not accessible → don't get stuck on "loading", go home.
        navigate('/', { replace: true })
      }
    }
    loadRun()
  }, [runId, currentRun?.id, setCurrentRun, user?.id, navigate])

  // ─ Helper functions ───────────────────────────────────────────────────────
  const groupOf = (encId: string) => groups.find((g) => g.members.some((m) => m.encounter.id === encId))

  function getLinkedEncounter(enc: Encounter): { enc: Encounter; playerName: string } | null {
    if (is3) {
      const g = groupOf(enc.id)
      const other = g?.members.find((m) => m.encounter.id !== enc.id)
      return other ? { enc: other.encounter, playerName: other.player?.name ?? '' } : null
    }
    for (const pair of pairs) {
      if (pair.encounter1.id === enc.id) return { enc: pair.encounter2, playerName: players.find((p) => p.id === pair.encounter2.player_id)?.name ?? '' }
      if (pair.encounter2.id === enc.id) return { enc: pair.encounter1, playerName: players.find((p) => p.id === pair.encounter1.player_id)?.name ?? '' }
    }
    return null
  }

  // 3-Spieler: Tod/Wiederbeleben wirkt direkt auf ALLE Mitglieder des Links
  // (keine Partner-Bestätigung; das 2-Spieler-Anfrage-System bleibt unverändert).
  async function handleTripleDeath(enc: Encounter) {
    const g = groupOf(enc.id)
    if (!g) { await updateStatus.mutateAsync({ id: enc.id, status: 'dead', runId: enc.run_id }); return }
    for (const m of g.members) {
      if (m.encounter.status !== 'dead') await updateStatus.mutateAsync({ id: m.encounter.id, status: 'dead', runId: enc.run_id })
    }
    toast.show('SoulLink besiegt – alle Pokémon im Link sind betroffen.', 'info')
  }
  async function handleTripleRevive(enc: Encounter) {
    const g = groupOf(enc.id)
    if (!g) { await updateStatus.mutateAsync({ id: enc.id, status: 'alive', runId: enc.run_id }); return }
    for (const m of g.members) {
      if (m.encounter.status === 'dead') await updateStatus.mutateAsync({ id: m.encounter.id, status: 'alive', runId: enc.run_id })
    }
  }

  function getLinkedInfo(enc: Encounter): { name: string; playerName: string } | undefined {
    const r = getLinkedEncounter(enc)
    return r ? { name: r.enc.nickname ?? r.enc.pokemon_name, playerName: r.playerName } : undefined
  }

  // A Pokémon may only enter the team if it has a confirmed (still-active) soul
  // link AND both partners are alive. Otherwise the team button/DnD is blocked.
  function getTeamEligibility(enc: Encounter): { eligible: boolean; reason?: string } {
    if (is3) {
      const g = groupOf(enc.id)
      if (!g) return { eligible: false, reason: 'Pokémon muss zuerst in einem SoulLink sein.' }
      if (!g.complete) return { eligible: false, reason: 'SoulLink ist noch unvollständig.' }
      if (g.members.some((m) => m.encounter.status !== 'alive')) return { eligible: false, reason: 'Alle Pokémon im Link müssen am Leben sein.' }
      return { eligible: true }
    }
    const link = getLinkedEncounter(enc)
    if (!link) return { eligible: false, reason: 'Pokémon muss zuerst mit dem Partner verlinkt werden.' }
    if (enc.status !== 'alive' || link.enc.status !== 'alive')
      return { eligible: false, reason: 'Beide Pokémon müssen am Leben sein.' }
    return { eligible: true }
  }

  function handleAddToTeam(enc: Encounter) {
    if (enc.player_id !== myPlayerId || enc.status === 'dead') return
    const elig = getTeamEligibility(enc)
    if (!elig.eligible) { toast.show(elig.reason ?? 'Nicht möglich', 'warning'); return }
    if (is3) {
      // 3-Spieler: direkt in den ersten freien Slot (kein Partner-Bestätigungs-Flow).
      const used = new Set(teamSlots.filter((s) => s.player_id === myPlayerId).map((s) => s.slot_position))
      const pos = [1, 2, 3, 4, 5, 6].find((p) => !used.has(p))
      if (!pos) { toast.show('Dein Team ist voll (6).', 'warning'); return }
      addToTeam.mutate({ runId: enc.run_id, playerId: myPlayerId!, encounterId: enc.id, slotPosition: pos, pokemonName: enc.nickname ?? enc.pokemon_name })
      return
    }
    setSlotPickerEncounter(enc)
  }

  async function handleDeathRequest(enc: Encounter) {
    const pair = pairs.find((p) => p.encounter1.id === enc.id || p.encounter2.id === enc.id)
    if (!pair || !myPlayerId) return
    const pp = players.find((p) => p.id !== myPlayerId)
    if (!pp) return
    try {
      await createRequest.mutateAsync({
        run_id: enc.run_id, request_type: 'death',
        requested_by_player_id: myPlayerId, target_player_id: pp.id,
        encounter1_id: null, encounter2_id: null,
        soul_link_id: pair.id, trigger_encounter_id: enc.id, route_match_type: null,
      })
      toast.show('Tod-Anfrage gesendet – warte auf Bestätigung', 'info')
    } catch { toast.show('Fehler beim Senden der Tod-Anfrage', 'error') }
  }

  async function handleReviveRequest(enc: Encounter) {
    const pair = pairs.find((p) => p.encounter1.id === enc.id || p.encounter2.id === enc.id)
    if (!pair || !myPlayerId) return
    const pp = players.find((p) => p.id !== myPlayerId)
    if (!pp) return
    const myEnc = pair.encounter1.player_id === myPlayerId ? pair.encounter1 : pair.encounter2
    const partnerEnc = pair.encounter1.player_id === myPlayerId ? pair.encounter2 : pair.encounter1
    try {
      await createRequest.mutateAsync({
        run_id: enc.run_id, request_type: 'revive',
        requested_by_player_id: myPlayerId, target_player_id: pp.id,
        encounter1_id: myEnc.id, encounter2_id: partnerEnc.id,
        soul_link_id: pair.id, trigger_encounter_id: enc.id, route_match_type: null,
      })
      toast.show('Wiederbeleben-Anfrage gesendet – warte auf Bestätigung', 'info')
    } catch { toast.show('Fehler beim Senden der Wiederbeleben-Anfrage', 'error') }
  }

  // Quick soul-link straight from the route checklist (uses the normal request flow)
  async function handleQuickSoulLink(a: Encounter, b: Encounter) {
    if (!myPlayerId) return
    const pp = players.find((p) => p.id !== myPlayerId)
    if (!pp) return
    const mine = a.player_id === myPlayerId ? a : b.player_id === myPlayerId ? b : null
    const partnerEnc = a.player_id === pp.id ? a : b.player_id === pp.id ? b : null
    if (!mine || !partnerEnc) { toast.show('Beide Spieler müssen ein Pokémon auf dieser Route haben.', 'warning'); return }
    const dup = pendingRequests.some((r) => r.request_type === 'link' &&
      ((r.encounter1_id === mine.id && r.encounter2_id === partnerEnc.id) ||
       (r.encounter1_id === partnerEnc.id && r.encounter2_id === mine.id)))
    if (dup) { toast.show('Es läuft bereits eine SoulLink-Anfrage für diese Route.', 'info'); return }
    try {
      await createRequest.mutateAsync({
        run_id: mine.run_id, request_type: 'link',
        requested_by_player_id: myPlayerId, target_player_id: pp.id,
        encounter1_id: mine.id, encounter2_id: partnerEnc.id,
        soul_link_id: null, trigger_encounter_id: mine.id, route_match_type: 'exact',
      })
      toast.show('SoulLink-Anfrage gesendet – Partner muss bestätigen', 'info')
    } catch { toast.show('Fehler beim Senden der SoulLink-Anfrage', 'error') }
  }

  async function copyShareCode() {
    if (!currentRun?.share_code) return
    await navigator.clipboard.writeText(currentRun.share_code)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  // Trust the URL: never render a run whose id ≠ the route param (the persisted
  // store may still hold the previous run — loadRun replaces it below).
  if (!currentRun || currentRun.id !== runId) {
    return (
      <div className="min-h-screen pokeball-bg flex items-center justify-center">
        <div className="text-slate-400 text-lg">Run wird geladen…</div>
      </div>
    )
  }

  // Logged in but not a member of this run → no access (only members see a run).
  if (user && players.length > 0 && !isMember) {
    return (
      <div className="min-h-screen pokeball-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center bg-[#1c1c26] border border-[#2e2e42] rounded-3xl p-8 shadow-2xl">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-white font-black text-xl mb-2">Kein Zugriff</h1>
          <p className="text-slate-400 text-sm mb-5">Du bist kein Mitglied dieses Runs. Tritt ihm über das Dashboard mit dem Run-Code bei.</p>
          <button onClick={() => navigate('/')} className="btn-primary w-full">Zum Dashboard</button>
        </div>
      </div>
    )
  }

  const myTeamCount = teamSlots.filter((s) => s.player_id === myPlayerId).length
  const partnerTeamCount = partnerPlayer ? teamSlots.filter((s) => s.player_id === partnerPlayer.id).length : 0

  // ─ Encounter card renderer (with optional DnD reorder wrapper) ────────────
  function renderEnc(enc: Encounter, compact: boolean) {
    const isMyEnc = enc.player_id === myPlayerId
    const isEditable = isMyFocus && isMyEnc
    const canDrag = isEditable && enc.status !== 'dead'
    const isHovered = dragOverEncId === enc.id
    const isFlashing = highlightId === `enc-${enc.id}`
    const elig = getTeamEligibility(enc)

    return (
      <div
        key={enc.id}
        id={`enc-${enc.id}`}
        draggable={canDrag}
        onDragStart={canDrag ? (e) => {
          // Only eligible (confirmed soul-link, both alive) Pokémon carry the
          // team payload — list reordering stays available either way.
          if (elig.eligible) e.dataTransfer.setData('text/encounter-id', enc.id)
          e.dataTransfer.setData('text/list-reorder-id', enc.id)
          e.dataTransfer.effectAllowed = 'move'
        } : undefined}
        onDragOver={isEditable ? (e) => {
          if (!e.dataTransfer.types.includes('text/list-reorder-id')) return
          e.preventDefault(); setDragOverEncId(enc.id)
        } : undefined}
        onDragLeave={isEditable ? () => setDragOverEncId(null) : undefined}
        onDragEnd={() => setDragOverEncId(null)}
        onDrop={isEditable ? (e) => {
          e.preventDefault(); setDragOverEncId(null)
          const draggedId = e.dataTransfer.getData('text/list-reorder-id')
          if (!draggedId || draggedId === enc.id) return
          const list = focusedEncounters
          const dragged = list.find((x) => x.id === draggedId)
          if (!dragged) return
          const without = list.filter((x) => x.id !== draggedId)
          const idx = without.findIndex((x) => x.id === enc.id)
          const newOrder = [...without.slice(0, idx), dragged, ...without.slice(idx)]
          reorderEncounters.mutate({ orderedIds: newOrder.map((x) => x.id), runId: currentRun!.id })
        } : undefined}
        className={`transition-all ${isFlashing ? 'route-flash' : ''} ${isHovered ? (compact ? 'ring-2 ring-pk-red ring-offset-1 ring-offset-[#11111a] rounded-2xl' : 'ring-2 ring-pk-red ring-offset-2 ring-offset-[#11111a] rounded-[20px]') : ''}`}
      >
        <EncounterCard
          encounter={enc}
          compact={compact}
          isLinked={linkedIds.has(enc.id)}
          isInTeam={teamEncounterIds.has(enc.id)}
          isMyEncounter={isEditable}
          linkedInfo={getLinkedInfo(enc)}
          teamEligible={elig.eligible}
          teamBlockReason={elig.reason}
          editionGame={currentRun?.game}
          statusAutoManaged={liveSyncMode && isLiveSynced(enc)}
          onClick={() => setSelectedEncounter(enc)}
          draggable={false}
          onAddToTeam={isEditable && enc.status !== 'dead' ? () => handleAddToTeam(enc) : undefined}
          onDeathRequest={isEditable && linkedIds.has(enc.id) ? () => (is3 ? handleTripleDeath(enc) : handleDeathRequest(enc)) : undefined}
          onReviveRequest={isEditable && linkedIds.has(enc.id) ? () => (is3 ? handleTripleRevive(enc) : handleReviveRequest(enc)) : undefined}
          onNavigateToPairs={() => setMainView('pairs')}
        />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ══ Fixed AAA atmosphere background (visual layer only — z-0) ═══════ */}
      <AtmosphereBackground />

      {/* ══ App shell ═════════════════════════════════════════════════════ */}
      <div className="relative z-10 min-h-screen flex flex-col">

        {/* ─ Sticky header ──────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 border-b border-white/5 backdrop-blur-2xl" style={{ background: 'rgba(17,17,22,0.92)' }}>
          <div className="w-full px-6 2xl:px-8">
            <div className="flex items-center justify-between py-3 gap-3">

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="text-slate-500 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-xl"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <PokeBall className="w-7 h-7 text-pk-red hidden sm:block" />
                <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white text-sm font-bold transition-colors">Zur Übersicht</button>
              </div>

              <div className="flex items-center gap-2">
                {pendingRequests.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl animate-pulse"
                    style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
                    <Zap className="w-3.5 h-3.5" />{pendingRequests.length} offen
                  </span>
                )}
                <button
                  onClick={copyShareCode}
                  className="flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-2 rounded-xl transition-all border"
                  style={{ background: '#1c1c26', borderColor: '#2e2e42', color: '#94a3b8' }}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {currentRun.share_code}
                </button>

                {/* Account menu (Profil · Meine Runs · Einstellungen · Abmelden) */}
                <UserMenu />
              </div>
            </div>
          </div>
        </header>

        {/* ─ Three-column layout — FULL width, TRUE proportions (≈18% / 60% / 22%). All
              tracks use `minmax(0, Nfr)` so the WHOLE width is split by ratio (a min-width
              floor would steal the base from the fr share and shrink the center — the bug
              that made the middle feel small and the left too wide). min-w-0 children +
              wrapping content prevent overflow. Below 2xl, safe fixed side columns. */}
        <div className="flex-1 w-full px-6 2xl:px-8 pt-6 pb-10">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_372px] gap-7 2xl:gap-8 items-start">

            {/* ░░ MAIN STAGE COLUMN — Inszenierung: Bühne → Team-Band → Konsole ░░ */}
            <main className="min-w-0 space-y-8">

              {/* Pending requests (only in my view) */}
              {isMyFocus && pendingRequests.length > 0 && myPlayerId && (
                <RequestsPanel requests={pendingRequests} myPlayerId={myPlayerId} />
              )}

              {/* ░░ HERO — der Mittelpunkt: „Weiterspielen" + Run-Puls. Glasfläche ÜBER dem
                    Hintergrund-Galerie-Bild (kein eigenes Bild), hebt sich durch Glow/Licht ab. ░░ */}
              {isMyFocus && (
                <section className="hero-glass anim-fade-up p-5 2xl:p-6">
                  {/* Eyebrow · Kino-Titel · Status · Run-Puls — kompakt */}
                  <div className="flex items-start justify-between gap-5 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-pk-red text-[10px] font-black uppercase tracking-[0.3em] mb-2">
                        <Zap className="w-3 h-3" /> Dein Abenteuer
                      </div>
                      {editingName ? (
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveRunName(); if (e.key === 'Escape') setEditingName(false) }} autoFocus maxLength={60} className="bg-[#16161f] border border-[#2e2e42] rounded-xl px-3 py-1.5 text-white font-black text-2xl outline-none focus:border-pk-red" />
                          <button onClick={saveRunName} disabled={savingName} className="text-sm font-bold px-3 py-2 rounded-lg" style={{ background: '#CC0000', color: '#fff' }}>{savingName ? '…' : 'Speichern'}</button>
                          <button onClick={() => setEditingName(false)} className="text-slate-500 hover:text-white p-1.5"><X className="w-5 h-5" /></button>
                        </div>
                      ) : (
                        <h1 className="text-white font-black text-3xl 2xl:text-[2.5rem] leading-[1.05] tracking-tight flex items-center gap-2.5 group">
                          <span className="truncate">{currentRun.name}</span>
                          {isOwner && (
                            <button onClick={() => { setNameDraft(currentRun.name); setEditingName(true) }} className="text-slate-600 hover:text-slate-300 transition-all opacity-0 group-hover:opacity-100 shrink-0" title="Run-Namen ändern"><Pencil className="w-4 h-4" /></button>
                          )}
                        </h1>
                      )}
                      <div className="flex items-center gap-2.5 mt-2 text-sm">
                        <button onClick={() => isOwner && setShowEditEdition(true)} className="font-bold text-slate-200 flex items-center gap-1.5 hover:text-white transition-colors">{currentRun.game}{isOwner && <Pencil className="w-3 h-3 text-slate-500" />}</button>
                        <span className="text-slate-600">·</span>
                        <button onClick={() => isMember && setShowModeModal(true)} className="font-bold flex items-center gap-2 transition-colors" style={{ color: liveSyncMode ? '#4ade80' : '#94a3b8' }}>
                          <span className={liveSyncMode ? 'ls-radar' : ''} style={{ width: 8, height: 8, borderRadius: 999, background: liveSyncMode ? '#4ade80' : '#64748b', display: 'inline-block' }} />
                          {liveSyncMode ? 'Live-Sync' : 'Manueller Tracker'}
                        </button>
                      </div>
                    </div>
                    <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
                      {[
                        { label: 'Team', value: `${myTeamCount}/6`, color: '#e2e8f0' },
                        { label: 'Gefangen', value: myEncounters.length, color: '#e2e8f0' },
                        { label: 'Am Leben', value: myEncounters.filter((e) => e.status === 'alive').length, color: '#4ade80' },
                        { label: 'SoulLinks', value: is3 ? groups.length : pairs.length, color: '#ff6b6b' },
                      ].map((s) => (
                        <div key={s.label} className="hero-stat rounded-xl px-3.5 py-2 text-center min-w-[74px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
                          <div className="font-black text-xl 2xl:text-2xl tabular-nums leading-none" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mt-1">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Kommando-Konsole: Live-Sync (Weiterspielen) ODER manuelle Haupt-Aktion */}
                  {liveSyncMode && LIVE_SURFACE ? (
                    <>
                      <EmulatorLivePanel
                        game={currentRun.game}
                        runId={currentRun.id}
                        importedSpeciesIds={myEncounterSpeciesIds}
                        importedPids={myEncounterPids}
                        onImport={(p, route) => { setEmuPrefill(p); setAddEncounterRoute(route); setShowAddEncounter(true) }}
                        compact
                      />
                      <div className="flex flex-wrap gap-3 mt-4">
                        <button onClick={() => { setAddEncounterRoute(undefined); setShowAddEncounter(true) }} className="btn-primary flex items-center gap-2 py-3 px-5 text-sm">
                          <Plus className="w-4 h-4" /> Encounter hinzufügen
                        </button>
                        <button onClick={() => setShowSoulLink(true)} className="btn-ghost flex items-center gap-2 py-3 px-5 text-sm">
                          <Link2 className="w-4 h-4" /> Pokémon verlinken
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {liveSyncMode && !LIVE_SURFACE && (
                        <div className="flex items-center gap-4 flex-wrap rounded-2xl p-4 mb-5" style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(204,0,0,0.28)' }}>
                          <div className="min-w-0 flex-1">
                            <div className="text-white font-black text-base">Browser-Tracker (manuell)</div>
                            <div className="text-slate-400 text-sm mt-0.5">Für automatischen Live-Sync mit BizHawk brauchst du den Companion.</div>
                          </div>
                          <a href={LINKS.download} className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm text-white" style={{ background: '#CC0000' }}>Companion holen</a>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <button onClick={() => { setAddEncounterRoute(undefined); setShowAddEncounter(true) }} className="hero-cta inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-base text-white">
                          <Plus className="w-5 h-5" /> Encounter hinzufügen
                        </button>
                        <button onClick={() => setShowSoulLink(true)} className="btn-ghost flex items-center gap-2.5 py-3 px-6 text-sm">
                          <Link2 className="w-5 h-5" /> Pokémon verlinken
                        </button>
                      </div>
                    </>
                  )}

                  {/* SoulGuide preview in the hero — one coach line, opens the full SoulGuide */}
                  <HeroCoachStrip headline={coachReport.headline} onOpen={() => setMainView('soulguide')} />
                </section>
              )}

              {/* Mein Team — 3-Spieler nutzt das Slot-Band; 2-Spieler zeigt das Live-Team
                    (die einzige Team-Anzeige) unten in TeamOverview. Keine Doppelung mehr. */}
              {is3 && (
                <div>
                  <SectionLabel label="Mein Team" sub={`${teamSlots.length} Pokémon`} />
                  <TeamPanel3
                    runId={currentRun.id}
                    players={players}
                    myPlayerId={myPlayerId ?? ''}
                    maxPlayers={maxPlayers}
                    encounters={encounters as Encounter[]}
                    groups={groups}
                    onSelectEncounter={(enc) => setSelectedEncounter(enc)}
                  />
                </div>
              )}

              {/* Partner-view banner */}
              {!isMyFocus && (
                <div className="flex items-center gap-3 rounded-2xl px-4 py-3 border anim-fade-up"
                  style={{ borderColor: 'rgba(255,203,5,0.4)', background: 'rgba(255,203,5,0.08)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,203,5,0.15)' }}>
                    <Eye className="w-5 h-5 text-pk-yellow" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-pk-yellow font-black text-sm flex items-center gap-1.5">
                      Partner-Ansicht — {focusedPlayer?.name ?? 'Partner'}
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-pk-yellow/70 text-xs">Nur Ansicht · Read-only · keine Bearbeitung möglich</div>
                  </div>
                  <button
                    onClick={() => setFocusedPlayerId(myPlayerId ?? null)}
                    className="text-xs font-bold px-3 py-2 rounded-xl transition-all shrink-0"
                    style={{ background: 'rgba(204,0,0,0.12)', color: '#CC0000', border: '1px solid rgba(204,0,0,0.3)' }}
                  >
                    Zurück zu mir
                  </button>
                </div>
              )}

              {/* Mein Team (live) + Partner-Team — 2-Spieler. Box/Besiegt leben im Box-Tab. */}
              {isMyFocus && !is3 && (
                <TeamOverview
                  myEncounters={myEncounters}
                  partnerEncounters={partnerEncounters}
                  teamSlots={teamSlots}
                  players={players}
                  myPlayerId={myPlayerId ?? ''}
                  game={currentRun.game}
                  onSelectEncounter={(e) => setSelectedEncounter(e)}
                  onImport={(p, route) => { setEmuPrefill(p); setAddEncounterRoute(route); setShowAddEncounter(true) }}
                />
              )}

              {/* Focus-dependent block (framed yellow when viewing partner) */}
              <div className={`space-y-5 ${!isMyFocus ? 'partner-frame p-4 lg:p-5' : ''}`}>
                {/* Workspace — Tabs: alternative Sichten auf den Run, eine nach der anderen */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex flex-1 min-w-0 rounded-2xl p-1.5 gap-1.5" style={{ background: 'rgba(20,20,30,0.7)', border: '1px solid #2e2e42' }}>
                    {([
                      { key: 'encounters', icon: <LayoutGrid className="w-4 h-4" />, label: isMyFocus ? 'Encounter' : (focusedPlayer?.name ?? 'Partner'), count: focusedEncounters.length },
                      { key: 'pairs', icon: <Link2 className="w-4 h-4" />, label: 'SoulLinks', count: is3 ? groups.length : pairs.length },
                      { key: 'box', icon: <Archive className="w-4 h-4" />, label: 'Box', count: focusedBox.length },
                      { key: 'story', icon: <BookOpen className="w-4 h-4" />, label: 'Story', count: null },
                      { key: 'soulguide', icon: <Sparkles className="w-4 h-4" />, label: 'SoulGuide', count: null },
                    ] as const).map((t) => {
                      const active = mainView === t.key
                      return (
                        <button
                          key={t.key}
                          onClick={() => setMainView(t.key)}
                          className="flex-1 min-w-0 py-2.5 px-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-1.5"
                          style={active
                            ? { background: 'linear-gradient(135deg,#e00018,#9c0014)', color: 'white', boxShadow: '0 8px 24px -12px rgba(204,0,0,0.7)' }
                            : { color: '#94a3b8' }}
                        >
                          {t.icon}<span className="truncate">{t.label}</span>
                          {t.count != null && <span className="opacity-70 tabular-nums">({t.count})</span>}
                        </button>
                      )
                    })}
                  </div>

                  {!isMyFocus && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1"
                      style={{ background: 'rgba(255,203,5,0.1)', color: '#FFCB05', border: '1px solid rgba(255,203,5,0.25)' }}>
                      <Lock className="w-2.5 h-2.5" /> Read-only
                    </span>
                  )}

                  {mainView === 'encounters' && (
                    <div className="flex rounded-xl p-1 shrink-0" style={{ background: '#1c1c26', border: '1px solid #2e2e42' }}>
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'text-white bg-white/10' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'text-white bg-white/10' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* ENCOUNTERS view */}
                {mainView === 'encounters' && (
                  focusedEncounters.length === 0 ? (
                    <EmptyState
                      icon={<Plus className="w-12 h-12" />}
                      title="Noch keine Encounters"
                      desc={isMyFocus
                        ? "Klicke auf 'Encounter hinzufügen' um dein erstes Pokémon zu loggen."
                        : "Dieser Spieler hat noch keine Encounters."}
                    />
                  ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {focusedEncounters.map((enc) => renderEnc(enc, false))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {focusedEncounters.map((enc) => renderEnc(enc, true))}
                    </div>
                  )
                )}

                {/* BOX view — live-derived: alive & not in the team (updates instantly with the
                    emulator party), plus a Besiegt section. Same card design as the team. */}
                {mainView === 'box' && (
                  (focusedBox.length === 0 && focusedDead.length === 0) ? (
                    <EmptyState
                      icon={<Archive className="w-12 h-12" />}
                      title="Box ist leer"
                      desc="Lebende Pokémon außerhalb deines Teams erscheinen hier automatisch — live aus dem Emulator."
                    />
                  ) : (
                    <div className="space-y-7">
                      {focusedBox.length > 0 && (
                        <div>
                          <SectionLabel label="In Box" sub={`${focusedBox.length} Pokémon`} />
                          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
                            {focusedBox.map((e) => <RunMonCard key={e.id} enc={e} onClick={() => setSelectedEncounter(e)} />)}
                          </div>
                        </div>
                      )}
                      {focusedDead.length > 0 && (
                        <div>
                          <SectionLabel label="Besiegt" sub={`${focusedDead.length} Pokémon`} />
                          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
                            {focusedDead.map((e) => <RunMonCard key={e.id} enc={e} onClick={() => setSelectedEncounter(e)} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* STORY GUIDE view */}
                {mainView === 'story' && (
                  <StoryGuide runGame={currentRun?.game ?? null} caughtLocations={storyCaughtLocations} />
                )}

                {/* SOULGUIDE view — the ONE analysis surface (score, recommendations, balance,
                    roles, coverage, type analysis, arena prep, box picks, SoulLinks, types …) */}
                {mainView === 'soulguide' && (
                  <SoulGuidePanel data={guide} report={coachReport} onSelectEncounter={(enc) => setSelectedEncounter(enc)} />
                )}

                {/* PAIRS view */}
                {mainView === 'pairs' && (
                  <div className="space-y-4">
                    {is3 ? (
                      groups.length === 0 ? (
                        <EmptyState
                          icon={<Link2 className="w-12 h-12" />}
                          title="Noch keine Soul Links"
                          desc="Verlinke Pokémon aus bis zu 3 Spielern zu einem gemeinsamen 3er-SoulLink."
                        />
                      ) : (
                        groups.map((g) => (
                          <SoulLinkTripleCard
                            key={g.id}
                            group={g}
                            players={players}
                            myPlayerId={myPlayerId ?? ''}
                            onSelectEncounter={(encId) => { const e = (encounters as Encounter[]).find((x) => x.id === encId); if (e) setSelectedEncounter(e) }}
                            onDelete={isMyFocus ? () => deleteSoulLink.mutate({ id: g.id, runId: currentRun.id, enc1Name: g.members[0]?.encounter.nickname ?? g.members[0]?.encounter.pokemon_name, enc2Name: g.members[1]?.encounter.nickname ?? g.members[1]?.encounter.pokemon_name }) : undefined}
                          />
                        ))
                      )
                    ) : pairs.length === 0 ? (
                      <EmptyState
                        icon={<Link2 className="w-12 h-12" />}
                        title="Noch keine Soul Links"
                        desc="Füge Encounters für beide Spieler hinzu und verlinke dann ihre Pokémon."
                      />
                    ) : (
                      pairs.map((pair) => (
                        <div key={pair.id} id={`pair-${pair.id}`} className={highlightId === `pair-${pair.id}` ? 'route-flash rounded-[22px]' : ''}>
                          <SoulLinkPairCard
                            pair={pair}
                            myPlayerId={myPlayerId ?? ''}
                            players={players}
                            hasPendingDeathRequest={pendingDeathLinkIds.has(pair.id)}
                            teamEncounterIds={teamEncounterIds}
                            onSelectEncounter={(enc) => setSelectedEncounter(enc)}
                          />
                        </div>
                      ))
                    )}

                    {/* Unlinked in pairs view */}
                    {encounters.filter((e) => !linkedIds.has(e.id)).length > 0 && (
                      <div className="mt-8">
                        <SectionLabel label="Nicht verlinkt" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {encounters.filter((e) => !linkedIds.has(e.id)).map((e) => (
                            <EncounterCard
                              key={e.id}
                              encounter={e as Encounter}
                              compact
                              isMyEncounter={(e as Encounter).player_id === myPlayerId}
                              isInTeam={teamEncounterIds.has(e.id)}
                              teamEligible={false}
                              teamBlockReason="Pokémon muss zuerst mit dem Partner verlinkt werden."
                              editionGame={currentRun?.game}
                              onClick={() => setSelectedEncounter(e as Encounter)}
                              draggable={false}
                              onAddToTeam={
                                e.status !== 'dead' && (e as Encounter).player_id === myPlayerId
                                  ? () => handleAddToTeam(e as Encounter)
                                  : undefined
                              }
                              onNavigateToPairs={() => {}}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>

            {/* ░░ DOCK — schlanke, dauerhaft sichtbare Info-Leiste. Begleitet das Spiel,
                  konkurriert aber nie mit der Mitte: Spieler · Checkliste · Protokoll · Coach ░░ */}
            <aside className="min-w-0 xl:sticky xl:top-[4.75rem] xl:max-h-[calc(100vh_-_5.5rem)] xl:overflow-y-auto space-y-4 anim-fade-up delay-2">

              {/* Spieler */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
                <PlayerStatCard player={myPlayer} isMe isActive={isMyFocus} encounters={myEncounters} pairs={pairs} teamCount={myTeamCount} avatarUrl={avatarOf(myPlayer)} onClick={() => setFocusedPlayerId(myPlayerId ?? null)} />
                <PlayerStatCard player={partnerPlayer} isMe={false} isActive={!isMyFocus} encounters={partnerEncounters} pairs={pairs} teamCount={partnerTeamCount} avatarUrl={avatarOf(partnerPlayer)} onClick={() => setFocusedPlayerId(partnerPlayer?.id ?? null)} />
              </div>
              <PlayersPanel
                players={players}
                maxPlayers={maxPlayers}
                myPlayerId={myPlayerId ?? ''}
                ownerUserId={currentRun.owner_user_id}
                online={onlinePlayers}
                avatars={memberAvatars}
              />

              {/* Encounter-Checkliste */}
              {is3 ? (
                <RouteChecklist3
                  game={currentRun.game}
                  encounters={encounters as Encounter[]}
                  players={players}
                  myPlayerId={myPlayerId ?? ''}
                  maxPlayers={maxPlayers}
                  soulLinkGroups={groups}
                  onOpenAddForRoute={(route) => { setAddEncounterRoute(route); setShowAddEncounter(true) }}
                  onScrollToEncounter={(enc) => { setFocusedPlayerId(enc.player_id); setMainView('encounters'); flashTo(`enc-${enc.id}`) }}
                  onJumpToPair={() => setMainView('pairs')}
                  collapsible
                  defaultOpen
                />
              ) : (
                <RouteChecklist
                  game={currentRun.game}
                  encounters={encounters as Encounter[]}
                  players={players}
                  myPlayerId={myPlayerId ?? ''}
                  soulLinkPairs={pairs}
                  onOpenAddForRoute={(route) => { setAddEncounterRoute(route); setShowAddEncounter(true) }}
                  onScrollToEncounter={(enc) => {
                    setFocusedPlayerId(enc.player_id)
                    setMainView('encounters')
                    flashTo(`enc-${enc.id}`)
                  }}
                  onJumpToPair={(pairId) => { setMainView('pairs'); flashTo(`pair-${pairId}`) }}
                  onRequestSoulLink={handleQuickSoulLink}
                  pendingLinkEncIds={pendingLinkEncIds}
                  readOnly={!isMyFocus}
                  collapsible
                  defaultOpen
                />
              )}

              {/* Run-Protokoll */}
              {myPlayerId && (
                <ActivityFeed runId={currentRun.id} players={players} myPlayerId={myPlayerId} collapsible defaultOpen />
              )}

              {/* SoulGuide — kleine Vorschau; öffnet den einzigen Analyseort (SoulGuide-Tab) */}
              <SoulGuidePreview data={guide} report={coachReport} onOpen={() => setMainView('soulguide')} />
            </aside>

          </div>
        </div>
      </div>

      {/* Invisible: keeps emulator-imported encounters in sync by stable PID (evolution etc.).
          Mounts only when a sync backend is reachable (dev plugin, or online Companion). */}
      {myPlayerId && liveSyncMode && LIVE_SURFACE && companion.status === 'connected' && (
        <EmulatorReconciler encounters={myEncounters} runId={currentRun.id} />
      )}

      {/* ══ Modals ════════════════════════════════════════════════════════ */}
      {showModeModal && (
        <ChangeModeModal current={runMode} onApply={applyMode} onClose={() => setShowModeModal(false)} />
      )}
      {showEditEdition && (
        <ChangeEditionModal
          currentGame={currentRun.game}
          busy={savingEdition}
          onConfirm={changeEdition}
          onCancel={() => setShowEditEdition(false)}
        />
      )}
      {showAddEncounter && myPlayer && (
        <AddEncounterModal
          runId={currentRun.id} player={myPlayer} game={currentRun.game}
          defaultRoute={addEncounterRoute}
          prefill={emuPrefill}
          myEncounters={myEncounters}
          onOpenExisting={(enc) => setSelectedEncounter(enc)}
          onClose={() => { setShowAddEncounter(false); setAddEncounterRoute(undefined); setEmuPrefill(undefined) }}
        />
      )}
      {showSoulLink && myPlayerId && (
        is3 ? (
          <SoulLink3Modal
            runId={currentRun.id} players={players} maxPlayers={maxPlayers}
            encounters={encounters as Encounter[]} linkedIds={linkedIds}
            onClose={() => setShowSoulLink(false)}
          />
        ) : (
          <SoulLinkModal
            runId={currentRun.id} game={currentRun.game} players={players}
            myPlayerId={myPlayerId} encounters={encounters as Encounter[]}
            linkedIds={linkedIds} onClose={() => setShowSoulLink(false)}
          />
        )
      )}
      {selectedEncounter && (
        <PokemonDetailModal
          encounter={selectedEncounter}
          linkedEncounter={getLinkedEncounter(selectedEncounter)?.enc ?? null}
          linkedPlayerName={getLinkedEncounter(selectedEncounter)?.playerName}
          myEncounter={selectedEncounter.player_id === myPlayerId}
          onClose={() => setSelectedEncounter(null)}
        />
      )}
      {slotPickerEncounter && myPlayerId && (
        <SlotPickerModal
          encounter={slotPickerEncounter}
          teamSlots={teamSlots}
          encounters={encounters as Encounter[]}
          soulLinkPairs={pairs}
          runId={currentRun.id}
          myPlayerId={myPlayerId}
          players={players}
          onClose={() => setSlotPickerEncounter(null)}
        />
      )}
      <QuickLook />
    </>
  )
}
