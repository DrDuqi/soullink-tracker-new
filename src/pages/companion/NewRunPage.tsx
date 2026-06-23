import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dices, Play, Loader2, Check, AlertTriangle, Settings, PartyPopper } from 'lucide-react'
import { useProfiles } from '../../hooks/useProfiles'
import { useEmulatorSync } from '../../hooks/useEmulatorSync'
import { getPlatform } from '../../platform'
import type { Preset } from '../../lib/presets'

// The single-player end-to-end flow: pick a profile (with its ROM/BizHawk/preset),
// generate a seed, then one click → randomize → launch BizHawk → wait for live-sync.
// Everything except the seed is automatic, which is the whole point of Phase 3.
type Step = 'idle' | 'randomizing' | 'launching' | 'waiting' | 'running' | 'error'

const ERR: Record<string, string> = {
  profile_not_found: 'Profil nicht gefunden.',
  original_rom_missing: 'Die Original-ROM des Profils fehlt oder wurde verschoben.',
  bizhawk_missing: 'BizHawk fehlt im Profil.',
  preset_missing: 'Das Randomizer-Preset fehlt im Profil.',
  randomize_failed: 'Die Randomisierung ist fehlgeschlagen.',
  fvx_not_found: 'Der Randomizer (FVX) wurde nicht gefunden.',
  unreachable: 'Companion nicht erreichbar.',
}

