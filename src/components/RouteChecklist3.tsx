import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ListChecks, Plus } from 'lucide-react'
import { getRoutesForGame } from '../lib/routes'
import { getSpriteUrl } from '../lib/pokemon-api'
import type { Encounter, Player, SoulLinkGroup } from '../types/database'

// Encounter checklist for 3-player runs: one line per player slot (1..maxPlayers)
// with "verlinkt / nicht verlinkt / besiegt" derived from the 3er-SoulLink groups.
// Separate from the 2-player RouteChecklist so that flow stays untouched.

type RouteState = 'open' | 'partial' | 'full' | 'linked' | 'dead'
const STATE_CFG: Record<RouteState, { icon: string; label: string; color: string }> = {
  open:    { icon: '⬜', label: 'Offen',          color: '#64748b' },
  partial: { icon: '🟡', label: 'Unvollständig',  color: '#fbbf24' },
  full:    { icon: '✅', label: 'Alle Encounter', color: '#4ade80' },
  linked:  { icon: '🔗', label: 'SoulLink aktiv', color: '#CC0000' },
  dead:    { icon: '☠️', label: 'SoulLink tot',   color: '#f87171' },
}

interface SlotInfo { n: number; player?: Player; encs: Encounter[] }
interface RouteInfo { route: string; slots: SlotInfo[]; state: RouteState; group?: SoulLinkGroup; firstEnc: Encounter | null; hasDup: boolean; totalCount: number }

