import { useState } from 'react'
import { Skull, Heart, Box, HelpCircle, Unlink, Clock, AlertTriangle, Link2, Star, Eye } from 'lucide-react'
import { getSpriteUrl, getTypeColor } from '../lib/pokemon-api'
import { useDeleteSoulLink } from '../hooks/useSoulLinks'
import { useCreateRequest } from '../hooks/useRequests'
import type { SoulLinkPair, PokemonStatus, Player, RouteMatchType, Encounter } from '../types/database'

const STATUS_ICONS: Record<PokemonStatus, { icon: React.ReactNode; color: string }> = {
  alive:   { icon: <Heart      className="w-4 h-4" />, color: '#4ade80' },
  dead:    { icon: <Skull      className="w-4 h-4" />, color: '#f87171' },
  boxed:   { icon: <Box        className="w-4 h-4" />, color: '#fbbf24' },
  missing: { icon: <HelpCircle className="w-4 h-4" />, color: '#94a3b8' },
}

const ROUTE_MATCH_BADGE: Record<RouteMatchType, { label: string; color: string }> = {
  exact:            { label: 'Gleiche Route', color: '#4ade80' },
  similar:          { label: 'Ähnliche Route', color: '#fbbf24' },
  manual_exception: { label: 'Route-Ausnahme', color: '#f87171' },
}

interface Props {
  pair: SoulLinkPair
  myPlayerId: string
  players: Player[]
  hasPendingDeathRequest?: boolean
  teamEncounterIds?: Set<string>
  onSelectEncounter?: (enc: Encounter) => void
}

