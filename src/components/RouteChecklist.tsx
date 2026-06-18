import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ListChecks, Plus, Link2, Clock } from 'lucide-react'
import { getRoutesForGame } from '../lib/routes'
import { getSpriteUrl } from '../lib/pokemon-api'
import type { Encounter, Player, SoulLinkPair } from '../types/database'

type RouteState = 'open' | 'partial' | 'both' | 'linked' | 'dead'

const STATE_CFG: Record<RouteState, { icon: string; label: string; color: string }> = {
  open:    { icon: '⬜', label: 'Offen',          color: '#64748b' },
  partial: { icon: '🟡', label: 'Unvollständig',  color: '#fbbf24' },
  both:    { icon: '✅', label: 'Beide Encounter', color: '#4ade80' },
  linked:  { icon: '🔗', label: 'SoulLink aktiv', color: '#CC0000' },
  dead:    { icon: '☠️', label: 'SoulLink tot',   color: '#f87171' },
}

interface RouteInfo {
  route: string
  state: RouteState
  p1Enc: Encounter | null
  p2Enc: Encounter | null
  p1All: Encounter[]
  p2All: Encounter[]
  pair: SoulLinkPair | null
}

interface Props {
  game: string
  encounters: Encounter[]
  players: Player[]
  myPlayerId: string
  soulLinkPairs: SoulLinkPair[]
  /** Open the add-encounter modal with the route pre-filled. */
  onOpenAddForRoute: (route: string) => void
  /** Scroll the main column to (and flash) an existing encounter. */
  onScrollToEncounter: (enc: Encounter) => void
  /** Jump to the soul-link pairs view and flash a pair. */
  onJumpToPair: (pairId: string) => void
  /** Create a soul-link request for two same-route encounters. */
  onRequestSoulLink?: (a: Encounter, b: Encounter) => void
  /** Encounter ids that already have a pending link request. */
  pendingLinkEncIds?: Set<string>
  /** Partner view → quick-link is shown only as a disabled hint. */
  readOnly?: boolean
  collapsible?: boolean
  defaultOpen?: boolean
}

