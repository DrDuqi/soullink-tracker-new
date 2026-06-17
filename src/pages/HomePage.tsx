import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Swords, Users, Zap, Shuffle, LogIn, UserPlus, ArrowRight, Link2, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRunStore } from '../store/runStore'
import { GAME_LIST } from '../lib/routes'
import UserMenu from '../components/UserMenu'
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

const DECO_POKEMON = [
  { id: 6,   side: 'left',  bottom: '0',   size: 240, opacity: 0.18 },
  { id: 9,   side: 'right', bottom: '0',   size: 220, opacity: 0.16 },
  { id: 25,  side: 'left',  bottom: '55%', size: 140, opacity: 0.12 },
  { id: 150, side: 'right', bottom: '52%', size: 180, opacity: 0.10 },
]

function Shell({ children, showMenu }: { children: React.ReactNode; showMenu?: boolean }) {
  return (
    <div className="relative min-h-screen pokeball-bg overflow-hidden flex flex-col">
      {DECO_POKEMON.map((d) => (
        <img
          key={d.id}
          src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${d.id}.png`}
          alt="" aria-hidden="true"
          className="absolute pointer-events-none select-none hidden lg:block"
          style={{ [d.side]: '-20px', bottom: d.bottom, width: d.size, height: d.size, opacity: d.opacity, filter: 'drop-shadow(0 0 40px rgba(204,0,0,0.2))', objectFit: 'contain' }}
        />
      ))}
      <div className="absolute top-[-80px] right-[-80px] w-[320px] h-[320px] rounded-full border-[40px] border-pk-red/8 pointer-events-none hidden lg:block" />
      <div className="absolute bottom-[-60px] left-[-60px] w-[280px] h-[280px] rounded-full border-[35px] border-pk-red/6 pointer-events-none hidden lg:block" />

      <header className="relative z-10 border-b border-white/5 bg-pk-red/5 backdrop-blur-sm">
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

// ─── Logged-out: Login / Register ─────────────────────────────────────────────
function AuthView() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(error)
    // success → AuthProvider updates session → dashboard renders automatically
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await signUp(email, password, username)
    setLoading(false)
    if (error) setError(error)
  }

  async function handleGoogle() {
    setError('')
    const { error } = await signInWithGoogle()
    if (error) setError(error)
  }

  return (
    <>
      <div className="text-center mb-10 anim-fade-up">
        <div className="flex items-center justify-center gap-3 mb-5">
          <PokeBall className="w-12 h-12 text-pk-red" />
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-none">
            Soul<span className="text-pk-red">Link</span>
          </h1>
          <PokeBall className="w-12 h-12 text-pk-red" />
        </div>
        <p className="text-slate-400 text-xl font-medium">Gemeinsam überleben. Gemeinsam sterben.</p>
        <p className="text-slate-600 text-sm mt-2">Melde dich an, um Runs zu erstellen und beizutreten.</p>
      </div>

      <div className="w-full max-w-md anim-fade-up delay-2">
        <div className="flex bg-[#1c1c26] border border-[#2e2e42] rounded-2xl p-1.5 mb-5">
          <button type="button" onClick={() => { setTab('login'); setError('') }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
            style={tab === 'login' ? { background: '#CC0000', color: 'white' } : { color: '#94a3b8' }}>
            <LogIn className="w-4 h-4" /> Anmelden
          </button>
          <button type="button" onClick={() => { setTab('register'); setError('') }}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
            style={tab === 'register' ? { background: '#CC0000', color: 'white' } : { color: '#94a3b8' }}>
            <UserPlus className="w-4 h-4" /> Registrieren
          </button>
        </div>

        {error && <div className="bg-red-950/60 border border-red-800 text-red-400 rounded-xl p-4 mb-5 text-sm font-medium">{error}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="pk-card p-7 space-y-5">
            <div>
              <label className="text-slate-300 text-sm font-bold mb-2 block">E-Mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" className="pk-input" required autoComplete="email" />
            </div>
            <div>
              <label className="text-slate-300 text-sm font-bold mb-2 block">Passwort</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pk-input" required autoComplete="current-password" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full text-base py-4">{loading ? 'Anmelden…' : '⚡ Anmelden'}</button>
            <GoogleButton onClick={handleGoogle} />
          </form>
        ) : (
          <form onSubmit={handleRegister} className="pk-card p-7 space-y-5">
            <div>
              <label className="text-slate-300 text-sm font-bold mb-2 block">Benutzername</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="z. B. Valon" className="pk-input" required minLength={3} />
              <p className="text-slate-600 text-xs mt-1.5">Eindeutig · wird automatisch als dein Spielername verwendet.</p>
            </div>
            <div>
              <label className="text-slate-300 text-sm font-bold mb-2 block">E-Mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" className="pk-input" required autoComplete="email" />
            </div>
            <div>
              <label className="text-slate-300 text-sm font-bold mb-2 block">Passwort</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mind. 6 Zeichen" className="pk-input" required minLength={6} autoComplete="new-password" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full text-base py-4">{loading ? 'Konto wird erstellt…' : '🔥 Konto erstellen'}</button>
            <GoogleButton onClick={handleGoogle} />
          </form>
        )}
      </div>
    </>
  )
}

function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border border-[#2e2e42] text-slate-300 hover:bg-white/5 transition-colors"
      title="Erfordert aktivierten Google-Provider in Supabase">
      <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#fff" d="M12 11v2.8h3.9c-.2 1-1.3 2.9-3.9 2.9-2.3 0-4.2-1.9-4.2-4.3S9.7 7.8 12 7.8c1.3 0 2.2.6 2.7 1.1l1.8-1.8C15.4 6 13.9 5.3 12 5.3 8.3 5.3 5.3 8.3 5.3 12s3 6.7 6.7 6.7c3.9 0 6.4-2.7 6.4-6.6 0-.4 0-.8-.1-1.1H12z"/></svg>
      Mit Google fortfahren
    </button>
  )
}

// ─── Logged-in: Dashboard ─────────────────────────────────────────────────────
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
  const [game, setGame] = useState(GAME_LIST[0])
  const [customCode, setCustomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
        const partner = ps.find((p) => p.auth_user_id !== user!.id)
        return { run, players: ps, partnerName: partner?.name ?? '—', lastActivity: lastByRun.get(run.id) ?? run.created_at }
      }).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
    },
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !profile) return
    setBusy(true); setError('')
    try {
      const payload: Record<string, unknown> = { name: `${profile.username}'s Run`, game, owner_user_id: user.id }
      if (customCode.trim()) payload.share_code = customCode.trim().toLowerCase()
      const { data: run, error: runErr } = await supabase.from('runs').insert(payload).select().single()
      if (runErr) throw runErr
      const { data: player, error: pErr } = await supabase.from('players')
        .insert({ run_id: run.id, name: profile.username, player_number: 1, auth_user_id: user.id })
        .select().single()
      if (pErr) throw pErr
      setCurrentRun(run as Run, [player as Player], (player as Player).id)
      navigate(`/run/${run.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen')
    } finally { setBusy(false) }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !profile || !joinCode.trim()) return
    setBusy(true); setError('')
    try {
      const { data: run, error: runErr } = await supabase.from('runs').select('*').eq('share_code', joinCode.trim().toLowerCase()).single()
      if (runErr || !run) throw new Error('Run nicht gefunden. Code überprüfen.')
      const { data: existing } = await supabase.from('players').select('*').eq('run_id', run.id)
      const players = (existing as Player[]) ?? []

      const mine = players.find((p) => p.auth_user_id === user.id)
      if (mine) { setCurrentRun(run as Run, players, mine.id); navigate(`/run/${run.id}`); return }
      if (players.length >= 2) throw new Error('Dieser Run hat bereits zwei Spieler.')

      const nextNum = players.length === 0 ? 1 : 2
      const { data: newPlayer, error: pErr } = await supabase.from('players')
        .insert({ run_id: run.id, name: profile.username, player_number: nextNum, auth_user_id: user.id })
        .select().single()
      if (pErr) throw pErr
      setCurrentRun(run as Run, [...players, newPlayer as Player], (newPlayer as Player).id)
      navigate(`/run/${run.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Beitreten')
    } finally { setBusy(false) }
  }

  return (
    <div className="w-full max-w-5xl anim-fade-up">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">Willkommen, {profile?.display_name || profile?.username} 👋</h1>
        <p className="text-slate-500 mt-1">Erstelle einen neuen Run oder tritt mit einem Code bei.</p>
      </div>

      {error && <div className="bg-red-950/60 border border-red-800 text-red-400 rounded-xl p-4 mb-6 text-sm font-medium">{error}</div>}

      <div className="grid md:grid-cols-2 gap-5 mb-10">
        {/* Create */}
        <form onSubmit={handleCreate} className="pk-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-white font-black"><Swords className="w-5 h-5 text-pk-red" /> Neuer Run</div>
          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">Spiel</label>
            <select value={game} onChange={(e) => setGame(e.target.value)} className="pk-input">
              {GAME_LIST.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">Run-Code <span className="text-slate-600 font-normal">(optional)</span></label>
            <div className="flex gap-2">
              <input value={customCode} onChange={(e) => setCustomCode(e.target.value)} placeholder="Automatisch generieren" className="pk-input font-mono" maxLength={12} />
              <button type="button" onClick={() => setCustomCode('')} title="Zufällig" className="shrink-0 w-12 flex items-center justify-center rounded-xl border border-[#2e2e42] text-slate-400 hover:text-white hover:border-slate-500 transition-colors" style={{ background: '#16161f' }}>
                <Shuffle className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-slate-600 text-xs">Spielername: <span className="text-slate-400 font-bold">{profile?.username}</span> (aus deinem Account)</p>
          <button type="submit" disabled={busy} className="btn-primary w-full py-3.5">{busy ? 'Wird erstellt…' : '⚡ Run starten'}</button>
        </form>

        {/* Join */}
        <form onSubmit={handleJoin} className="pk-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-white font-black"><Users className="w-5 h-5 text-pk-red" /> Run beitreten</div>
          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">Run-Code</label>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="z. B. abc12345" className="pk-input font-mono tracking-widest" required />
          </div>
          <p className="text-slate-600 text-xs">Du trittst als <span className="text-slate-400 font-bold">{profile?.username}</span> bei.</p>
          <button type="submit" disabled={busy} className="btn-ghost w-full py-3.5 flex items-center justify-center gap-2">{busy ? 'Beitreten…' : <>🔗 Beitreten</>}</button>
        </form>
      </div>

      {/* My runs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">Meine Runs</h2>
          <button onClick={() => refetch()} className="text-slate-500 text-xs hover:text-white transition-colors">Aktualisieren</button>
        </div>

        {isLoading ? (
          <div className="text-slate-500 text-sm py-8 text-center">Lade deine Runs…</div>
        ) : myRuns.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-[#2e2e42]">
            <p className="text-slate-400 font-bold">Noch keine Runs</p>
            <p className="text-slate-600 text-sm mt-1">Erstelle oben deinen ersten Run oder tritt einem bei.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {myRuns.map(({ run, partnerName, lastActivity, players }) => (
              <button key={run.id} onClick={() => { setCurrentRun(run, players, players.find((p) => p.auth_user_id === user?.id)?.id ?? players[0].id); navigate(`/run/${run.id}`) }}
                className="pk-card p-4 text-left hover:border-slate-600 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-white font-black truncate">{run.name}</div>
                    <div className="text-slate-500 text-xs">{run.game}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-pk-red transition-colors shrink-0 mt-1" />
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs flex-wrap">
                  <span className="flex items-center gap-1 text-slate-400"><Link2 className="w-3 h-3 text-pk-red/60" /> {partnerName}</span>
                  <span className="font-mono text-slate-500">{run.share_code}</span>
                  <span className="flex items-center gap-1 text-slate-600 ml-auto"><Clock className="w-3 h-3" /> {timeAgo(lastActivity)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
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

  return <Shell showMenu={!!user}>{user ? <Dashboard /> : <AuthView />}</Shell>
}
