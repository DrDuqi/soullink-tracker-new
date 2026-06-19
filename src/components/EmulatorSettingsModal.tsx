import { useRef, useState } from 'react'
import { X, Check, Copy, Download, Gamepad2, RotateCcw, ChevronDown, ChevronUp, Loader2, FolderSearch } from 'lucide-react'
import {
  useEmulatorSettings, useEmulatorSettingsStore, settingsStatus, buildStartBat, fileName, findFile,
} from '../lib/emulatorSettings'

function StatusRow({ label, ok, value, onChange }: { label: string; ok: boolean; value?: string; onChange?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#2e2e42] bg-[#16161f] px-4 py-3">
      <div className="min-w-0">
        <div className="text-slate-300 text-sm font-bold">{label}</div>
        <div className="text-xs mt-0.5 truncate">
          {ok
            ? <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold"><Check className="w-3.5 h-3.5 shrink-0" /> {value ?? 'eingerichtet'}</span>
            : <span className="text-slate-500">nicht eingerichtet</span>}
        </div>
      </div>
      {onChange && (
        <button onClick={onChange} className="btn-ghost text-xs py-1.5 px-3 shrink-0">Ändern</button>
      )}
    </div>
  )
}

function AdvField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-slate-500 text-[11px] font-semibold mb-1 block">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} spellCheck={false}
        className="pk-input font-mono text-[11px] py-1.5" />
    </div>
  )
}

/** Compact emulator settings (post-setup). Shows BizHawk / ROM / Live-Sync status
 *  and a reset; full paths, the .bat and the Lua/sync internals live behind
 *  "Erweiterte Optionen" — a normal user never needs them. */
export default function EmulatorSettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useEmulatorSettings()
  const update = useEmulatorSettingsStore((s) => s.update)
  const reset = useEmulatorSettingsStore((s) => s.reset)
  const [copied, setCopied] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [resolving, setResolving] = useState<'biz' | 'rom' | null>(null)
  const bizInput = useRef<HTMLInputElement>(null)
  const romInput = useRef<HTMLInputElement>(null)

  const st = settingsStatus(settings)
  const bat = buildStartBat(settings)

  async function resolvePicked(file: File | undefined, kind: 'biz' | 'rom') {
    if (!file) return
    setResolving(kind)
    const path = await findFile(file.name)
    setResolving(null)
    if (path) update(kind === 'biz' ? { bizhawkPath: path } : { romPath: path })
  }
  async function copyBat() {
    try { await navigator.clipboard.writeText(bat); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }
  function downloadBat() {
    const blob = new Blob([bat], { type: 'application/bat' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'start-soullink.bat'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade">
      <input ref={bizInput} type="file" accept=".exe" className="hidden" onChange={(e) => resolvePicked(e.target.files?.[0], 'biz')} />
      <input ref={romInput} type="file" accept=".nds,.gba,.gbc,.gb" className="hidden" onChange={(e) => resolvePicked(e.target.files?.[0], 'rom')} />

      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-lg border border-[#2e2e42] shadow-2xl anim-pop overflow-hidden" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#2e2e42] sticky top-0 bg-[#1c1c26] z-10">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-pk-red" />
            <h2 className="text-white font-black text-xl">Emulator</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-7 py-6 space-y-3">
          <StatusRow label="BizHawk" ok={st.bizhawk} value="eingerichtet" onChange={() => bizInput.current?.click()} />
          <StatusRow label="ROM" ok={st.rom} value={st.rom ? fileName(settings.romPath) : undefined} onChange={() => romInput.current?.click()} />
          <StatusRow label="Live Sync" ok={st.lua} value="eingerichtet" />
          {resolving && <p className="text-slate-500 text-xs flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Datei wird gesucht…</p>}

          <div className="flex items-center justify-between pt-2">
            <button onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-400 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Einrichtung zurücksetzen
            </button>
            <button onClick={onClose} className="btn-primary px-6">Fertig</button>
          </div>

          {/* Erweiterte Optionen */}
          <div className="border-t border-[#2e2e42] pt-3">
            <button onClick={() => setAdvanced((v) => !v)} className="w-full flex items-center justify-between text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors">
              <span className="flex items-center gap-1.5"><FolderSearch className="w-3.5 h-3.5" /> Erweiterte Optionen</span>
              {advanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {advanced && (
              <div className="mt-3 space-y-5">
                <div className="space-y-2">
                  <AdvField label="BizHawk-Pfad" value={settings.bizhawkPath} placeholder="…\EmuHawk.exe" onChange={(v) => update({ bizhawkPath: v })} />
                  <AdvField label="ROM-Pfad" value={settings.romPath} placeholder="…\game.nds" onChange={(v) => update({ romPath: v })} />
                  <AdvField label="Lua-Pfad" value={settings.luaPath} placeholder="…\soullink_sync.lua" onChange={(v) => update({ luaPath: v })} />
                  <AdvField label="Sync-Ordner" value={settings.syncFolder} placeholder="…\emulator\bizhawk" onChange={(v) => update({ syncFolder: v })} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">start-soullink.bat</span>
                    <div className="flex gap-2">
                      <button onClick={copyBat} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors"
                        style={{ color: '#94a3b8', background: '#16161f', borderColor: '#2e2e42' }}>
                        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} {copied ? 'Kopiert' : 'Startdatei kopieren'}
                      </button>
                      <button onClick={downloadBat} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors"
                        style={{ color: '#CC0000', background: 'rgba(204,0,0,0.1)', borderColor: 'rgba(204,0,0,0.3)' }}>
                        <Download className="w-3 h-3" /> Startdatei herunterladen
                      </button>
                    </div>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 bg-[#16161f] border border-[#2e2e42] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all">{bat}</pre>
                  <p className="text-slate-600 text-[11px] mt-1">Nur für Fortgeschrittene – ein normaler Nutzer braucht das nicht.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
