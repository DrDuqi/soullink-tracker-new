import { useEffect, useState } from 'react'
import { Users, Box, Skull, Swords, Heart, MapPin, Gamepad2 } from 'lucide-react'
import { getSpriteUrl, getTypeColor, fetchItemName } from '../lib/pokemon-api'
import EncounterCard from './EncounterCard'
import { useEmuTeamStore } from '../store/emuTeamStore'
import { deriveTeamGroups } from '../lib/teamGroups'
import type { EmulatorMon } from '../lib/emulatorSync'
import type { Encounter, Player, TeamSlot } from '../types/database'

const STATUS_COLOR: Record<string, string> = { alive: '#4ade80', dead: '#f87171', boxed: '#fbbf24', missing: '#94a3b8' }
const STATUS_DE: Record<string, string> = { alive: 'Am Leben', dead: 'Besiegt', boxed: 'In Box', missing: 'Vermisst' }

function Label({ icon, text, count, color = '#94a3b8' }: { icon: React.ReactNode; text: string; count: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span style={{ color }}>{icon}</span>
      <span className="text-slate-200 text-xs font-black uppercase tracking-widest">{text}</span>
      <span className="text-slate-600 text-xs">({count})</span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,#2e2e42,transparent)' }} />
    </div>
  )
}

// One team slot = the tracked encounter (identity/route/status/moves) enriched
// with the LIVE emulator mon (level/HP/item) matched by stable PID.
function TeamSlot({ enc, mon, onClick }: { enc: Encounter; mon?: EmulatorMon; onClick: () => void }) {
  const [item, setItem] = useState<string | null>(null)
  useEffect(() => {
    let c = false
    if (mon?.heldItemId) fetchItemName(mon.heldItemId).then((n) => { if (!c) setItem(n) }); else setItem(null)
    return () => { c = true }
  }, [mon?.heldItemId])

  const moves = [enc.move_1, enc.move_2, enc.move_3, enc.move_4].filter(Boolean) as string[]
  const hpPct = mon && mon.maxHp > 0 ? Math.round((mon.hp / mon.maxHp) * 100) : null
  const hpColor = hpPct == null ? '#3e3e52' : hpPct > 50 ? '#4ade80' : hpPct > 20 ? '#fbbf24' : '#f87171'

  return (
    <button onClick={onClick} className="rounded-xl border border-[#2e2e42] bg-[#1c1c26] p-3 text-left hover:border-slate-600 transition-colors">
      {enc.types && enc.types.length > 0 && (
        <div className="h-1 rounded-full mb-2" style={{ background: enc.types.length === 2 ? `linear-gradient(90deg,${getTypeColor(enc.types[0])} 50%,${getTypeColor(enc.types[1])} 50%)` : getTypeColor(enc.types[0]) }} />
      )}
      <div className="flex items-center gap-2">
        {enc.pokemon_id != null && <img src={getSpriteUrl(enc.pokemon_id)} alt="" className="w-12 h-12 object-contain shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="text-white text-sm font-bold capitalize truncate">{enc.nickname ?? enc.pokemon_name}</div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            {mon && <span>Lv {mon.level}</span>}
            <span className="px-1 rounded font-bold" style={{ color: STATUS_COLOR[enc.status], background: `${STATUS_COLOR[enc.status]}1e` }}>{STATUS_DE[enc.status]}</span>
          </div>
        </div>
      </div>
      {mon && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-1.5 rounded-full" style={{ width: `${hpPct}%`, background: hpColor }} /></div>
          <span className="text-[10px] text-slate-500 tabular-nums">{mon.hp}/{mon.maxHp}</span>
        </div>
      )}
      <div className="mt-1.5 space-y-1 text-[10px]">
        <div className="flex items-center gap-1 text-slate-500"><MapPin className="w-3 h-3" />{enc.location}</div>
        {item && <div className="text-slate-400">Item: <span className="text-slate-200">{item}</span></div>}
        {moves.length > 0 && <div className="flex flex-wrap gap-1">{moves.map((m) => <span key={m} className="px-1.5 py-0.5 rounded bg-[#16161f] border border-[#2e2e42] text-slate-300">{m}</span>)}</div>}
      </div>
    </button>
  )
}

