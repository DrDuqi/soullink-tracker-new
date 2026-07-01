import { useEffect, useState } from 'react'
import { Users, Swords, Heart } from 'lucide-react'
import { getSpriteUrl, fetchPokemon } from '../lib/pokemon-api'
import { isGameMismatch } from '../lib/routes'
import RunMonCard from './RunMonCard'
import { useEmuTeamStore } from '../store/emuTeamStore'
import { deriveTeamGroups } from '../lib/teamGroups'
import { buildLivePrefill, type EncounterPrefill } from '../lib/liveSync'
import type { EmulatorMon } from '../lib/emulatorSync'
import type { Encounter, Player, TeamSlot } from '../types/database'

function Label({ icon, text, count, color = '#94a3b8' }: { icon: React.ReactNode; text: string; count: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span style={{ color }}>{icon}</span>
      <span className="text-slate-200 text-xs font-black uppercase tracking-widest">{text}</span>
      <span className="text-slate-600 text-xs">({count})</span>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,#2e2e42,transparent)' }} />
    </div>
  )
}

// Live emulator mon that hasn't been imported yet as an encounter.
function GhostSlot({ mon, game, currentLocationName, currentLocationId, suppressLocation, onImport }: { mon: EmulatorMon; game: string; currentLocationName: string | null; currentLocationId: number | null; suppressLocation: boolean; onImport: (prefill: EncounterPrefill, route?: string) => void }) {
  const [speciesName, setSpeciesName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    let c = false
    fetchPokemon(mon.speciesId).then((p) => { if (!c && p) setSpeciesName(p.name) })
    return () => { c = true }
  }, [mon.speciesId])

  const hpPct = mon.maxHp > 0 ? Math.round((mon.hp / mon.maxHp) * 100) : null
  const hpColor = hpPct == null ? '#3e3e52' : hpPct > 50 ? '#4ade80' : hpPct > 20 ? '#fbbf24' : '#f87171'

  async function handleImport() {
    setImporting(true)
    try {
      const res = await buildLivePrefill(mon, { game, currentLocationName, currentLocationId, suppressLocation })
      if (res) onImport(res.prefill, res.route)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-yellow-700/40 bg-[#1c1c20] p-4">
      <div className="h-1.5 rounded-full mb-3 bg-slate-700/40" />
      <div className="flex items-center gap-3">
        <img src={getSpriteUrl(mon.speciesId)} alt="" className="w-20 h-20 object-contain shrink-0 opacity-70" />
        <div className="min-w-0 flex-1">
          <div className="text-slate-300 text-base font-black capitalize truncate">
            {speciesName ?? `#${String(mon.speciesId).padStart(3, '0')}`}
          </div>
          <div className="flex items-center gap-2 text-[10px] mt-1">
            <span className="text-slate-400 font-bold">Lv {mon.level}</span>
            <span className="px-1.5 py-0.5 rounded font-black text-yellow-500 bg-yellow-500/10">Noch nicht übernommen</span>
          </div>
        </div>
      </div>
      {hpPct != null && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-2.5 rounded-full" style={{ width: `${hpPct}%`, background: hpColor }} />
          </div>
          <span className="text-[11px] text-slate-500 tabular-nums">{mon.hp}/{mon.maxHp}</span>
        </div>
      )}
      <button
        onClick={handleImport}
        disabled={importing}
        className="mt-3 w-full text-xs font-bold px-2 py-2 rounded-lg transition-all hover:opacity-80 disabled:opacity-40"
        style={{ color: '#CC0000', background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.3)' }}
      >
        {importing ? 'Wird geladen…' : 'Als Encounter übernehmen'}
      </button>
    </div>
  )
}

type DisplaySlot =
  | { type: 'enc'; enc: Encounter; mon?: EmulatorMon }
  | { type: 'ghost'; mon: EmulatorMon }
  | { type: 'empty'; idx: number }

interface Props {
  myEncounters: Encounter[]
  partnerEncounters: Encounter[]
  teamSlots: TeamSlot[]
  players: Player[]
  myPlayerId: string
  game: string
  onSelectEncounter: (enc: Encounter) => void
  onImport: (prefill: EncounterPrefill, route?: string) => void
}

// The single "Mein Team" surface: the live party (source of truth when connected),
// with ghost slots for party mons not yet imported. Box / Besiegt live in the Box tab.
export default function TeamOverview({ myEncounters, partnerEncounters, teamSlots, players, myPlayerId, game, onSelectEncounter, onImport }: Props) {
  const { team: liveTeam, connected, game: emuGame, currentLocationName, currentLocationId } = useEmuTeamStore()
  const mismatch = isGameMismatch(game, emuGame)
  const partner = players.find((p) => p.id !== myPlayerId)

  const { team: teamEncs, liveByPid } = deriveTeamGroups(myEncounters, teamSlots, myPlayerId, liveTeam, connected)
  const partnerSlotEncIds = new Set(teamSlots.filter((s) => partner && s.player_id === partner.id).map((s) => s.encounter_id))
  const partnerTeam = partnerEncounters.filter((e) => partnerSlotEncIds.has(e.id))

  // Build 6 display slots. When connected: follow the live emulator slot order and
  // insert ghost slots for mons that are in the emulator but not yet imported.
  const displaySlots: DisplaySlot[] = (() => {
    if (!connected || liveTeam.length === 0) {
      return [0, 1, 2, 3, 4, 5].map((i) => {
        const enc = teamEncs[i]
        return enc
          ? { type: 'enc' as const, enc, mon: enc.emu_pid ? liveByPid.get(enc.emu_pid) : undefined }
          : { type: 'empty' as const, idx: i }
      })
    }

    const result: DisplaySlot[] = []
    const usedEncIds = new Set<string>()

    for (let slotNum = 1; slotNum <= 6; slotNum++) {
      const liveMon = liveTeam.find((m) => m.slot === slotNum)
      if (!liveMon) { result.push({ type: 'empty', idx: slotNum - 1 }); continue }
      const enc = liveMon.pid != null ? teamEncs.find((e) => e.emu_pid === String(liveMon.pid)) : undefined
      if (enc) { usedEncIds.add(enc.id); result.push({ type: 'enc', enc, mon: liveMon }) }
      else { result.push({ type: 'ghost', mon: liveMon }) }
    }
    for (const enc of teamEncs) {
      if (!usedEncIds.has(enc.id) && result.length < 6) {
        result.push({ type: 'enc', enc, mon: enc.emu_pid ? liveByPid.get(enc.emu_pid) : undefined })
      }
    }
    while (result.length < 6) result.push({ type: 'empty', idx: result.length })
    return result
  })()

  const teamEncCount = displaySlots.filter((s) => s.type === 'enc').length
  const ghostCount = displaySlots.filter((s) => s.type === 'ghost').length

  return (
    <div className="space-y-6">
      {/* Mein Team — the live party */}
      <div>
        <Label icon={<Users className="w-4 h-4" />} text="Mein Team" count={teamEncCount + ghostCount} color="#CC0000" />
        {!connected && teamEncCount === 0 && (
          <p className="text-slate-600 text-[11px] mb-2 flex items-center gap-1.5"><Swords className="w-3.5 h-3.5" /> Emulator nicht verbunden – Team aus manueller Markierung „Im Team".</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displaySlots.map((slot) => {
            if (slot.type === 'enc') {
              return <RunMonCard key={slot.enc.id} enc={slot.enc} mon={slot.mon} size="lg" onClick={() => onSelectEncounter(slot.enc)} />
            }
            if (slot.type === 'ghost') {
              return <GhostSlot key={`ghost-${slot.mon.slot}`} mon={slot.mon} game={game} currentLocationName={currentLocationName} currentLocationId={currentLocationId} suppressLocation={mismatch} onImport={onImport} />
            }
            return (
              <div key={`empty-${slot.idx}`} className="rounded-2xl border border-dashed border-[#2e2e42] min-h-[150px] flex items-center justify-center text-slate-700 text-[11px]">
                Slot {slot.idx + 1}
              </div>
            )
          })}
        </div>
      </div>

      {/* Partner-Team */}
      <div>
        <Label icon={<Swords className="w-4 h-4" />} text={`Partner-Team${partner ? ' · ' + partner.name : ''}`} count={partnerTeam.length} color="#FFCB05" />
        {partnerTeam.length === 0 ? (
          <div className="text-center py-6 rounded-2xl border border-dashed border-[#2e2e42] text-slate-600 text-[11px] flex items-center justify-center gap-1.5">
            <Heart className="w-3.5 h-3.5" /> Warte auf Partnerdaten…
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {partnerTeam.slice(0, 6).map((e) => (
              <RunMonCard key={e.id} enc={e} onClick={() => onSelectEncounter(e)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
