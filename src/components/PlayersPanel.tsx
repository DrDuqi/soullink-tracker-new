import { Users, Crown } from 'lucide-react'
import type { Player } from '../types/database'

/** Run roster with online status. Renders maxPlayers slots (2 or 3); filled slots
 *  show the player + a green/grey dot, empty slots show "frei". */
export default function PlayersPanel({
  players, maxPlayers, myPlayerId, ownerUserId, online,
}: {
  players: Player[]
  maxPlayers: number
  myPlayerId: string
  ownerUserId?: string | null
  online: Set<string>
}) {
  const slots = Array.from({ length: Math.max(2, Math.min(3, maxPlayers)) }, (_, i) => i + 1)

  return (
    <div className="rounded-2xl border border-[#2e2e42] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#1c1c26' }}>
        <Users className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-slate-200 text-xs font-black uppercase tracking-widest">Spieler</span>
        <span className="text-slate-600 text-[10px] ml-auto">{players.filter((p) => p.auth_user_id).length}/{slots.length}</span>
      </div>
      <div className="p-2.5 space-y-1.5" style={{ background: '#161620' }}>
        {slots.map((n) => {
          const p = players.find((pl) => pl.player_number === n)
          const filled = !!p?.auth_user_id
          const isMe = p?.id === myPlayerId
          const isOnline = !!p && online.has(p.id)
          const isOwner = !!p?.auth_user_id && p.auth_user_id === ownerUserId
          return (
            <div key={n} className="flex items-center gap-2 rounded-xl px-3 py-2 border"
              style={{ background: filled ? '#1c1c26' : 'transparent', borderColor: filled ? '#2e2e42' : 'rgba(46,46,66,0.5)' }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: isOnline ? '#4ade80' : filled ? '#64748b' : '#3e3e52' }} title={isOnline ? 'Online' : 'Offline'} />
              {filled ? (
                <>
                  <span className="text-sm font-bold truncate" style={{ color: isMe ? '#CC0000' : '#e2e8f0' }}>{p!.name}</span>
                  {isOwner && <Crown className="w-3 h-3 text-pk-yellow shrink-0" />}
                  {isMe && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-slate-400 shrink-0">Du</span>}
                  <span className="ml-auto text-[10px] font-bold" style={{ color: isOnline ? '#4ade80' : '#64748b' }}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-600 italic">Slot {n} frei – warte auf Spieler…</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
