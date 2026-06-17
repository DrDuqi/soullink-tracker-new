import { useState } from 'react'
import { Wifi, WifiOff, Loader2, Gamepad2, Heart, Skull, Play, Pause } from 'lucide-react'
import { getSpriteUrl } from '../lib/pokemon-api'
import { STATUS_LABEL_DE } from '../lib/emulatorSync'
import { useEmulatorSync } from '../hooks/useEmulatorSync'

const ENABLED_KEY = 'soullink-emusync-enabled'
const GAME_LABEL: Record<string, string> = { platinum: 'Platinum', heartgold: 'HeartGold', firered: 'FireRed', emerald: 'Emerald', black: 'Black' }

/** Live in-game party from the local emulator sync. Additive & non-destructive:
 *  it does NOT touch tracked encounters / soul links / the team system. */
export default function EmulatorLivePanel({ game }: { game?: string }) {
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

  // Status banner (point 7)
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
      {/* Header / status */}
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

      {/* Team */}
      {enabled && team.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3" style={{ background: '#161620' }}>
          {team.map((m) => (
            <div key={m.slot} className={`rounded-xl border p-2 flex items-center gap-2 ${m.fainted ? 'border-red-900/40 bg-red-950/15 opacity-70' : 'border-[#2e2e42] bg-[#1c1c26]'}`}>
              <img src={getSpriteUrl(m.speciesId)} alt="" className={`w-10 h-10 object-contain shrink-0 ${m.fainted ? 'grayscale' : ''}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-white text-xs font-bold">#{m.speciesId}</span>
                  {m.fainted ? <Skull className="w-3 h-3 text-red-400" /> : <Heart className="w-3 h-3 text-green-400" />}
                </div>
                <div className="text-slate-400 text-[10px]">Lv {m.level} · {m.hp}/{m.maxHp}</div>
                {m.status !== 'ok' && (
                  <div className="text-[9px] font-bold" style={{ color: '#fbbf24' }}>{STATUS_LABEL_DE[m.status]}</div>
                )}
              </div>
            </div>
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
