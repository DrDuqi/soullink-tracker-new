import { useState } from 'react'
import { X, Link2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getSpriteUrl, getTypeColor } from '../lib/pokemon-api'
import { useCreateSoulLink3 } from '../hooks/useSoulLinks'
import type { Encounter, Player, RouteMatchType } from '../types/database'

/** 3-player linking: pick up to one Pokémon per player and create a single
 *  triple SoulLink directly. Saving an incomplete link (1–2 of 3) is allowed. */
export default function SoulLink3Modal({ runId, players, maxPlayers, encounters, linkedIds, onClose }: {
  runId: string
  players: Player[]
  maxPlayers: number
  encounters: Encounter[]
  linkedIds: Set<string>
  onClose: () => void
}) {
  const create = useCreateSoulLink3()
  const [sel, setSel] = useState<Record<number, string>>({})
  const [error, setError] = useState('')

  const slots = Array.from({ length: Math.max(2, Math.min(3, maxPlayers)) }, (_, i) => i + 1)
  const chosen = slots.map((n) => encounters.find((e) => e.id === sel[n])).filter(Boolean) as Encounter[]
  const count = chosen.length

  // Soft warnings (never block saving): different routes, duplicate primary type.
  const locs = new Set(chosen.map((e) => e.location))
  const sameRoute = chosen.length >= 2 && locs.size === 1
  const primaryTypes = chosen.map((e) => e.types?.[0]).filter(Boolean) as string[]
  const dupType = new Set(primaryTypes).size < primaryTypes.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (count === 0) { setError('Mindestens ein Pokémon auswählen.'); return }
    setError('')
    const routeType: RouteMatchType = sameRoute ? 'exact' : 'manual_exception'
    try {
      await create.mutateAsync({
        link: {
          run_id: runId,
          encounter1_id: sel[1] || null,
          encounter2_id: sel[2] || null,
          encounter3_id: sel[3] || null,
          route_match_type: routeType,
        },
        names: chosen.map((e) => e.nickname ?? e.pokemon_name),
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-lg border border-[#2e2e42] shadow-2xl anim-pop overflow-hidden" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#2e2e42]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pk-red/10 border border-pk-red/30 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-pk-red" />
            </div>
            <div>
              <h2 className="text-white font-black text-xl">3er-SoulLink erstellen</h2>
              <p className="text-slate-400 text-sm">Bis zu 3 Pokémon · unvollständig erlaubt</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
          {error && <div className="bg-red-950/50 border border-red-800 text-red-400 rounded-xl p-4 text-sm">{error}</div>}

          {slots.map((n) => {
            const player = players.find((p) => p.player_number === n)
            const opts = encounters.filter((e) => e.player_id === player?.id && !linkedIds.has(e.id))
            return (
              <div key={n}>
                <label className="text-slate-300 text-sm font-bold mb-2 block">{player?.name ?? `Spieler ${n}`}</label>
                <select value={sel[n] ?? ''} onChange={(e) => setSel((s) => ({ ...s, [n]: e.target.value }))} className="pk-input">
                  <option value="">— (fehlt / kein Pokémon)</option>
                  {opts.map((e) => (
                    <option key={e.id} value={e.id}>{e.nickname ?? e.pokemon_name} — {e.location}</option>
                  ))}
                </select>
                {!player && <p className="text-slate-600 text-[11px] mt-1">Slot noch frei (kein Spieler beigetreten).</p>}
              </div>
            )
          })}

          {/* Preview */}
          {chosen.length > 0 && (
            <div className="bg-[#16161f] border border-[#2e2e42] rounded-2xl p-4 flex items-center justify-around flex-wrap gap-3">
              {chosen.map((e) => (
                <div key={e.id} className="text-center">
                  {e.pokemon_id && <img src={getSpriteUrl(e.pokemon_id)} className="w-14 h-14 mx-auto object-contain drop-shadow-md" alt="" />}
                  <div className="text-white text-xs capitalize font-bold mt-1">{e.nickname ?? e.pokemon_name}</div>
                  <div className="flex gap-1 justify-center mt-1">
                    {(e.types ?? []).map((t) => <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: getTypeColor(t) }}>{t}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Soft warnings */}
          <div className="space-y-2">
            {count >= 2 && sameRoute && (
              <div className="flex items-center gap-2 text-green-400 text-xs font-semibold"><CheckCircle2 className="w-4 h-4" /> Gleiche Route — SoulLink-Regel erfüllt.</div>
            )}
            {count >= 2 && !sameRoute && (
              <div className="flex items-center gap-2 text-yellow-300 text-xs font-semibold"><AlertTriangle className="w-4 h-4" /> Unterschiedliche Routen — wird als Ausnahme gespeichert.</div>
            )}
            {dupType && (
              <div className="flex items-center gap-2 text-yellow-300 text-xs font-semibold"><AlertTriangle className="w-4 h-4" /> Zwei Pokémon teilen denselben Primärtyp.</div>
            )}
            {count < slots.length && (
              <div className="text-slate-500 text-xs">Unvollständig: {count}/{slots.length} Pokémon — wird als „Unvollständig" gespeichert.</div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Abbrechen</button>
            <button type="submit" disabled={count === 0 || create.isPending} className="btn-primary flex-1">
              {create.isPending ? 'Speichern…' : 'SoulLink speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
