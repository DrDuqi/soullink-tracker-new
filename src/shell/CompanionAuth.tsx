import { useState } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// Clean, marketing-free login for the Companion window. The window runs on the
// 127.0.0.1 origin, so the website's session does NOT carry over — the user signs
// in here once. Reuses the SAME AuthContext methods as the website (no duplicated
// auth logic); only the presentation is desktop-shell styled.
export default function CompanionAuth() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = mode === 'in' ? await signIn(email, password) : await signUp(email, password, username)
    if (res.error) setError(res.error)
    setBusy(false)
  }

  const input = 'w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600'

  return (
    <div className="h-full flex items-center justify-center p-6" style={{ background: '#0b0b10' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6 justify-center">
          <div className="w-9 h-9 rounded-xl bg-pk-red flex items-center justify-center text-white font-black">S</div>
          <span className="text-white font-black text-xl tracking-tight">SoulLink</span>
        </div>
        <div className="rounded-2xl border border-[#2e2e42] bg-[#16161f] p-6">
          <div className="flex gap-1 mb-5 p-1 rounded-xl bg-[#111116] border border-[#2e2e42]">
            {(['in', 'up'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${mode === m ? 'bg-pk-red text-white' : 'text-slate-400 hover:text-white'}`}>
                {m === 'in' ? 'Anmelden' : 'Registrieren'}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === 'up' && (
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Benutzername" className={input} required autoComplete="username" />
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" className={input} required autoComplete="email" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passwort" className={input} required autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
            {error && <p className="text-red-300 text-xs">{error}</p>}
            <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{ background: '#CC0000' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {mode === 'in' ? 'Anmelden' : 'Konto erstellen'}
            </button>
          </form>
          <div className="flex items-center gap-3 my-4">
            <span className="flex-1 h-px bg-[#2e2e42]" /><span className="text-slate-600 text-xs">oder</span><span className="flex-1 h-px bg-[#2e2e42]" />
          </div>
          <button onClick={() => signInWithGoogle()} className="w-full py-2.5 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5 transition-colors">
            Mit Google anmelden
          </button>
        </div>
        <p className="text-slate-600 text-[11px] text-center mt-4">Dein Login bleibt in der SoulLink-App gespeichert.</p>
      </div>
    </div>
  )
}
