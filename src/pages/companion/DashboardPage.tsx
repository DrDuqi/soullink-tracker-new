import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ArrowRight, Loader2, Swords, Users, Clock, Play, LogIn, RefreshCw, MoreVertical, Pencil, Archive, Trash2, Copy, Skull, Trophy } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useProfiles } from '../../hooks/useProfiles'
import { useMyRuns, type RunVM } from '../../hooks/useMyRuns'
import { useRunStore } from '../../store/runStore'
import { getPlatform } from '../../platform'
import { fetchRunRecipe, saveRunRecipe } from '../../lib/runRecipe'
import { renameRun, deleteRunRemote, setRunStatus, newAttemptRemote, loadRun } from '../../lib/runActions'
import { createRun } from '../../lib/createRun'
import type { LocalRun } from '../../lib/profiles'

const EDITIONS: Record<string, string> = {
  platinum: 'Pokémon Platin', diamond: 'Pokémon Diamant', pearl: 'Pokémon Perl',
  heartgold: 'Pokémon HeartGold', soulsilver: 'Pokémon SoulSilver',
  black: 'Pokémon Schwarz', white: 'Pokémon Weiß', black2: 'Pokémon Schwarz 2', white2: 'Pokémon Weiß 2',
}
const editionLabel = (e?: string | null) => (e && EDITIONS[e]) || e || 'Pokémon'

