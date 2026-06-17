import { useEffect, useState } from 'react'
import { Wifi, WifiOff, Loader2, Gamepad2, Heart, Skull, Play, Pause, Plus, Check } from 'lucide-react'
import { getSpriteUrl, getTypeColor, fetchPokemon, fetchMoveById, fetchItemName, fetchAbilityName } from '../lib/pokemon-api'
import { STATUS_LABEL_DE, natureName } from '../lib/emulatorSync'
import type { EmulatorMon } from '../lib/emulatorSync'
import type { EncounterPrefill } from './AddEncounterModal'
import { useEmulatorSync } from '../hooks/useEmulatorSync'

const ENABLED_KEY = 'soullink-emusync-enabled'
const GAME_LABEL: Record<string, string> = { platinum: 'Platinum', heartgold: 'HeartGold', firered: 'FireRed', emerald: 'Emerald', black: 'Black' }

// Resolves ability / item / move names (by id, cached) for one Pokémon and
// renders the enriched detail. Keyed on the ids so the 1s status ticker doesn't
// cause refetches; cache makes repeats free.
function MonRich({ mon, imported, onImport }: { mon: EmulatorMon; imported: boolean; onImport?: (p: EncounterPrefill) => void }) {
  const [moves, setMoves] = useState<({ name: string; type: string } | null)[]>([])
  const [ability, setAbility] = useState<string | null>(null)
  const [item, setItem] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const moveKey = (mon.moveIds ?? []).join(',')

  useEffect(() => {
    let cancelled = false
    const ids = (mon.moveIds ?? []).filter((x) => x > 0)
    Promise.all(ids.map((id) => fetchMoveById(id))).then((r) => { if (!cancelled) setMoves(r) })
    if (mon.abilityId) fetchAbilityName(mon.abilityId).then((n) => { if (!cancelled) setAbility(n) })
    if (mon.heldItemId) fetchItemName(mon.heldItemId).then((n) => { if (!cancelled) setItem(n) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveKey, mon.abilityId, mon.heldItemId])

  // Build a prefill from data the emulator reliably provides, then hand it to the
  // EXISTING encounter modal/save-flow (no new system). The user still picks the route.
  async function doImport() {
    if (!onImport) return
    setImporting(true)
    try {
      const poke = await fetchPokemon(mon.speciesId)
      if (!poke) return
      const ids = (mon.moveIds ?? []).filter((x) => x > 0)
      const mv = await Promise.all(ids.map((id) => fetchMoveById(id)))
      onImport({
        pokemon: poke,
        nickname: mon.nickname ?? null,
        status: mon.fainted ? 'dead' : 'alive',
        moves: mv.map((m) => m?.name ?? null),
        note: `Aus Emulator · Lv ${mon.level}`,
      })
    } finally {
      setImporting(false)
    }
  }

  const hpPct = mon.maxHp > 0 ? Math.round((mon.hp / mon.maxHp) * 100) : 0
  const hpColor = hpPct > 50 ? '#4ade80' : hpPct > 20 ? '#fbbf24' : '#f87171'
  const nature = natureName(mon.natureId)
  const title = mon.nickname || `#${mon.speciesId}`

  return (
    <div className={`rounded-xl border p-3 ${mon.fainted ? 'border-red-900/40 bg-red-950/15 opacity-70' : 'border-[#2e2e42] bg-[#1c1c26]'}`}>
      <div className="flex items-center gap-3">
        <img src={getSpriteUrl(mon.speciesId)} alt="" className={`w-12 h-12 object-contain shrink-0 ${mon.fainted ? 'grayscale' : ''}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-white text-sm font-bold capitalize truncate">{title}</span>
            {mon.nickname && <span className="text-slate-500 text-[10px]">#{mon.speciesId}</span>}
            {mon.fainted ? <Skull className="w-3.5 h-3.5 text-red-400 shrink-0" /> : <Heart className="w-3.5 h-3.5 text-green-400 shrink-0" />}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
            <span>Lv {mon.level}</span>
            {mon.status !== 'ok' && <span className="font-bold" style={{ color: '#fbbf24' }}>{STATUS_LABEL_DE[mon.status]}</span>}
          </div>
          {/* HP bar */}
          <div className="mt-1 flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-1.5 rounded-full" style={{ width: `${hpPct}%`, background: hpColor }} />
            </div>
            <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{mon.hp}/{mon.maxHp}</span>
          </div>
        </div>
      </div>

      {/* Enriched detail */}
      <div className="mt-2 pt-2 border-t border-[#2e2e42] space-y-1 text-[10px]">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-400">
          <span>Wesen: <span className="text-slate-200">{nature ?? '—'}</span></span>
          <span>Fähigkeit: <span className="text-slate-200">{ability ?? (mon.abilityId ? '…' : '—')}</span></span>
          <span>Item: <span className="text-slate-200">{item ?? (mon.heldItemId ? '…' : '—')}</span></span>
        </div>
        <div className="flex flex-wrap gap-1 pt-0.5">
          {(mon.moveIds ?? []).filter((x) => x > 0).length === 0 ? (
            <span className="text-slate-600">Keine Attacken</span>
          ) : (
            (mon.moveIds ?? []).filter((x) => x > 0).map((id, i) => {
              const mv = moves[i]
              return (
                <span key={id} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: mv ? getTypeColor(mv.type) : '#3e3e52' }}>
                  {mv ? mv.name : `#${id}`}
                </span>
              )
            })
          )}
        </div>
      </div>

      {onImport && (
        <div className="mt-2">
          {imported ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400">
              <Check className="w-3 h-3" /> Bereits übernommen
            </span>
          ) : (
            <button
              onClick={doImport}
              disabled={importing}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ color: '#CC0000', background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.3)' }}
            >
              <Plus className="w-3 h-3" /> {importing ? 'Übernehme…' : 'Als Encounter übernehmen'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Live in-game party from the local emulator sync. Additive & non-destructive:
 *  it does NOT touch tracked encounters / soul links / the team system. */
export default function EmulatorLivePanel({
  game, onImport, importedSpeciesIds,
}: {
  game?: string
  onImport?: (p: EncounterPrefill) => void
  importedSpeciesIds?: Set<number>
}) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(ENABLED_KEY) !== '0' } catch { return true }
  })
  const { phase, team, game: liveGame, ageSec } = useEmulatorSync(enabled)

  function toggle() {
    const v = !enabled
    setEnabled(v)
    try { localStorage.setItem(ENABLED_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }

  const gameName = GAME_LABEL[(liveGame ?? game ?? '').toLowerCase()] ?? (liveGame ?? game ?? 'Spiel')

  let icon = <Gamepad2 className="w-4 h-4" />
  let title = ''
  let color = '#64748b'
  if (!enabled) { icon = <WifiOff className="w-4 h-4" />; title = 'Live-Sync deaktiviert'; color = '#64748b' }
  else if (phase === 'init') { icon = <Loader2 className="w-4 h-4 animate-spin" />; title = 'Suche Emulator…'; color = '#64748b' }
  else if (phase === 'error') { icon = <WifiOff className="w-4 h-4" />; title = 'Emulator-Sync nicht erreichbar – läuft „npm run dev"?'; color = '#f87171' }
  else if (phase === 'offline') { icon = <WifiOff className="w-4 h-4" />; title = 'Emulator nicht gefunden'; color = '#94a3b8' }
  else if (phase === 'waiting') { icon = <Loader2 className="w-4 h-4 animate-spin" />; title = 'Datei gefunden – warte auf Pokémon'; color = '#fbbf24' }
  else { icon = <Wifi className="w-4 h-4" />; title = `Verbunden mit ${gameName}`; color = '#4ade80' }

  const showAge = enabled && ageSec != null && (phase === 'connected' || phase === 'waiting')

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${color}40` }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#1c1c26' }}>
        <span style={{ color }}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-slate-200 text-xs font-black uppercase tracking-widest">Emulator Live-Team</div>
          <div className="text-[11px] font-bold" style={{ color }}>
            {title}{showAge && <span className="text-slate-500 font-medium"> · letztes Update vor {ageSec}s</span>}
          </div>
        </div>
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors border shrink-0"
          style={enabled
            ? { color: '#f87171', background: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.3)' }
            : { color: '#4ade80', background: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' }}
        >
          {enabled ? <><Pause className="w-3 h-3" /> Sync stoppen</> : <><Play className="w-3 h-3" /> Sync starten</>}
        </button>
      </div>

      {enabled && team.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3" style={{ background: '#161620' }}>
          {team.map((m) => (
            <MonRich
              key={m.slot}
              mon={m}
              imported={!!importedSpeciesIds?.has(m.speciesId)}
              onImport={onImport}
            />
          ))}
        </div>
      )}

      {enabled && team.length === 0 && phase !== 'init' && (
        <div className="px-4 py-3 text-slate-600 text-[11px]" style={{ background: '#161620' }}>
          {phase === 'connected' || phase === 'waiting'
            ? 'Noch keine Pokémon im Team erkannt.'
            : 'BizHawk + Lua starten (soullink_sync.lua) – das Team erscheint automatisch.'}
        </div>
      )}
    </div>
  )
}
