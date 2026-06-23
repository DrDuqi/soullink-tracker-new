import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRight, Loader2, Swords, Users, Clock } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useMyRuns, type RunVM } from '../../hooks/useMyRuns'
import { useRunStore } from '../../store/runStore'

// The Companion home — "Weiterspielen", not "was möchtest du konfigurieren?".
// It shows the user's SoulLinks (runs) front and center; opening one loads the
// existing RunPage (team/box/tracker). Tools (emulator/randomizer/profile) live in
// the new-run flow + Einstellungen, not in the daily navigation.
export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { data: runs = [], isLoading } = useMyRuns()
  const setCurrentRun = useRunStore((s) => s.setCurrentRun)
  const name = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Trainer'

  function openRun(vm: RunVM) {
    const mine = vm.players.find((p) => p.auth_user_id === user?.id)
    setCurrentRun(vm.run, vm.players, mine?.id ?? vm.players[0]?.id ?? '')
    navigate(`/run/${vm.run.id}`)
  }

  const [active, ...rest] = runs

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-slate-400 text-sm">Willkommen zurück, {name}</div>
          <h1 className="text-white font-black text-3xl tracking-tight mt-0.5">Weiterspielen</h1>
        </div>
        <button onClick={() => navigate('/new')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5">
          <Plus className="w-4 h-4" /> Neuer SoulLink
        </button>
      </div>

      {isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Deine SoulLinks werden geladen…</div>
      ) : runs.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-pk-red/30 bg-gradient-to-r from-pk-red/10 to-transparent p-8 text-center">
          <h2 className="text-white font-black text-xl">Noch kein SoulLink</h2>
          <p className="text-slate-400 text-sm mt-1.5">Erstelle deinen ersten gemeinsamen Run — Seed, Randomisierung und Start passieren automatisch.</p>
          <button onClick={() => navigate('/new')} className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl font-black text-white" style={{ background: '#CC0000' }}>
            <Plus className="w-5 h-5" /> Neuen SoulLink erstellen
          </button>
        </div>
      ) : (
        <>
          {/* active SoulLink — the hero */}
          <button onClick={() => openRun(active)} className="mt-7 w-full text-left rounded-2xl border border-pk-red/40 bg-gradient-to-r from-pk-red/10 to-transparent p-6 hover:border-pk-red/70 transition-colors">
            <div className="flex items-center gap-2 flex-wrap">
              <Swords className="w-5 h-5 text-pk-red" />
              <span className="text-white font-black text-xl">{active.run.name}</span>
              {active.run.game && <span className="text-[11px] font-bold text-slate-300 bg-white/5 border border-[#2e2e42] rounded-full px-2 py-0.5">{active.run.game}</span>}
            </div>
            <div className="flex items-center gap-3 mt-2 text-slate-400 text-xs flex-wrap">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {active.players.map((p) => p.name).join(' & ')}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {relTime(active.lastActivity)}</span>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-white" style={{ background: '#CC0000' }}>
              Run öffnen <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {rest.length > 0 && (
            <div className="mt-6">
              <h3 className="text-slate-200 text-xs font-black uppercase tracking-widest mb-2.5">Weitere SoulLinks</h3>
              <div className="space-y-2">
                {rest.map((vm) => (
                  <button key={vm.run.id} onClick={() => openRun(vm)} className="w-full text-left rounded-xl border border-[#2e2e42] bg-[#16161f] hover:border-pk-red/50 hover:bg-[#1a1a24] transition-colors p-4 flex items-center gap-3">
                    <Swords className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-white font-bold truncate">{vm.run.name}</div>
                      <div className="text-slate-500 text-xs">{vm.players.map((p) => p.name).join(' & ')} · {relTime(vm.lastActivity)}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-600" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function relTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const h = Math.floor(d / 3_600_000)
  if (h < 1) return 'gerade aktiv'
  if (h < 24) return `vor ${h} h`
  const days = Math.floor(h / 24)
  return days === 1 ? 'gestern' : `vor ${days} Tagen`
}
