import { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Skull, Heart, Box, HelpCircle, Zap, Shield, Swords, Wifi } from 'lucide-react'
import {
  getOfficialArtUrl,
  getSpriteUrl,
  getTypeColor,
  TYPE_NAMES_DE,
  fetchPokemonDetails,
  fetchEvolutionChain,
  fetchPokemonMoves,
  fetchMoveDetails,
  formatMoveName,
} from '../lib/pokemon-api'
import { useUpdateEncounter, useUpdateMoves } from '../hooks/useEncounters'
import { useToastStore } from '../store/toastStore'
import type { Encounter } from '../types/database'
import type { PokemonDetails, EvolutionStage, MoveDetail } from '../lib/pokemon-api'

const MOVE_CAT_DE: Record<'physical' | 'special' | 'status', { label: string; color: string }> = {
  physical: { label: 'Physisch', color: '#f87171' },
  special:  { label: 'Spezial',  color: '#60a5fa' },
  status:   { label: 'Status',   color: '#a78bfa' },
}

interface Props {
  encounter: Encounter
  linkedEncounter?: Encounter | null
  linkedPlayerName?: string
  myEncounter?: boolean
  onClose: () => void
}

const STATUS_ICONS: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  alive:   { icon: <Heart   className="w-4 h-4" />, label: 'Am Leben', color: '#4ade80' },
  dead:    { icon: <Skull   className="w-4 h-4" />, label: 'Besiegt',  color: '#f87171' },
  boxed:   { icon: <Box     className="w-4 h-4" />, label: 'In Box',   color: '#fbbf24' },
  missing: { icon: <HelpCircle className="w-4 h-4" />, label: 'Vermisst', color: '#94a3b8' },
}

const STAT_LABELS: Record<string, { short: string; icon: React.ReactNode; color: string }> = {
  hp:             { short: 'KP',  icon: <Heart className="w-3 h-3" />,   color: '#4ade80' },
  attack:         { short: 'AN',  icon: <Swords className="w-3 h-3" />,  color: '#f87171' },
  defense:        { short: 'VE',  icon: <Shield className="w-3 h-3" />,  color: '#60a5fa' },
  specialAttack:  { short: 'SAN', icon: <Zap className="w-3 h-3" />,     color: '#c084fc' },
  specialDefense: { short: 'SVE', icon: <Shield className="w-3 h-3" />,  color: '#34d399' },
  speed:          { short: 'IN',  icon: <Zap className="w-3 h-3" />,     color: '#fbbf24' },
}
const STAT_KEYS = ['hp','attack','defense','specialAttack','specialDefense','speed'] as const

