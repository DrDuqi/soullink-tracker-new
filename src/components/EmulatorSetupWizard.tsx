import { useEffect, useRef, useState } from 'react'
import { X, Check, ChevronRight, ChevronLeft, Gamepad2, Loader2, FolderSearch, PartyPopper } from 'lucide-react'
import {
  useEmulatorSettings, useEmulatorSettingsStore, detectEmulator, findFile, fileName,
  type DetectResult, type EmulatorSettings,
} from '../lib/emulatorSettings'

const TOTAL = 5

function Ok({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold text-sm"><Check className="w-4 h-4" /> {children}</span>
}
function Pending({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 text-slate-500 font-bold text-sm"><X className="w-4 h-4" /> {children}</span>
}

/** Friendly one-time emulator setup. Auto-detects everything it can (Lua + sync
 *  folder always, BizHawk + ROMs if near the project) so the user only picks what
 *  is missing. Never shows paths, Lua, sync folders, JSON or .bat to the user. */
export default function EmulatorSetupWizard({ onClose }: { onClose: () => void }) {
  const settings = useEmulatorSettings()
  const update = useEmulatorSettingsStore((s) => s.update)
  const [step, setStep] = useState(1)
  const [detect, setDetect] = useState<DetectResult | null>(null)
  const [detecting, setDetecting] = useState(true)
  const [bizAuto, setBizAuto] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [bizErr, setBizErr] = useState('')
  const [romErr, setRomErr] = useState('')
  const bizInput = useRef<HTMLInputElement>(null)
  const romInput = useRef<HTMLInputElement>(null)
  const applied = useRef(false)

  useEffect(() => {
    detectEmulator().then((d) => {
      setDetect(d)
      setDetecting(false)
      if (!d || applied.current) return
      applied.current = true
      const patch: Partial<EmulatorSettings> = {}
      if (d.lua) patch.luaPath = d.lua
      if (d.syncFolder) patch.syncFolder = d.syncFolder
      if (d.bizhawk && !settings.bizhawkPath.trim()) { patch.bizhawkPath = d.bizhawk; setBizAuto(true) }
      if (Object.keys(patch).length) update(patch)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function resolvePicked(file: File | undefined, kind: 'biz' | 'rom') {
    if (!file) return
    kind === 'biz' ? setBizErr('') : setRomErr('')
    setResolving(true)
    const path = await findFile(file.name)
    setResolving(false)
    if (path) {
      if (kind === 'biz') { update({ bizhawkPath: path }); setBizAuto(false) }
      else update({ romPath: path })
    } else {
      const msg = `„${file.name}" konnte nicht automatisch gefunden werden. Lege die Datei in den Projekt- oder roms-Ordner – oder trage den Pfad später unter „Erweiterte Optionen" ein.`
      kind === 'biz' ? setBizErr(msg) : setRomErr(msg)
    }
  }

  const bizOk = !!settings.bizhawkPath.trim()
  const romOk = !!settings.romPath.trim()
  const liveOk = !!settings.luaPath.trim()
  const canNext = step === 2 ? bizOk : step === 3 ? romOk : true

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade">
      <input ref={bizInput} type="file" accept=".exe" className="hidden" onChange={(e) => resolvePicked(e.target.files?.[0], 'biz')} />
      <input ref={romInput} type="file" accept=".nds,.gba,.gbc,.gb" className="hidden" onChange={(e) => resolvePicked(e.target.files?.[0], 'rom')} />

      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-lg border border-[#2e2e42] shadow-2xl anim-pop overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#2e2e42]">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-pk-red" />
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Emulator-Setup · Schritt {step}/{TOTAL}</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 px-7 pt-4">
          {Array.from({ length: TOTAL }, (_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i < step ? '#CC0000' : '#2e2e42' }} />
          ))}
        </div>

        <div className="px-7 py-6 min-h-[260px]">
          {step === 1 && (
            <div className="text-center py-6">
              <Gamepad2 className="w-12 h-12 text-pk-red mx-auto mb-4" />
              <h2 className="text-white font-black text-2xl mb-2">Willkommen beim Emulator-Setup</h2>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">Wir richten deinen Emulator einmalig ein. Das dauert weniger als eine Minute.</p>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-white font-black text-xl mb-1.5">BizHawk auswählen</h2>
              <p className="text-slate-400 text-sm mb-5">Bitte wähle deine EmuHawk.exe aus.</p>
              <div className="rounded-2xl border border-[#2e2e42] bg-[#16161f] p-4 flex items-center justify-between gap-3">
                {bizOk ? (bizAuto ? <Ok>BizHawk wurde automatisch gefunden</Ok> : <Ok>BizHawk eingerichtet</Ok>) : <Pending>Noch nicht ausgewählt</Pending>}
                <button onClick={() => bizInput.current?.click()} disabled={resolving}
                  className="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5 shrink-0">
                  {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderSearch className="w-3.5 h-3.5" />} EmuHawk.exe auswählen
                </button>
              </div>
              {bizErr && !bizOk && (
                <div className="mt-3">
                  <p className="text-yellow-400/90 text-xs mb-1.5">{bizErr}</p>
                  <input
                    value={settings.bizhawkPath}
                    onChange={(e) => update({ bizhawkPath: e.target.value })}
                    placeholder="C:\Tools\BizHawk\EmuHawk.exe"
                    spellCheck={false}
                    autoFocus
                    className="pk-input font-mono text-xs"
                  />
                  <p className="text-slate-600 text-[11px] mt-1">Tipp: im Explorer Shift+Rechtsklick auf EmuHawk.exe → „Als Pfad kopieren", dann hier einfügen.</p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-white font-black text-xl mb-1.5">ROM auswählen</h2>
              <p className="text-slate-400 text-sm mb-1">Wähle die ROM aus, die du tatsächlich spielst – nicht die Original-ROM, sondern z. B. deine Randomizer-/SoulLink-Version.</p>
              <p className="text-slate-600 text-xs mb-4 italic">z. B. Pokemon Platin SoulLink Randomizer.nds · Pokemon HG SoulLink.nds</p>

              {detect && detect.roms.length > 0 && (
                <div className="space-y-1.5 mb-3 max-h-44 overflow-y-auto">
                  {detect.roms.map((r) => {
                    const sel = settings.romPath === r.path
                    return (
                      <button key={r.path} onClick={() => { setRomErr(''); update({ romPath: r.path }) }}
                        className="w-full flex items-center gap-2 text-left rounded-xl border px-3 py-2 text-sm transition-colors"
                        style={sel
                          ? { borderColor: 'rgba(74,222,128,0.4)', background: 'rgba(74,222,128,0.08)', color: '#e2e8f0' }
                          : { borderColor: '#2e2e42', background: '#16161f', color: '#cbd5e1' }}>
                        {sel ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <span className="w-4 shrink-0" />}
                        <span className="truncate">{r.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              <button onClick={() => romInput.current?.click()} disabled={resolving} className="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5">
                {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderSearch className="w-3.5 h-3.5" />}
                {detect && detect.roms.length > 0 ? 'Andere ROM auswählen' : 'ROM auswählen'}
              </button>

              {romOk && <p className="mt-3"><Ok>ROM eingerichtet · <span className="text-slate-300 font-normal">{fileName(settings.romPath)}</span></Ok></p>}
              {romErr && !romOk && (
                <div className="mt-3">
                  <p className="text-yellow-400/90 text-xs mb-1.5">{romErr}</p>
                  <input
                    value={settings.romPath}
                    onChange={(e) => update({ romPath: e.target.value })}
                    placeholder="C:\ROMs\Pokemon Platin Randomizer.nds"
                    spellCheck={false}
                    autoFocus
                    className="pk-input font-mono text-xs"
                  />
                  <p className="text-slate-600 text-[11px] mt-1">Tipp: im Explorer Shift+Rechtsklick auf die ROM → „Als Pfad kopieren", dann hier einfügen.</p>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-white font-black text-xl mb-1.5">Lua &amp; Live-Sync</h2>
              <p className="text-slate-400 text-sm mb-5">Die App kennt ihr eigenes Projekt – hier musst du nichts auswählen.</p>
              {detecting ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Wird eingerichtet…</div>
              ) : (
                <div className="rounded-2xl border border-[#2e2e42] bg-[#16161f] p-4 space-y-2">
                  {liveOk ? <Ok>Lua eingerichtet</Ok> : <Pending>Lua</Pending>}
                  <div />
                  {liveOk ? <Ok>Live-Sync eingerichtet</Ok> : <Pending>Live-Sync</Pending>}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="text-center py-2">
              <PartyPopper className="w-12 h-12 text-pk-yellow mx-auto mb-4" />
              <h2 className="text-white font-black text-2xl mb-1">Fertig!</h2>
              <p className="text-slate-400 text-sm mb-5">Alles erfolgreich eingerichtet.</p>
              <div className="rounded-2xl border border-[#2e2e42] bg-[#16161f] p-4 space-y-2 text-left max-w-xs mx-auto">
                {bizOk ? <Ok>BizHawk</Ok> : <Pending>BizHawk</Pending>}
                <div />
                {romOk ? <Ok>ROM</Ok> : <Pending>ROM</Pending>}
                <div />
                {liveOk ? <Ok>Live Sync</Ok> : <Pending>Live Sync</Pending>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-5 border-t border-[#2e2e42]">
          <button onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}
            className="btn-ghost text-sm flex items-center gap-1.5 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" /> Zurück
          </button>
          {step < TOTAL ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="btn-primary flex items-center gap-1.5 px-6">
              Weiter <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={onClose} className="btn-primary px-6">Einrichtung abschließen</button>
          )}
        </div>
      </div>
    </div>
  )
}
