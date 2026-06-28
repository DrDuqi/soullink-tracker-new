import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Swords, Users, Zap, Shuffle, ArrowRight, Link2, Clock,
  MoreVertical, Crown, Trash2, LogOut, X, Download, Gamepad2,
} from 'lucide-react'
import { LINKS } from '../lib/appInfo'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRunStore } from '../store/runStore'
import { useToastStore } from '../store/toastStore'
import { GAME_LIST } from '../lib/routes'
import { setRunMode, type RunMode } from '../lib/runMode'
import { useSettings } from '../store/settingsStore'
import UserMenu from '../components/UserMenu'
import AtmosphereBackground from '../components/AtmosphereBackground'
import LandingPage from './LandingPage'
import type { Run, Player } from '../types/database'

function PokeBall({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M2,50 H98" stroke="currentColor" strokeWidth="4" />
      <path d="M2,50 Q2,2 50,2 Q98,2 98,50" fill="currentColor" opacity="0.8" />
      <circle cx="50" cy="50" r="14" fill="currentColor" stroke="currentColor" strokeWidth="4" />
      <circle cx="50" cy="50" r="8" fill="white" opacity="0.9" />
    </svg>
  )
}

function Shell({ children, showMenu }: { children: React.ReactNode; showMenu?: boolean }) {
  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      <AtmosphereBackground />

      {/* z-50 so the user-menu dropdown always sits above the page content below */}
      <header className="relative z-50 border-b border-white/5 bg-pk-red/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PokeBall className="w-8 h-8 text-pk-red" />
            <span className="text-white font-black text-xl tracking-tight">SoulLink<span className="text-pk-red">.</span></span>
          </div>
          {showMenu ? (
            <UserMenu />
          ) : (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Zap className="w-4 h-4 text-pk-yellow" />
              <span className="hidden sm:inline">Pokémon Gen I–V Nuzlocke Tracker</span>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center px-4 py-12">{children}</main>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
interface RunVM { run: Run; players: Player[]; partnerName: string; lastActivity: string }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  if (hours < 24) return `vor ${hours} Std.`
  return `vor ${days} Tag${days !== 1 ? 'en' : ''}`
}

function Dashboard() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { setCurrentRun } = useRunStore()
  const toast = useToastStore()
  const [game, setGame] = useState(GAME_LIST[0])
  const [runName, setRunName] = useState('')
  const mode: RunMode = 'manual'   // the website is the MANUAL tracker; Live-Sync needs the Companion
  const [playerCount, setPlayerCount] = useState<number>(() => useSettings.getState().defaultPlayers)
  const [customCode, setCustomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [deleteFor, setDeleteFor] = useState<RunVM | null>(null)
  const [transferFor, setTransferFor] = useState<RunVM | null>(null)
  const [actionBusy, setActionBusy] = useState(false)

  const { data: myRuns = [], isLoading, refetch } = useQuery<RunVM[]>({
    queryKey: ['my-runs', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: mine } = await supabase.from('players').select('run_id').eq('auth_user_id', user!.id)
      const runIds = [...new Set((mine ?? []).map((r) => r.run_id as string))]
      if (runIds.length === 0) return []
      const [{ data: runs }, { data: players }, { data: acts }] = await Promise.all([
        supabase.from('runs').select('*').in('id', runIds),
        supabase.from('players').select('*').in('run_id', runIds),
        supabase.from('activity_log').select('run_id, created_at').in('run_id', runIds).order('created_at', { ascending: false }),
      ])
      const allP = (players as Player[]) ?? []
      const lastByRun = new Map<string, string>()
      for (const a of (acts as { run_id: string; created_at: string }[]) ?? []) if (!lastByRun.has(a.run_id)) lastByRun.set(a.run_id, a.created_at)
      return ((runs as Run[]) ?? []).map((run) => {
        const ps = allP.filter((p) => p.run_id === run.id)
        const partner = ps.find((p) => p.auth_user_id && p.auth_user_id !== user!.id)
        return { run, players: ps, partnerName: partner?.name ?? '—', lastActivity: lastByRun.get(run.id) ?? run.created_at }
      }).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
    },
  })

  function openRun(vm: RunVM) {
    const mine = vm.players.find((p) => p.auth_user_id === user?.id)
    setCurrentRun(vm.run, vm.players, mine?.id ?? vm.players[0]?.id ?? '')
    navigate(`/run/${vm.run.id}`)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !profile) return
    setBusy(true); setError('')
    try {
      const payload: Record<string, unknown> = { name: runName.trim() || `${profile.username}'s Run`, game, owner_user_id: user.id }
      if (customCode.trim()) payload.share_code = customCode.trim().toLowerCase()
      const { data: run, error: runErr } = await supabase.from('runs').insert(payload).select().single()
      if (runErr) throw runErr
      const { data: player, error: pErr } = await supabase.from('players')
        .insert({ run_id: run.id, name: profile.username, player_number: 1, auth_user_id: user.id })
        .select().single()
      if (pErr) throw pErr
      // Spieleranzahl best-effort persistieren (Spalte existiert erst ab Migration v13).
      if (playerCount === 3) {
        try { await supabase.from('runs').update({ max_players: 3 }).eq('id', run.id) } catch { /* Spalte fehlt → bleibt 2 */ }
      }
      setRunMode(run.id, mode)   // gewählten Spielmodus lokal für diesen Run speichern
      setCurrentRun({ ...(run as Run), max_players: playerCount }, [player as Player], (player as Player).id)
      navigate(`/run/${run.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen')
    } finally { setBusy(false) }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !joinCode.trim()) return
    setBusy(true); setError('')
    try {
      // Secure server-side join: claims a freed slot (rejoin keeps data) or inserts.
      const { data: runId, error: rpcErr } = await supabase.rpc('join_run', { p_share_code: joinCode.trim() })
      if (rpcErr) throw new Error(rpcErr.message)
      const [{ data: run }, { data: players }] = await Promise.all([
        supabase.from('runs').select('*').eq('id', runId).single(),
        supabase.from('players').select('*').eq('run_id', runId),
      ])
      const ps = (players as Player[]) ?? []
      const mine = ps.find((p) => p.auth_user_id === user.id)
      setCurrentRun(run as Run, ps, mine?.id ?? ps[0]?.id ?? '')
      navigate(`/run/${runId}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Beitreten')
    } finally { setBusy(false) }
  }

  async function doLeave(vm: RunVM) {
    setActionBusy(true)
    const { error } = await supabase.rpc('leave_run', { p_run_id: vm.run.id })
    setActionBusy(false)
    if (error) { toast.show(error.message, 'error'); return }
    toast.show('Tracker verlassen', 'success'); refetch()
  }
  async function doDelete(vm: RunVM) {
    setActionBusy(true)
    const { error } = await supabase.rpc('delete_run', { p_run_id: vm.run.id })
    setActionBusy(false)
    if (error) { toast.show(error.message, 'error'); return }
    setDeleteFor(null); toast.show('Tracker dauerhaft gelöscht', 'success'); refetch()
  }
  async function doTransferAndLeave(vm: RunVM, newOwnerId: string) {
    setActionBusy(true)
    const { error: tErr } = await supabase.rpc('transfer_run_owner', { p_run_id: vm.run.id, p_new_owner: newOwnerId })
    if (tErr) { setActionBusy(false); toast.show(tErr.message, 'error'); return }
    const { error: lErr } = await supabase.rpc('leave_run', { p_run_id: vm.run.id })
    setActionBusy(false)
    if (lErr) { toast.show(lErr.message, 'error'); return }
    setTransferFor(null); toast.show('Besitz übertragen & Tracker verlassen', 'success'); refetch()
  }

  function onLeaveClick(vm: RunVM) {
    setMenuFor(null)
    const amOwner = vm.run.owner_user_id === user?.id
    const others = vm.players.filter((p) => p.auth_user_id && p.auth_user_id !== user?.id)
    if (amOwner && others.length > 0) { setTransferFor(vm); return }
    doLeave(vm)
  }

  return (
    <div className="w-full max-w-5xl anim-fade-up">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 text-pk-red font-black text-[11px] uppercase tracking-widest mb-1.5"><span>🖊</span> Browser-Tracker (manuell)</div>
        <h1 className="text-3xl font-black text-white">Willkommen, {profile?.display_name || profile?.username} 👋</h1>
        <p className="text-slate-500 mt-1">Tracke deinen SoulLink im Browser — von Hand oder als Zuschauer. Zum echten Spielen mit Emulator &amp; automatischem Live-Sync brauchst du den Companion.</p>
      </div>

      {/* Companion = das eigentliche Spielen (Emulator, Randomizer, Live-Sync, Weiterspielen, Multiplayer). */}
      <a href={LINKS.download} className="w-full text-left rounded-2xl p-5 mb-8 flex items-center gap-4 transition-transform active:scale-[0.99]"
        style={{ background: 'linear-gradient(120deg, rgba(204,0,0,0.20), rgba(204,0,0,0.05))', border: '1px solid rgba(204,0,0,0.35)' }}>
        <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(204,0,0,0.22)' }}>
          <Gamepad2 className="w-6 h-6 text-pk-red" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-black text-lg">Mit Emulator &amp; Live-Sync spielen? → Companion herunterladen</div>
          <div className="text-slate-300 text-sm">ROM randomisieren, BizHawk starten, automatischer Team-Sync, Weiterspielen &amp; Multiplayer — alles in der Desktop-App.</div>
        </div>
        <span className="shrink-0 hidden sm:flex items-center gap-1.5 text-pk-red font-bold text-sm"><Download className="w-4 h-4" /> Download</span>
      </a>

      {error && <div className="bg-red-950/60 border border-red-800 text-red-400 rounded-xl p-4 mb-6 text-sm font-medium">{error}</div>}

      <div className="grid md:grid-cols-2 gap-5 mb-10">
        <form onSubmit={handleCreate} className="pk-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-white font-black"><Swords className="w-5 h-5 text-pk-red" /> Manuellen Tracker erstellen</div>
          <p className="text-slate-500 text-xs -mt-1">Ein Browser-Tracker zum Eintragen von Hand. Zum Spielen mit Emulator startest du Runs im Companion.</p>
          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">Tracker-Name <span className="text-slate-600 font-normal">(optional)</span></label>
            <input value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="z. B. Mein Platin SoulLink" maxLength={40} className="pk-input" />
          </div>
          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">Spiel</label>
            <select value={game} onChange={(e) => setGame(e.target.value)} className="pk-input">{GAME_LIST.map((g) => <option key={g}>{g}</option>)}</select>
          </div>
          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">Code <span className="text-slate-600 font-normal">(optional)</span></label>
            <div className="flex gap-2">
              <input value={customCode} onChange={(e) => setCustomCode(e.target.value)} placeholder="Automatisch generieren" className="pk-input font-mono" maxLength={12} />
              <button type="button" onClick={() => setCustomCode('')} title="Zufällig" className="shrink-0 w-12 flex items-center justify-center rounded-xl border border-[#2e2e42] text-slate-400 hover:text-white hover:border-slate-500 transition-colors" style={{ background: '#16161f' }}><Shuffle className="w-4 h-4" /></button>
            </div>
          </div>
          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">Spieleranzahl</label>
            <div className="flex rounded-xl p-1 gap-1" style={{ background: '#16161f', border: '1px solid #2e2e42' }}>
              {[2, 3].map((n) => (
                <button key={n} type="button" onClick={() => setPlayerCount(n)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                  style={playerCount === n ? { background: '#CC0000', color: 'white' } : { color: '#64748b' }}>
                  {n} Spieler
                </button>
              ))}
            </div>
          </div>
          <p className="text-slate-600 text-xs">Spielername: <span className="text-slate-400 font-bold">{profile?.username}</span> (aus deinem Account)</p>
          <button type="submit" disabled={busy} className="btn-primary w-full py-3.5">{busy ? 'Wird erstellt…' : '🖊 Manuellen Tracker starten'}</button>
        </form>

        <form onSubmit={handleJoin} className="pk-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-white font-black"><Users className="w-5 h-5 text-pk-red" /> Per Code beitreten</div>
          <p className="text-slate-500 text-xs -mt-1">Tritt dem SoulLink eines Freundes bei, um im Browser mitzutracken oder zuzuschauen.</p>
          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">Code</label>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="z. B. abc12345" className="pk-input font-mono tracking-widest" required />
          </div>
          <p className="text-slate-600 text-xs">Du trittst als <span className="text-slate-400 font-bold">{profile?.username}</span> bei.</p>
          <button type="submit" disabled={busy} className="btn-ghost w-full py-3.5">{busy ? 'Beitreten…' : '🔗 Beitreten'}</button>
        </form>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">Meine Tracker</h2>
          <button onClick={() => refetch()} className="text-slate-500 text-xs hover:text-white transition-colors">Aktualisieren</button>
        </div>

        {isLoading ? (
          <div className="text-slate-500 text-sm py-8 text-center">Lade deine Runs…</div>
        ) : myRuns.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-[#2e2e42]">
            <p className="text-slate-400 font-bold">Noch keine Tracker</p>
            <p className="text-slate-600 text-sm mt-1">Erstelle oben deinen ersten manuellen Tracker oder tritt per Code bei.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {myRuns.map((vm) => {
              const amOwner = vm.run.owner_user_id === user?.id
              const activeMembers = vm.players.filter((p) => p.auth_user_id)
              const soleOwner = amOwner && activeMembers.length <= 1
              return (
                <div key={vm.run.id} className="pk-card p-4 relative">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => openRun(vm)} className="text-left min-w-0 flex-1 group">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-black truncate">{vm.run.name}</span>
                        {amOwner && <Crown className="w-3.5 h-3.5 text-pk-yellow shrink-0" />}
                      </div>
                      <div className="text-slate-500 text-xs">{vm.run.game}</div>
                    </button>
                    <div className="relative shrink-0">
                      <button onClick={() => setMenuFor(menuFor === vm.run.id ? null : vm.run.id)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors" aria-label="Aktionen">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuFor === vm.run.id && (
                        <>
                          <div className="fixed inset-0 z-[40]" onClick={() => setMenuFor(null)} />
                          <div className="absolute right-0 top-full mt-1 z-[50] bg-[#1c1c26] border border-[#2e2e42] rounded-xl shadow-2xl overflow-hidden min-w-48">
                            <button onClick={() => { setMenuFor(null); openRun(vm) }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
                              <ArrowRight className="w-4 h-4" /> Öffnen
                            </button>
                            {!soleOwner && (
                              <button onClick={() => onLeaveClick(vm)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
                                <LogOut className="w-4 h-4" /> Tracker verlassen
                              </button>
                            )}
                            {amOwner && (
                              <button onClick={() => { setMenuFor(null); setDeleteFor(vm) }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-400/5 transition-colors border-t border-[#2e2e42]">
                                <Trash2 className="w-4 h-4" /> Tracker dauerhaft löschen
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <button onClick={() => openRun(vm)} className="w-full text-left">
                    <div className="flex items-center gap-3 mt-3 text-xs flex-wrap">
                      <span className="flex items-center gap-1 text-slate-400"><Link2 className="w-3 h-3 text-pk-red/60" /> {vm.partnerName}</span>
                      <span className="font-mono text-slate-500">{vm.run.share_code}</span>
                      <span className="flex items-center gap-1 text-slate-600 ml-auto"><Clock className="w-3 h-3" /> {timeAgo(vm.lastActivity)}</span>
                    </div>
                  </button>
                  {soleOwner && (
                    <p className="text-slate-600 text-[10px] mt-2">Als alleiniger Owner kannst du den Tracker nur dauerhaft löschen.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {deleteFor && <DeleteConfirmModal vm={deleteFor} busy={actionBusy} onCancel={() => setDeleteFor(null)} onConfirm={() => doDelete(deleteFor)} />}
      {transferFor && user && <TransferOwnerModal vm={transferFor} myId={user.id} busy={actionBusy} onCancel={() => setTransferFor(null)} onConfirm={(uid) => doTransferAndLeave(transferFor, uid)} />}
    </div>
  )
}

function DeleteConfirmModal({ vm, busy, onCancel, onConfirm }: { vm: RunVM; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[210] p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-md border border-[#2e2e42] shadow-2xl anim-pop">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2e2e42]">
          <h2 className="text-white font-black text-lg flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-400" /> Tracker löschen</h2>
          <button onClick={onCancel} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-6 space-y-4">
          <p className="text-slate-300 text-sm">Tracker wirklich dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
          <div className="rounded-xl px-4 py-3 bg-[#16161f] border border-[#2e2e42]">
            <div className="text-white font-bold">{vm.run.name}</div>
            <div className="text-slate-500 text-xs">{vm.run.game} · {vm.run.share_code}</div>
          </div>
          <p className="text-slate-600 text-xs">Alle Pokémon, SoulLinks, Team-Slots, Anfragen und das Protokoll werden entfernt.</p>
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} disabled={busy} className="btn-ghost flex-1">Abbrechen</button>
            <button onClick={onConfirm} disabled={busy} className="flex-1 rounded-[14px] font-bold py-3.5 text-white" style={{ background: '#CC0000' }}>{busy ? 'Wird gelöscht…' : 'Dauerhaft löschen'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TransferOwnerModal({ vm, myId, busy, onCancel, onConfirm }: { vm: RunVM; myId: string; busy: boolean; onCancel: () => void; onConfirm: (newOwnerId: string) => void }) {
  const others = vm.players.filter((p) => p.auth_user_id && p.auth_user_id !== myId)
  const [sel, setSel] = useState(others[0]?.auth_user_id ?? '')
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[210] p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-md border border-[#2e2e42] shadow-2xl anim-pop">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2e2e42]">
          <h2 className="text-white font-black text-lg flex items-center gap-2"><Crown className="w-5 h-5 text-pk-yellow" /> Wähle einen neuen Owner</h2>
          <button onClick={onCancel} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-6 space-y-4">
          <p className="text-slate-400 text-sm">Du bist Owner von <span className="text-white font-bold">{vm.run.name}</span>. Übertrage den Besitz, bevor du den Tracker verlässt.</p>
          <div className="space-y-2">
            {others.map((p) => (
              <button key={p.id} onClick={() => setSel(p.auth_user_id!)}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all text-left"
                style={{ background: sel === p.auth_user_id ? 'rgba(255,203,5,0.08)' : '#16161f', borderColor: sel === p.auth_user_id ? 'rgba(255,203,5,0.5)' : '#2e2e42' }}>
                <span className="w-8 h-8 rounded-full bg-[#1c1c26] border border-[#2e2e42] flex items-center justify-center text-pk-yellow font-black">{p.name.charAt(0).toUpperCase()}</span>
                <span className="text-white font-bold">{p.name}</span>
                {sel === p.auth_user_id && <Crown className="w-4 h-4 text-pk-yellow ml-auto" />}
              </button>
            ))}
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} disabled={busy} className="btn-ghost flex-1">Abbrechen</button>
            <button onClick={() => sel && onConfirm(sel)} disabled={busy || !sel} className="btn-primary flex-1">{busy ? 'Übertrage…' : 'Übertragen & verlassen'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen pokeball-bg flex items-center justify-center">
        <div className="text-slate-400 text-lg">Wird geladen…</div>
      </div>
    )
  }
  if (!user) return <LandingPage />
  return <Shell showMenu><Dashboard /></Shell>
}