// Player-first home: every active SoulLink is an EQUAL, fully-actionable card
// (Weiterspielen · Nur Tracker · ⋮ menu) — so several parallel runs are all started
// the same way. The most recently played one just gets a "Zuletzt gespielt" badge.
// "Weiterspielen" relaunches the run's exact ROM (its own savegame); a run not yet set
// up on this PC is reproduced from its shared recipe on demand.
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
  const isFinished = (vm: RunVM) => vm.run.status === 'won' || vm.run.status === 'lost'
  const activeRuns = visible.filter((vm) => !isFinished(vm))
  const pastRuns = visible.filter(isFinished)

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
    if (lr?.romPath) await platform.launch({ bizhawkPath: lr.bizhawk || '', romPath: lr.romPath, luaPath: '', syncFolder: '' }, false, vm.run.id, true)
    setBusyId(null); await reloadLocals(); openRun(vm)
  }

  // End the SHARED run (either member can). Moves it to "Vergangene Runs".
  async function markStatus(vm: RunVM, status: 'won' | 'lost') {
    setMenuFor(null)
    if (!confirm(status === 'won' ? `„${vm.run.name}" als gewonnen abschließen? 🏆` : `„${vm.run.name}" als verloren abschließen? 💀`)) return
    setBusyId(vm.run.id)
    try { await setRunStatus(vm.run.id, status); await refetch() } catch (e) { alert(e instanceof Error ? e.message : 'Status konnte nicht gesetzt werden') }
    setBusyId(null)
  }

  // New attempt: a NEW SHARED run for the SAME members + rules (RPC clones it for
  // both players), then set it up locally (new seed → new ROM + savegame) and open it.
  async function newAttempt(vm: RunVM) {
    if (!user) return
    if (!confirm('Neuen Versuch starten? Es entsteht ein NEUER gemeinsamer Run (gleiche Mitspieler, gleiches Preset) mit neuem Seed + neuer ROM + frischem Spielstand. Der alte Run bleibt erhalten.')) return
    setBusyId(vm.run.id); setMenuFor(null)
    let newId: string
    try { newId = await newAttemptRemote(vm.run.id) } catch (e) { setBusyId(null); alert(e instanceof Error ? e.message : 'Neuer Versuch fehlgeschlagen'); return }
    // Reproduce the new run locally with this player's ROM + the shared recipe.
    const recipe = await fetchRunRecipe(newId)
    if (recipe?.preset_data && active?.paths.originalRom && active?.paths.bizhawk) {
      const r = await platform.prepareRun({ runId: newId, profileId: active.id, presetData: recipe.preset_data, seed: recipe.world_seed ?? undefined })
      if (r.ok) await platform.launch({ bizhawkPath: r.bizhawk || '', romPath: r.outputRom || '', luaPath: '', syncFolder: '' }, true, newId)
    }
    await refetch(); await reloadLocals()
    setBusyId(null)
    try { const { run, players, myPlayerId } = await loadRun(newId, user.id); setCurrentRun(run, players, myPlayerId); navigate(`/run/${newId}`) }
    catch { /* dashboard already refreshed */ }
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
          <h1 className="text-white font-black text-3xl tracking-tight mt-0.5">Deine SoulLinks</h1>
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
          {activeRuns.length > 0 && (
            <div className="mt-7 space-y-3">
              {activeRuns.map((vm, i) => {
                const lr = locals[vm.run.id]
                const busy = busyId === vm.run.id
                const latest = i === 0
                return (
                  <div key={vm.run.id} className={`rounded-2xl border p-5 relative ${latest ? 'border-pk-red/40 bg-gradient-to-r from-pk-red/10 to-transparent' : 'border-[#2e2e42] bg-[#16161f]'}`}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Swords className="w-5 h-5 text-pk-red shrink-0" />
                          <span className="text-white font-black text-lg">{vm.run.name}</span>
                          <span className="text-[11px] font-bold text-slate-300 bg-white/5 border border-[#2e2e42] rounded-full px-2 py-0.5">{editionLabel(vm.run.game)}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-green-300 bg-green-500/10 rounded px-1.5 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Aktiv</span>
                          {latest && <span className="text-[10px] font-black uppercase tracking-wide text-pk-yellow bg-pk-yellow/10 rounded px-1.5 py-0.5">Zuletzt gespielt</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-slate-400 text-xs flex-wrap">
                          <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {vm.players.map((p) => p.name).join(' & ')}</span>
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {relTime(vm.lastActivity)}</span>
                          {lr?.seed != null
                            ? <span className="font-mono">Seed {lr.seed}</span>
                            : <span className="text-amber-400/80">hier noch nicht eingerichtet</span>}
                        </div>
                      </div>
                      <RunMenu open={menuFor === vm.run.id} onToggle={() => setMenuFor(menuFor === vm.run.id ? null : vm.run.id)}
                        onAttempt={() => newAttempt(vm)} onWon={() => markStatus(vm, 'won')} onLost={() => markStatus(vm, 'lost')}
                        onRename={() => doRename(vm)} onArchive={() => doArchive(vm)} onDelete={() => doDelete(vm)} onDuplicate={() => doDuplicate(vm)} onTracker={() => { setMenuFor(null); openRun(vm) }} />
                    </div>
                    <div className="flex items-center gap-2.5 mt-4 flex-wrap">
                      <button onClick={() => playRun(vm)} disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-white disabled:opacity-60" style={{ background: '#CC0000' }}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {lr ? 'Weiterspielen' : 'Spielen'}
                      </button>
                      <button onClick={() => openRun(vm)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5">Nur Tracker <ArrowRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {activeRuns.length === 0 && pastRuns.length > 0 && (
            <div className="mt-7 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-6 text-center">
              <p className="text-white font-black">Kein aktiver SoulLink</p>
              <p className="text-slate-400 text-sm mt-1">Starte unten bei einem vergangenen Run „Neuer Versuch" — oder lege einen neuen an.</p>
            </div>
          )}

          {pastRuns.length > 0 && (
            <div className="mt-7">
              <h3 className="text-slate-200 text-xs font-black uppercase tracking-widest mb-2.5">Vergangene Runs</h3>
              <div className="space-y-2">
                {pastRuns.map((vm) => {
                  const won = vm.run.status === 'won'
                  return (
                    <div key={vm.run.id} className="rounded-xl border border-[#2e2e42] bg-[#14141c] p-4 flex items-center gap-3 relative">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide rounded px-1.5 py-0.5 ${won ? 'text-green-300 bg-green-500/10' : 'text-red-300 bg-red-500/10'}`}>
                            {won ? <Trophy className="w-3 h-3" /> : <Skull className="w-3 h-3" />} {won ? 'Gewonnen' : 'Verloren'}
                          </span>
                          <span className="text-slate-300 font-bold truncate">{vm.run.name}</span>
                          {vm.run.attempt_number && vm.run.attempt_number > 1 && <span className="text-slate-600 text-xs">#{vm.run.attempt_number}</span>}
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5">{vm.players.map((p) => p.name).join(' & ')} · {relTime(vm.lastActivity)}</div>
                      </div>
                      <button onClick={() => newAttempt(vm)} disabled={busyId === vm.run.id} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs text-white disabled:opacity-50 shrink-0" style={{ background: '#CC0000' }}>
                        {busyId === vm.run.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Neuer Versuch
                      </button>
                      <RunMenu open={menuFor === vm.run.id} onToggle={() => setMenuFor(menuFor === vm.run.id ? null : vm.run.id)}
                        finished onAttempt={() => newAttempt(vm)} onWon={() => markStatus(vm, 'won')} onLost={() => markStatus(vm, 'lost')}
                        onRename={() => doRename(vm)} onArchive={() => doArchive(vm)} onDelete={() => doDelete(vm)} onDuplicate={() => doDuplicate(vm)} onTracker={() => { setMenuFor(null); openRun(vm) }} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RunMenu({ open, onToggle, finished, onAttempt, onWon, onLost, onRename, onArchive, onDelete, onDuplicate, onTracker }: {
  open: boolean; onToggle: () => void; finished?: boolean
  onAttempt: () => void; onWon: () => void; onLost: () => void; onRename: () => void; onArchive: () => void; onDelete: () => void; onDuplicate: () => void; onTracker: () => void
}) {
  const item = 'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 text-left'
  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button onClick={onToggle} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" aria-label="Menü"><MoreVertical className="w-5 h-5" /></button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-[#1c1c26] border border-[#2e2e42] rounded-xl shadow-2xl overflow-hidden py-1">
          <button onClick={onTracker} className={item}><ArrowRight className="w-4 h-4" /> Nur Tracker öffnen</button>
          <button onClick={onAttempt} className={item}><RefreshCw className="w-4 h-4" /> Neuer Versuch</button>
          {!finished && <button onClick={onWon} className={item}><Trophy className="w-4 h-4 text-green-400" /> Als gewonnen</button>}
          {!finished && <button onClick={onLost} className={item}><Skull className="w-4 h-4" /> Als verloren</button>}
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
