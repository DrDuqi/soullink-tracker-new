import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Gamepad2, Cpu, Dices, Check, Loader2, ChevronRight, FolderOpen, Sparkles } from 'lucide-react'
import { useProfiles } from '../../hooks/useProfiles'
import { useCompanion } from '../../hooks/useCompanion'
import { getPlatform } from '../../platform'
import { EDITION_OPTIONS, editionLabel, editionRomExts, editionPlatformLabel, resolveEdition, type EditionKey } from '../../lib/edition'
import { companionConfig, saveCompanionConfig } from '../../lib/companion'
import type { RomInfo } from '../../lib/companion'
import type { Preset } from '../../lib/presets'

// "Mein Setup" — ONE setup, no per-partner profiles. The player sets their original
// ROM, emulator and default rules ONCE here; everything else (seed, randomized ROM,
// savegame, run folder, launch) is automatic for every SoulLink afterwards. Under the
// hood this is a single auto-created profile; the word "Profil" never appears.
export default function MeinSetupPage() {
  const navigate = useNavigate()
  const platform = getPlatform()
  const companion = useCompanion(true)
  const { profiles, active, available, loading, create, update } = useProfiles()
  const [params] = useSearchParams()
  const [presets, setPresets] = useState<Preset[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [romInfo, setRomInfo] = useState<RomInfo | null>(null)

  // Edition is the central choice — each edition has its OWN profile (ROM/emulator/rules),
  // so a GBA edition never inherits a DS ROM or a DS hint. NewRunPage links here with
  // ?edition=… so "einrichten" lands on the right edition.
  const [editionKey, setEditionKey] = useState<EditionKey>(() => resolveEdition(params.get('edition')) || resolveEdition(active?.edition) || EDITION_OPTIONS[0].key)
  const ed = profiles.find((p) => resolveEdition(p.edition) === editionKey) ?? null
  const creating = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (available && !loading && !ed && !creating.current.has(editionKey)) {
      creating.current.add(editionKey)
      create({ name: `Setup ${editionLabel(editionKey)}`, players: [], edition: editionKey })
    }
  }, [available, loading, ed, editionKey, create])
  useEffect(() => { setRomInfo(null) }, [editionKey])
  // Strictly edition-bound presets (resolveEdition normalises 'platinum'↔'Platin').
  useEffect(() => { setPresets([]); platform.listPresets().then((all) => setPresets((all ?? []).filter((p) => resolveEdition(p.edition) === editionKey))) }, [platform, editionKey])
  // Remember the last edition so "Neuer SoulLink" opens with it (never jumps to Platin).
  useEffect(() => { try { localStorage.setItem('soullink:lastEdition', editionKey) } catch { /* ignore */ } }, [editionKey])

  // BizHawk is a GLOBAL component (installed once for ALL editions) — stored in the
  // companion config, never per-edition. Detected installs count too, so we never
  // re-ask when it's already there.
  const [globalBiz, setGlobalBiz] = useState<string | null>(null)
  const reloadBiz = async () => { const c = await companionConfig(); setGlobalBiz(c?.config.bizhawk || c?.detected.bizhawk || null) }
  useEffect(() => { reloadBiz() }, [])

  async function pickRom() {
    if (!ed) return
    setBusy('rom'); setRomInfo(null)
    const r = await platform.pickFile('rom')
    if (r.path) {
      const info = await platform.validateRom(r.path, { exts: editionRomExts(editionKey), editionLabel: editionLabel(editionKey), platformLabel: editionPlatformLabel(editionKey) })
      setRomInfo(info)
      if (info?.valid) await update(ed.id, { paths: { originalRom: r.path }, edition: editionKey })
    }
    setBusy(null)
  }
  async function pickBiz() {
    setBusy('biz'); const r = await platform.pickFile('biz')
    if (r.path) { await saveCompanionConfig({ bizhawk: r.path }); await reloadBiz() }   // global, not per-edition
    setBusy(null)
  }
  async function setRules(presetId: string) { if (ed) await update(ed.id, { presetId }) }

  // Auto-install BizHawk (download + extract into the managed folder) so the player
  // never picks an emulator by hand. Poll the progress for a bar.
  const [bizInstall, setBizInstall] = useState<{ state: string; percent: number; error: string | null } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])
  async function autoInstallBiz() {
    setBizInstall({ state: 'downloading', percent: 0, error: null })
    await platform.installBizhawk()
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const st = await platform.bizhawkStatus()
      if (!st) return
      setBizInstall({ state: st.state, percent: st.percent, error: st.error })
      if (st.state === 'done' && st.exe) {
        if (pollRef.current) clearInterval(pollRef.current)
        await reloadBiz()   // server already saved config.bizhawk (global); just refresh
        setBizInstall(null)
      } else if (st.state === 'error') {
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }, 1000)
  }

  if (!available) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-10">
        <h1 className="text-white font-black text-3xl tracking-tight">Mein Setup</h1>
        <div className="mt-7 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-6 text-center">
          <p className="text-white font-black">Der Companion läuft noch nicht</p>
          <p className="text-slate-400 text-sm mt-1">Starte den SoulLink Companion, dann kannst du dein Setup einrichten.</p>
        </div>
      </div>
    )
  }

  const rom = ed?.paths.originalRom
  const biz = globalBiz   // GLOBAL emulator — same for every edition
  const presetId = ed?.presetId || presets.find((p) => p.builtin)?.id || ''
  const fname = (p?: string | null): string | null => (p ? (p.split(/[\\/]/).pop() ?? null) : null)

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <h1 className="text-white font-black text-3xl tracking-tight">Mein Setup</h1>
      <p className="text-slate-400 mt-1.5">Der Emulator ist global (einmal für alles). ROM &amp; Regeln verwaltest du pro Edition.</p>

      {/* GLOBAL — Companion/Emulator/Java/FVX/Update existieren genau EINMAL */}
      <div className="mt-7 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-4">
        <div className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Global · einmal für alle Editionen</div>
        <Row icon={Cpu} title="Emulator (BizHawk)" done={!!biz} value={fname(biz)}
          desc="Wird genau EINMAL eingerichtet und gilt für jede Edition (GBA &amp; DS). Java &amp; Randomizer richtet SoulLink automatisch ein."
          busy={busy === 'biz'} action={biz ? 'Ändern' : 'Selbst wählen'} onClick={pickBiz} icon2={FolderOpen}
          extra={
            bizInstall ? (
              bizInstall.state === 'error' ? (
                <div className="text-[11px]">
                  <span className="text-amber-400">Einrichtung fehlgeschlagen: {bizInstall.error}</span>
                  <button onClick={autoInstallBiz} className="ml-2 font-bold text-pk-red hover:underline">Erneut versuchen</button>
                </div>
              ) : (
                <div className="w-full">
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> {bizInstall.state === 'extracting' ? 'Entpacken…' : 'BizHawk wird geladen…'}</span>
                    <span className="text-slate-500">{bizInstall.percent}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#2a2a35] overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${bizInstall.percent}%`, background: '#CC0000' }} /></div>
                </div>
              )
            ) : biz ? (
              <span className="text-[11px] text-green-400 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Emulator vorhanden — gilt für alle Editionen.</span>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={autoInstallBiz} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white" style={{ background: '#CC0000' }}><Sparkles className="w-3.5 h-3.5" /> Automatisch einrichten</button>
                <span className="text-[11px] text-slate-500">lädt BizHawk ~65 MB · empfohlen</span>
              </div>
            )
          } />
      </div>

      {/* Edition — bestimmt ROM-Typ, Validierung und Presets */}
      <div className="mt-4 rounded-2xl border border-pk-red/30 bg-[#16161f] p-4">
        <label className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">Edition</label>
        <select value={editionKey} onChange={(e) => setEditionKey(e.target.value as EditionKey)}
          className="w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3 py-2.5 text-sm text-white">
          {EDITION_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <p className="text-slate-500 text-[11px] mt-2">Benötigt eine <b className="text-slate-300">{editionRomExts(editionKey).join('/')}</b>-ROM ({editionPlatformLabel(editionKey)}). Jede Edition speichert ihre ROM/Regeln unabhängig.</p>
      </div>

      <div className="mt-3 space-y-3">
        {/* Original-ROM (pro Edition) */}
        <Row icon={Gamepad2} title="Original-ROM" done={!!rom}
          value={fname(rom)} hint={romInfo?.message} hintOk={romInfo?.valid}
          desc={`Deine originale ${editionLabel(editionKey)}-ROM (${editionRomExts(editionKey).join('/')}). Die randomisierten ROMs erzeugt SoulLink selbst.`}
          busy={busy === 'rom'} action={rom ? 'Ändern' : 'Auswählen'} onClick={pickRom} icon2={FolderOpen} />

        {/* Standard-Spielregeln */}
        <div className="rounded-2xl border border-[#2e2e42] bg-[#16161f] p-4">
          <div className="flex items-start gap-3">
            <Dices className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="text-white font-black">Standard-Spielregeln</span>{presetId && <Check className="w-4 h-4 text-green-400" />}</div>
              <p className="text-slate-400 text-sm mt-0.5">Welche Regeln neue SoulLinks standardmäßig nutzen.</p>
              <div className="flex items-center gap-2 mt-2.5">
                <select value={presetId} onChange={(e) => setRules(e.target.value)} className="flex-1 rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3 py-2 text-sm text-white">
                  {presets.length === 0 && <option value="">Keine Regeln</option>}
                  {presets.map((p) => <option key={p.id} value={p.id}>{p.name}{p.builtin ? '' : ' (eigene)'}</option>)}
                </select>
                <button onClick={() => navigate('/presets')} className="text-xs font-bold text-slate-300 hover:text-white border border-[#3a3a4e] rounded-lg px-3 py-2 hover:bg-white/5 inline-flex items-center gap-1.5">Regeln verwalten <ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {rom && biz && (
        <button onClick={() => navigate(`/new?edition=${encodeURIComponent(editionKey)}`)} className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-white" style={{ background: '#CC0000' }}>
          Fertig — {editionLabel(editionKey)} starten <ChevronRight className="w-5 h-5" />
        </button>
      )}
      {companion.usesCompanion && <div className="mt-4 text-center text-slate-600 text-[11px]">Java &amp; Randomizer richtet SoulLink automatisch ein.</div>}
    </div>
  )
}

function Row({ icon: Icon, title, desc, value, done, hint, hintOk, busy, action, onClick, icon2: Icon2, extra }: {
  icon: typeof Gamepad2; title: string; desc: string; value: string | null; done: boolean
  hint?: string; hintOk?: boolean; busy: boolean; action: string; onClick: () => void; icon2: typeof FolderOpen; extra?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#2e2e42] bg-[#16161f] p-4">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="text-white font-black">{title}</span>{done && <Check className="w-4 h-4 text-green-400" />}</div>
          <p className="text-slate-400 text-sm mt-0.5">{desc}</p>
          {value && <p className="text-slate-300 text-xs mt-1.5 truncate">{value}</p>}
          {hint && <p className={`text-[11px] mt-1 ${hintOk ? 'text-green-400' : 'text-amber-400'}`}>{hint}</p>}
          {extra && <div className="mt-2">{extra}</div>}
        </div>
        <button onClick={onClick} disabled={busy} className="shrink-0 text-xs font-bold text-slate-200 border border-[#3a3a4e] rounded-lg px-3 py-2 hover:bg-white/5 disabled:opacity-40 inline-flex items-center gap-1.5">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon2 className="w-4 h-4" />} {action}
        </button>
      </div>
    </div>
  )
}