export default function SoulLinkPairCard({ pair, myPlayerId, players, hasPendingDeathRequest, teamEncounterIds, onSelectEncounter }: Props) {
  const deleteLink = useDeleteSoulLink()
  const createRequest = useCreateRequest()
  const [deathSent, setDeathSent] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const { encounter1: e1, encounter2: e2 } = pair
  const bothDead = e1.status === 'dead' && e2.status === 'dead'

  const myPlayer = players.find((p) => p.id === myPlayerId)
  const partnerPlayer = players.find((p) => p.id !== myPlayerId)
  const myEncounter = e1.player_id === myPlayerId ? e1 : e2.player_id === myPlayerId ? e2 : null

  async function handleDeathRequest() {
    if (!myPlayer || !partnerPlayer || !myEncounter) return
    try {
      await createRequest.mutateAsync({
        run_id: pair.run_id,
        request_type: 'death',
        requested_by_player_id: myPlayer.id,
        target_player_id: partnerPlayer.id,
        encounter1_id: null,
        encounter2_id: null,
        soul_link_id: pair.id,
        trigger_encounter_id: myEncounter.id,
        route_match_type: null,
      })
      setDeathSent(true)
    } catch { /* silent */ }
  }

  async function handleUnlink() {
    if (!confirm('Diesen Soul Link entfernen?')) return
    setUnlinking(true)
    await deleteLink.mutateAsync({
      id: pair.id,
      runId: pair.run_id,
      enc1Name: e1.nickname ?? e1.pokemon_name,
      enc2Name: e2.nickname ?? e2.pokemon_name,
    })
  }

  const showDeathBtn     = !bothDead && !hasPendingDeathRequest && !deathSent && myEncounter
  const showPendingBadge = (hasPendingDeathRequest || deathSent) && !bothDead
  const rmBadge = pair.route_match_type ? ROUTE_MATCH_BADGE[pair.route_match_type] : null

  return (
    <div className={`pk-card anim-fade-up transition-all ${bothDead ? 'pk-card-dead anim-death' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#2e2e42]">
        <div className="flex items-center gap-2 flex-wrap">
          <Link2 className="w-4 h-4 text-pk-red" />
          <span className="text-white text-sm font-bold">{pair.location}</span>
          {rmBadge && (
            <span className="pk-badge" style={{ color: rmBadge.color, background: `${rmBadge.color}18`, border: `1px solid ${rmBadge.color}40` }}>
              {rmBadge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showPendingBadge && (
            <span className="pk-badge flex items-center gap-1" style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <Clock className="w-3 h-3" /> Tod ausstehend…
            </span>
          )}
          {showDeathBtn && (
            <button
              onClick={handleDeathRequest}
              disabled={createRequest.isPending}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
              style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}
            >
              <Skull className="w-3.5 h-3.5" /> Tod melden
            </button>
          )}
          {!bothDead && (
            <button
              onClick={handleUnlink}
              disabled={unlinking}
              title="Link aufheben"
              className="text-slate-600 hover:text-slate-300 transition-colors p-1.5 hover:bg-white/5 rounded-lg"
            >
              <Unlink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Route warning */}
      {pair.route_match_type === 'manual_exception' && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-red-400 text-xs">Route-Ausnahme akzeptiert</span>
        </div>
      )}

      {/* Encounters grid */}
      <div className="grid grid-cols-2 gap-3 p-5 pt-3">
        {[e1, e2].map((enc) => {
          const st = STATUS_ICONS[enc.status]
          const isDead = enc.status === 'dead'
          const playerName = players.find((p) => p.id === enc.player_id)?.name
          const isInTeam = teamEncounterIds?.has(enc.id) ?? false
          const isMyEnc = enc.player_id === myPlayerId

          return (
            <div
              key={enc.id}
              className={`rounded-2xl border p-4 transition-all group ${isDead ? 'opacity-60' : ''} ${onSelectEncounter && !isDead ? 'cursor-pointer hover:border-slate-500' : ''}`}
              style={{ background: '#16161f', borderColor: isDead ? '#4a1a1a' : '#2e2e42' }}
              onClick={onSelectEncounter && !isDead ? () => onSelectEncounter(enc) : undefined}
            >
              {/* Type accent */}
              {enc.types && enc.types.length > 0 && (
                <div
                  className="h-1 rounded-full mb-3"
                  style={{ background: enc.types.length === 2
                    ? `linear-gradient(90deg, ${getTypeColor(enc.types[0])} 50%, ${getTypeColor(enc.types[1])} 50%)`
                    : getTypeColor(enc.types[0]) }}
                />
              )}
              <div className="flex items-center gap-3">
                <div className="relative">
                  {enc.pokemon_id ? (
                    <img
                      src={getSpriteUrl(enc.pokemon_id)}
                      alt={enc.pokemon_name}
                      className={`w-14 h-14 object-contain drop-shadow-md transition-all ${isDead ? 'grayscale' : ''} ${onSelectEncounter && !isDead ? 'group-hover:scale-110' : ''}`}
                    />
                  ) : (
                    <div className="w-14 h-14 bg-slate-800 rounded-xl" />
                  )}
                  {onSelectEncounter && !isDead && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5" style={{ color: st.color }}>
                    {st.icon}
                    <span className={`text-sm font-black capitalize truncate ${isDead ? 'line-through' : 'text-white'}`}>
                      {enc.nickname ?? enc.pokemon_name}
                    </span>
                    {isInTeam && <Star className="w-3 h-3 text-pk-yellow shrink-0" />}
                  </div>
                  {enc.nickname && <div className="text-slate-500 text-xs capitalize">{enc.pokemon_name}</div>}
                  {playerName && (
                    <div className="text-xs mt-1 font-bold" style={{ color: isMyEnc ? '#CC0000' : '#64748b' }}>
                      {isMyEnc ? 'Du' : playerName}
                    </div>
                  )}
                  {/* Types */}
                  {enc.types && enc.types.length > 0 && (
                    <div className="flex gap-1 mt-1.5">
                      {enc.types.map((t) => (
                        <span key={t} className="type-badge text-[9px]" style={{ background: getTypeColor(t) }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
