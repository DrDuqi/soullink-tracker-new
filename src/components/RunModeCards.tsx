import { Gamepad2, Zap, Check } from 'lucide-react'
import type { RunMode } from '../lib/runMode'

/** Two big cards to choose the game mode — used both when creating a run and when
 *  changing the mode later. */
export default function RunModeCards({ selected, onSelect }: { selected: RunMode | null; onSelect: (m: RunMode) => void }) {
  const cards: { mode: RunMode; icon: React.ReactNode; title: string; desc: string; foot: string; accent: string }[] = [
    {
      mode: 'manual',
      icon: <Gamepad2 className="w-6 h-6" />,
      title: 'Manuell spielen',
      desc: 'Alle Pokémon, Routen und Encounter werden von dir selbst eingetragen.',
      foot: 'Empfohlen ohne Emulator oder auf echter Hardware.',
      accent: '#4ade80',
    },
    {
      mode: 'live_sync',
      icon: <Zap className="w-6 h-6" />,
      title: 'Emulator Live-Sync',
      desc: 'Der Tracker liest dein Team automatisch aus BizHawk aus.',
      foot: 'Empfohlen für Randomizer auf dem Emulator.',
      accent: '#CC0000',
    },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {cards.map((c) => {
        const sel = selected === c.mode
        return (
          <button
            key={c.mode}
            type="button"
            onClick={() => onSelect(c.mode)}
            className="text-left rounded-2xl border p-4 transition-all"
            style={sel
              ? { borderColor: c.accent, background: `${c.accent}14`, boxShadow: `0 0 0 1px ${c.accent}` }
              : { borderColor: '#2e2e42', background: '#16161f' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: c.accent }}>{c.icon}</span>
              {sel && <span style={{ color: c.accent }}><Check className="w-4 h-4" /></span>}
            </div>
            <div className="text-white font-black text-sm">{c.title}</div>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">{c.desc}</p>
            <p className="text-slate-600 text-[11px] mt-2">{c.foot}</p>
          </button>
        )
      })}
    </div>
  )
}
