import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { getSpriteUrl, getTypeColor, fetchItemName, TYPE_NAMES_DE } from '../lib/pokemon-api'
import type { EmulatorMon } from '../lib/emulatorSync'
import type { Encounter } from '../types/database'

// ONE card design for team / box / defeated Pokémon — so box mons never feel "second class".
// `mon` (live emulator data) is optional: present for the current party (adds Lv + HP bar),
// absent for box / defeated mons.
const STATUS_COLOR: Record<string, string> = { alive: '#4ade80', dead: '#f87171', boxed: '#fbbf24', missing: '#94a3b8' }
const STATUS_DE: Record<string, string> = { alive: 'Am Leben', dead: 'Besiegt', boxed: 'In Box', missing: 'Vermisst' }
const typeDe = (t: string) => TYPE_NAMES_DE[t] ?? t

export default function RunMonCard({ enc, mon, onClick, size = 'md' }: { enc: Encounter; mon?: EmulatorMon; onClick?: () => void; size?: 'md' | 'lg' }) {
  const [item, setItem] = useState<string | null>(null)
  useEffect(() => {
    let c = false
    if (mon?.heldItemId) fetchItemName(mon.heldItemId).then((n) => { if (!c) setItem(n) }); else setItem(null)
    return () => { c = true }
  }, [mon?.heldItemId])

  const moves = [enc.move_1, enc.move_2, enc.move_3, enc.move_4].filter(Boolean) as string[]
  const hpPct = mon && mon.maxHp > 0 ? Math.round((mon.hp / mon.maxHp) * 100) : null
  const hpColor = hpPct == null ? '#3e3e52' : hpPct > 50 ? '#4ade80' : hpPct > 20 ? '#fbbf24' : '#f87171'
  const dead = enc.status === 'dead'
  const lg = size === 'lg'
  const status = STATUS_COLOR[enc.status] ?? '#94a3b8'

  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border text-left transition-all duration-200 w-full group hover:-translate-y-0.5 ${lg ? 'p-4' : 'p-3.5'} ${dead ? 'opacity-70' : ''}`}
      style={{ background: dead ? '#1a1016' : '#1c1c26', borderColor: dead ? '#4a1a1a' : '#2e2e42' }}
    >
      {enc.types && enc.types.length > 0 && (
        <div className="h-1.5 rounded-full mb-3" style={{ background: enc.types.length === 2 ? `linear-gradient(90deg,${getTypeColor(enc.types[0])} 50%,${getTypeColor(enc.types[1])} 50%)` : getTypeColor(enc.types[0]) }} />
      )}
      <div className="flex items-center gap-3">
        {enc.pokemon_id != null && <img src={getSpriteUrl(enc.pokemon_id)} alt="" className={`${lg ? 'w-20 h-20' : 'w-16 h-16'} object-contain shrink-0 ${dead ? 'grayscale' : ''}`} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-white font-black capitalize truncate ${lg ? 'text-lg' : 'text-base'}`}>{enc.nickname ?? enc.pokemon_name}</span>
            {mon && <span className="text-slate-300 text-xs font-bold shrink-0 tabular-nums">Lv {mon.level}</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {(enc.types ?? []).map((t) => (
              <span key={t} className="text-[10px] font-black rounded px-1.5 py-0.5 text-white" style={{ background: getTypeColor(t) }}>{typeDe(t)}</span>
            ))}
            <span className="text-[10px] font-black rounded px-1.5 py-0.5" style={{ color: status, background: `${status}1e`, border: `1px solid ${status}40` }}>{STATUS_DE[enc.status] ?? enc.status}</span>
          </div>
        </div>
      </div>

      {mon && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden"><div className="h-2.5 rounded-full transition-all duration-300" style={{ width: `${hpPct}%`, background: hpColor }} /></div>
          <span className="text-[11px] text-slate-400 tabular-nums font-bold shrink-0">{mon.hp}/{mon.maxHp}</span>
        </div>
      )}

      <div className="mt-2.5 space-y-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-500"><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{enc.location}</span></div>
        {item && <div className="text-slate-400">Item: <span className="text-slate-200 font-bold">{item}</span></div>}
        {moves.length > 0 && <div className="flex flex-wrap gap-1.5 pt-0.5">{moves.map((m) => <span key={m} className="px-2 py-0.5 rounded-lg bg-[#16161f] border border-[#2e2e42] text-slate-300">{m}</span>)}</div>}
      </div>
    </button>
  )
}
