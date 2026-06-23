import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRight, Loader2, Swords, Users, Clock, Play, LogIn, RefreshCw } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useMyRuns, type RunVM } from '../../hooks/useMyRuns'
import { useRunStore } from '../../store/runStore'
import { getPlatform } from '../../platform'
import { fetchRunRecipe } from '../../lib/runRecipe'
import type { LocalRun } from '../../lib/profiles'

// The Companion home — "Weiterspielen", not "was möchtest du konfigurieren?".
// It shows the user's SoulLinks (runs) front and center; opening one loads the
// existing RunPage (team/box/tracker). Tools (emulator/randomizer/profile) live in
// the new-run flow + Einstellungen, not in the daily navigation.
export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { data: runs = [], isLoading } = useMyRuns()
  const setCurrentRun = useRunStore((s) => s.setCurrentRun)
  const platform = getPlatform()
  const name = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Trainer'

  const [active, ...rest] = runs ?? []
  const [localRun, setLocalRun] = useState<LocalRun | null>(null)
  const [launching, setLaunching] = useState(false)

  // Is the active run set up on THIS PC (ROM + savegame)? → enables "Weiterspielen".
  useEffect(() => {
    let cancel = false
    if (!active) { setLocalRun(null); return }
    platform.getLocalRun(active.run.id).then((lr) => { if (!cancel) setLocalRun(lr) })
    return () => { cancel = true }
  }, [platform, active?.run.id])

  function openRun(vm: RunVM) {
    const mine = vm.players.find((p) => p.auth_user_id === user?.id)
    setCurrentRun(vm.run, vm.players, mine?.id ?? vm.players[0]?.id ?? '')
    navigate(`/run/${vm.run.id}`)
  }

  // Continue playing: relaunch the run's exact ROM → BizHawk loads its savegame →
  // then open the run view. Falls back to just opening the tracker if not local.
  async function playRun(vm: RunVM) {
    if (!localRun) { openRun(vm); return }
    setLaunching(true)
    await platform.launch({ bizhawkPath: localRun.bizhawk || '', romPath: localRun.romPath, luaPath: '', syncFolder: '' }, false)
    setLaunching(false)
    openRun(vm)
  }

  // New attempt (lost the SoulLink): keep run + rules, NEW seed → new ROM + savegame.
  // No randomizer reconfiguring. Uses the run's shared preset so it stays consistent.
  async function newAttempt(vm: RunVM) {
    if (!localRun) return
    if (!confirm('Neuen Versuch starten? Es wird eine neue ROM mit neuem Seed (gleiche Regeln) erstellt — dein bisheriger Spielstand dieses Runs bleibt als Datei erhalten, aber du startest frisch.')) return
    setLaunching(true)
    const recipe = await fetchRunRecipe(vm.run.id)
    const r = await platform.prepareRun({
      runId: vm.run.id, profileId: localRun.profileId || '',
      presetData: recipe?.preset_data ?? undefined,
      presetId: recipe?.preset_data ? undefined : localRun.presetId,
      seed: Math.floor(Math.random() * 1_000_000_000),
    })
    if (r.ok) {
      setLocalRun((cur) => (cur ? { ...cur, romPath: r.outputRom || cur.romPath, seed: r.seed } : cur))
      await platform.launch({ bizhawkPath: r.bizhawk || '', romPath: r.outputRom || '', luaPath: '', syncFolder: '' }, false)
    }
    setLaunching(false)
    openRun(vm)
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-slate-400 text-sm">Willkommen zurück, {name}</div>
          <h1 className="text-white font-black text-3xl tracking-tight mt-0.5">Weiterspielen</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/join')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5">
            <LogIn className="w-4 h-4" /> Beitreten
          </button>
          <button onClick={() => navigate('/new')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: '#CC0000' }}>
            <Plus className="w-4 h-4" /> Neuer SoulLink
          </button>
        </div>
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
          <div className="mt-7 rounded-2xl border border-pk-red/40 bg-gradient-to-r from-pk-red/10 to-transparent p-6">
            <div className="flex items-center gap-2 flex-wrap">
              <Swords className="w-5 h-5 text-pk-red" />
              <span className="text-white font-black text-xl">{active.run.name}</span>
              {active.run.game && <span className="text-[11px] font-bold text-slate-300 bg-white/5 border border-[#2e2e42] rounded-full px-2 py-0.5">{active.run.game}</span>}
            </div>
            <div className="flex items-center gap-3 mt-2 text-slate-400 text-xs flex-wrap">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {active.players.map((p) => p.name).join(' & ')}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {relTime(active.lastActivity)}</span>
              {localRun?.seed != null && <span className="font-mono">Seed {localRun.seed}</span>}
            </div>
            <div className="flex items-center gap-2.5 mt-4 flex-wrap">
              <button onClick={() => playRun(active)} disabled={launching} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-white disabled:opacity-60" style={{ background: '#CC0000' }}>
                {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {localRun ? 'Weiterspielen' : 'Run öffnen'}
              </button>
              {localRun && (
                <button onClick={() => openRun(active)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5">
                  Nur Tracker <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {localRun && (
                <button onClick={() => newAttempt(active)} disabled={launching} title="Gleiche Regeln, neuer Seed + neuer Spielstand" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-400 hover:text-white border border-[#3a3a4e] hover:bg-white/5 disabled:opacity-40">
                  <RefreshCw className="w-4 h-4" /> Neuer Versuch
                </button>
              )}
            </div>
            {!localRun && <p className="text-slate-500 text-[11px] mt-2.5">Dieser Run ist auf diesem PC noch nicht eingerichtet — „Run öffnen" zeigt den Tracker.</p>}
          </div>

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
