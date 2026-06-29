import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertTriangle, Settings, LogIn } from 'lucide-react'
import { useProfiles } from '../../hooks/useProfiles'
import { getPlatform } from '../../platform'
import { useAuth } from '../../contexts/AuthContext'
import { joinRunByCode } from '../../lib/joinRun'
import { fetchRunRecipe } from '../../lib/runRecipe'
import { seedForPlayer } from '../../lib/randomizerSync'
import { useRunStore } from '../../store/runStore'

// Join a friend's SoulLink by code: claim the slot (join_run) → read the shared
// recipe (preset rules; world_seed only in "Gleiche Welt") → randomize THIS player's
// own ROM with those rules → launch → open the shared RunPage. One run, local ROM/save.
type Step = 'idle' | 'joining' | 'randomizing' | 'launching' | 'error'
const ERR: Record<string, string> = {
  preset_missing: 'Der Run hat noch kein geteiltes Preset.',
  original_rom_missing: 'Die Original-ROM deines Profils fehlt.',
  bizhawk_missing: 'BizHawk fehlt in deinem Profil.',
  fvx_not_found: 'Der Randomizer (FVX) wurde nicht gefunden.',
  randomize_failed: 'Die ROM konnte nicht randomisiert werden.',
  unreachable: 'Companion nicht erreichbar.',
}

export default function JoinRunPage() {
  const navigate = useNavigate()
  const platform = getPlatform()
  const { user } = useAuth()
  const { active } = useProfiles()
  const setCurrentRun = useRunStore((s) => s.setCurrentRun)
  const [code, setCode] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const ready = !!(active && active.paths.originalRom && active.paths.bizhawk)
  const busy = step === 'joining' || step === 'randomizing' || step === 'launching'

  async function join() {
    if (!user || !active || !code.trim()) return
    setErr(null); setInfo(null); setStep('joining')
    let joined
    try { joined = await joinRunByCode(code, user.id) } catch (e) { setErr(e instanceof Error ? e.message : 'Beitritt fehlgeschlagen.'); setStep('error'); return }

    // ── Validation: refuse to start with the wrong rules/edition/FVX version ───────
    const recipe = await fetchRunRecipe(joined.run.id)
    if (!recipe?.preset_data) { setErr('Dieser Run wurde noch nicht vorbereitet. Bitte warte, bis dein Freund den SoulLink gestartet hat.'); setStep('error'); return }
    if (recipe.edition && active.edition && recipe.edition !== active.edition) {
      setErr(`Dieser SoulLink ist für „${recipe.edition}", dein Profil für „${active.edition}". Bitte ein passendes Profil/ROM wählen.`); setStep('error'); return
    }
    const localFvx = (await platform.randomizerStatus())?.version ?? null
    if (recipe.fvx_version && localFvx && recipe.fvx_version !== localFvx) {
      setErr(`Der Host nutzte FVX ${recipe.fvx_version}, du hast ${localFvx}. Für identische Regeln muss die FVX-Version übereinstimmen.`); setStep('error'); return
    }

    // Adopt the host's rules, but derive THIS player's own deterministic seed from the
    // run master seed + slot → same world rules, different (reproducible) world.
    const { seed: mySeed, slot } = seedForPlayer({ masterSeed: recipe.world_seed, sameWorld: !!recipe.same_world, players: joined.players, playerId: joined.myPlayerId })
    setInfo(`✓ Host-Regeln übernommen · Spieler-Slot ${slot + 1} · eigener Seed #${mySeed}${recipe.same_world ? ' · Gleiche Welt' : ''} · ROM wird separat randomisiert`)
    setStep('randomizing')
    const r = await platform.prepareRun({ runId: joined.run.id, profileId: active.id, presetData: recipe.preset_data, seed: recipe.world_seed != null ? mySeed : undefined })
    if (!r.ok) { setErr(ERR[r.error || ''] || r.error || 'Fehler'); setStep('error'); return }

    setStep('launching')
    const lr = await platform.launch({ bizhawkPath: r.bizhawk || '', romPath: r.outputRom || '', luaPath: '', syncFolder: '' }, false, joined.run.id)
    if (!lr.ok) { setErr('BizHawk-Start fehlgeschlagen' + (lr.error ? ` (${lr.error})` : '')); setStep('error'); return }

    setCurrentRun(joined.run, joined.players, joined.myPlayerId)
    navigate(`/run/${joined.run.id}`)
  }

  return (
    <div className="max-w-xl mx-auto px-8 py-10">
      <h1 className="text-white font-black text-3xl tracking-tight">SoulLink beitreten</h1>
      <p className="text-slate-400 mt-1.5">Gib den Einladungs-Code deines Freundes ein.</p>

      {!ready ? (
        <div className="mt-7 rounded-2xl border border-amber-700/40 bg-amber-950/15 p-6">
          <div className="flex items-center gap-2 text-amber-300 font-black"><AlertTriangle className="w-5 h-5" /> Profil noch nicht vollständig</div>
          <p className="text-slate-300 text-sm mt-2">Zum Beitreten brauchst du ein Profil mit deiner eigenen Original-ROM und BizHawk.</p>
          <button onClick={() => navigate('/profiles')} className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: '#CC0000' }}>
            <Settings className="w-4 h-4" /> Profil einrichten
          </button>
        </div>
      ) : (
        <>
          <div className="mt-7 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-5">
            <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">Einladungs-Code</label>
            <input value={code} disabled={busy} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') join() }}
              placeholder="z. B. happy-bidoof-42" className="w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3.5 py-2.5 text-sm text-white font-mono" />
            <p className="text-slate-500 text-[11px] mt-2">Du randomisierst mit <b className="text-slate-300">deiner eigenen ROM</b> nach den geteilten Regeln. Dein Spielstand bleibt lokal.</p>
          </div>

          <button onClick={join} disabled={busy || !code.trim()} className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-white disabled:opacity-60" style={{ background: '#CC0000' }}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {step === 'joining' ? 'Trete bei …' : step === 'randomizing' ? 'Randomisiere … (~1 Min)' : step === 'launching' ? 'BizHawk wird gestartet …' : 'Beitreten & starten'}
          </button>
          {info && !err && (
            <div className="mt-4 rounded-xl border border-green-800/40 bg-green-950/20 px-3.5 py-2.5 text-green-300 text-xs leading-relaxed">{info}</div>
          )}
          {err && <p className="mt-4 text-red-300 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {err}</p>}
        </>
      )}
    </div>
  )
}
