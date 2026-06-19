import { useState } from 'react'
import { X, MapPin, PenLine, AlertTriangle, Lock } from 'lucide-react'
import PokemonSearch from './PokemonSearch'
import { useAddEncounter } from '../hooks/useEncounters'
import { getRoutesForGame } from '../lib/routes'
import { getLearnedRoute, useLocationMapStore } from '../lib/locationMap'
import { getTypeColor, getSpriteUrl } from '../lib/pokemon-api'
import type { Encounter, Player, PokemonStatus } from '../types/database'
import type { PokemonBasic } from '../lib/pokemon-api'

/** Optional pre-fill (e.g. when importing from the emulator live-team).
 *  Only what the encounter model can store is used — the user still picks the route. */
export interface EncounterPrefill {
  pokemon?: PokemonBasic
  nickname?: string | null
  status?: PokemonStatus
  moves?: (string | null)[]   // up to 4 move names → move_1..4
  note?: string               // seeded into the notes field (e.g. level, since encounters have no level column)
  emuPid?: string | null      // stable emulator identity → stored on the encounter (evolution-proof)
  emuLocationId?: number | null  // current emulator location id → auto-learn id→route on save
  // Read-only live data shown in the import modal (comes from Lua, not editable):
  level?: number | null
  hp?: number | null
  maxHp?: number | null
  item?: string | null
}

interface Props {
  runId: string
  player: Player
  game: string
  onClose: () => void
  /** Pre-selected route (e.g. from the encounter checklist). */
  defaultRoute?: string
  prefill?: EncounterPrefill
  /** My existing encounters — used to detect route + PID duplicates before saving. */
  myEncounters?: Encounter[]
  /** Called instead of inserting when the same emulator PID already exists
   *  (PID is the unique identity) — open the existing encounter rather than duplicating. */
  onOpenExisting?: (enc: Encounter) => void
}

