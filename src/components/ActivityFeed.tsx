import { useState } from 'react'
import { ChevronDown, ChevronUp, Scroll, Link2, Skull, Star, Zap, User, AlertCircle, Swords } from 'lucide-react'
import { useActivityLog } from '../hooks/useActivityLog'
import type { Player } from '../types/database'

const EVENT_CFG: Record<string, { icon: React.ReactNode; color: string }> = {
  encounter_added:  { icon: <Zap     className="w-3.5 h-3.5" />, color: '#4ade80' },
  soul_link_created:{ icon: <Link2   className="w-3.5 h-3.5" />, color: '#CC0000' },
  soul_link_deleted:{ icon: <Link2   className="w-3.5 h-3.5" />, color: '#64748b' },
  death_confirmed:  { icon: <Skull   className="w-3.5 h-3.5" />, color: '#f87171' },
  pokemon_died:     { icon: <Skull   className="w-3.5 h-3.5" />, color: '#f87171' },
  pokemon_evolved:  { icon: <Star    className="w-3.5 h-3.5" />, color: '#FFCB05' },
  pokemon_revived:  { icon: <Zap     className="w-3.5 h-3.5" />, color: '#34d399' },
  team_added:       { icon: <Star    className="w-3.5 h-3.5" />, color: '#a78bfa' },
  team_removed:     { icon: <Star    className="w-3.5 h-3.5" />, color: '#64748b' },
  moves_updated:    { icon: <Swords  className="w-3.5 h-3.5" />, color: '#60a5fa' },
  request_rejected: { icon: <AlertCircle className="w-3.5 h-3.5" />, color: '#64748b' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Gerade eben'
  if (mins < 60)  return `vor ${mins} Min.`
  if (hours < 24) return `vor ${hours} Std.`
  return `vor ${days} Tag${days !== 1 ? 'en' : ''}`
}

interface Props {
  runId: string
  players: Player[]
  myPlayerId: string
  /** When true the panel renders a collapsible header (used on mobile/sidebar). Default: true */
  collapsible?: boolean
  /** Initial open state. Default: true */
  defaultOpen?: boolean
}

export default function ActivityFeed({
  runId, players, myPlayerId, collapsible = true, defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const { data: entries = [] } = useActivityLog(runId)

  const getPlayerName = (pid: string | null) =>
    pid ? (players.find((p) => p.id === pid)?.name ?? null) : null

  return (
    <div className="rounded-2xl border border-[#2e2e42] overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${collapsible ? 'cursor-pointer hover:bg-white/3 transition-colors' : ''}`}
        style={{ background: '#1c1c26' }}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <div className="flex items-center gap-2">
          <Scroll className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-200 text-xs font-black uppercase tracking-widest">Run-Protokoll</span>
          <span className="text-slate-600 text-xs">({entries.length})</span>
        </div>
        {collapsible && (
          open
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        )}
      </div>

      {/* Entries */}
      {open && (
        <div
          className="divide-y divide-[#1e1e2a] overflow-y-auto"
          style={{ background: '#161620', maxHeight: '360px' }}
        >
          {entries.length === 0 ? (
            <div className="text-slate-600 text-xs text-center py-8 px-4">
              Noch keine Ereignisse aufgezeichnet.
            </div>
          ) : (
            entries.map((entry) => {
              const { icon, color } = EVENT_CFG[entry.event_type] ?? { icon: <User className="w-3.5 h-3.5" />, color: '#64748b' }
              const playerName = getPlayerName(entry.player_id)
              const isMe = entry.player_id === myPlayerId
              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors">
                  <div
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                    style={{ background: `${color}18`, color }}
                  >
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-xs leading-snug">{entry.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-slate-600 text-[10px]">{timeAgo(entry.created_at)}</span>
                      {playerName && (
                        <>
                          <span className="text-slate-700 text-[10px]">·</span>
                          <span className="text-[10px] font-medium" style={{ color: isMe ? '#CC0000' : '#64748b' }}>
                            {isMe ? 'Du' : playerName}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
