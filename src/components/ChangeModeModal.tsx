import { useState } from 'react'
import { X, Gamepad2 } from 'lucide-react'
import RunModeCards from './RunModeCards'
import type { RunMode } from '../lib/runMode'

/** In-run "Spielmodus ändern" dialog. Manual hides all emulator UI and stops the
 *  sync; Live-Sync brings the emulator panel back (with its setup wizard). */
export default function ChangeModeModal({ current, onApply, onClose }: {
  current: RunMode
  onApply: (m: RunMode) => void
  onClose: () => void
}) {
  const [sel, setSel] = useState<RunMode>(current)

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-lg border border-[#2e2e42] shadow-2xl anim-pop">
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#2e2e42]">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-pk-red" />
            <h2 className="text-white font-black text-xl">Spielmodus ändern</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-7 py-6 space-y-5">
          <RunModeCards selected={sel} onSelect={setSel} />
          <p className="text-slate-500 text-xs">
            {sel === 'manual'
              ? 'Manuell: Emulator-Panel und Live-Sync werden ausgeblendet, alles wird von Hand eingetragen.'
              : 'Live-Sync: Emulator-Panel erscheint; falls noch nicht eingerichtet, öffnet sich der Setup-Assistent.'}
          </p>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-ghost flex-1">Abbrechen</button>
            <button onClick={() => onApply(sel)} disabled={sel === current} className="btn-primary flex-1">Speichern</button>
          </div>
        </div>
      </div>
    </div>
  )
}
