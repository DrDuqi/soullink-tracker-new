import { useState } from 'react'
import { Star, X, Plus } from 'lucide-react'
import { getSpriteUrl, getTypeColor } from '../lib/pokemon-api'
import { useTeamSlots, useAddToTeam, useRemoveFromTeam } from '../hooks/useTeamSlots'
import type { Encounter, Player, SoulLinkGroup } from '../types/database'

// 3-player team view: one column per player slot (1..maxPlayers). Add/remove are
// DIRECT (the existing team-slot hooks, unchanged) — 3er-SoulLinks are created
// directly, so there is no partner-confirmation request flow here. Eligible = the
// Pokémon is in a COMPLETE 3er-link with all members alive.
export default function TeamPanel3({
  runId, players, myPlayerId, maxPlayers, encounters, groups, onSelectEncounter,
}: {
  runId: string
  players: Player[]
  myPlayerId: string
  maxPlayers: number
  encounters: Encounter[]
  groups: SoulLinkGroup[]
  onSelectEncounter?: (enc: Encounter) => void
}) {
  const { data: teamSlots = [] } = useTeamSlots(runId)
  const addToTeam = useAddToTeam()
  const removeFromTeam = useRemoveFromTeam()
  const [picker, setPicker] = useState<number | null>(null)

  const slotNums = Array.from({ length: Math.max(2, Math.min(3, maxPlayers)) }, (_, i) => i + 1)
  const myPlayer = players.find((p) => p.id === myPlayerId)
  const groupOf = (encId: string) => groups.find((g) => g.members.some((m) => m.encounter.id === encId))

  // My eligible Pokémon: alive, in a complete link (all alive), not yet in a slot.
  const mySlotEncIds = new Set(teamSlots.filter((s) => s.player_id === myPlayerId).map((s) => s.encounter_id))
  const eligible = encounters.filter((e) => {
    if (e.player_id !== myPlayerId || e.status !== 'alive' || mySlotEncIds.has(e.id)) return false
    const g = groupOf(e.id)
    return !!g && g.complete && g.members.every((m) => m.encounter.status === 'alive')
  })

  function addAt(pos: number, encId: string) {
    const enc = encounters.find((e) => e.id === encId)
    if (!enc || !myPlayer) return
    addToTeam.mutate({ runId, playerId: myPlayer.id, encounterId: encId, slotPosition: pos, pokemonName: enc.nickname ?? enc.pokemon_name })
    setPicker(null)
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${slotNums.length}, minmax(0,1fr))` }}>
      {slotNums.map((n) => {
        const player = players.find((p) => p.player_number === n)
        const isMe = player?.id === myPlayerId
        const playerSlots = player ? teamSlots.filter((s) => s.player_id === player.id) : []

        if (!player) {
          return (
            <div key={n} className="rounded-2xl border border-dashed border-[#2e2e42] bg-[#16161f] flex items-center justify-center min-h-[120px] text-center p-3">
              <span className="text-slate-600 text-xs italic">Spieler {n}<br />frei – wartet auf Spieler</span>
            </div>
          )
        }

        return (
          <div key={n} className="rounded-2xl border border-[#2e2e42] bg-[#1c1c26]">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2e2e42] rounded-t-2xl" style={{ background: isMe ? 'rgba(204,0,0,0.08)' : 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center gap-1.5 min-w-0">
                <Star className="w-3.5 h-3.5 shrink-0" style={{ color: isMe ? '#CC0000' : '#64748b' }} />
                <span className="text-white text-xs font-black truncate">{player.name}</span>
                {isMe && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0" style={{ background: '#CC000020', color: '#CC0000', border: '1px solid #CC000040' }}>DU</span>}
              </div>
              <span className="text-slate-500 text-[10px] shrink-0">{playerSlots.length}/6</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-2">
              {[1, 2, 3, 4, 5, 6].map((pos) => {
                const slot = playerSlots.find((s) => s.slot_position === pos)
                const enc = slot ? encounters.find((e) => e.id === slot.encounter_id) : null
                const g = enc ? groupOf(enc.id) : undefined
                const dead = enc?.status === 'dead'
                if (!enc) {
                  return (
                    <div key={pos} className="relative rounded-xl border border-dashed border-[#2e2e42] min-h-[78px] flex items-center justify-center">
                      {isMe ? (
                        <>
                          <button onClick={() => setPicker(picker === pos ? null : pos)} className="flex flex-col items-center gap-1 text-slate-600 hover:text-slate-400 transition-colors p-2">
                            <Plus className="w-4 h-4" /><span className="text-[9px]">Slot {pos}</span>
                          </button>
                          {picker === pos && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-[200] bg-[#1c1c26] border border-[#2e2e42] rounded-xl shadow-2xl overflow-hidden w-44">
                              <div className="text-slate-400 text-[10px] font-bold px-3 py-2 border-b border-[#2e2e42]">Pokémon wählen</div>
                              <div className="max-h-52 overflow-y-auto">
                                {eligible.length === 0 ? (
                                  <div className="px-3 py-2 text-slate-500 text-[10px] text-center">Nur vollständige 3er-Links (alle am Leben).</div>
                                ) : eligible.map((e) => (
                                  <button key={e.id} onClick={() => addAt(pos, e.id)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left">
                                    {e.pokemon_id && <img src={getSpriteUrl(e.pokemon_id)} className="w-7 h-7 object-contain shrink-0" alt="" />}
                                    <div className="min-w-0">
                                      <div className="text-white text-[10px] font-bold capitalize truncate">{e.nickname ?? e.pokemon_name}</div>
                                      <div className="text-slate-500 text-[9px] truncate">{e.location}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : <span className="text-slate-700 text-[9px]">Slot {pos}</span>}
                    </div>
                  )
                }
                return (
                  <div key={pos} className={`relative rounded-xl border min-h-[78px] flex flex-col items-center p-1.5 cursor-pointer group ${dead ? 'opacity-50 border-red-900/40' : 'border-[#2e2e42]'}`}
                    style={{ background: '#16161f' }} onClick={() => onSelectEncounter?.(enc)}>
                    {enc.pokemon_id && <img src={getSpriteUrl(enc.pokemon_id)} alt="" className={`w-9 h-9 object-contain ${dead ? 'grayscale' : ''}`} />}
                    <div className={`text-[10px] font-bold capitalize truncate w-full text-center ${dead ? 'text-red-400 line-through' : 'text-white'}`}>{enc.nickname ?? enc.pokemon_name}</div>
                    <div className="flex gap-0.5 justify-center mt-0.5">
                      {(enc.types ?? []).map((t) => <span key={t} className="w-1.5 h-1.5 rounded-full" style={{ background: getTypeColor(t) }} />)}
                    </div>
                    {g && <span className="text-[8px] text-pk-red/70" title={g.complete ? 'Vollständiger 3er-Link' : 'Unvollständiger Link'}>🔗{g.complete ? '' : '?'}</span>}
                    {isMe && slot && (
                      <button onClick={(e) => { e.stopPropagation(); removeFromTeam.mutate({ id: slot.id, runId, pokemonName: enc.nickname ?? enc.pokemon_name, encounterId: enc.id }) }}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