export default function AddEncounterModal({ runId, player, game, onClose, defaultRoute, prefill, myEncounters, onOpenExisting }: Props) {
  const addEncounter = useAddEncounter()
  const routes = getRoutesForGame(game)
  const routeInList = !!defaultRoute && routes.includes(defaultRoute)
  const isImport = !!prefill?.pokemon

  const [selectedPokemon, setSelectedPokemon] = useState<PokemonBasic | null>(prefill?.pokemon ?? null)
  const [nickname, setNickname] = useState(prefill?.nickname ?? '')
  const [location, setLocation] = useState(
    routeInList ? defaultRoute! : defaultRoute ? 'Eigene Route...' : ''
  )
  const [customLocation, setCustomLocation] = useState(routeInList ? '' : defaultRoute ?? '')
  const [notes, setNotes] = useState(prefill?.note ?? '')
  const [error, setError] = useState('')
  const [dupWarning, setDupWarning] = useState<Encounter | null>(null)

  const isCustom = location === 'Eigene Route...'
  const finalLocation = isCustom ? customLocation.trim() : location

  // Auto-Learning-Hinweis: aktuelle Emulator-Orts-ID und ihr (evtl. schon gelerntes) Mapping.
  const emuLocId = prefill?.emuLocationId ?? null
  const emuLocMapped = emuLocId != null ? getLearnedRoute(game, emuLocId) : null
  // Read-only Live-Daten (aus Lua) für den Import.
  const STATUS_DE: Record<string, string> = { alive: 'Am Leben', dead: 'Besiegt', boxed: 'In Box', missing: 'Vermisst' }
  const liveMoves = (prefill?.moves ?? []).filter(Boolean) as string[]

  // PID = eindeutige Identität: existiert bereits ein Encounter mit derselben
  // Emulator-PID, wird NIE ein zweiter angelegt — stattdessen der vorhandene geöffnet.
  function findByPid(): Encounter | null {
    const pid = prefill?.emuPid
    if (!pid) return null
    return myEncounters?.find((enc) => enc.emu_pid === pid) ?? null
  }

  async function doSave() {
    if (!selectedPokemon || !finalLocation) return
    const pidMatch = findByPid()
    if (pidMatch) { onOpenExisting?.(pidMatch); onClose(); return }
    setError('')
    try {
      await addEncounter.mutateAsync({
        player_id: player.id,
        run_id: runId,
        location: finalLocation,
        pokemon_name: selectedPokemon.name,
        pokemon_id: selectedPokemon.id,
        nickname: nickname.trim() || null,
        status: prefill?.status ?? 'alive',
        notes: notes.trim() || null,
        types: selectedPokemon.types,
        move_1: prefill?.moves?.[0] ?? null,
        move_2: prefill?.moves?.[1] ?? null,
        move_3: prefill?.moves?.[2] ?? null,
        move_4: prefill?.moves?.[3] ?? null,
        emu_pid: prefill?.emuPid ?? null,
      })
      // Auto-Learning: unbekannte Emulator-Orts-ID mit der gewählten Route verknüpfen
      // (nur wenn noch nicht gelernt — Korrekturen laufen über den Orte-Manager).
      const locId = prefill?.emuLocationId
      if (locId != null && !getLearnedRoute(game, locId)) {
        useLocationMapStore.getState().setMapping(game, locId, finalLocation)
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPokemon || !finalLocation) return
    // Schon übernommen (gleiche PID)? → vorhandenen Encounter öffnen, nicht duplizieren.
    const pidMatch = findByPid()
    if (pidMatch) { onOpenExisting?.(pidMatch); onClose(); return }
    const existing = myEncounters?.find((enc) => enc.location === finalLocation) ?? null
    if (existing) {
      setDupWarning(existing)
      return
    }
    await doSave()
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-lg border border-[#2e2e42] shadow-2xl anim-pop">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#2e2e42]">
          <div>
            <h2 className="text-white font-black text-xl">{isImport ? 'Als Encounter übernehmen' : 'Encounter hinzufügen'}</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {player.name} · {game}{isImport ? ' · aus Emulator' : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          {error && (
            <div className="bg-red-950/50 border border-red-800 text-red-400 rounded-xl p-4 text-sm">{error}</div>
          )}

          {/* Duplicate-Route-Warnung */}
          {dupWarning && selectedPokemon && (
            <div className="rounded-2xl border border-yellow-700/50 bg-yellow-950/30 p-5 space-y-4">
              <div className="flex items-center gap-2 text-yellow-400 font-black text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Route bereits verwendet
              </div>
              <p className="text-slate-400 text-xs">
                Für diese Route existiert bereits ein Encounter. Nach klassischen Nuzlocke-Regeln ist nur der erste Encounter einer Route erlaubt.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#16161f] border border-[#2e2e42] p-3 text-center">
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Bereits gespeichert</div>
                  {dupWarning.pokemon_id != null && (
                    <img src={getSpriteUrl(dupWarning.pokemon_id)} alt="" className="w-14 h-14 object-contain mx-auto" />
                  )}
                  <div className="text-white text-xs font-bold capitalize mt-1">{dupWarning.nickname ?? dupWarning.pokemon_name}</div>
                </div>
                <div className="rounded-xl bg-[#16161f] border border-[#2e2e42] p-3 text-center">
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Neues Pokémon</div>
                  <img src={selectedPokemon.sprite} alt="" className="w-14 h-14 object-contain mx-auto" />
                  <div className="text-white text-xs font-bold capitalize mt-1">{nickname.trim() || selectedPokemon.name}</div>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setDupWarning(null)} className="btn-ghost flex-1">Abbrechen</button>
                <button
                  type="button"
                  onClick={doSave}
                  disabled={addEncounter.isPending}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all bg-red-700 hover:bg-red-600 text-white disabled:opacity-50"
                >
                  {addEncounter.isPending ? 'Wird gespeichert…' : 'Trotzdem speichern'}
                </button>
              </div>
            </div>
          )}

          {/* Pokémon */}
          <div>
            <label className="text-slate-300 text-sm font-semibold mb-2 block">
              Pokémon {!isImport && <span className="text-slate-500 font-normal">(Gen I–V)</span>}
            </label>

            {isImport && selectedPokemon ? (
              // Emulator-Import: Live-Daten read-only (kommen aus Lua, nicht editierbar).
              <div className="rounded-2xl border border-[#2e2e42] bg-[#16161f] p-4 space-y-3">
                <div className="flex items-center gap-4">
                  <img src={selectedPokemon.sprite} alt="" className="w-16 h-16 object-contain drop-shadow-md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-white capitalize font-bold text-lg truncate">{selectedPokemon.name}</div>
                    <div className="text-slate-500 text-xs mb-2">
                      #{String(selectedPokemon.id).padStart(3, '0')}{prefill?.level != null && ` · Lv ${prefill.level}`}
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {selectedPokemon.types.map((t) => (
                        <span key={t} className="type-badge" style={{ background: getTypeColor(t) }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400">
                  {prefill?.level != null && <span>Level: <span className="text-slate-200">{prefill.level}</span></span>}
                  {prefill?.maxHp != null && <span>KP: <span className="text-slate-200">{prefill.hp ?? 0}/{prefill.maxHp}</span></span>}
                  <span>Status: <span className="text-slate-200">{STATUS_DE[prefill?.status ?? 'alive']}</span></span>
                  {prefill?.item && <span>Item: <span className="text-slate-200">{prefill.item}</span></span>}
                  {prefill?.emuPid && <span className="col-span-2 truncate">PID: <span className="text-slate-300 font-mono">{prefill.emuPid}</span></span>}
                </div>
                {liveMoves.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {liveMoves.map((m) => (
                      <span key={m} className="px-1.5 py-0.5 rounded bg-[#1c1c26] border border-[#2e2e42] text-slate-300 text-[10px]">{m}</span>
                    ))}
                  </div>
                )}
                <p className="flex items-start gap-1.5 text-[11px] text-slate-500 pt-0.5">
                  <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Diese Daten kommen aus dem Emulator und werden automatisch synchronisiert. Editierbar bleiben Route, Spitzname und Notizen.
                </p>
              </div>
            ) : (
              <>
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
              </>
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
            {emuLocId != null && (
              emuLocMapped ? (
                <p className="text-slate-500 text-[11px] mt-1.5">
                  Ort-ID {emuLocId} ist als „{emuLocMapped}" gespeichert (im Orte-Manager änderbar).
                </p>
              ) : (
                <p className="text-emerald-500/80 text-[11px] mt-1.5">
                  Diese Auswahl wird mit Ort-ID {emuLocId} verknüpft und beim nächsten Mal automatisch erkannt.
                </p>
              )
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
