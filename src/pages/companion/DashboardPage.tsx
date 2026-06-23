import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRight, Loader2, Swords, Users, Clock, Play, LogIn, RefreshCw, MoreVertical, Pencil, Archive, Trash2, Copy } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useProfiles } from '../../hooks/useProfiles'
import { useMyRuns, type RunVM } from '../../hooks/useMyRuns'
import { useRunStore } from '../../store/runStore'
import { getPlatform } from '../../platform'
import { fetchRunRecipe, saveRunRecipe } from '../../lib/runRecipe'
import { renameRun, deleteRunRemote } from '../../lib/runActions'
import { createRun } from '../../lib/createRun'
import type { LocalRun } from '../../lib/profiles'

// Player-first home: your SoulLinks as cards. Each card has a ⋮ menu to manage
// parallel runs (rename/archive/delete/duplicate). "Weiterspielen" relaunches the
// run's exact ROM (its own savegame); a run not yet set up here is reproduced from
// its shared recipe on demand.
export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { active } = useProfiles()
  const { data: runs = [], isLoading, refetch } = useMyRuns()
  const setCurrentRun = useRunStore((s) => s.setCurrentRun)
  const platform = getPlatform()
  const name = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Trainer'

  const [locals, setLocals] = useState<Record<string, LocalRun>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const reloadLocals = useCallback(async () => { setLocals(await platform.listLocalRuns()) }, [platform])
  useEffect(() => { reloadLocals() }, [reloadLocals, runs])

  const visible = runs.filter((vm) => !locals[vm.run.id]?.archived)
  const [hero, ...rest] = visible

  function openRun(vm: RunVM) {
    const mine = vm.players.find((p) => p.auth_user_id === user?.id)
    setCurrentRun(vm.run, vm.players, mine?.id ?? vm.players[0]?.id ?? '')
    navigate(`/run/${vm.run.id}`)
  }

  // Play: relaunch the local ROM (same save), else reproduce from the run's recipe
  // (own profile ROM), else just open the tracker.
  async function playRun(vm: RunVM) {
    setBusyId(vm.run.id)
    let lr: LocalRun | null = locals[vm.run.id] ?? null
    if (!lr) {
      const recipe = await fetchRunRecipe(vm.run.id)
      if (recipe?.preset_data && active?.paths.originalRom && active?.paths.bizhawk) {
        const r = await platform.prepareRun({ runId: vm.run.id, profileId: active.id, presetData: recipe.preset_data, seed: recipe.world_seed ?? undefined })
        if (r.ok) lr = { runId: vm.run.id, romPath: r.outputRom || '', bizhawk: r.bizhawk, seed: r.seed }
      }
    }
    if (lr?.romPath) await platform.launch({ bizhawkPath: lr.bizhawk || '', romPath: lr.romPath, luaPath: '', syncFolder: '' }, false)
    setBusyId(null); await reloadLocals(); openRun(vm)
  }

  // New attempt: same run + rules, NEW seed → new ROM + savegame.
  async function newAttempt(vm: RunVM) {
    const lr = locals[vm.run.id]; if (!lr) return
    if (!confirm('Neuen Versuch starten? Neue ROM + neuer Seed (gleiche Regeln), frischer Spielstand.')) return
    setBusyId(vm.run.id); setMenuFor(null)
    const recipe = await fetchRunRecipe(vm.run.id)
    const r = await platform.prepareRun({ runId: vm.run.id, profileId: lr.profileId || active?.id || '', presetData: recipe?.preset_data ?? undefined, presetId: recipe?.preset_data ? undefined : lr.presetId, seed: Math.floor(Math.random() * 1_000_000_000) })
    if (r.ok) await platform.launch({ bizhawkPath: r.bizhawk || '', romPath: r.outputRom || '', luaPath: '', syncFolder: '' }, false)
    setBusyId(null); await reloadLocals(); openRun(vm)
  }

  async function doRename(vm: RunVM) {
    setMenuFor(null)
    const next = prompt('Neuer Name für diesen SoulLink:', vm.run.name)
    if (!next || !next.trim()) return
    try { await renameRun(vm.run.id, next); await refetch() } catch (e) { alert(e instanceof Error ? e.message : 'Umbenennen fehlgeschlagen') }
  }
  async function doArchive(vm: RunVM) {
    setMenuFor(null); await platform.archiveRun(vm.run.id, true); await reloadLocals()
  }
  async function doDelete(vm: RunVM) {
    setMenuFor(null)
    if (!confirm(`„${vm.run.name}" wirklich löschen? Der Online-Run, die lokale ROM und der Spielstand werden entfernt. Das kann nicht rückgängig gemacht werden.`)) return
    setBusyId(vm.run.id)
    try { await deleteRunRemote(vm.run.id) } catch (e) { setBusyId(null); alert(e instanceof Error ? e.message : 'Löschen fehlgeschlagen'); return }
    await platform.deleteRun(vm.run.id)
    setBusyId(null); await refetch(); await reloadLocals()
  }
  async function doDuplicate(vm: RunVM) {
    setMenuFor(null)
    if (!user) return
    setBusyId(vm.run.id)
    try {
      const created = await createRun({ name: `${vm.run.name} (Kopie)`, game: vm.run.game, ownerUserId: user.id, username: profile?.username || name })
      const recipe = await fetchRunRecipe(vm.run.id)
      if (recipe) await saveRunRecipe(created.run.id, { presetData: recipe.preset_data, edition: recipe.edition, baseRom: recipe.base_rom, worldSeed: recipe.world_seed })
      await refetch()
    } catch (e) { alert(e instanceof Error ? e.message : 'Duplizieren fehlgeschlagen') }
    setBusyId(null)
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-10" onClick={() => setMenuFor(null)}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-slate-400 text-sm">Willkommen zurück, {name}</div>
          <h1 className="text-white font-black text-3xl tracking-tight mt-0.5">Weiterspielen</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/join')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5"><LogIn className="w-4 h-4" /> Beitreten</button>
          <button onClick={() => navigate('/new')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: '#CC0000' }}><Plus className="w-4 h-4" /> Neuer SoulLink</button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Deine SoulLinks werden geladen…</div>
      ) : visible.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-pk-red/30 bg-gradient-to-r from-pk-red/10 to-transparent p-8 text-center">
          <h2 className="text-white font-black text-xl">Noch kein SoulLink</h2>
          <p className="text-slate-400 text-sm mt-1.5">Erstelle deinen ersten gemeinsamen Run — Seed, Randomisierung und Start passieren automatisch.</p>
          <button onClick={() => navigate('/new')} className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl font-black text-white" style={{ background: '#CC0000' }}><Plus className="w-5 h-5" /> Neuen SoulLink erstellen</button>
        </div>
      ) : (
        <>
          {hero && (
            <div className="mt-7 rounded-2xl border border-pk-red/40 bg-gradient-to-r from-pk-red/10 to-transparent p-6 relative">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Swords className="w-5 h-5 text-pk-red" />
                    <span className="text-white font-black text-xl">{hero.run.name}</span>
                    {hero.run.game && <span className="text-[11px] font-bold text-slate-300 bg-white/5 border border-[#2e2e42] rounded-full px-2 py-0.5">{hero.run.game}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-slate-400 text-xs flex-wrap">
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {hero.players.map((p) => p.name).join(' & ')}</span>
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {relTime(hero.lastActivity)}</span>
                    {locals[hero.run.id]?.seed != null && <span className="font-mono">Seed {locals[hero.run.id].seed}</span>}
                  </div>
                </div>
                <RunMenu open={menuFor === hero.run.id} onToggle={() => setMenuFor(menuFor === hero.run.id ? null : hero.run.id)}
                  isLocal={!!locals[hero.run.id]} onAttempt={() => newAttempt(hero)} onRename={() => doRename(hero)} onArchive={() => doArchive(hero)} onDelete={() => doDelete(hero)} onDuplicate={() => doDuplicate(hero)} onTracker={() => { setMenuFor(null); openRun(hero) }} />
              </div>
              <div className="flex items-center gap-2.5 mt-4 flex-wrap">
                <button onClick={() => playRun(hero)} disabled={busyId === hero.run.id} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-white disabled:opacity-60" style={{ background: '#CC0000' }}>
                  {busyId === hero.run.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {locals[hero.run.id] ? 'Weiterspielen' : 'Spielen'}
                </button>
                <button onClick={() => openRun(hero)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5">Nur Tracker <ArrowRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div className="mt-6">
              <h3 className="text-slate-200 text-xs font-black uppercase tracking-widest mb-2.5">Weitere SoulLinks</h3>
              <div className="space-y-2">
                {rest.map((vm) => (
                  <div key={vm.run.id} className="rounded-xl border border-[#2e2e42] bg-[#16161f] p-4 flex items-center gap-3 relative">
                    <button onClick={() => playRun(vm)} disabled={busyId === vm.run.id} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                      {busyId === vm.run.id ? <Loader2 className="w-4 h-4 animate-spin text-pk-red shrink-0" /> : <Swords className="w-4 h-4 text-slate-400 shrink-0" />}
                      <span className="min-w-0">
                        <span className="block text-white font-bold truncate">{vm.run.name}</span>
                        <span className="block text-slate-500 text-xs">{vm.players.map((p) => p.name).join(' & ')} · {relTime(vm.lastActivity)}</span>
                      </span>
                    </button>
                    <RunMenu open={menuFor === vm.run.id} onToggle={() => setMenuFor(menuFor === vm.run.id ? null : vm.run.id)}
                      isLocal={!!locals[vm.run.id]} onAttempt={() => newAttempt(vm)} onRename={() => doRename(vm)} onArchive={() => doArchive(vm)} onDelete={() => doDelete(vm)} onDuplicate={() => doDuplicate(vm)} onTracker={() => { setMenuFor(null); openRun(vm) }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RunMenu({ open, onToggle, isLocal, onAttempt, onRename, onArchive, onDelete, onDuplicate, onTracker }: {
  open: boolean; onToggle: () => void; isLocal: boolean
  onAttempt: () => void; onRename: () => void; onArchive: () => void; onDelete: () => void; onDuplicate: () => void; onTracker: () => void
}) {
  const item = 'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 text-left'
  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button onClick={onToggle} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" aria-label="Menü"><MoreVertical className="w-5 h-5" /></button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-[#1c1c26] border border-[#2e2e42] rounded-xl shadow-2xl overflow-hidden py-1">
          <button onClick={onTracker} className={item}><ArrowRight className="w-4 h-4" /> Nur Tracker öffnen</button>
          {isLocal && <button onClick={onAttempt} className={item}><RefreshCw className="w-4 h-4" /> Neuer Versuch</button>}
          <button onClick={onRename} className={item}><Pencil className="w-4 h-4" /> Umbenennen</button>
          <button onClick={onDuplicate} className={item}><Copy className="w-4 h-4" /> Duplizieren</button>
          <button onClick={onArchive} className={item}><Archive className="w-4 h-4" /> Archivieren</button>
          <button onClick={onDelete} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/5 text-left border-t border-[#2e2e42]"><Trash2 className="w-4 h-4" /> Löschen</button>
        </div>
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
