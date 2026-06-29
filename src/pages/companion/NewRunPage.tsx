import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dices, Play, Loader2, Check, AlertTriangle, Settings } from 'lucide-react'
import { useProfiles } from '../../hooks/useProfiles'
import { getPlatform } from '../../platform'
import { useAuth } from '../../contexts/AuthContext'
import { createRun } from '../../lib/createRun'
import { saveRunRecipe } from '../../lib/runRecipe'
import { derivePlayerSeed } from '../../lib/randomizerSync'
import { EDITION_OPTIONS, editionLabel, resolveEdition, type EditionKey } from '../../lib/edition'
import { useRunStore } from '../../store/runStore'
import { useMyRuns } from '../../hooks/useMyRuns'
import type { Preset } from '../../lib/presets'

// The end-to-end flow that closes the loop: pick the EDITION (the central choice) →
// resolve its profile/ROM → choose preset → randomize into a per-run file → launch
// BizHawk → open the RunPage. The edition drives presets, ROM, run game and everything
// downstream (routes/checklist/dex via resolveEdition).
type Step = 'idle' | 'creating' | 'randomizing' | 'launching' | 'error'

const ERR: Record<string, string> = {
  profile_not_found: 'Einrichtung nicht gefunden.',
  original_rom_missing: 'Deine Original-ROM fehlt oder wurde verschoben — in den Einstellungen erneut auswählen.',
  bizhawk_missing: 'Der Emulator (BizHawk) ist noch nicht eingerichtet — in den Einstellungen festlegen.',
  preset_missing: 'Es sind noch keine Spielregeln gesetzt.',
  randomize_failed: 'Die Randomisierung ist fehlgeschlagen (FVX-Ausgabe). Prüfe ROM & Preset.',
  fvx_not_found: 'Der Randomizer (FVX) ist noch nicht eingerichtet — in „Mein Setup" automatisch einrichten.',
  fvx_url_unconfigured: 'Automatische FVX-Installation ist nicht konfiguriert — FVX-Ordner in „Mein Setup" auswählen.',
  rom_not_found: 'Die ausgewählte Original-ROM wurde nicht gefunden.',
  settings_missing: 'Das gewählte Preset/Regelwerk fehlt.',
  no_output_path: 'Kein Ziel für die randomisierte ROM — interner Fehler.',
  output_missing: 'Die randomisierte ROM wurde nicht erzeugt.',
  spawn_failed: 'FVX/Java konnte nicht gestartet werden — Java-Laufzeit prüfen.',
  unreachable: 'Companion nicht erreichbar.',
}

