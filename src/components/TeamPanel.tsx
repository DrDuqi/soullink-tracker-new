import { useState } from 'react'
import { Star, X, Plus, ChevronDown } from 'lucide-react'
import { getSpriteUrl, getTypeColor } from '../lib/pokemon-api'
import { useTeamSlots, useAddToTeam, useRemoveFromTeam } from '../hooks/useTeamSlots'
import { useCreateRequest } from '../hooks/useRequests'
import { useToastStore } from '../store/toastStore'
import type { Encounter, Player, SoulLinkPair, TeamSlot } from '../types/database'

interface Props {
  runId: string
  players: Player[]
  myPlayerId: string
  encounters: Encounter[]
  soulLinkPairs: SoulLinkPair[]
  onSelectEncounter?: (enc: Encounter) => void
  onNavigateToPairs?: () => void
}

export default function TeamPanel({
  runId, players, myPlayerId, encounters, soulLinkPairs, onSelectEncounter, onNavigateToPairs,
}: Props) {
  const { data: teamSlots = [] } = useTeamSlots(runId)

  const myPlayer = players.find((p) => p.id === myPlayerId)
  const partnerPlayer = players.find((p) => p.id !== myPlayerId)
  const orderedPlayers = [myPlayer, partnerPlayer].filter(Boolean) as Player[]

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: '3fr 2fr' }}>
      {orderedPlayers.map((player) => {
        const isMe = player.id === myPlayerId
        const playerSlots = teamSlots.filter((s) => s.player_id === player.id)
        const aliveEncs = encounters.filter(
          (e) => e.player_id === player.id && e.status === 'alive' && !playerSlots.find((s) => s.encounter_id === e.id)
        )
        // Only confirmed soul links with a living partner may enter the team
        const eligibleEncs = aliveEncs.filter((e) => {
          const info = resolveLinkedInfo(e, soulLinkPairs, encounters, players)
          return info != null && info.enc.status === 'alive'
        })
        return (
          <PlayerTeam
            key={player.id}
            player={player}
            isMe={isMe}
            slots={playerSlots}
            encounters={encounters}
            availableEncounters={eligibleEncs}
            soulLinkPairs={soulLinkPairs}
            runId={runId}
            myPlayerId={myPlayerId}
            players={players}
            onSelectEncounter={onSelectEncounter}
            onNavigateToPairs={onNavigateToPairs}
          />
        )
      })}
    </div>
  )
}

interface LinkedInfo {
  enc: Encounter
  soulLinkId: string
  partnerPlayerId: string
  partnerPlayerName: string
}

function resolveLinkedInfo(
  enc: Encounter,
  soulLinkPairs: SoulLinkPair[],
  encounters: Encounter[],
  players: Player[],
): LinkedInfo | null {
  for (const pair of soulLinkPairs) {
    let partnerEncId: string | null = null
    if (pair.encounter1.id === enc.id) partnerEncId = pair.encounter2.id
    else if (pair.encounter2.id === enc.id) partnerEncId = pair.encounter1.id
    if (!partnerEncId) continue

    const partnerEnc =
      encounters.find((e) => e.id === partnerEncId) ??
      (pair.encounter1.id === partnerEncId ? pair.encounter1 : pair.encounter2)
    const partnerPlayer = players.find((p) => p.id === partnerEnc.player_id)
    return {
      enc: partnerEnc,
      soulLinkId: pair.id,
      partnerPlayerId: partnerEnc.player_id,
      partnerPlayerName: partnerPlayer?.name ?? '?',
    }
  }
  return null
}