interface Props {
  myEncounters: Encounter[]
  partnerEncounters: Encounter[]
  teamSlots: TeamSlot[]
  players: Player[]
  myPlayerId: string
  onSelectEncounter: (enc: Encounter) => void
}

export default function TeamOverview({ myEncounters, partnerEncounters, teamSlots, players, myPlayerId, onSelectEncounter }: Props) {
  const { team: liveTeam, connected } = useEmuTeamStore()
  const partner = players.find((p) => p.id !== myPlayerId)

  const { team: teamEncs, box: boxEncs, dead: deadEncs, liveByPid } = deriveTeamGroups(myEncounters, teamSlots, myPlayerId, liveTeam, connected)
  const partnerSlotEncIds = new Set(teamSlots.filter((s) => partner && s.player_id === partner.id).map((s) => s.encounter_id))
  const partnerTeam = partnerEncounters.filter((e) => partnerSlotEncIds.has(e.id))

  return (
    <div className="space-y-5">
      {/* Mein Team */}
      <div>
        <Label icon={<Users className="w-4 h-4" />} text="Mein Team" count={teamEncs.length} color="#CC0000" />
        {!connected && teamEncs.length === 0 && (
          <p className="text-slate-600 text-[11px] mb-2 flex items-center gap-1.5"><Gamepad2 className="w-3.5 h-3.5" /> Emulator nicht verbunden – Team aus manueller Markierung „Im Team".</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const enc = teamEncs[i]
            if (!enc) return <div key={i} className="rounded-xl border border-dashed border-[#2e2e42] min-h-[96px] flex items-center justify-center text-slate-700 text-[10px]">Slot {i + 1}</div>
            return <TeamSlot key={enc.id} enc={enc} mon={enc.emu_pid ? liveByPid.get(enc.emu_pid) : undefined} onClick={() => onSelectEncounter(enc)} />
          })}
        </div>
      </div>

      {/* In Box */}
      {boxEncs.length > 0 && (
        <div>
          <Label icon={<Box className="w-4 h-4" />} text="In Box / Nicht im Team" count={boxEncs.length} color="#fbbf24" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {boxEncs.map((e) => (
              <EncounterCard key={e.id} encounter={e} compact isMyEncounter onClick={() => onSelectEncounter(e)} />
            ))}
          </div>
        </div>
      )}

      {/* Besiegt */}
      {deadEncs.length > 0 && (
        <div>
          <Label icon={<Skull className="w-4 h-4" />} text="Besiegt" count={deadEncs.length} color="#f87171" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {deadEncs.map((e) => (
              <EncounterCard key={e.id} encounter={e} compact isMyEncounter onClick={() => onSelectEncounter(e)} />
            ))}
          </div>
        </div>
      )}

      {/* Partner-Team */}
      <div>
        <Label icon={<Swords className="w-4 h-4" />} text={`Partner-Team${partner ? ' · ' + partner.name : ''}`} count={partnerTeam.length} color="#FFCB05" />
        {partnerTeam.length === 0 ? (
          <div className="text-center py-6 rounded-xl border border-dashed border-[#2e2e42] text-slate-600 text-[11px] flex items-center justify-center gap-1.5">
            <Heart className="w-3.5 h-3.5" /> Warte auf Partnerdaten…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {partnerTeam.slice(0, 6).map((e) => (
              <button key={e.id} onClick={() => onSelectEncounter(e)} className="rounded-xl border border-[#2e2e42] bg-[#1c1c26] p-2 text-left hover:border-slate-600 transition-colors flex items-center gap-2">
                {e.pokemon_id != null && <img src={getSpriteUrl(e.pokemon_id)} alt="" className="w-9 h-9 object-contain shrink-0" />}
                <div className="min-w-0">
                  <div className="text-white text-xs font-bold capitalize truncate">{e.nickname ?? e.pokemon_name}</div>
                  <div className="text-[9px]" style={{ color: STATUS_COLOR[e.status] }}>{STATUS_DE[e.status]}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
