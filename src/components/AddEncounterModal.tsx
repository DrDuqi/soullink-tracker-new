import { useState } from 'react'
import { X, MapPin, PenLine } from 'lucide-react'
import PokemonSearch from './PokemonSearch'
import { useAddEncounter } from '../hooks/useEncounters'
import { getRoutesForGame } from '../lib/routes'
import { getTypeColor } from '../lib/pokemon-api'
import type { Player } from '../types/database'
import type { PokemonBasic } from '../lib/pokemon-api'

interface Props {
  runId: string
  player: Player
  game: string
  onClose: () => void
  /** Pre-selected route (e.g. from the encounter checklist). */
  defaultRoute?: string
}

export default function AddEncounterModal({ runId, player, game, onClose, defaultRoute }: Props) {
  const addEncounter = useAddEncounter()
  const routes = getRoutesForGame(game)
  const routeInList = !!defaultRoute && routes.includes(defaultRoute)

  const [selectedPokemon, setSelectedPokemon] = useState<PokemonBasic | null>(null)
  const [nickname, setNickname] = useState('')
  const [location, setLocation] = useState(
    routeInList ? defaultRoute! : defaultRoute ? 'Eigene Route...' : ''
  )
  const [customLocation, setCustomLocation] = useState(routeInList ? '' : defaultRoute ?? '')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const isCustom = location === 'Eigene Route...'
  const finalLocation = isCustom ? customLocation.trim() : location

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPokemon || !finalLocation) return
    setError('')
    try {
      await addEncounter.mutateAsync({
        player_id: player.id,
        run_id: runId,
        location: finalLocation,
        pokemon_name: selectedPokemon.name,
        pokemon_id: selectedPokemon.id,
        nickname: nickname.trim() || null,
        status: 'alive',
        notes: notes.trim() || null,
        types: selectedPokemon.types,
        move_1: null,
        move_2: null,
        move_3: null,
        move_4: null,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-lg border border-[#2e2e42] shadow-2xl anim-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#2e2e42]">
          <div>
            <h2 className="text-white font-black text-xl">Encounter hinzufügen</h2>
            <p className="text-slate-400 text-sm mt-0.5">{player.name} · {game}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          {error && (
            <div className="bg-red-950/50 border border-red-800 text-red-400 rounded-xl p-4 text-sm">{error}</div>
          )}

          {/* Pokémon */}
          <div>
            <label className="text-slate-300 text-sm font-semibold mb-2 block">Pokémon <span className="text-slate-500 font-normal">(Gen I–V)</span></label>
            <PokemonSearch onSelect={setSelectedPokemon} />
            {selectedPokemon && (
              <div className="mt-3 flex items-center gap-4 bg-[#16161f] rounded-2xl px-4 py-3 border border-[#2e2e42] anim-slide-d">
                <img src={selectedPokemon.sprite} alt={selectedPokemon.name} className="w-16 h-16 object-contain drop-shadow-md" />
                <div>
                  <div className="text-white capitalize font-bold text-lg">{selectedPokemon.name}</div>
                  <div className="text-slate-500 text-xs mb-2">#{String(selectedPokemon.id).padStart(3, '0')}</div>
                  <div className="flex gap-1.5">
                    {selectedPokemon.types.map((t) => (
                      <span key={t} className="type-badge" style={{ background: getTypeColor(t) }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Route */}
          <div>
            <label className="text-slate-300 text-sm font-semibold mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Route / Gebiet
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pk-input"
              required
            >
              <option value="">Gebiet auswählen…</option>
              {routes.map((r) => <option key={r}>{r}</option>)}
            </select>
            {isCustom && (
              <input
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Eigener Gebietsname…"
                className="pk-input mt-2"
                required
                autoFocus
              />
            )}
          </div>

          {/* Nickname */}
          <div>
            <label className="text-slate-300 text-sm font-semibold mb-2 flex items-center gap-1.5">
              <PenLine className="w-4 h-4" /> Spitzname <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Einen Spitznamen vergeben…"
              className="pk-input"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-slate-300 text-sm font-semibold mb-2 block">
              Notizen <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Besonderheiten notieren…"
              rows={2}
              className="pk-input resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Abbrechen</button>
            <button
              type="submit"
              disabled={!selectedPokemon || !finalLocation || addEncounter.isPending}
              className="btn-primary flex-1"
            >
              {addEncounter.isPending ? 'Wird hinzugefügt…' : 'Encounter speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