function PlayerTeam({
  player, isMe, slots, encounters, availableEncounters, soulLinkPairs, runId,
  myPlayerId, players, onSelectEncounter, onNavigateToPairs,
}: {
  player: Player
  isMe: boolean
  slots: TeamSlot[]
  encounters: Encounter[]
  availableEncounters: Encounter[]
  soulLinkPairs: SoulLinkPair[]
  runId: string
  myPlayerId: string
  players: Player[]
  onSelectEncounter?: (enc: Encounter) => void
  onNavigateToPairs?: () => void
}) {
  const addToTeam = useAddToTeam()
  const removeFromTeam = useRemoveFromTeam()
  const createRequest = useCreateRequest()
  const toast = useToastStore()
  const [openSlotPicker, setOpenSlotPicker] = useState<number | null>(null)
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)

  const slotMinHeight = isMe ? 175 : 135
  const spriteSize = isMe ? 'w-20 h-20' : 'w-14 h-14'
  const nameClass = isMe ? 'text-sm font-bold' : 'text-xs font-bold'
  const typeClass = isMe ? 'text-xs' : 'text-[10px]'
  const badgeClass = isMe ? 'text-xs' : 'text-[10px]'
  const cardPadding = isMe ? 'p-3' : 'p-2'

  function linked(enc: Encounter): LinkedInfo | null {
    return resolveLinkedInfo(enc, soulLinkPairs, encounters, players)
  }

  function handleRemove(slot: TeamSlot, enc: Encounter) {
    if (!isMe) return
    const info = linked(enc)
    if (info) {
      createRequest.mutate(
        {
          run_id: runId,
          request_type: 'team_remove',
          requested_by_player_id: myPlayerId,
          target_player_id: info.partnerPlayerId,
          encounter1_id: enc.id,
          encounter2_id: info.enc.id,
          soul_link_id: info.soulLinkId,
          trigger_encounter_id: enc.id,
          route_match_type: null,
        },
        {
          onSuccess: () => toast.show('Entfernung angefragt – Partner muss bestätigen', 'info'),
          onError: () => toast.show('Fehler beim Senden der Entfernung-Anfrage', 'error'),
        }
      )
    } else {
      removeFromTeam.mutate({
        id: slot.id,
        runId,
        pokemonName: enc.nickname ?? enc.pokemon_name,
        encounterId: enc.id,
      })
    }
  }

  function handleDrop(e: React.DragEvent, slotPos: number) {
    e.preventDefault()
    setDragOverSlot(null)
    if (!isMe) return
    const encId = e.dataTransfer.getData('text/encounter-id')
    if (!encId) return
    const enc = encounters.find((en) => en.id === encId)
    if (!enc || enc.player_id !== player.id) return
    if (enc.status === 'dead') return // Dead Pokémon cannot join the team

    // Check if this encounter is already in a team slot (move vs. add)
    const existingSlot = slots.find((s) => s.encounter_id === encId)
    const isMove = !!existingSlot

    if (isMove) {
      if (existingSlot.slot_position === slotPos) return
      const info = linked(enc)
      if (info) {
        createRequest.mutate(
          {
            run_id: runId,
            request_type: 'team_move',
            requested_by_player_id: myPlayerId,
            target_player_id: info.partnerPlayerId,
            encounter1_id: enc.id,
            encounter2_id: info.enc.id,
            soul_link_id: info.soulLinkId,
            trigger_encounter_id: enc.id,
            route_match_type: null,
            slot_position: slotPos,
            partner_slot_position: slotPos,
          },
          {
            onSuccess: () => toast.show('Slot-Wechsel angefragt – Partner muss bestätigen', 'info'),
            onError: () => toast.show('Fehler beim Senden der Slot-Anfrage', 'error'),
          }
        )
      } else {
        addToTeam.mutate({
          runId,
          playerId: player.id,
          encounterId: encId,
          slotPosition: slotPos,
          pokemonName: enc.nickname ?? enc.pokemon_name,
        })
      }
    } else {
      const info = linked(enc)
      if (!info) {
        toast.show('Pokémon muss zuerst mit dem Partner verlinkt werden.', 'warning')
        return
      }
      if (info.enc.status !== 'alive') {
        toast.show('Beide Pokémon müssen am Leben sein.', 'warning')
        return
      }
      // Soul-linked: use request flow — never add unilaterally
      createRequest.mutate(
        {
          run_id: runId,
          request_type: 'team_sync',
          requested_by_player_id: myPlayerId,
          target_player_id: info.partnerPlayerId,
          encounter1_id: enc.id,
          encounter2_id: info.enc.id,
          soul_link_id: info.soulLinkId,
          trigger_encounter_id: enc.id,
          route_match_type: null,
          slot_position: slotPos,
          partner_slot_position: slotPos,
        },
        {
          onSuccess: () => toast.show('Team-Anfrage gesendet – Partner muss bestätigen', 'info'),
          onError: () => toast.show('Fehler beim Senden der Team-Anfrage', 'error'),
        }
      )
    }
    setOpenSlotPicker(null)
  }

  return (
    <div className="rounded-2xl border border-[#2e2e42] bg-[#1c1c26]">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[#2e2e42] rounded-t-2xl"
        style={{ background: isMe ? 'rgba(204,0,0,0.08)' : 'rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4" style={{ color: isMe ? '#CC0000' : '#64748b' }} />
          <span className="text-white text-sm font-black">{player.name}</span>
          {isMe && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: '#CC000020', color: '#CC0000', border: '1px solid #CC000040' }}>
              DU
            </span>
          )}
        </div>
        <span className="text-slate-500 text-xs">{slots.length}/6</span>
      </div>

      {/* 6 slots */}
      <div className="grid grid-cols-3 gap-2 p-3">
        {[1, 2, 3, 4, 5, 6].map((pos) => {
          const slot = slots.find((s) => s.slot_position === pos)
          const enc = slot ? encounters.find((e) => e.id === slot.encounter_id) : null
          const linkedInfo = enc ? linked(enc) : null
          const isOver = dragOverSlot === pos

          return (
            <div
              key={pos}
              className="relative"
              onDragOver={(e) => { e.preventDefault(); if (isMe) setDragOverSlot(pos) }}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={(e) => handleDrop(e, pos)}
            >
              {enc ? (
                <div
                  className={`rounded-xl border transition-all cursor-pointer group flex flex-col ${enc.status === 'dead' ? 'opacity-40' : ''} ${isOver ? 'border-pk-red/60 scale-[1.03]' : 'border-[#2e2e42]'}`}
                  style={{ background: isOver ? 'rgba(204,0,0,0.08)' : '#16161f', minHeight: slotMinHeight }}
                  onClick={() => onSelectEncounter?.(enc)}
                  draggable={isMe}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/encounter-id', enc.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                >
                  {/* Type bar */}
                  {enc.types && enc.types.length > 0 && (
                    <div
                      className="h-1 rounded-t-xl shrink-0"
                      style={{
                        background:
                          enc.types.length === 2
                            ? `linear-gradient(90deg,${getTypeColor(enc.types[0])} 50%,${getTypeColor(enc.types[1])} 50%)`
                            : getTypeColor(enc.types[0]),
                      }}
                    />
                  )}

                  <div className={`${cardPadding} flex flex-col items-center flex-1`}>
                    {enc.pokemon_id && (
                      <img
                        src={getSpriteUrl(enc.pokemon_id)}
                        alt={enc.pokemon_name}
                        className={`${spriteSize} mx-auto object-contain ${enc.status === 'dead' ? 'grayscale' : ''}`}
                      />
                    )}
                    <div className={`text-white ${nameClass} capitalize truncate w-full text-center mt-1`}>
                      {enc.nickname ?? enc.pokemon_name}
                    </div>

                    {enc.types && enc.types.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap justify-center">
                        {enc.types.map((t) => (
                          <span
                            key={t}
                            className={`${typeClass} px-1.5 py-0.5 rounded font-bold capitalize`}
                            style={{ background: `${getTypeColor(t)}22`, color: getTypeColor(t) }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {linkedInfo && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigateToPairs?.() }}
                        className={`mt-1.5 w-full text-center ${badgeClass} text-pk-red/70 hover:text-pk-red transition-colors leading-tight`}
                        title={`Verlinkt mit: ${linkedInfo.enc.nickname ?? linkedInfo.enc.pokemon_name} (${linkedInfo.partnerPlayerName})`}
                      >
                        🔗 <span className="capitalize">{linkedInfo.enc.nickname ?? linkedInfo.enc.pokemon_name}</span>
                      </button>
                    )}
                  </div>

                  {isMe && (
                    <button
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove(slot!, enc)
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={`rounded-xl border border-dashed flex flex-col items-center justify-center transition-all ${isOver && isMe ? 'border-pk-red/60 bg-pk-red/5 scale-[1.03]' : 'border-[#2e2e42]'}`}
                  style={{ minHeight: slotMinHeight }}
                >
                  {isMe ? (
                    <div className="relative w-full flex flex-col items-center">
                      <button
                        onClick={() => setOpenSlotPicker(openSlotPicker === pos ? null : pos)}
                        className="flex flex-col items-center gap-1.5 text-slate-600 hover:text-slate-400 transition-colors p-4"
                      >
                        <Plus className="w-5 h-5" />
                        <span className="text-[10px]">Slot {pos}</span>
                      </button>

                      {openSlotPicker === pos && availableEncounters.length > 0 && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-[200] bg-[#1c1c26] border border-[#2e2e42] rounded-xl shadow-2xl overflow-hidden w-44">
                          <div className="text-slate-400 text-[10px] font-bold px-3 py-2 border-b border-[#2e2e42]">
                            Pokémon wählen
                          </div>
                          <div className="max-h-52 overflow-y-auto">
                            {availableEncounters.map((e) => {
                              const info = linked(e)
                              return (
                                <button
                                  key={e.id}
                                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left"
                                  onClick={() => {
                                    if (info) {
                                      // Soul-linked: use request flow
                                      createRequest.mutate(
                                        {
                                          run_id: runId,
                                          request_type: 'team_sync',
                                          requested_by_player_id: myPlayerId,
                                          target_player_id: info.partnerPlayerId,
                                          encounter1_id: e.id,
                                          encounter2_id: info.enc.id,
                                          soul_link_id: info.soulLinkId,
                                          trigger_encounter_id: e.id,
                                          route_match_type: null,
                                          slot_position: pos,
                                          partner_slot_position: pos,
                                        },
                                        {
                                          onSuccess: () => toast.show('Team-Anfrage gesendet – Partner muss bestätigen', 'info'),
                                          onError: () => toast.show('Fehler beim Senden der Team-Anfrage', 'error'),
                                        }
                                      )
                                    } else {
                                      toast.show('Pokémon muss zuerst mit dem Partner verlinkt werden.', 'warning')
                                    }
                                    setOpenSlotPicker(null)
                                  }}
                                >
                                  {e.pokemon_id && (
                                    <img src={getSpriteUrl(e.pokemon_id)} className="w-8 h-8 object-contain shrink-0" alt="" />
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-white text-[10px] font-bold capitalize truncate">
                                      {e.nickname ?? e.pokemon_name}
                                    </div>
                                    <div className="text-slate-500 text-[9px] truncate">{e.location}</div>
                                    {info && (
                                      <div className="text-pk-red/60 text-[9px]">
                                        🔗 {info.enc.nickname ?? info.enc.pokemon_name}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {openSlotPicker === pos && availableEncounters.length === 0 && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-[200] bg-[#1c1c26] border border-[#2e2e42] rounded-xl px-3 py-2 w-48 text-slate-500 text-[10px] text-center">
                          Nur bestätigte SoulLinks (beide am Leben) können ins Team.
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-700 text-[10px]">Slot {pos}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isMe && (
        <p className="text-slate-700 text-[9px] text-center pb-2">
          <ChevronDown className="inline w-2.5 h-2.5" /> Encounter ziehen, + klicken oder „Ins Team" auf der Karte
        </p>
      )}
    </div>
  )
}
