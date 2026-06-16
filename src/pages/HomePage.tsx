import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swords, Users, Zap, Shuffle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRunStore } from '../store/runStore'
import { GAME_LIST } from '../lib/routes'
import type { Run, Player } from '../types/database'

const PLAYER_NAME_KEY = 'soullink_player_name'

const DECO_POKEMON = [
  { id: 6,   side: 'left',  bottom: '0',   size: 240, opacity: 0.18 },
  { id: 9,   side: 'right', bottom: '0',   size: 220, opacity: 0.16 },
  { id: 25,  side: 'left',  bottom: '55%', size: 140, opacity: 0.12 },
  { id: 150, side: 'right', bottom: '52%', size: 180, opacity: 0.10 },
]

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

export default function HomePage() {
  const navigate = useNavigate()
  const { currentRun, myPlayerId, setCurrentRun, clearRun } = useRunStore()

  const savedName = localStorage.getItem(PLAYER_NAME_KEY) ?? ''

  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [myName, setMyName] = useState(savedName)
  const [game, setGame] = useState(GAME_LIST[0])
  const [customCode, setCustomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinName, setJoinName] = useState(savedName)
  const [editingJoinName, setEditingJoinName] = useState(!savedName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingSession, setCheckingSession] = useState(!!(currentRun && myPlayerId))

  // Auto-redirect if last session exists and run is still valid
  useEffect(() => {
    if (!currentRun || !myPlayerId) {
      setCheckingSession(false)
      return
    }
    supabase
      .from('runs')
      .select('id')
      .eq('id', currentRun.id)
      .single()
      .then(
        ({ data }) => {
          if (data) {
            navigate(`/run/${currentRun.id}`)
          } else {
            clearRun()
            setCheckingSession(false)
          }
        },
        () => setCheckingSession(false)
      )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = myName.trim()
    if (!name) return
    setLoading(true); setError('')
    try {
      const payload: Record<string, string> = { name: `${name}'s Run`, game }
      if (customCode.trim()) payload.share_code = customCode.trim().toLowerCase()

      const { data: run, error: runErr } = await supabase
        .from('runs').insert(payload).select().single()
      if (runErr) throw runErr

      const { data: player, error: playerErr } = await supabase
        .from('players')
        .insert({ run_id: run.id, name, player_number: 1 })
        .select().single()
      if (playerErr) throw playerErr

      localStorage.setItem(PLAYER_NAME_KEY, name)
      setCurrentRun(run as Run, [player as Player], (player as Player).id)
      navigate(`/run/${run.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen')
    } finally { setLoading(false) }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const name = editingJoinName ? joinName.trim() : (savedName || joinName.trim())
    if (!joinCode.trim() || !name) return
    setLoading(true); setError('')
    try {
      const { data: run, error: runErr } = await supabase
        .from('runs').select('*').eq('share_code', joinCode.trim().toLowerCase()).single()
      if (runErr || !run) throw new Error('Run nicht gefunden. Code überprüfen.')

      const { data: existingPlayers } = await supabase.from('players').select('*').eq('run_id', run.id)
      const players = (existingPlayers as Player[]) ?? []

      let myPlayer = players.find((p) => p.name.toLowerCase() === name.toLowerCase())

      if (!myPlayer && players.length < 2) {
        const nextNum = players.length === 0 ? 1 : 2
        const { data: newPlayer, error: pErr } = await supabase
          .from('players').insert({ run_id: run.id, name, player_number: nextNum }).select().single()
        if (pErr) throw pErr
        myPlayer = newPlayer as Player
        players.push(myPlayer)
      } else if (!myPlayer) {
        myPlayer = players[1] ?? players[0]
      }

      const { data: allPlayers } = await supabase.from('players').select('*').eq('run_id', run.id)
      localStorage.setItem(PLAYER_NAME_KEY, name)
      setCurrentRun(run as Run, allPlayers as Player[], myPlayer!.id)
      navigate(`/run/${run.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Beitreten')
    } finally { setLoading(false) }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen pokeball-bg flex items-center justify-center">
        <div className="text-slate-400 text-lg">Session wird geladen…</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen pokeball-bg overflow-hidden flex flex-col">
      {/* Decorative Pokémon */}
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

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-pk-red/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PokeBall className="w-8 h-8 text-pk-red" />
            <span className="text-white font-black text-xl tracking-tight">SoulLink<span className="text-pk-red">.</span></span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Zap className="w-4 h-4 text-pk-yellow" />
            <span>Pokémon Gen I–V Nuzlocke Tracker</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-10 anim-fade-up">
          <div className="flex items-center justify-center gap-3 mb-5">
            <PokeBall className="w-12 h-12 text-pk-red" />
            <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-none">
              Soul<span className="text-pk-red">Link</span>
            </h1>
            <PokeBall className="w-12 h-12 text-pk-red" />
          </div>
          <p className="text-slate-400 text-xl font-medium">Gemeinsam überleben. Gemeinsam sterben.</p>
          <p className="text-slate-600 text-sm mt-2">Pokémon Gen I–V · Nuzlocke SoulLink Tracker</p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-10 anim-fade-up delay-2">
          {['Echtzeit-Sync', 'SoulLink System', 'Bestätigungs-Anfragen', '649 Pokémon', 'Offizielle Routen'].map((f) => (
            <span key={f} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.25)', color: '#f87171' }}>
              {f}
            </span>
          ))}
        </div>

        {/* Card */}
        <div className="w-full max-w-md anim-fade-up delay-3">
          <div className="flex bg-[#1c1c26] border border-[#2e2e42] rounded-2xl p-1.5 mb-5">
            <TabBtn active={tab === 'create'} onClick={() => setTab('create')}>
              <Swords className="w-4 h-4" /> Neuer Run
            </TabBtn>
            <TabBtn active={tab === 'join'} onClick={() => setTab('join')}>
              <Users className="w-4 h-4" /> Beitreten
            </TabBtn>
          </div>

          {error && (
            <div className="bg-red-950/60 border border-red-800 text-red-400 rounded-xl p-4 mb-5 text-sm font-medium">{error}</div>
          )}

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="pk-card p-7 space-y-5">
              <div>
                <label className="text-slate-300 text-sm font-bold mb-2 block">Dein Name</label>
                <input
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  placeholder="z. B. Valon"
                  className="pk-input"
                  required
                />
              </div>
              <div>
                <label className="text-slate-300 text-sm font-bold mb-2 block">Spiel</label>
                <select value={game} onChange={(e) => setGame(e.target.value)} className="pk-input">
                  {GAME_LIST.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-slate-300 text-sm font-bold mb-2 block">
                  Run-Code <span className="text-slate-600 font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    placeholder="Automatisch generieren"
                    className="pk-input font-mono"
                    maxLength={12}
                  />
                  <button
                    type="button"
                    onClick={() => setCustomCode('')}
                    title="Zufällig generieren"
                    className="shrink-0 w-12 flex items-center justify-center rounded-xl border border-[#2e2e42] text-slate-400 hover:text-white hover:border-slate-500 transition-colors text-base"
                    style={{ background: '#16161f' }}
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-slate-600 text-xs mt-1.5">Leer = automatisch generieren · Dein Partner tritt mit diesem Code bei</p>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full text-base py-4">
                {loading ? 'Wird erstellt…' : '⚡ Run starten'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="pk-card p-7 space-y-5">
              <div>
                <label className="text-slate-300 text-sm font-bold mb-2 block">Run-Code</label>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="z. B. abc12345"
                  className="pk-input font-mono tracking-widest"
                  required
                />
              </div>

              {editingJoinName ? (
                <div>
                  <label className="text-slate-300 text-sm font-bold mb-2 block">Dein Name</label>
                  <input
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="z. B. Leon"
                    className="pk-input"
                    required
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: '#16161f', border: '1px solid #2e2e42' }}>
                  <div>
                    <div className="text-slate-400 text-xs mb-0.5">Beitreten als</div>
                    <div className="text-white font-black text-sm">{savedName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEditingJoinName(true); setJoinName(savedName) }}
                    className="text-slate-500 text-xs hover:text-white transition-colors"
                  >
                    Ändern
                  </button>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full text-base py-4">
                {loading ? 'Beitreten…' : '🔗 Run beitreten'}
              </button>
            </form>
          )}
        </div>

        {/* Bottom logo strip */}
        <div className="flex items-center gap-6 mt-12 opacity-20 anim-fade-up delay-5">
          {[3, 6, 9, 25, 54, 94, 143, 150].map((id) => (
            <img key={id} src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`} alt="" aria-hidden className="w-10 h-10 object-contain" />
          ))}
        </div>
      </main>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
      style={active ? { background: '#CC0000', color: 'white' } : { color: '#94a3b8', background: 'transparent' }}
    >
      {children}
    </button>
  )
}
