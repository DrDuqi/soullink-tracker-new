import { useState, useEffect } from 'react'
import { X, Link2, Clock, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react'
import { getSpriteUrl } from '../lib/pokemon-api'
import { useCreateRequest } from '../hooks/useRequests'
import { compareRoutes, type RouteMatchResult } from '../lib/fuzzyMatch'
import type { Encounter, Player } from '../types/database'

interface Props {
  runId: string
  game: string
  players: Player[]
  myPlayerId: string
  encounters: Encounter[]
  linkedIds: Set<string>
  onClose: () => void
}

export default function SoulLinkModal({ runId, game: _game, players, myPlayerId, encounters, linkedIds, onClose }: Props) {
  const createRequest = useCreateRequest()
  const [enc1Id, setEnc1Id] = useState('')
  const [enc2Id, setEnc2Id] = useState('')
  const [routeMatch, setRouteMatch] = useState<RouteMatchResult | null>(null)
  const [exceptionChecked, setExceptionChecked] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const p1 = players.find((p) => p.player_number === 1)
  const p2 = players.find((p) => p.player_number === 2)
  const myPlayer = players.find((p) => p.id === myPlayerId)
  const partnerPlayer = players.find((p) => p.id !== myPlayerId)

  const enc1Options = encounters.filter((e) => e.player_id === p1?.id && !linkedIds.has(e.id))
  const enc2Options = encounters.filter((e) => e.player_id === p2?.id && !linkedIds.has(e.id))
  const e1 = encounters.find((e) => e.id === enc1Id)
  const e2 = encounters.find((e) => e.id === enc2Id)

  useEffect(() => {
    if (e1 && e2) {
      setRouteMatch(compareRoutes(e1.location, e2.location))
      setExceptionChecked(false)
    } else {
      setRouteMatch(null)
    }
  }, [enc1Id, enc2Id, e1?.location, e2?.location])

  const canSubmit = (() => {
    if (!enc1Id || !enc2Id) return false
    if (!routeMatch) return false
    if (routeMatch === 'different' && !exceptionChecked) return false
    return true
  })()

  const routeMatchType = (): 'exact' | 'similar' | 'manual_exception' => {
    if (routeMatch === 'exact') return 'exact'
    if (routeMatch === 'similar') return 'similar'
    return 'manual_exception'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !myPlayer || !partnerPlayer) return
    setError('')
    try {
      await createRequest.mutateAsync({
        run_id: runId,
        request_type: 'link',
        requested_by_player_id: myPlayer.id,
        target_player_id: partnerPlayer.id,
        encounter1_id: enc1Id,
        encounter2_id: enc2Id,
        soul_link_id: null,
        trigger_encounter_id: null,
        route_match_type: routeMatchType(),
      })
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Senden')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-lg border border-[#2e2e42] shadow-2xl anim-pop">
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#2e2e42]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pk-red/10 border border-pk-red/30 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-pk-red" />
            </div>
            <div>
              <h2 className="text-white font-black text-xl">Soul Link anfragen</h2>
              <p className="text-slate-400 text-sm">Anfrage an {partnerPlayer?.name ?? 'Partner'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="px-7 py-10 text-center anim-pop">
            <div className="w-16 h-16 rounded-full bg-pk-red/10 border border-pk-red/30 flex items-center justify-center mx-auto mb-5">
              <Clock className="w-8 h-8 text-pk-red" />
            </div>
            <h3 className="text-white font-black text-xl mb-2">Anfrage gesendet!</h3>
            <p className="text-slate-400 text-base mb-8">
              Warte auf Bestätigung von <span className="text-white font-bold">{partnerPlayer?.name}</span>…
            </p>
            <button onClick={onClose} className="btn-ghost px-10">Schließen</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
            {error && <div className="bg-red-950/50 border border-red-800 text-red-400 rounded-xl p-4 text-sm">{error}</div>}

            <p className="text-slate-400 text-sm">
              Die Link-Anfrage wird an <span className="text-white font-bold">{partnerPlayer?.name ?? 'deinen Partner'}</span> gesendet und muss von ihm/ihr bestätigt werden.
            </p>

            {/* Player 1 */}
            <div>
              <label className="text-slate-300 text-sm font-bold mb-2 block">{p1?.name ?? 'Spieler 1'}</label>
              <select value={enc1Id} onChange={(e) => setEnc1Id(e.target.value)} className="pk-input" required>
                <option value="">Pokémon auswählen…</option>
                {enc1Options.map((e) => (
                  <option key={e.id} value={e.id}>{e.nickname ?? e.pokemon_name} — {e.location}</option>
                ))}
              </select>
              {enc1Options.length === 0 && <p className="text-slate-500 text-xs mt-1.5">Keine nicht-verlinkten Pokémon.</p>}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#2e2e42]" />
              <div className="w-10 h-10 rounded-full bg-pk-red/10 border border-pk-red/30 flex items-center justify-center">
                <Link2 className="w-4 h-4 text-pk-red" />
              </div>
              <div className="flex-1 h-px bg-[#2e2e42]" />
            </div>

            {/* Player 2 */}
            <div>
              <label className="text-slate-300 text-sm font-bold mb-2 block">{p2?.name ?? 'Spieler 2'}</label>
              <select value={enc2Id} onChange={(e) => setEnc2Id(e.target.value)} className="pk-input" required>
                <option value="">Pokémon auswählen…</option>
                {enc2Options.map((e) => (
                  <option key={e.id} value={e.id}>{e.nickname ?? e.pokemon_name} — {e.location}</option>
                ))}
              </select>
              {enc2Options.length === 0 && <p className="text-slate-500 text-xs mt-1.5">Keine nicht-verlinkten Pokémon.</p>}
            </div>

            {/* Route match feedback */}
            {routeMatch && (
              <RouteMatchBanner match={routeMatch} e1={e1} e2={e2} exceptionChecked={exceptionChecked} onException={setExceptionChecked} />
            )}

            {/* Preview */}
            {e1 && e2 && (
              <div className="bg-[#16161f] border border-[#2e2e42] rounded-2xl p-5 flex items-center justify-around anim-slide-d">
                {[e1, e2].map((e, i) => (
                  <div key={e.id} className="text-center">
                    {e.pokemon_id && <img src={getSpriteUrl(e.pokemon_id)} className="w-16 h-16 mx-auto object-contain drop-shadow-md" alt="" />}
                    <div className="text-white text-sm capitalize font-bold mt-1">{e.nickname ?? e.pokemon_name}</div>
                    <div className="text-slate-500 text-xs">{e.location}</div>
                    {i === 0 && (
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">Abbrechen</button>
              <button type="submit" disabled={!canSubmit || createRequest.isPending} className="btn-primary flex-1">
                {createRequest.isPending ? 'Senden…' : 'Anfrage senden'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function RouteMatchBanner({
  match, e1, e2, exceptionChecked, onException,
}: {
  match: RouteMatchResult
  e1: Encounter | undefined
  e2: Encounter | undefined
  exceptionChecked: boolean
  onException: (v: boolean) => void
}) {
  if (match === 'exact') {
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-3 border" style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.3)' }}>
        <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
        <span className="text-green-400 text-sm font-semibold">Gleiche Route — SoulLink-Regel erfüllt.</span>
      </div>
    )
  }
  if (match === 'similar') {
    return (
      <div className="rounded-xl px-4 py-3 border" style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.3)' }}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
          <span className="text-yellow-300 text-sm font-semibold">
            Ähnliche Routen erkannt: „{e1?.location}" ≈ „{e2?.location}"
          </span>
        </div>
        <p className="text-yellow-400/70 text-xs mt-1.5 ml-8">
          Diese Routen sehen ähnlich aus (möglicher Tippfehler). Du kannst trotzdem fortfahren.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-xl px-4 py-4 border" style={{ background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.3)' }}>
      <div className="flex items-center gap-3 mb-2">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
        <span className="text-red-300 text-sm font-bold">Unterschiedliche Routen!</span>
      </div>
      <p className="text-slate-400 text-xs mb-3 ml-8">
        „{e1?.location}" ≠ „{e2?.location}" — Laut SoulLink-Regeln müssen Pokémon auf derselben Route gefangen werden.
      </p>
      <label className="flex items-center gap-2.5 cursor-pointer ml-8">
        <input
          type="checkbox"
          checked={exceptionChecked}
          onChange={(e) => onException(e.target.checked)}
          className="w-4 h-4 rounded accent-pk-red"
        />
        <span className="text-slate-300 text-sm font-semibold">Ausnahme aktivieren — Route trotzdem verbinden</span>
      </label>
      {exceptionChecked && (
        <p className="text-amber-400 text-xs mt-2 ml-8">
          Der Partner muss dieser Ausnahme ausdrücklich zustimmen.
        </p>
      )}
    </div>
  )
}