export default function RouteChecklist({
  game, encounters, players, myPlayerId, soulLinkPairs,
  onOpenAddForRoute, onScrollToEncounter, onJumpToPair,
  onRequestSoulLink, pendingLinkEncIds, readOnly = false,
  collapsible = true, defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const p1 = players[0]
  const p2 = players[1]

  const officialRoutes = useMemo(
    () => getRoutesForGame(game).filter((r) => r !== 'Eigene Route...'),
    [game]
  )

  const buildInfo = (route: string): RouteInfo => {
    const here = encounters.filter((e) => e.location === route)
    const p1All = p1 ? here.filter((e) => e.player_id === p1.id) : []
    const p2All = p2 ? here.filter((e) => e.player_id === p2.id) : []
    const p1Enc = p1All[0] ?? null
    const p2Enc = p2All[0] ?? null
    const pair = soulLinkPairs.find(
      (pr) => pr.location === route || pr.encounter1.location === route || pr.encounter2.location === route
    ) ?? null

    let state: RouteState
    if (pair) {
      state = pair.encounter1.status === 'dead' || pair.encounter2.status === 'dead' ? 'dead' : 'linked'
    } else if (p1Enc && p2Enc) state = 'both'
    else if (p1Enc || p2Enc) state = 'partial'
    else state = 'open'

    return { route, state, p1Enc, p2Enc, p1All, p2All, pair }
  }

  const officialInfos = useMemo(
    () => officialRoutes.map(buildInfo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [officialRoutes, encounters, soulLinkPairs, players]
  )

  // Custom routes = any encounter location not part of the official set.
  const customInfos = useMemo(() => {
    const official = new Set(officialRoutes)
    const customs = new Set<string>()
    encounters.forEach((e) => {
      if (e.location && !official.has(e.location)) customs.add(e.location)
    })
    return [...customs].map(buildInfo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounters, officialRoutes, soulLinkPairs, players])

  const doneCount = officialInfos.filter(
    (i) => i.state === 'both' || i.state === 'linked' || i.state === 'dead'
  ).length

  function handleClick(info: RouteInfo) {
    if (info.pair) { onJumpToPair(info.pair.id); return }
    const mine =
      (info.p1Enc?.player_id === myPlayerId ? info.p1Enc : null) ??
      (info.p2Enc?.player_id === myPlayerId ? info.p2Enc : null)
    const target = mine ?? info.p1Enc ?? info.p2Enc
    if (target) onScrollToEncounter(target)
    else onOpenAddForRoute(info.route)
  }

  function renderRow(info: RouteInfo) {
    const cfg = STATE_CFG[info.state]
    const hasAny = !!(info.p1Enc || info.p2Enc)
    const bothAlive = !!(info.p1Enc && info.p2Enc && info.p1Enc.status === 'alive' && info.p2Enc.status === 'alive')
    const canQuickLink = info.state === 'both' && bothAlive && !!onRequestSoulLink
    const pending = !!(pendingLinkEncIds && info.p1Enc && info.p2Enc &&
      (pendingLinkEncIds.has(info.p1Enc.id) || pendingLinkEncIds.has(info.p2Enc.id)))
    const totalCount = info.p1All.length + info.p2All.length
    const hasDup = info.p1All.length > 1 || info.p2All.length > 1

    return (
      <div
        key={info.route}
        role="button"
        tabIndex={0}
        onClick={() => handleClick(info)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(info) } }}
        className="w-full text-left px-3 py-2 rounded-xl border transition-all hover:border-slate-500 hover:bg-white/5 cursor-pointer"
        style={{
          background: info.state === 'open' ? 'transparent' : '#16161f',
          borderColor: hasDup ? 'rgba(251,191,36,0.4)' : info.state === 'open' ? 'rgba(46,46,66,0.5)' : `${cfg.color}33`,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm leading-none">{hasDup ? '⚠️' : cfg.icon}</span>
          <span className={`flex-1 text-xs font-bold truncate ${info.state === 'open' ? 'text-slate-500' : 'text-slate-100'}`}>
            {info.route}
            {hasDup && (
              <span className="ml-1.5 text-[9px] font-black px-1 py-0.5 rounded" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.15)' }}>
                {totalCount} Encounters
              </span>
            )}
          </span>
          {info.state === 'open'
            ? <Plus className="w-3 h-3 text-slate-600 shrink-0" />
            : <span className="text-[9px] font-bold shrink-0" style={{ color: hasDup ? '#fbbf24' : cfg.color }}>{hasDup ? 'Mehrfach' : cfg.label}</span>}
        </div>

        {hasAny && (
          <div className="mt-1.5 pl-6 space-y-0.5">
            {[{ pl: p1, encs: info.p1All }, { pl: p2, encs: info.p2All }].map(({ pl, encs }, idx) =>
              pl ? (
                <div key={idx} className="min-w-0">
                  {encs.length === 0 ? (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="font-bold shrink-0" style={{ color: pl.id === myPlayerId ? '#CC0000' : '#94a3b8' }}>{pl.name}:</span>
                      <span className="text-slate-600 italic">fehlt</span>
                    </div>
                  ) : encs.map((enc, ei) => (
                    <div key={enc.id} className="flex items-center gap-1.5 text-[10px] min-w-0">
                      {ei === 0
                        ? <span className="font-bold shrink-0" style={{ color: pl.id === myPlayerId ? '#CC0000' : '#94a3b8' }}>{pl.name}:</span>
                        : <span className="shrink-0 text-yellow-600">↳</span>}
                      <span className={`flex items-center gap-1 capitalize truncate ${enc.status === 'dead' ? 'text-red-400 line-through' : 'text-slate-300'}`}>
                        {enc.pokemon_id && <img src={getSpriteUrl(enc.pokemon_id)} alt="" className="w-4 h-4 object-contain shrink-0" />}
                        {enc.nickname ?? enc.pokemon_name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null
            )}
          </div>
        )}

        {/* Quick SoulLink */}
        {canQuickLink && (
          pending ? (
            <div className="mt-2 ml-6 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
              style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <Clock className="w-3 h-3" /> Anfrage läuft…
            </div>
          ) : readOnly ? (
            <div className="mt-2 ml-6 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg opacity-60"
              style={{ color: '#64748b', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.25)' }}
              title="Nur in deiner eigenen Ansicht möglich">
              <Link2 className="w-3 h-3" /> SoulLink nur in eigener Ansicht
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); if (info.p1Enc && info.p2Enc) onRequestSoulLink!(info.p1Enc, info.p2Enc) }}
              className="mt-2 ml-6 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:opacity-80"
              style={{ color: '#CC0000', background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.3)' }}
            >
              <Link2 className="w-3 h-3" /> SoulLink anfragen
            </button>
          )
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#2e2e42] overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${collapsible ? 'cursor-pointer hover:bg-white/3 transition-colors' : ''}`}
        style={{ background: '#1c1c26' }}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <div className="flex items-center gap-2">
          <ListChecks className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-200 text-xs font-black uppercase tracking-widest">Encounter-Checkliste</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-600 text-[10px] tabular-nums">{doneCount}/{officialInfos.length}</span>
          {collapsible && (open
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />)}
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="p-2.5 space-y-1.5 overflow-y-auto" style={{ background: '#161620', maxHeight: '540px' }}>
          {officialInfos.map(renderRow)}

          {customInfos.length > 0 && (
            <>
              <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest px-1 pt-3 pb-1">
                Eigene Routen
              </div>
              {customInfos.map(renderRow)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
