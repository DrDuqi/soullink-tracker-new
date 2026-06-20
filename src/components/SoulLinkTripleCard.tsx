import { Link2, Skull, Trash2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { getSpriteUrl, getTypeColor } from '../lib/pokemon-api'
import type { SoulLinkGroup, Player } from '../types/database'

/** A 3-player SoulLink (triple). Shows each player's slot (Pokémon or "fehlt"),
 *  a complete/incomplete/defeated status and a duplicate-primary-type warning.
 *  When any member is defeated, the whole link is marked as affected. */
export default function SoulLinkTripleCard({ group, players, myPlayerId, onSelectEncounter, onDelete }: {
  group: SoulLinkGroup
  players: Player[]
  myPlayerId: string
  onSelectEncounter: (encId: string) => void
  onDelete?: () => void
}) {
  const nameOf = (pn: number) => players.find((p) => p.player_number === pn)?.name ?? `Spieler ${pn}`
  const slots = [...group.members.map((m) => m.playerNumber), ...group.missingPlayerNumbers].sort((a, b) => a - b)

  // Duplicate primary type among living members.
  const livePrimary = group.members.filter((m) => m.encounter.status !== 'dead').map((m) => m.encounter.types?.[0]).filter(Boolean) as string[]
  const dupType = new Set(livePrimary).size < livePrimary.length

  const status = group.anyDead
    ? { label: 'Besiegt – ganzer Link betroffen', color: '#f87171', icon: <Skull className="w-3.5 h-3.5" /> }
    : group.complete
      ? { label: 'Vollständig', color: '#4ade80', icon: <CheckCircle2 className="w-3.5 h-3.5" /> }
      : { label: 'Unvollständig', color: '#fbbf24', icon: <Clock className="w-3.5 h-3.5" /> }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: group.anyDead ? 'rgba(248,113,113,0.4)' : '#2e2e42' }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#1c1c26' }}>
        <Link2 className="w-3.5 h-3.5 text-pk-red" />
        <span className="text-slate-300 text-xs font-bold">{group.location ?? 'SoulLink'}</span>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold ml-auto" style={{ color: status.color }}>
          {status.icon} {status.label}
        </span>
        {onDelete && (
          <button onClick={onDelete} className="text-slate-600 hover:text-red-400 transition-colors p-1" title="SoulLink aufheben">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 p-3" style={{ background: '#161620' }}>
        {slots.map((pn) => {
          const m = group.members.find((x) => x.playerNumber === pn)
          const isMe = m?.encounter.player_id === myPlayerId
          if (!m) {
            return (
              <div key={pn} className="rounded-xl border border-dashed border-[#2e2e42] p-2 text-center min-h-[88px] flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500">{nameOf(pn)}</span>
                <span className="text-[10px] text-slate-600 italic mt-1">fehlt</span>
              </div>
            )
          }
          const e = m.encounter
          const dead = e.status === 'dead'
          return (
            <button key={pn} onClick={() => onSelectEncounter(e.id)}
              className="rounded-xl border p-2 text-center hover:border-slate-600 transition-colors"
              style={{ borderColor: dead ? 'rgba(248,113,113,0.3)' : '#2e2e42', background: '#1c1c26' }}>
              <div className="text-[10px] font-bold truncate" style={{ color: isMe ? '#CC0000' : '#94a3b8' }}>{nameOf(pn)}</div>
              {e.pokemon_id && <img src={getSpriteUrl(e.pokemon_id)} alt="" className={`w-10 h-10 mx-auto object-contain ${dead ? 'grayscale opacity-60' : ''}`} />}
              <div className={`text-[11px] font-bold capitalize truncate ${dead ? 'text-red-400 line-through' : 'text-white'}`}>{e.nickname ?? e.pokemon_name}</div>
              <div className="flex gap-0.5 justify-center mt-0.5">
                {(e.types ?? []).map((t) => <span key={t} className="w-2 h-2 rounded-full" style={{ background: getTypeColor(t) }} />)}
              </div>
            </button>
          )
        })}
      </div>

      {dupType && (
        <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] border-t" style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.25)' }}>
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          <span className="text-yellow-300">Zwei Pokémon im Link teilen denselben Primärtyp.</span>
        </div>
      )}
    </div>
  )
}
