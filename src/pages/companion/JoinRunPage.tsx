import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertTriangle, Settings, LogIn } from 'lucide-react'
import { useProfiles } from '../../hooks/useProfiles'
import { useAuth } from '../../contexts/AuthContext'
import { joinRunByCode } from '../../lib/joinRun'
import { fetchRunRecipe, type RunRecipe } from '../../lib/runRecipe'
import JoinSetupWizard from '../../components/JoinSetupWizard'

// Join a friend's SoulLink by code → claim the slot → then hand off to the fully
// automatic JoinSetupWizard (validate config, derive this player's own seed, install
// FVX if needed, randomize a separate ROM, launch BizHawk + Lua). The partner watches
// a progress checklist and clicks nothing but "Jetzt spielen" at the end.
interface Session { joined: Awaited<ReturnType<typeof joinRunByCode>>; recipe: RunRecipe }

export default function JoinRunPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { active } = useProfiles()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  const ready = !!(active && active.paths.originalRom && active.paths.bizhawk)

  async function join() {
    if (!user || !active || !code.trim()) return
    setErr(null); setJoining(true)
    let joined
    try { joined = await joinRunByCode(code, user.id) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Beitritt fehlgeschlagen.'); setJoining(false); return }
    const recipe = await fetchRunRecipe(joined.run.id)
    setJoining(false)
    if (!recipe?.preset_data) { setErr('Dieser Run wurde noch nicht vorbereitet. Bitte warte, bis dein Freund den SoulLink gestartet und randomisiert hat.'); return }
    setSession({ joined, recipe })   // → the wizard takes over from here
  }

  if (session && active) {
    return <JoinSetupWizard joined={session.joined} recipe={session.recipe} profile={{ id: active.id, edition: active.edition }} onClose={() => setSession(null)} />
  }

  return (
    <div className="max-w-xl mx-auto px-8 py-10">
      <h1 className="text-white font-black text-3xl tracking-tight">SoulLink beitreten</h1>
      <p className="text-slate-400 mt-1.5">Gib den Einladungs-Code deines Freundes ein — den Rest erledigt SoulLink automatisch.</p>

      {!ready ? (
        <div className="mt-7 rounded-2xl border border-amber-700/40 bg-amber-950/15 p-6">
          <div className="flex items-center gap-2 text-amber-300 font-black"><AlertTriangle className="w-5 h-5" /> Profil noch nicht vollständig</div>
          <p className="text-slate-300 text-sm mt-2">Zum Beitreten brauchst du einmalig ein Profil mit deiner eigenen Original-ROM und BizHawk. Danach ist Beitreten ein Klick.</p>
          <button onClick={() => navigate('/profiles')} className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: '#CC0000' }}>
            <Settings className="w-4 h-4" /> Profil einrichten
          </button>
        </div>
      ) : (
        <>
          <div className="mt-7">
            <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">Einladungs-Code</label>
            <input value={code} disabled={joining} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') join() }}
              placeholder="z. B. happy-bidoof-42" className="w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3.5 py-2.5 text-sm text-white font-mono" />
            <p className="text-slate-500 text-[11px] mt-2">Du übernimmst automatisch die <b className="text-slate-300">Regeln des Hosts</b> und randomisierst mit <b className="text-slate-300">deiner eigenen ROM</b> und deinem eigenen Seed. Dein Spielstand bleibt lokal.</p>
          </div>

          <button onClick={join} disabled={joining || !code.trim()} className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-white disabled:opacity-60" style={{ background: '#CC0000' }}>
            {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {joining ? 'Trete bei …' : 'Beitreten & automatisch einrichten'}
          </button>
          {err && <p className="mt-4 text-red-300 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {err}</p>}
        </>
      )}
    </div>
  )
}