export default function NewRunPage() {
  const navigate = useNavigate()
  const platform = getPlatform()
  const { active, loading } = useProfiles()
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000_000))
  const [presets, setPresets] = useState<Preset[]>([])
  const [presetId, setPresetId] = useState<string>('')
  const [step, setStep] = useState<Step>('idle')
  const [err, setErr] = useState<string | null>(null)
  const sync = useEmulatorSync(step === 'waiting' || step === 'running')

  useEffect(() => { if (step === 'waiting' && sync.phase === 'connected') setStep('running') }, [sync.phase, step])

  // Load presets for the profile's edition; default to the profile's last preset or
  // the first available (SoulLink Standard) so beginners just click "Run starten".
  useEffect(() => {
    let cancel = false
    platform.listPresets(active?.edition || undefined).then((list) => {
      if (cancel || !list) return
      setPresets(list)
      setPresetId((cur) => cur || active?.presetId || list[0]?.id || '')
    })
    return () => { cancel = true }
  }, [platform, active?.edition, active?.presetId])

  const ready = !!(active && active.paths.originalRom && active.paths.bizhawk && presetId)
  const busy = step === 'randomizing' || step === 'launching' || step === 'waiting'

  async function start() {
    if (!active) return
    setErr(null); setStep('randomizing')
    const r = await platform.prepareRun({ profileId: active.id, presetId, seed })
    if (!r.ok) { setErr(ERR[r.error || ''] || r.error || 'Fehler'); setStep('error'); return }
    setStep('launching')
    const lr = await platform.launch({ bizhawkPath: r.bizhawk || '', romPath: r.outputRom || '', luaPath: '', syncFolder: '' }, false)
    if (!lr.ok) { setErr('BizHawk-Start fehlgeschlagen' + (lr.error ? ` (${lr.error})` : '')); setStep('error'); return }
    setStep('waiting')
  }

  if (loading) return <div className="p-10 text-slate-500 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Wird geladen…</div>

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <h1 className="text-white font-black text-3xl tracking-tight">Neuer SoulLink</h1>
      <p className="text-slate-400 mt-1.5">Seed wählen, der Rest passiert automatisch.</p>

      {!ready ? (
        <div className="mt-7 rounded-2xl border border-amber-700/40 bg-amber-950/15 p-6">
          <div className="flex items-center gap-2 text-amber-300 font-black"><AlertTriangle className="w-5 h-5" /> Profil noch nicht vollständig</div>
          <p className="text-slate-300 text-sm mt-2">
            {active ? <>Für <b className="text-white">{active.name}</b> fehlen noch Original-ROM, BizHawk oder Preset.</> : 'Lege zuerst ein Profil an und hinterlege die Spiel-Dateien.'}
          </p>
          <button onClick={() => navigate('/profiles')} className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: '#CC0000' }}>
            <Settings className="w-4 h-4" /> Profil einrichten
          </button>
        </div>
      ) : step === 'running' ? (
        <div className="mt-7 rounded-2xl border border-green-700/40 bg-green-950/20 p-8 text-center">
          <PartyPopper className="w-12 h-12 text-pk-yellow mx-auto mb-3" />
          <h2 className="text-white font-black text-2xl">Läuft! Viel Spaß</h2>
          <p className="text-slate-300 mt-1.5">BizHawk ist gestartet und der Live-Sync ist verbunden. Dein Team erscheint automatisch.</p>
          <p className="text-slate-500 text-xs mt-3">Seed: <span className="font-mono text-slate-300">{seed}</span></p>
        </div>
      ) : (
        <>
          <div className="mt-7 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-5">
            <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Profil</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-black text-lg">{active!.name}</span>
              {active!.edition && <span className="text-[11px] font-bold text-slate-300 bg-white/5 border border-[#2e2e42] rounded-full px-2 py-0.5">{active!.edition}</span>}
              {active!.players.map((p, i) => <span key={i} className="text-[11px] font-bold text-slate-400">{p}{i < active!.players.length - 1 ? ' ·' : ''}</span>)}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-5">
            <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">Preset (Regeln)</label>
            <select value={presetId} onChange={(e) => setPresetId(e.target.value)} disabled={busy}
              className="w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3.5 py-2.5 text-sm text-white">
              {presets.length === 0 && <option value="">Kein Preset verfügbar</option>}
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}{p.builtin ? '' : ' (eigenes)'}</option>)}
            </select>
            <p className="text-slate-500 text-[11px] mt-2">Bestimmt die Randomizer-Regeln. Eigene Presets erstellst du über „Profile → Preset bearbeiten".</p>
          </div>

          <div className="mt-4 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-5">
            <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">Seed</label>
            <div className="flex items-center gap-2">
              <input type="number" value={seed} disabled={busy} onChange={(e) => setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="flex-1 rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3.5 py-2.5 text-sm text-white font-mono" />
              <button onClick={() => setSeed(Math.floor(Math.random() * 1_000_000_000))} disabled={busy} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs text-slate-200 border border-[#3a3a4e] hover:bg-white/5 disabled:opacity-40">
                <Dices className="w-4 h-4" /> Würfeln
              </button>
            </div>
            <p className="text-slate-500 text-[11px] mt-2">Gleicher Seed + gleiches Preset = gleiches Spiel. (Für Mitspieler später teilbar.)</p>
          </div>

          <button onClick={start} disabled={busy} className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-white disabled:opacity-60" style={{ background: '#CC0000' }}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {step === 'randomizing' ? 'Randomisiere … (kann ~1 Min dauern)'
              : step === 'launching' ? 'BizHawk wird gestartet …'
              : step === 'waiting' ? 'Warte auf Live-Sync …'
              : 'SoulLink erstellen & starten'}
          </button>

          {busy && (
            <div className="mt-4 space-y-1.5">
              <StepLine done={step !== 'randomizing'} active={step === 'randomizing'} label="ROM randomisieren" />
              <StepLine done={step === 'waiting'} active={step === 'launching'} label="BizHawk starten" />
              <StepLine done={false} active={step === 'waiting'} label="Live-Sync verbinden" />
            </div>
          )}
          {err && <p className="mt-4 text-red-300 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {err}</p>}
        </>
      )}
    </div>
  )
}

function StepLine({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {done ? <Check className="w-4 h-4 text-green-400" /> : active ? <Loader2 className="w-4 h-4 animate-spin text-pk-red" /> : <span className="w-4 h-4 rounded-full border border-[#3a3a4e]" />}
      <span className={done ? 'text-green-300' : active ? 'text-white font-bold' : 'text-slate-500'}>{label}</span>
    </div>
  )
}