export default function RouteChecklist3({
  game, encounters, players, myPlayerId, maxPlayers, soulLinkGroups,
  onOpenAddForRoute, onScrollToEncounter, onJumpToPair, collapsible = true, defaultOpen = true,
}: {
  game: string
  encounters: Encounter[]
  players: Player[]
  myPlayerId: string
  maxPlayers: number
  soulLinkGroups: SoulLinkGroup[]
  onOpenAddForRoute: (route: string) => void
  onScrollToEncounter: (enc: Encounter) => void
  onJumpToPair: (groupId: string) => void
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const slotNums = Array.from({ length: Math.max(2, Math.min(3, maxPlayers)) }, (_, i) => i + 1)

  const officialRoutes = useMemo(() => getRoutesForGame(game).filter((r) => r !== 'Eigene Route...'), [game])

  const buildInfo = (route: string): RouteInfo => {
    const here = encounters.filter((e) => e.location === route)
    const slots: SlotInfo[] = slotNums.map((n) => {
      const player = players.find((p) => p.player_number === n)
      const encs = player ? here.filter((e) => e.player_id === player.id) : []
      return { n, player, encs }
    })
    const group = soulLinkGroups.find((g) => g.members.some((m) => m.encounter.location === route))
    const presentSlots = slots.filter((s) => s.encs.length > 0).length
    const joinedSlots = slots.filter((s) => s.player).length
    let state: RouteState
    if (group) state = group.anyDead ? 'dead' : 'linked'
    else if (presentSlots > 0 && presentSlots === joinedSlots && joinedSlots > 0) state = 'full'
    else if (presentSlots > 0) state = 'partial'
    else state = 'open'
    const hasDup = slots.some((s) => s.encs.length > 1)
    const totalCount = slots.reduce((a, s) => a + s.encs.length, 0)
    return { route, slots, state, group, firstEnc: here[0] ?? null, hasDup, totalCount }
  }

  const officialInfos = useMemo(() => officialRoutes.map(buildInfo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [officialRoutes, encounters, soulLinkGroups, players])
  const customInfos = useMemo(() => {
    const official = new Set(officialRoutes)
    const customs = new Set<string>()
    encounters.forEach((e) => { if (e.location && !official.has(e.location)) customs.add(e.location) })
    return [...customs].map(buildInfo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounters, officialRoutes, soulLinkGroups, players])

  const doneCount = officialInfos.filter((i) => i.state === 'full' || i.state === 'linked' || i.state === 'dead').length

  function handleClick(info: RouteInfo) {
    if (info.group) { onJumpToPair(info.group.id); return }
    const mine = info.slots.find((s) => s.player?.id === myPlayerId)?.encs[0] ?? null
    const target = mine ?? info.firstEnc
    if (target) onScrollToEncounter(target)
    else onOpenAddForRoute(info.route)
  }

  function renderRow(info: RouteInfo) {
    const cfg = STATE_CFG[info.state]
    const hasAny = info.slots.some((s) => s.encs.length > 0)
    return (
      <div key={info.route} role="button" tabIndex={0}
        onClick={() => handleClick(info)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(info) } }}
        className="w-full text-left px-3 py-2 rounded-xl border transition-all hover:border-slate-500 hover:bg-white/5 cursor-pointer"
        style={{
          background: info.state === 'open' ? 'transparent' : '#16161f',
          borderColor: info.hasDup ? 'rgba(251,191,36,0.4)' : info.state === 'open' ? 'rgba(46,46,66,0.5)' : `${cfg.color}33`,
        }}>
        <div className="flex items-center gap-2">
          <span className="text-sm leading-none">{info.hasDup ? '⚠️' : cfg.icon}</span>
          <span className={`flex-1 text-xs font-bold truncate ${info.state === 'open' ? 'text-slate-500' : 'text-slate-100'}`}>
            {info.route}
            {info.hasDup && <span className="ml-1.5 text-[9px] font-black px-1 py-0.5 rounded" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.15)' }}>{info.totalCount} Encounters</span>}
          </span>
          {info.state === 'open'
            ? <Plus className="w-3 h-3 text-slate-600 shrink-0" />
            : <span className="text-[9px] font-bold shrink-0" style={{ color: info.hasDup ? '#fbbf24' : cfg.color }}>{info.hasDup ? 'Mehrfach' : cfg.label}</span>}
        </div>

        {(hasAny || info.group) && (
          <div className="mt-1.5 pl-6 space-y-0.5">
            {info.slots.map((s) => (
              <div key={s.n} className="min-w-0">
                {s.encs.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="font-bold shrink-0" style={{ color: s.player?.id === myPlayerId ? '#CC0000' : '#94a3b8' }}>{s.player?.name ?? `Spieler ${s.n}`}:</span>
                    <span className="text-slate-600 italic">fehlt</span>
                  </div>
                ) : s.encs.map((enc, ei) => (
                  <div key={enc.id} className="flex items-center gap-1.5 text-[10px] min-w-0">
                    {ei === 0
                      ? <span className="font-bold shrink-0" style={{ color: s.player?.id === myPlayerId ? '#CC0000' : '#94a3b8' }}>{s.player?.name ?? `Spieler ${s.n}`}:</span>
                      : <span className="shrink-0 text-yellow-600">↳</span>}
                    <span className={`flex items-center gap-1 capitalize truncate ${enc.status === 'dead' ? 'text-red-400 line-through' : 'text-slate-300'}`}>
                      {enc.pokemon_id && <img src={getSpriteUrl(enc.pokemon_id)} alt="" className="w-4 h-4 object-contain shrink-0" />}
                      {enc.nickname ?? enc.pokemon_name}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#2e2e42] overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-3 ${collapsible ? 'cursor-pointer hover:bg-white/3 transition-colors' : ''}`}
        style={{ background: '#1c1c26' }} onClick={collapsible ? () => setOpen((v) => !v) : undefined}>
        <div className="flex items-center gap-2">
          <ListChecks className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-200 text-xs font-black uppercase tracking-widest">Encounter-Checkliste</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-600 text-[10px] tabular-nums">{doneCount}/{officialInfos.length}</span>
          {collapsible && (open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />)}
        </div>
      </div>
      {open && (
        <div className="p-2.5 space-y-1.5 overflow-y-auto" style={{ background: '#161620', maxHeight: '540px' }}>
          {officialInfos.map(renderRow)}
          {customInfos.length > 0 && (
            <>
              <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest px-1 pt-3 pb-1">Eigene Routen</div>
              {customInfos.map(renderRow)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