export default function PokemonDetailModal({ encounter, linkedEncounter, linkedPlayerName, myEncounter, onClose }: Props) {
  const [details, setDetails] = useState<PokemonDetails | null>(null)
  const [evolutionChain, setEvolutionChain] = useState<EvolutionStage[]>([])
  const [loading, setLoading] = useState(true)
  const [evolving, setEvolving] = useState(false)
  const [movesList, setMovesList] = useState<string[]>([])
  const [moves, setMoves] = useState<[string,string,string,string]>([
    encounter.move_1 ?? '',
    encounter.move_2 ?? '',
    encounter.move_3 ?? '',
    encounter.move_4 ?? '',
  ])
  const [moveSaved, setMoveSaved] = useState(false)
  const [moveDetails, setMoveDetails] = useState<Record<number, MoveDetail | null>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateEncounter = useUpdateEncounter()
  const updateMoves = useUpdateMoves()
  const toast = useToastStore()

  useEffect(() => {
    if (!encounter.pokemon_id) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      fetchPokemonDetails(encounter.pokemon_id),
      fetchEvolutionChain(encounter.pokemon_id),
      fetchPokemonMoves(encounter.pokemon_id),
    ]).then(([det, chain, mvs]) => {
      setDetails(det)
      setEvolutionChain(chain)
      setMovesList(mvs)
      setLoading(false)
    })
  }, [encounter.pokemon_id])

  // Sync moves if encounter prop changes (e.g. after realtime update)
  useEffect(() => {
    setMoves([
      encounter.move_1 ?? '',
      encounter.move_2 ?? '',
      encounter.move_3 ?? '',
      encounter.move_4 ?? '',
    ])
  }, [encounter.move_1, encounter.move_2, encounter.move_3, encounter.move_4])

  // Resolve move metadata (type / category / power / accuracy) from PokéAPI
  useEffect(() => {
    let cancelled = false
    ;([0, 1, 2, 3] as const).forEach((idx) => {
      const mv = moves[idx]?.trim()
      if (!mv) { setMoveDetails((d) => (d[idx] ? { ...d, [idx]: null } : d)); return }
      fetchMoveDetails(mv).then((det) => { if (!cancelled) setMoveDetails((d) => ({ ...d, [idx]: det })) })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves[0], moves[1], moves[2], moves[3]])

  async function saveMoves(updated: [string,string,string,string]) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await updateMoves.mutateAsync({
          id: encounter.id,
          runId: encounter.run_id,
          moves: {
            move_1: updated[0] || null,
            move_2: updated[1] || null,
            move_3: updated[2] || null,
            move_4: updated[3] || null,
          },
        })
        setMoveSaved(true)
        setTimeout(() => setMoveSaved(false), 1800)
      } catch {
        toast.show('Fehler beim Speichern der Attacken', 'error')
      }
    }, 600)
  }

  function handleMoveChange(idx: number, value: string) {
    const next = [...moves] as [string,string,string,string]
    next[idx] = value
    setMoves(next)
    saveMoves(next)
  }

  const currentIdx = evolutionChain.findIndex((s) => s.id === encounter.pokemon_id)
  const nextEvolution = currentIdx >= 0 && currentIdx < evolutionChain.length - 1
    ? evolutionChain[currentIdx + 1]
    : undefined
  const prevEvolution = currentIdx > 0
    ? evolutionChain[currentIdx - 1]
    : undefined

  const types = details?.types ?? encounter.types ?? []
  const statusInfo = STATUS_ICONS[encounter.status] ?? STATUS_ICONS.alive
  // Mit dem Emulator verbunden → Art/Level/Attacken/Status/Entwicklung kommen aus
  // Lua und werden automatisch synchronisiert; hier nicht manuell editierbar.
  const isLiveSynced = !!encounter.emu_pid
  const canEditMoves = myEncounter && !isLiveSynced
  const canEvolveManually = myEncounter && !isLiveSynced

  async function handleDevolve() {
    if (!prevEvolution || !myEncounter) return
    setEvolving(true)
    try {
      const prevDetails = await fetchPokemonDetails(prevEvolution.id)
      await updateEncounter.mutateAsync({
        id: encounter.id,
        runId: encounter.run_id,
        updates: {
          pokemon_id: prevEvolution.id,
          pokemon_name: prevEvolution.name,
          types: prevDetails?.types ?? encounter.types,
        },
        prevPokemonName: encounter.nickname ?? encounter.pokemon_name,
      })
      toast.show(`✓ ${encounter.nickname ?? encounter.pokemon_name} wurde zu ${prevEvolution.name} zurückentwickelt.`, 'success')
      onClose()
    } catch {
      toast.show('Fehler beim Zurückentwickeln', 'error')
    } finally {
      setEvolving(false)
    }
  }

  async function handleEvolve() {
    if (!nextEvolution || !myEncounter) return
    setEvolving(true)
    try {
      // Fetch next evo's types
      const nextDetails = await fetchPokemonDetails(nextEvolution.id)
      await updateEncounter.mutateAsync({
        id: encounter.id,
        runId: encounter.run_id,
        updates: {
          pokemon_id: nextEvolution.id,
          pokemon_name: nextEvolution.name,
          types: nextDetails?.types ?? encounter.types,
        },
        prevPokemonName: encounter.nickname ?? encounter.pokemon_name,
      })
      toast.show(`✓ ${encounter.nickname ?? encounter.pokemon_name} hat sich zu ${nextEvolution.name} entwickelt!`, 'success')
      onClose()
    } catch {
      toast.show('Fehler beim Entwickeln', 'error')
    } finally {
      setEvolving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-xl border border-[#2e2e42] shadow-2xl anim-pop overflow-hidden" style={{ maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Type gradient header bar */}
        {types.length > 0 && (
          <div className="h-2" style={{
            background: types.length === 2
              ? `linear-gradient(90deg,${getTypeColor(types[0])} 0%,${getTypeColor(types[1])} 100%)`
              : getTypeColor(types[0]),
          }} />
        )}

        {/* Top: artwork + name */}
        <div className="relative flex items-start gap-4 p-6 pb-4">
          {/* Official artwork */}
          <div className="shrink-0 w-28 h-28 flex items-center justify-center rounded-2xl"
            style={{ background: types.length > 0 ? `${getTypeColor(types[0])}18` : '#16161f' }}>
            {encounter.pokemon_id ? (
              <img
                src={getOfficialArtUrl(encounter.pokemon_id)}
                alt={encounter.pokemon_name}
                className={`w-24 h-24 object-contain drop-shadow-xl ${encounter.status === 'dead' ? 'grayscale' : ''}`}
              />
            ) : (
              <span className="text-4xl">?</span>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 pt-1">
            {encounter.pokemon_id && (
              <p className="text-slate-500 text-xs font-mono mb-0.5">#{String(encounter.pokemon_id).padStart(3, '0')}</p>
            )}
            <h2 className="text-white text-2xl font-black capitalize leading-tight">
              {encounter.nickname ?? encounter.pokemon_name}
            </h2>
            {encounter.nickname && (
              <p className="text-slate-400 text-sm capitalize">{encounter.pokemon_name}</p>
            )}

            {/* Types */}
            <div className="flex gap-1.5 mt-2">
              {types.map((t) => (
                <span key={t} className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: getTypeColor(t) }}>
                  {TYPE_NAMES_DE[t] ?? t}
                </span>
              ))}
            </div>

            {/* Status + location */}
            <div className="flex items-center gap-2 mt-2.5">
              <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg" style={{ color: statusInfo.color, background: `${statusInfo.color}18` }}>
                {statusInfo.icon} {statusInfo.label}
              </span>
              <span className="text-slate-500 text-xs">{encounter.location}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Emulator-Sync-Hinweis */}
          {isLiveSynced && (
            <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 px-4 py-3 flex items-start gap-2">
              <Wifi className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <p className="text-emerald-300/90 text-xs">
                Dieses Pokémon ist mit dem Emulator synchronisiert. Art, Level, Attacken, HP, Status, Item und Entwicklung kommen aus Lua und werden automatisch aktualisiert. Manuell änderbar bleiben Route, Spitzname und Notizen.
              </p>
            </div>
          )}

          {/* Soul Link partner */}
          {linkedEncounter && (
            <div className="rounded-2xl border border-pk-red/25 p-4" style={{ background: 'rgba(204,0,0,0.06)' }}>
              <p className="text-slate-400 text-xs font-bold mb-3 uppercase tracking-wider">Soul Link</p>
              <div className="flex items-center gap-3">
                {linkedEncounter.pokemon_id && (
                  <img src={getSpriteUrl(linkedEncounter.pokemon_id)} className="w-12 h-12 object-contain" alt="" />
                )}
                <div>
                  <div className="text-white font-black capitalize">{linkedEncounter.nickname ?? linkedEncounter.pokemon_name}</div>
                  <div className="text-slate-400 text-xs">{linkedPlayerName ? `${linkedPlayerName}'s Pokémon` : 'Partner'} · {linkedEncounter.location}</div>
                  <div className="flex gap-1.5 mt-1">
                    {(linkedEncounter.types ?? []).map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: getTypeColor(t) }}>
                        {TYPE_NAMES_DE[t] ?? t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Base stats */}
          {loading ? (
            <div className="text-center py-6 text-slate-500 text-sm">Lade Daten…</div>
          ) : details ? (
            <div>
              <p className="text-slate-400 text-xs font-bold mb-3 uppercase tracking-wider">Basiswerte</p>
              <div className="space-y-2">
                {STAT_KEYS.map((key) => {
                  const { short, icon, color } = STAT_LABELS[key]
                  const value = details.stats[key]
                  const pct = Math.min(100, Math.round((value / 255) * 100))
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-12 shrink-0" style={{ color }}>
                        {icon}
                        <span className="text-xs font-bold">{short}</span>
                      </div>
                      <div className="text-white text-xs font-mono w-8 shrink-0">{value}</div>
                      <div className="flex-1 h-2 rounded-full bg-white/5">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Height & Weight */}
              <div className="flex gap-4 mt-4">
                <div className="text-center flex-1 rounded-xl py-2" style={{ background: '#16161f' }}>
                  <div className="text-slate-400 text-xs">Größe</div>
                  <div className="text-white text-sm font-bold">{(details.height / 10).toFixed(1)} m</div>
                </div>
                <div className="text-center flex-1 rounded-xl py-2" style={{ background: '#16161f' }}>
                  <div className="text-slate-400 text-xs">Gewicht</div>
                  <div className="text-white text-sm font-bold">{(details.weight / 10).toFixed(1)} kg</div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Moves */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Attacken</p>
              {moveSaved && (
                <span className="text-green-400 text-[10px] font-bold animate-pulse">✓ Gespeichert</span>
              )}
            </div>
            {/* datalist for autocomplete */}
            <datalist id={`moves-${encounter.id}`}>
              {movesList.map((m) => (
                <option key={m} value={formatMoveName(m)} />
              ))}
            </datalist>
            <div className="grid grid-cols-2 gap-2">
              {([0,1,2,3] as const).map((idx) => {
                const det = moveDetails[idx]
                const cat = det ? MOVE_CAT_DE[det.damageClass] : null
                return (
                  <div key={idx}>
                    <div className="text-slate-600 text-[10px] font-bold mb-1">Attacke {idx + 1}</div>
                    {canEditMoves ? (
                      <input
                        list={`moves-${encounter.id}`}
                        value={moves[idx]}
                        onChange={(e) => handleMoveChange(idx, e.target.value)}
                        placeholder="—"
                        className="w-full bg-[#16161f] border border-[#2e2e42] rounded-lg px-2.5 py-1.5 text-white text-xs font-medium outline-none focus:border-pk-red transition-colors placeholder:text-slate-700"
                      />
                    ) : (
                      <div className="w-full bg-[#16161f] border border-[#2e2e42] rounded-lg px-2.5 py-1.5 text-xs font-medium min-h-[32px]"
                        style={{ color: moves[idx] ? '#e2e8f0' : '#4a5568' }}>
                        {moves[idx] || '—'}
                      </div>
                    )}
                    {det && cat && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: getTypeColor(det.type) }}>
                          {TYPE_NAMES_DE[det.type] ?? det.type}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ color: cat.color, background: `${cat.color}22` }}>
                          {cat.label}
                        </span>
                        {det.power != null && <span className="text-slate-500 text-[9px] font-mono">💥{det.power}</span>}
                        {det.accuracy != null && <span className="text-slate-500 text-[9px] font-mono">🎯{det.accuracy}%</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Evolution chain */}
          {evolutionChain.length > 1 && (
            <div>
              <p className="text-slate-400 text-xs font-bold mb-3 uppercase tracking-wider">Entwicklungslinie</p>
              <div className="flex items-center gap-2 flex-wrap">
                {evolutionChain.map((stage, i) => {
                  const isCurrent = stage.id === encounter.pokemon_id
                  return (
                    <div key={stage.id} className="flex items-center gap-2">
                      {i > 0 && (
                        <div className="text-center">
                          <ChevronRight className="w-4 h-4 text-slate-600" />
                          {(evolutionChain[i].level || evolutionChain[i].item || evolutionChain[i].happiness) && (
                            <div className="text-slate-600 text-[9px] text-center">
                              {stage.level ? `Lv.${stage.level}` : stage.item ? stage.item.replace('-', ' ') : stage.happiness ? 'Freundschaft' : ''}
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        className={`text-center rounded-xl p-2 border transition-all ${isCurrent ? 'border-pk-red/50' : 'border-transparent'}`}
                        style={{ background: isCurrent ? 'rgba(204,0,0,0.1)' : 'rgba(255,255,255,0.04)' }}
                      >
                        <img src={getSpriteUrl(stage.id)} className="w-12 h-12 object-contain mx-auto" alt="" />
                        <div className={`text-[10px] font-bold capitalize mt-1 ${isCurrent ? 'text-pk-red' : 'text-slate-400'}`}>
                          {stage.name}
                        </div>
                        {isCurrent && <div className="text-pk-red text-[8px]">Aktuell</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-1 flex-wrap">
            <button onClick={onClose} className="btn-ghost flex-1 py-3 min-w-24">Schließen</button>
            {prevEvolution && canEvolveManually && encounter.status !== 'dead' && (
              <button
                onClick={handleDevolve}
                disabled={evolving}
                className="btn-ghost flex-1 py-3 capitalize flex items-center justify-center gap-2 min-w-24"
                style={{ borderColor: '#4b5563', color: '#94a3b8' }}
              >
                <ChevronLeft className="w-4 h-4" />
                {evolving ? 'Lädt…' : `← ${prevEvolution.name}`}
              </button>
            )}
            {nextEvolution && canEvolveManually && encounter.status !== 'dead' && (
              <button
                onClick={handleEvolve}
                disabled={evolving}
                className="btn-yellow flex-1 py-3 capitalize flex items-center justify-center gap-2 min-w-24"
              >
                <ChevronRight className="w-4 h-4" />
                {evolving ? 'Entwickelt…' : `→ ${nextEvolution.name}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
