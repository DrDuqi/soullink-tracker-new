import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, ArrowRight, Loader2, Swords, Users, Clock, Play, LogIn, RefreshCw, MoreVertical, Pencil, Archive, Trash2, Copy, Skull, Trophy, Sparkles, Gamepad2, FileText, Link2, Zap } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useProfiles } from '../../hooks/useProfiles'
import { useMyRuns, type RunVM } from '../../hooks/useMyRuns'
import { useRunStore } from '../../store/runStore'
import { getPlatform } from '../../platform'
import { supabase } from '../../lib/supabase'
import { LINKS } from '../../lib/appInfo'
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

// Cinematic, fully-evolved/legendary artwork so each run card looks like its own
// "game card" (deterministic per run id → stable, distinct). Official-artwork CDN.
const RUN_ART = [6, 9, 3, 149, 130, 131, 448, 94, 257, 392, 248, 260, 254, 282, 445, 373, 350, 230, 461, 475, 612, 700, 663, 658]
const ART = (n: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${n}.png`
function artForRun(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return ART(RUN_ART[h % RUN_ART.length])
}
// Cosmetic trainer level from real activity (runs + caught + soul-links). Pleasant curve.
function levelFromXp(xp: number) {
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 60)) + 1)
  const base = (level - 1) * (level - 1) * 60
  const next = level * level * 60
  return { level, into: xp - base, span: Math.max(1, next - base) }
}

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

  // ── Right-rail data: real stats, trainer level + activity feed (cheap queries) ──
  const runIds = runs.map((vm) => vm.run.id)
  const idKey = [...runIds].sort().join(',')
  const { data: stats } = useQuery({
    queryKey: ['dash-stats', idKey], enabled: runIds.length > 0, staleTime: 60_000,
    queryFn: async () => {
      const [c, l] = await Promise.allSettled([
        supabase.from('encounters').select('id', { count: 'exact', head: true }).in('run_id', runIds),
        supabase.from('soul_links').select('id', { count: 'exact', head: true }).in('run_id', runIds),
      ])
      return {
        caught: c.status === 'fulfilled' ? (c.value.count ?? 0) : 0,
        links: l.status === 'fulfilled' ? (l.value.count ?? 0) : 0,
      }
    },
  })
  const { data: feed = [] } = useQuery({
    queryKey: ['dash-feed', idKey], enabled: runIds.length > 0, staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from('activity_log')
        .select('description, event_type, created_at, run_id')
        .in('run_id', runIds).order('created_at', { ascending: false }).limit(6)
      return (data ?? []) as { description: string; event_type: string; created_at: string; run_id: string }[]
    },
  })
  const caught = stats?.caught ?? 0
  const links = stats?.links ?? 0
  const xp = runs.length * 120 + caught * 12 + links * 30 + activeRuns.length * 80
  const lvl = levelFromXp(xp)
  const avatarUrl = (profile?.avatar_url as string | undefined) || undefined

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
    <div className="px-6 lg:px-8 py-8" onClick={() => setMenuFor(null)}>
      <div className="mx-auto max-w-[1180px] grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 anim-fade-up">
        {/* ── MAIN ───────────────────────────────────────────── */}
        <div className="min-w-0">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              <div className="text-slate-400 text-sm">Willkommen zurück,</div>
              <h1 className="text-white font-black text-[2rem] leading-tight tracking-tight">{name} 👋</h1>
              <p className="text-slate-500 text-sm mt-1">Bereit für ein neues Abenteuer?</p>
            </div>
            <div className="flex items-center gap-2.5">
              <button onClick={() => navigate('/join')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-200 border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] transition-colors"><LogIn className="w-4 h-4" /> Beitreten</button>
              <button onClick={() => navigate('/new')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm text-white shadow-lg shadow-pk-red/30 hover:brightness-110 transition" style={{ background: 'linear-gradient(135deg,#ff2d2d,#b80018)' }}><Plus className="w-4 h-4" /> Neuer SoulLink</button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3.5">
            <span className="w-7 h-7 rounded-lg bg-pk-red/15 flex items-center justify-center"><Swords className="w-4 h-4 text-pk-red" /></span>
            <h2 className="text-white font-black text-lg">Deine SoulLinks</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Deine SoulLinks werden geladen…</div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-pk-red/30 bg-gradient-to-br from-pk-red/12 to-transparent p-8 text-center">
              <h3 className="text-white font-black text-xl">Noch kein SoulLink</h3>
              <p className="text-slate-400 text-sm mt-1.5">Starte dein erstes Abenteuer — Seed, Randomisierung und Start passieren automatisch.</p>
              <button onClick={() => navigate('/new')} className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl font-black text-white" style={{ background: 'linear-gradient(135deg,#ff2d2d,#b80018)' }}><Plus className="w-5 h-5" /> Neuen SoulLink erstellen</button>
            </div>
          ) : (
            <>
              {activeRuns.length > 0 && (
                <div className="space-y-3.5">
                  {activeRuns.map((vm, i) => {
                    const lr = locals[vm.run.id]
                    const busy = busyId === vm.run.id
                    const latest = i === 0
                    return (
                      <div key={vm.run.id}
                        className="group relative rounded-2xl overflow-hidden border transition-all duration-300 hover:-translate-y-0.5"
                        style={{ borderColor: latest ? 'rgba(255,60,60,0.35)' : 'rgba(255,255,255,0.07)', background: 'linear-gradient(135deg, rgba(22,22,31,0.9), rgba(13,13,19,0.9))', boxShadow: latest ? '0 18px 50px -22px rgba(204,0,0,0.7)' : '0 14px 40px -28px rgba(0,0,0,0.85)' }}>
                        <img src={artForRun(vm.run.id)} alt="" loading="lazy" draggable={false}
                          className="absolute right-0 top-1/2 -translate-y-1/2 h-[150%] w-auto max-w-[52%] object-contain pointer-events-none select-none transition-transform duration-500 group-hover:scale-105"
                          style={{ opacity: 0.5, filter: 'saturate(1.05) drop-shadow(0 10px 30px rgba(0,0,0,0.55))', WebkitMaskImage: 'linear-gradient(90deg, transparent 2%, #000 58%)', maskImage: 'linear-gradient(90deg, transparent 2%, #000 58%)' }} />
                        <div className="absolute inset-0 pointer-events-none" style={{ background: latest ? 'radial-gradient(130% 150% at 86% 30%, rgba(204,0,0,0.16), transparent 56%)' : 'radial-gradient(130% 150% at 92% 30%, rgba(80,120,255,0.06), transparent 56%)' }} />
                        <div className="relative p-5">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-white font-black text-xl drop-shadow-sm">{vm.run.name}</span>
                              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                <span className="text-[11px] font-bold text-slate-200 bg-white/[0.06] border border-white/10 rounded-full px-2.5 py-0.5">{editionLabel(vm.run.game)}</span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-green-300 bg-green-500/12 border border-green-500/20 rounded-full px-2 py-0.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Aktiv</span>
                                {latest && <span className="text-[10px] font-black uppercase tracking-wide text-pk-yellow bg-pk-yellow/12 border border-pk-yellow/25 rounded-full px-2 py-0.5">Zuletzt gespielt</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-3 text-slate-400 text-xs flex-wrap">
                                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {vm.players.map((p) => p.name).join(' & ')}</span>
                                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {relTime(vm.lastActivity)}</span>
                                {lr?.seed != null
                                  ? <span className="font-mono flex items-center gap-1 text-slate-500"><Zap className="w-3 h-3" /> {lr.seed}</span>
                                  : <span className="text-amber-400/80">hier noch nicht eingerichtet</span>}
                              </div>
                            </div>
                            <RunMenu open={menuFor === vm.run.id} onToggle={() => setMenuFor(menuFor === vm.run.id ? null : vm.run.id)}
                              onAttempt={() => newAttempt(vm)} onWon={() => markStatus(vm, 'won')} onLost={() => markStatus(vm, 'lost')}
                              onRename={() => doRename(vm)} onArchive={() => doArchive(vm)} onDelete={() => doDelete(vm)} onDuplicate={() => doDuplicate(vm)} onTracker={() => { setMenuFor(null); openRun(vm) }} />
                          </div>
                          <div className="flex items-center gap-2.5 mt-4 flex-wrap">
                            <button onClick={() => playRun(vm)} disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-white shadow-lg shadow-pk-red/30 hover:brightness-110 disabled:opacity-60 transition" style={{ background: 'linear-gradient(135deg,#ff2d2d,#b80018)' }}>
                              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {lr ? 'Weiterspielen' : 'Spielen'}
                            </button>
                            <button onClick={() => openRun(vm)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-200 border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] transition">Nur Tracker <ArrowRight className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeRuns.length === 0 && pastRuns.length > 0 && (
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center">
                  <p className="text-white font-black">Kein aktiver SoulLink</p>
                  <p className="text-slate-400 text-sm mt-1">Starte unten bei einem vergangenen Run „Neuer Versuch" — oder lege einen neuen an.</p>
                </div>
              )}

              {pastRuns.length > 0 && (
                <div className="mt-7">
                  <h3 className="text-slate-300 text-xs font-black uppercase tracking-widest mb-2.5">Vergangene Runs</h3>
                  <div className="space-y-2">
                    {pastRuns.map((vm) => {
                      const won = vm.run.status === 'won'
                      return (
                        <div key={vm.run.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3 relative">
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
                          <button onClick={() => newAttempt(vm)} disabled={busyId === vm.run.id} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs text-white disabled:opacity-50 shrink-0" style={{ background: 'linear-gradient(135deg,#ff2d2d,#b80018)' }}>
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

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
                <StatCard icon={Swords} color="#ff6b6b" value={activeRuns.length} label="Aktive Runs" />
                <StatCard icon={Sparkles} color="#4ade80" value={caught} label="Pokémon gefangen" />
                <StatCard icon={Link2} color="#a78bfa" value={links} label="SoulLinks" />
                <StatCard icon={Trophy} color="#fbbf24" value={runs.length} label="Runs gesamt" />
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT RAIL ─────────────────────────────────────── */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] backdrop-blur-md p-5">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                {avatarUrl
                  ? <img src={avatarUrl} alt="" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-pk-red/40" />
                  : <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg" style={{ background: 'linear-gradient(135deg,#ff2d2d,#7a0010)' }}>{name.charAt(0).toUpperCase()}</div>}
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-400 border-2 border-[#0c0c12]" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-black truncate">{name}</div>
                <div className="text-green-400 text-xs font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] font-bold mb-1.5"><span className="text-pk-yellow">Level {lvl.level}</span><span className="text-slate-500">{lvl.into} / {lvl.span} XP</span></div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (lvl.into / lvl.span) * 100)}%`, background: 'linear-gradient(90deg,#ffcb05,#ff8a00)' }} /></div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] backdrop-blur-md p-5">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-300 mb-3 flex items-center gap-2"><Gamepad2 className="w-3.5 h-3.5 text-green-400" /> Companion</div>
            <StatusRow label="Companion" value="Verbunden" />
            <StatusRow label="Live-Sync" value="Bereit" />
            <StatusRow label="Lua-Script" value="Aktiv" />
          </div>

          {feed.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] backdrop-blur-md p-5">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-300 mb-3">Aktivität</div>
              <div className="space-y-3">
                {feed.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-pk-red shrink-0" />
                    <div className="min-w-0">
                      <div className="text-slate-300 text-xs leading-snug">{a.description}</div>
                      <div className="text-slate-600 text-[10px] mt-0.5">{relTime(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] backdrop-blur-md p-5">
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-300 mb-3 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-pk-red" /> Neuigkeiten</div>
            <p className="text-slate-400 text-xs leading-relaxed">Updates installiert SoulLink automatisch — kein manueller Download mehr nötig.</p>
            <a href={LINKS.changelog} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-pk-red hover:text-white"><FileText className="w-3.5 h-3.5" /> Changelog ansehen</a>
          </div>
        </aside>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, color, value, label }: { icon: typeof Swords; color: string; value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-md p-4 transition-transform hover:-translate-y-0.5">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5" style={{ background: `${color}1f` }}><Icon className="w-[18px] h-[18px]" style={{ color }} /></span>
      <div className="text-white font-black text-2xl leading-none">{value}</div>
      <div className="text-slate-500 text-[11px] font-bold mt-1">{label}</div>
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_1px_rgba(74,222,128,0.6)] shrink-0" />
      <span className="text-slate-300 text-sm font-bold flex-1">{label}</span>
      <span className="text-green-400 text-xs font-bold">{value}</span>
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
