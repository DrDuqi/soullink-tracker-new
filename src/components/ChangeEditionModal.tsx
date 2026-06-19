import { useState } from 'react'
import { X, AlertTriangle, Gamepad2 } from 'lucide-react'
import { GAME_LIST } from '../lib/routes'

/** Lets the run owner change the run edition after creation. The edition decides
 *  the checklist, the import routes, the emulator compatibility and the region-based
 *  team analysis. Existing encounters are kept; routes that no longer fit are only
 *  marked, never deleted. */
export default function ChangeEditionModal({
  currentGame, busy, onConfirm, onCancel,
}: {
  currentGame: string
  busy?: boolean
  onConfirm: (game: string) => void
  onCancel: () => void
}) {
  const [game, setGame] = useState(currentGame)
  const changed = game !== currentGame

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-md border border-[#2e2e42] shadow-2xl anim-pop">
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#2e2e42]">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-pk-red" />
            <h2 className="text-white font-black text-xl">Run-Edition ändern</h2>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-7 py-6 space-y-5">
          <div>
            <label className="text-slate-300 text-sm font-semibold mb-2 block">Edition</label>
            <select value={game} onChange={(e) => setGame(e.target.value)} className="pk-input">
              {GAME_LIST.map((g) => <option key={g}>{g}</option>)}
            </select>
            <p className="text-slate-500 text-xs mt-1.5">Aktuell: <span className="text-slate-300 font-semibold">{currentGame}</span></p>
          </div>

          <div className="rounded-2xl border border-yellow-700/50 bg-yellow-950/25 p-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-400" />
            <p className="text-yellow-200/90 text-xs leading-relaxed">
              Die Run-Edition bestimmt Routen, Checkliste und Encounter-Regeln. Bestehende Encounter bleiben erhalten, können aber eventuell nicht mehr zur neuen Edition passen.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCancel} className="btn-ghost flex-1">Abbrechen</button>
            <button
              type="button"
              onClick={() => onConfirm(game)}
              disabled={!changed || busy}
              className="btn-primary flex-1"
            >
              {busy ? 'Wird geändert…' : 'Edition ändern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
