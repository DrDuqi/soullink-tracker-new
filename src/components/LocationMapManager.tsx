import { useState } from 'react'
import { MapPin, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { getRoutesForGame } from '../lib/routes'
import { useLocationMap, useLocationMapStore } from '../lib/locationMap'

/** Lists the learned location-ID → route mappings for a game and lets the user
 *  correct (dropdown) or delete (trash) any of them. Purely local (localStorage). */
export default function LocationMapManager({ game }: { game: string }) {
  const map = useLocationMap(game)
  const setMapping = useLocationMapStore((s) => s.setMapping)
  const removeMapping = useLocationMapStore((s) => s.removeMapping)
  const [open, setOpen] = useState(false)

  const routes = getRoutesForGame(game).filter((r) => r !== 'Eigene Route...')
  const entries = Object.entries(map).sort((a, b) => Number(a[0]) - Number(b[0]))

  return (
    <div className="border-t" style={{ borderColor: '#2e2e42', background: '#16161f' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-4 py-2 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
      >
        <MapPin className="w-3.5 h-3.5" />
        <span className="font-bold">Gelernte Orte ({entries.length})</span>
        <span className="flex-1" />
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          {entries.length === 0 ? (
            <p className="text-slate-600 text-[11px] py-1">
              Noch keine. Beim Import eines Emulator-Pokémon wird die aktuelle Orts-ID automatisch mit der gewählten Route verknüpft.
            </p>
          ) : (
            entries.map(([id, route]) => (
              <div key={id} className="flex items-center gap-2">
                <span className="text-slate-500 text-[10px] tabular-nums w-14 shrink-0">ID {id}</span>
                <select
                  value={routes.includes(route) ? route : ''}
                  onChange={(e) => setMapping(game, Number(id), e.target.value)}
                  className="flex-1 min-w-0 bg-[#1c1c26] border border-[#2e2e42] rounded-lg px-2 py-1 text-[11px] text-slate-200"
                >
                  {!routes.includes(route) && <option value="">{route} (eigen)</option>}
                  {routes.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button
                  onClick={() => removeMapping(game, Number(id))}
                  className="text-slate-500 hover:text-red-400 transition-colors p-1 shrink-0"
                  title="Zuordnung löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
