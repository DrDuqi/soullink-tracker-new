import { Star, X, Link2 } from 'lucide-react'
import { getSpriteUrl } from '../lib/pokemon-api'
import { useAddToTeam } from '../hooks/useTeamSlots'
import { useCreateRequest } from '../hooks/useRequests'
import { useToastStore } from '../store/toastStore'
import type { Encounter, Player, SoulLinkPair, TeamSlot } from '../types/database'

interface Props {
  encounter: Encounter
  teamSlots: TeamSlot[]
  encounters: Encounter[]
  soulLinkPairs: SoulLinkPair[]
  runId: string
  myPlayerId: string
  players: Player[]
  onClose: () => void
}

export default function SlotPickerModal({ encounter, teamSlots, encounters, soulLinkPairs, runId, myPlayerId, players, onClose }: Props) {
  const addToTeam = useAddToTeam()
  const createRequest = useCreateRequest()
  const toast = useToastStore()

  // Find soul link partner for this encounter
  let linkedEnc: Encounter | null = null
  let soulLinkId: string | null = null
  for (const pair of soulLinkPairs) {
    if (pair.encounter1.id === encounter.id) {
      linkedEnc = encounters.find((e) => e.id === pair.encounter2.id) ?? pair.encounter2
      soulLinkId = pair.id
      break
    }
    if (pair.encounter2.id === encounter.id) {
      linkedEnc = encounters.find((e) => e.id === pair.encounter1.id) ?? pair.encounter1
      soulLinkId = pair.id
      break
    }
  }

  const partnerPlayer = players.find((p) => p.id !== myPlayerId)
  const mySlots = teamSlots.filter((s) => s.player_id === myPlayerId)
  const isLinked = !!(soulLinkId && linkedEnc && partnerPlayer)
  const isPending = addToTeam.isPending || createRequest.isPending

  function handleSlotPick(slotPos: number) {
    if (isPending) return

    if (isLinked && linkedEnc && partnerPlayer && soulLinkId) {
      // Soul-linked: create team_sync request — never add unilaterally
      createRequest.mutate(
        {
          run_id: runId,
          request_type: 'team_sync',
          requested_by_player_id: myPlayerId,
          target_player_id: partnerPlayer.id,
          encounter1_id: encounter.id,
          encounter2_id: linkedEnc.id,
          soul_link_id: soulLinkId,
          trigger_encounter_id: encounter.id,
          route_match_type: null,
          slot_position: slotPos,
          partner_slot_position: slotPos,
        },
        {
          onSuccess: () => {
            toast.show('Team-Anfrage gesendet – Partner muss bestätigen', 'info')
            onClose()
          },
          onError: () => toast.show('Fehler beim Senden der Team-Anfrage', 'error'),
        }
      )
    } else {
      // Unlinked: add directly
      addToTeam.mutate(
        {
          runId,
          playerId: myPlayerId,
          encounterId: encounter.id,
          slotPosition: slotPos,
          pokemonName: encounter.nickname ?? encounter.pokemon_name,
        },
        {
          onSuccess: () => onClose(),
          onError: (err) => {
            const msg = err instanceof Error ? err.message : String(err)
            toast.show(msg, 'error')
          },
        }
      )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-sm border border-[#2e2e42] shadow-2xl overflow-hidden anim-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e2e42]">
          <div className="flex items-center gap-3">
            {encounter.pokemon_id && (
              <img src={getSpriteUrl(encounter.pokemon_id)} className="w-9 h-9 object-contain" alt="" />
            )}
            <div>
              <div className="text-white font-black capitalize">{encounter.nickname ?? encounter.pokemon_name}</div>
              <div className="text-slate-500 text-xs">Ins Hauptteam aufnehmen</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Soul link notice */}
        {isLinked && linkedEnc && (
          <div className="mx-5 mt-4 rounded-xl px-4 py-3" style={{ background: 'rgba(204,0,0,0.06)', border: '1px solid rgba(204,0,0,0.2)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Link2 className="w-3 h-3 text-pk-red/70" />
              <div className="text-pk-red/80 text-[10px] font-bold uppercase tracking-wider">Soul Link — Partner muss bestätigen</div>
            </div>
            <p className="text-slate-400 text-[11px] mb-2 leading-snug">
              Dieses Pokémon besitzt einen SoulLink. Der Partner muss ebenfalls ins Team aufgenommen werden. Beide kommen gleichzeitig rein.
            </p>
            <div className="flex items-center gap-2">
              {linkedEnc.pokemon_id && (
                <img src={getSpriteUrl(linkedEnc.pokemon_id)} className="w-8 h-8 object-contain" alt="" />
              )}
              <div>
                <div className="text-white text-sm font-bold capitalize">{linkedEnc.nickname ?? linkedEnc.pokemon_name}</div>
                <div className="text-slate-500 text-[10px]">wird ebenfalls in denselben Slot aufgenommen</div>
              </div>
            </div>
          </div>
        )}

        {/* Slot grid */}
        <div className="p-5">
          <div className="text-slate-400 text-xs font-bold mb-3 uppercase tracking-wider">Slot wählen</div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((pos) => {
              const existingSlot = mySlots.find((s) => s.slot_position === pos)
              const existingEnc = existingSlot ? encounters.find((e) => e.id === existingSlot.encounter_id) : null
              const isCurrent = existingSlot?.encounter_id === encounter.id

              return (
                <button
                  key={pos}
                  onClick={() => handleSlotPick(pos)}
                  disabled={isPending || isCurrent}
                  className={`rounded-xl border p-3 text-center transition-all hover:border-pk-red/50 disabled:opacity-40 ${isCurrent ? 'border-pk-red/60 bg-pk-red/5' : 'border-[#2e2e42]'}`}
                  style={{ background: isCurrent ? undefined : '#16161f' }}
                >
                  <div className="text-slate-500 text-[9px] mb-1">Slot {pos}</div>
                  {existingEnc ? (
                    <>
                      {existingEnc.pokemon_id && (
                        <img src={getSpriteUrl(existingEnc.pokemon_id)} className="w-8 h-8 object-contain mx-auto" alt="" />
                      )}
                      <div className="text-white text-[9px] capitalize truncate mt-0.5">
                        {existingEnc.nickname ?? existingEnc.pokemon_name}
                      </div>
                      {!isCurrent && <div className="text-slate-600 text-[8px]">ersetzen</div>}
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4 text-slate-600 mx-auto mb-1" />
                      <div className="text-slate-600 text-[9px]">Leer</div>
                    </>
                  )}
                </button>
              )
            })}
          </div>

          {isPending && (
            <div className="text-center text-slate-400 text-xs mt-3">
              {createRequest.isPending ? 'Anfrage wird gesendet…' : 'Wird gespeichert…'}
            </div>
          )}

          <button onClick={onClose} disabled={isPending} className="btn-ghost w-full py-2.5 mt-3 text-sm disabled:opacity-50">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