export default function NewRunPage() {
  const navigate = useNavigate()
  const platform = getPlatform()
  const { user, profile } = useAuth()
  const { profiles, active, loading } = useProfiles()
  const { data: myRuns = [] } = useMyRuns()
  const setCurrentRun = useRunStore((s) => s.setCurrentRun)
  // Recent partners (derived from past runs) → 1-click "Mit wem?", newest first.
  const recentPartners = (() => {
    const seen = new Set<string>(); const out: string[] = []
    for (const vm of myRuns) {
      const n = (vm.partnerName || '').trim()
      if (!n || n === '—' || seen.has(n.toLowerCase())) continue
      seen.add(n.toLowerCase()); out.push(n)
      if (out.length >= 5) break
    }
    return out
  })()
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000_000))
  const [presets, setPresets] = useState<Preset[]>([])
  const [presetId, setPresetId] = useState<string>('')
  const [sameWorld, setSameWorld] = useState(false)   // off = own world per player (linked by route)
  const [partnerName, setPartnerName] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [err, setErr] = useState<string | null>(null)

  // ① Edition is the central choice. Default to the active profile's edition.
  const [editionKey, setEditionKey] = useState<EditionKey>(() => resolveEdition(active?.edition) || EDITION_OPTIONS[0].key)
  useEffect(() => { const k = resolveEdition(active?.edition); if (k) setEditionKey(k) }, [active?.edition])
  // The profile that holds the ROM/emulator for the chosen edition (one per edition).
  const editionProfile = profiles.find((p) => resolveEdition(p.edition) === editionKey) ?? null

  // Presets are edition-bound: load for the chosen edition, reset selection on change.
  useEffect(() => {
    let cancel = false
    platform.listPresets(editionProfile?.edition || editionKey).then((list) => {
      if (cancel) return
      setPresets(list ?? [])
      setPresetId(editionProfile?.presetId && (list ?? []).some((p) => p.id === editionProfile.presetId) ? editionProfile.presetId : (list?.[0]?.id || ''))
    })
    return () => { cancel = true }
  }, [platform, editionKey, editionProfile?.edition, editionProfile?.presetId])

  const romReady = !!(editionProfile && editionProfile.paths.originalRom && editionProfile.paths.bizhawk)
  const ready = !!(romReady && presetId)
  const busy = step === 'creating' || step === 'randomizing' || step === 'launching'

  async function start() {
    if (!editionProfile || !user) return
    setErr(null)
    // 1) Create the real Supabase run (so it persists + appears in the dashboard).
    setStep('creating')
    let run, player
    const myName = profile?.username || profile?.display_name || 'Ich'
    const runName = partnerName.trim() ? `${myName} & ${partnerName.trim()}` : `${myName}s SoulLink`
    try {
      const created = await createRun({
        name: runName,
        game: editionProfile.edition || editionKey,
        ownerUserId: user.id,
        username: profile?.username || profile?.display_name || 'Spieler',
      })
      run = created.run; player = created.player
    } catch (e) { setErr(e instanceof Error ? e.message : 'Run konnte nicht erstellt werden.'); setStep('error'); return }

    // 2) Randomize this run's ROM with THIS player's seed. `seed` is the run master
    //    seed; the host is slot 0 → derives its own seed (unless "Gleiche Welt").
    setStep('randomizing')
    const hostSeed = sameWorld ? seed : derivePlayerSeed(seed, 0)
    const fvxVersion = (await platform.randomizerStatus())?.version ?? null
    const r = await platform.prepareRun({ runId: run.id, profileId: editionProfile.id, presetId, seed: hostSeed })
    if (!r.ok) { setErr(ERR[r.error || ''] || r.error || 'Fehler'); setStep('error'); return }

    // Store the shared recipe so partners reproduce the SAME rules/edition/FVX version
    // but derive their OWN per-slot seed from the run master seed. Non-fatal if it fails.
    try { await saveRunRecipe(run.id, { presetData: r.presetData, edition: r.edition, baseRom: r.baseRom, masterSeed: seed, sameWorld, fvxVersion }) } catch { /* ignore */ }

    // 3) Launch BizHawk with the randomized ROM + live-sync.
    setStep('launching')
    const lr = await platform.launch({ bizhawkPath: r.bizhawk || '', romPath: r.outputRom || '', luaPath: '', syncFolder: '' }, false, run.id)
    if (!lr.ok) { setErr('BizHawk-Start fehlgeschlagen' + (lr.error ? ` (${lr.error})` : '')); setStep('error'); return }

    // 4) Open the existing RunPage; the live-sync feeds it in the background.
    setCurrentRun(run, [player], player.id)
    navigate(`/run/${run.id}`)
  }

  if (loading) return <div className="p-10 text-slate-500 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Wird geladen…</div>

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <h1 className="text-white font-black text-3xl tracking-tight">Neuer SoulLink</h1>
      <p className="text-slate-400 mt-1.5">Wähle zuerst deine Edition — alles Weitere passt sich automatisch an.</p>

      {/* ① Edition — die zentrale Auswahl des gesamten Setups */}
      <div className="mt-7 rounded-2xl border border-pk-red/30 bg-[#16161f] p-5">
        <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">① Edition</label>
        <select value={editionKey} disabled={busy} onChange={(e) => setEditionKey(e.target.value as EditionKey)}
          className="w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3.5 py-2.5 text-sm text-white">
          {EDITION_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <p className="text-slate-500 text-[11px] mt-2">Bestimmt Routen, Encounter-Checkliste, Presets, ROM-Validierung, Emulator & Randomizer — überall automatisch.</p>
      </div>

      {!romReady ? (
        <div className="mt-4 rounded-2xl border border-amber-700/40 bg-amber-950/15 p-6">
          <div className="flex items-center gap-2 text-amber-300 font-black"><AlertTriangle className="w-5 h-5" /> Für {editionLabel(editionKey)} noch nicht eingerichtet</div>
          <p className="text-slate-300 text-sm mt-2">Für diese Edition ist noch keine <b className="text-white">Original-ROM</b> bzw. kein Emulator hinterlegt. Einmal einrichten — danach läuft alles automatisch.</p>
          <button onClick={() => navigate(`/mysetup?edition=${encodeURIComponent(editionKey)}`)} className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: '#CC0000' }}>
            <Settings className="w-4 h-4" /> {editionLabel(editionKey)} einrichten
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-5">
            <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">② Mit wem spielst du?</label>
            <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Name deines Freundes (oder leer = allein)"
              className="w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3.5 py-2.5 text-sm text-white disabled:opacity-100" />
            {recentPartners.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-slate-500 text-[11px] font-bold">Zuletzt:</span>
                {recentPartners.map((n) => {
                  const sel = partnerName.trim().toLowerCase() === n.toLowerCase()
                  return (
                    <button key={n} type="button" disabled={busy} onClick={() => setPartnerName(sel ? '' : n)}
                      className={`text-[11px] font-bold rounded-full px-2.5 py-1 border transition-colors ${sel ? 'text-white border-pk-red/60 bg-pk-red/15' : 'text-slate-300 border-[#3a3a4e] hover:bg-white/5'}`}>
                      {n}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-slate-500 text-[11px] mt-2">Nach dem Start teilst du den Einladungs-Code — dein Freund tritt damit bei und randomisiert seine eigene ROM.</p>
          </div>

          <div className="mt-4 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-5">
            <div className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Edition</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-black text-lg">{active!.edition ? editionLabel(active!.edition) : 'Pokémon'}</span>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-slate-400 text-xs font-black uppercase tracking-widest">③ Regel-Preset</label>
              <button onClick={() => navigate('/presets')} className="text-[11px] font-bold text-slate-400 hover:text-white underline underline-offset-2">Regeln bearbeiten</button>
            </div>
            <select value={presetId} onChange={(e) => setPresetId(e.target.value)} disabled={busy || presets.length === 0}
              className="w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3.5 py-2.5 text-sm text-white disabled:opacity-60">
              {presets.length === 0 && <option value="">— keine —</option>}
              {presets.map((p) => <option key={p.id} value={p.id}>{p.name}{p.builtin ? '' : ' (eigene)'}</option>)}
            </select>
            {presets.length === 0
              ? <p className="text-amber-300/90 text-[11px] mt-2">Für {editionLabel(editionKey)} existieren noch keine Regel-Presets. <button onClick={() => navigate('/presets')} className="font-bold underline underline-offset-2">Eigene Regeln erstellen</button>.</p>
              : <p className="text-slate-500 text-[11px] mt-2">Nur Presets für {editionLabel(editionKey)} — bestimmt, wie randomisiert wird (Pokémon, Trainer, Items …).</p>}
          </div>

          <div className="mt-4 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-5">
            <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">④ Seed &amp; ⑤ Welt</label>
            <div className="flex items-center gap-2">
              <input type="number" value={seed} disabled={busy} onChange={(e) => setSeed(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="flex-1 rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3.5 py-2.5 text-sm text-white font-mono" />
              <button onClick={() => setSeed(Math.floor(Math.random() * 1_000_000_000))} disabled={busy} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs text-slate-200 border border-[#3a3a4e] hover:bg-white/5 disabled:opacity-40">
                <Dices className="w-4 h-4" /> Würfeln
              </button>
            </div>
            <p className="text-slate-500 text-[11px] mt-2">Gleiche Regeln + gleicher Seed = exakt gleiche Welt.</p>
            <label className="flex items-start gap-2.5 mt-3 cursor-pointer">
              <input type="checkbox" checked={sameWorld} disabled={busy} onChange={(e) => setSameWorld(e.target.checked)} className="mt-0.5 accent-pk-red" />
              <span className="text-xs text-slate-300">
                <b className="text-white">Gleiche Welt für beide Spieler</b> (gemeinsamer Seed)
                <span className="block text-slate-500 text-[11px]">Aus = jeder spielt seine eigene zufällige Welt, verbunden über die Routen (Standard-SoulLink). Setzt bei „Ein" voraus, dass beide dieselbe ROM-Version haben.</span>
              </span>
            </label>
          </div>

          <button onClick={start} disabled={busy || !ready} className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-white disabled:opacity-60" style={{ background: '#CC0000' }}>
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {step === 'creating' ? 'Run wird erstellt …'
              : step === 'randomizing' ? 'Randomisiere … (kann ~1 Min dauern)'
              : step === 'launching' ? 'BizHawk wird gestartet …'
              : '⑥ SoulLink erstellen & starten'}
          </button>

          {busy && (
            <div className="mt-4 space-y-1.5">
              <StepLine done={step === 'randomizing' || step === 'launching'} active={step === 'creating'} label="Run erstellen" />
              <StepLine done={step === 'launching'} active={step === 'randomizing'} label="ROM randomisieren" />
              <StepLine done={false} active={step === 'launching'} label="BizHawk starten & öffnen" />
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
