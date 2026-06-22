import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Download, Gamepad2, FolderOpen, Check, Loader2,
  Zap, PartyPopper, Shuffle, Play, RefreshCw, Cpu, FileWarning,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCompanion } from '../hooks/useCompanion'
import { useEmulatorSync } from '../hooks/useEmulatorSync'
import { companionConfig, saveCompanionConfig, USES_COMPANION } from '../lib/companion'
import { useEmulatorSettings, useEmulatorSettingsStore, findFile, launchEmulator } from '../lib/emulatorSettings'
import { DOWNLOADS } from '../lib/downloads'
import AtmosphereBackground from '../components/AtmosphereBackground'

// One guided step. Green when done, otherwise shows its action(s) + a support hint.
function StepCard({ n, title, desc, done, optional, children }: {
  n: number; title: string; desc: string; done: boolean; optional?: boolean; children?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border p-5 transition-colors" style={{ background: '#16161f', borderColor: done ? 'rgba(74,222,128,0.4)' : '#2e2e42' }}>
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-sm"
          style={done ? { background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.4)' }
                      : { background: 'rgba(204,0,0,0.12)', color: '#ff6b6b', border: '1px solid rgba(204,0,0,0.3)' }}>
          {done ? <Check className="w-5 h-5" /> : n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-black text-lg">{title}</h3>
            {optional && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-400 border border-[#2e2e42]">optional</span>}
            {done && <span className="text-[11px] font-bold text-green-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Erledigt</span>}
          </div>
          <p className="text-slate-400 text-sm mt-1 leading-relaxed">{desc}</p>
          {!done && <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center gap-2.5">{children}</div>}
        </div>
      </div>
    </div>
  )
}

const btnRed = 'flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-transform active:scale-[0.98]'
const btnGhost = 'flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5 transition-colors'

export default function SetupPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const settings = useEmulatorSettings()
  const updateSettings = useEmulatorSettingsStore((s) => s.update)

  // ── live detection ─────────────────────────────────────────────────────────
  const companion = useCompanion(true)
  const running = companion.status === 'connected'
  const [cfg, setCfg] = useState<{ bizhawk: string | null; rom: string | null; lua: string | null } | null>(null)
  const sync = useEmulatorSync(running)
  const liveSync = sync.phase === 'connected'

  const refetchCfg = async () => { const c = await companionConfig(); if (c) setCfg(c.config) }
  useEffect(() => {
    if (!running) { setCfg(null); return }
    let cancel = false
    const tick = () => { companionConfig().then((c) => { if (!cancel && c) setCfg(c.config) }) }
    tick(); const id = setInterval(tick, 2500)
    return () => { cancel = true; clearInterval(id) }
  }, [running])

  // In dev there is no Companion config endpoint → fall back to local settings so
  // the page is still testable. In prod the Companion config is authoritative.
  const bizhawkFound = !!(cfg?.bizhawk || (!USES_COMPANION && settings.bizhawkPath))
  const romFound = !!(cfg?.rom || (!USES_COMPANION && settings.romPath))
  const luaFound = !!(cfg?.lua || (!USES_COMPANION && settings.luaPath)) || running

  // Sticky "installed" (running implies installed; survives the Companion closing).
  const [installed, setInstalled] = useState(() => { try { return localStorage.getItem('onboard-companion-seen') === '1' } catch { return false } })
  useEffect(() => { if (running && !installed) { setInstalled(true); try { localStorage.setItem('onboard-companion-seen', '1') } catch { /* ignore */ } } }, [running, installed])

  const [randomizer, setRandomizer] = useState(() => { try { return localStorage.getItem('onboard-randomizer') === '1' } catch { return false } })
  const toggleRandomizer = () => setRandomizer((v) => { const n = !v; try { localStorage.setItem('onboard-randomizer', n ? '1' : '0') } catch { /* ignore */ } return n })

  // ── file pickers (resolve filename → absolute path via the Companion) ───────
  const romInput = useRef<HTMLInputElement>(null)
  const bizInput = useRef<HTMLInputElement>(null)
  const [resolving, setResolving] = useState<'rom' | 'biz' | null>(null)
  const [pickErr, setPickErr] = useState<{ k: 'rom' | 'biz'; msg: string } | null>(null)
  async function resolvePicked(file: File | undefined, kind: 'rom' | 'biz') {
    if (!file) return
    setResolving(kind); setPickErr(null)
    const path = await findFile(file.name)
    setResolving(null)
    if (path) {
      updateSettings(kind === 'rom' ? { romPath: path } : { bizhawkPath: path })
      await saveCompanionConfig(kind === 'rom' ? { rom: path } : { bizhawk: path })
      refetchCfg()
    } else {
      setPickErr({ k: kind, msg: `„${file.name}" wurde nicht gefunden. Lege die Datei in deinen Downloads- oder Projektordner und versuche es erneut.` })
    }
  }

  // ── connect live-sync (launch BizHawk + Lua via the Companion) ──────────────
  const [connecting, setConnecting] = useState(false)
  const [connectErr, setConnectErr] = useState<string | null>(null)
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { if (liveSync) { setConnecting(false); setConnectErr(null); if (connectTimer.current) clearTimeout(connectTimer.current) } }, [liveSync])
  useEffect(() => () => { if (connectTimer.current) clearTimeout(connectTimer.current) }, [])
  async function connect(restart = false) {
    setConnectErr(null); setConnecting(true)
    const res = await launchEmulator(settings, restart)
    if (!res.ok) {
      setConnecting(false)
      setConnectErr(
        res.error === 'rom_not_found' ? 'ROM nicht gefunden – bitte oben neu auswählen.'
        : res.error === 'bizhawk_not_found' ? 'BizHawk nicht gefunden – bitte oben neu auswählen.'
        : res.error === 'lua_not_found' ? 'Sync-Script nicht gefunden – Companion neu starten.'
        : 'Start fehlgeschlagen. Läuft BizHawk schon?' + (res.detail ? ` (${res.detail})` : ''),
      )
      return
    }
    if (res.already) { setConnecting(false); setConnectErr('BizHawk läuft bereits ohne Sync-Script. Bitte BizHawk schließen und erneut verbinden.'); return }
    if (connectTimer.current) clearTimeout(connectTimer.current)
    connectTimer.current = setTimeout(() => { setConnecting(false); setConnectErr('Keine Verbindung. Läuft BizHawk mit dem Sync-Script?') }, 45000)
  }

  // ── auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => { if (!authLoading && !user) navigate('/') }, [authLoading, user, navigate])
  if (authLoading || !user) return null

  const required = [installed, bizhawkFound, romFound, running, liveSync]
  const doneCount = required.filter(Boolean).length
  const allDone = required.every(Boolean)

  return (
    <>
      <AtmosphereBackground />
      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 border-b border-white/5 backdrop-blur-2xl" style={{ background: 'rgba(17,17,22,0.92)' }}>
          <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-slate-500 hover:text-white p-1.5 hover:bg-white/5 rounded-xl transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            <Cpu className="w-5 h-5 text-pk-red hidden sm:block" />
            <div>
              <h1 className="text-white font-black text-base leading-tight">Erste Einrichtung</h1>
              <p className="text-slate-500 text-xs">In ~5 Minuten spielbereit</p>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto w-full px-4 py-8">
          {/* hidden, robust file inputs */}
          <input ref={romInput} type="file" accept=".nds,.gba,.gbc,.gb" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => resolvePicked(e.target.files?.[0], 'rom')} />
          <input ref={bizInput} type="file" accept=".exe" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => resolvePicked(e.target.files?.[0], 'biz')} />

          {allDone ? (
            <div className="rounded-3xl border border-green-700/40 bg-green-950/20 p-8 text-center mb-8">
              <PartyPopper className="w-14 h-14 text-pk-yellow mx-auto mb-4" />
              <h2 className="text-white font-black text-3xl mb-2">Einrichtung abgeschlossen!</h2>
              <p className="text-slate-300 mb-6">Viel Spaß bei deinem SoulLink! Dein Live-Sync läuft.</p>
              <button onClick={() => navigate('/')} className={btnRed + ' mx-auto'} style={{ background: '#CC0000' }}>
                Zu meinen Runs <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-white font-black text-2xl">Lass uns starten</h2>
                <span className="text-slate-400 text-sm font-bold tabular-nums">{doneCount}/5 Schritten</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(doneCount / 5) * 100}%`, background: 'linear-gradient(90deg,#CC0000,#ff5b5b)' }} />
              </div>
              <p className="text-slate-500 text-sm mt-2">Folge den Schritten von oben nach unten – jeder Punkt wird automatisch grün, sobald er erledigt ist.</p>
            </div>
          )}

          <div className="space-y-4">
            {/* 1 · Companion */}
            <StepCard n={1} done={installed && running} title="SoulLink Companion installieren & starten"
              desc="Eine kleine App auf deinem PC, die BizHawk für dich startet. Sie läuft unsichtbar im Hintergrund (Symbol unten rechts im System-Tray).">
              <a href={DOWNLOADS.companion} download className={btnRed} style={{ background: '#CC0000' }}>
                <Download className="w-4 h-4" /> Companion herunterladen
              </a>
              <p className="text-slate-500 text-xs sm:ml-1">
                {running ? '' : installed ? 'Schon installiert? Starte ihn über das Startmenü.' : 'Installieren → startet automatisch. Dann wird dieser Punkt grün.'}
              </p>
            </StepCard>

            {/* 2 · BizHawk */}
            <StepCard n={2} done={bizhawkFound} title="BizHawk herunterladen"
              desc="Der Emulator, in dem deine ROM läuft. Lade ihn herunter, entpacke ihn – danach wählst du ihn einmal aus.">
              <a href={DOWNLOADS.bizhawk} target="_blank" rel="noreferrer" className={btnRed} style={{ background: '#CC0000' }}>
                <Download className="w-4 h-4" /> BizHawk herunterladen
              </a>
              <button onClick={() => bizInput.current?.click()} disabled={!running || resolving === 'biz'} className={btnGhost + ' disabled:opacity-40'}>
                {resolving === 'biz' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gamepad2 className="w-4 h-4" />} EmuHawk.exe auswählen
              </button>
              {!running && <p className="text-slate-500 text-xs sm:ml-1">Starte zuerst den Companion (Schritt 1).</p>}
              {pickErr?.k === 'biz' && <p className="text-yellow-400/90 text-xs basis-full">{pickErr.msg}</p>}
            </StepCard>

            {/* 3 · Randomizer (optional) */}
            <StepCard n={3} done={randomizer} optional title="Universal Pokémon Randomizer ZX (optional)"
              desc="Nur falls du eine randomisierte SoulLink-ROM spielen möchtest. Damit erzeugst du deine eigene Randomizer-ROM.">
              <a href={DOWNLOADS.randomizer} target="_blank" rel="noreferrer" className={btnRed} style={{ background: '#CC0000' }}>
                <Download className="w-4 h-4" /> Randomizer herunterladen
              </a>
              <button onClick={toggleRandomizer} className={btnGhost}>
                <Shuffle className="w-4 h-4" /> Habe ich erledigt / überspringen
              </button>
            </StepCard>

            {/* 4 · ROM */}
            <StepCard n={4} done={romFound} title="Eigene Pokémon-ROM auswählen"
              desc="Wähle die ROM, die du tatsächlich spielst (z. B. deine Randomizer-Version).">
              <div className="basis-full rounded-xl border border-amber-700/40 bg-amber-950/15 p-3 flex items-start gap-2 mb-1">
                <FileWarning className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-amber-200/90 text-xs leading-relaxed">
                  Aus rechtlichen Gründen können wir keine Pokémon-ROMs bereitstellen. Bitte verwende ausschließlich deine eigene ROM.
                </p>
              </div>
              <button onClick={() => romInput.current?.click()} disabled={!running || resolving === 'rom'} className={btnRed + ' disabled:opacity-40'} style={{ background: '#CC0000' }}>
                {resolving === 'rom' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />} Eigene ROM auswählen
              </button>
              {!running && <p className="text-slate-500 text-xs sm:ml-1">Starte zuerst den Companion (Schritt 1).</p>}
              {pickErr?.k === 'rom' && <p className="text-yellow-400/90 text-xs basis-full">{pickErr.msg}</p>}
            </StepCard>

            {/* 5 · Connect */}
            <StepCard n={5} done={liveSync} title="Live-Sync verbinden"
              desc="Ein Klick startet BizHawk mit deiner ROM und dem Sync-Script. Sobald dein Team im Spiel ist, erscheint es automatisch auf der Website.">
              <button onClick={() => connect(false)} disabled={!running || !bizhawkFound || !romFound || connecting} className={btnRed + ' disabled:opacity-40'} style={{ background: '#CC0000' }}>
                {connecting ? <><Loader2 className="w-4 h-4 animate-spin" /> Verbinde …</> : <><Play className="w-4 h-4" /> Lua-Sync verbinden</>}
              </button>
              {connectErr && (
                <div className="basis-full">
                  <p className="text-red-300 text-xs mb-1.5">{connectErr}</p>
                  <button onClick={() => connect(true)} className="text-[11px] font-bold text-slate-300 hover:text-white underline underline-offset-2 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> BizHawk mit Sync-Script neu starten
                  </button>
                </div>
              )}
              {(!bizhawkFound || !romFound) && !connectErr && <p className="text-slate-500 text-xs sm:ml-1">Erst BizHawk + ROM oben einrichten.</p>}
              <p className="basis-full text-slate-500 text-xs mt-1">
                💡 Ruckelt BizHawk im Sekundentakt? Füge den Ordner
                <code className="mx-1 px-1 py-0.5 rounded bg-[#16161f] border border-[#2e2e42] text-slate-300">%LOCALAPPDATA%\SoulLink Companion</code>
                als Ausnahme in Windows Defender (bzw. deinem Antivirus) hinzu.
              </p>
            </StepCard>
          </div>

          {/* Live system status — what the website currently detects */}
          <div className="rounded-2xl border border-[#2e2e42] bg-[#1c1c26] p-5 mt-6">
            <div className="flex items-center gap-2 mb-3.5">
              <Zap className="w-4 h-4 text-pk-yellow" />
              <h3 className="text-slate-200 text-xs font-black uppercase tracking-widest">Live-Status</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <StatusRow ok={running} label="Companion läuft" hint="Companion über das Startmenü starten" />
              <StatusRow ok={bizhawkFound} label="BizHawk gefunden" hint="BizHawk herunterladen & auswählen" />
              <StatusRow ok={romFound} label="ROM gefunden" hint="Eigene ROM auswählen" />
              <StatusRow ok={luaFound} label="Sync-Script (Lua) gefunden" hint="Companion neu starten" />
              <StatusRow ok={liveSync} label="Live-Sync aktiv" hint="Lua-Sync verbinden klicken" />
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

function StatusRow({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: ok ? 'rgba(74,222,128,0.3)' : '#2e2e42', background: ok ? 'rgba(74,222,128,0.06)' : 'transparent' }}>
      <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={ok ? { background: 'rgba(74,222,128,0.18)', color: '#4ade80' } : { background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
        {ok ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-black">✕</span>}
      </span>
      <div className="min-w-0">
        <div className={`text-sm font-bold ${ok ? 'text-green-300' : 'text-slate-300'}`}>{label}</div>
        {!ok && <div className="text-[11px] text-slate-500">➡ {hint}</div>}
      </div>
    </div>
  )
}
