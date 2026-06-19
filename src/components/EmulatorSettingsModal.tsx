import { useState } from 'react'
import { X, Check, AlertCircle, Copy, Download, Gamepad2, RotateCcw } from 'lucide-react'
import {
  useEmulatorSettings, useEmulatorSettingsStore, settingsStatus, buildStartBat,
  type EmulatorSettings,
} from '../lib/emulatorSettings'

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg"
      style={ok
        ? { color: '#4ade80', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)' }
        : { color: '#f87171', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)' }}
    >
      {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {label}
    </span>
  )
}

function Field({ label, value, placeholder, hint, onChange }: {
  label: string; value: string; placeholder: string; hint?: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-slate-300 text-sm font-semibold mb-1.5 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="pk-input font-mono text-xs"
      />
      {hint && <p className="text-slate-600 text-[11px] mt-1">{hint}</p>}
    </div>
  )
}

export default function EmulatorSettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useEmulatorSettings()
  const update = useEmulatorSettingsStore((s) => s.update)
  const reset = useEmulatorSettingsStore((s) => s.reset)
  const [copied, setCopied] = useState(false)

  const set = (patch: Partial<EmulatorSettings>) => update(patch)
  const st = settingsStatus(settings)
  const allSet = st.bizhawk && st.rom && st.lua
  const bat = buildStartBat(settings)

  async function copyBat() {
    try { await navigator.clipboard.writeText(bat); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }
  function downloadBat() {
    const blob = new Blob([bat], { type: 'application/bat' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'start-soullink.bat'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-2xl border border-[#2e2e42] shadow-2xl anim-pop overflow-hidden" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#2e2e42] sticky top-0 bg-[#1c1c26] z-10">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-pk-red" />
            <h2 className="text-white font-black text-xl">Emulator-Einstellungen</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-7 py-6 space-y-6">
          {/* Status */}
          <div className="flex flex-wrap gap-2">
            <StatusChip ok={st.bizhawk} label="BizHawk" />
            <StatusChip ok={st.rom} label="ROM" />
            <StatusChip ok={st.lua} label="Lua" />
            <StatusChip ok={st.sync} label="Sync-Ordner" />
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <Field
              label="BizHawk / EmuHawk-Pfad"
              value={settings.bizhawkPath}
              placeholder="C:\Tools\BizHawk-2.11.1-win-x64\EmuHawk.exe"
              hint="Die EmuHawk.exe deiner BizHawk-Installation."
              onChange={(v) => set({ bizhawkPath: v })}
            />
            <Field
              label="ROM-Pfad"
              value={settings.romPath}
              placeholder="C:\ROMs\Pokemon Platin.nds"
              hint="Die .nds (oder .gba/.gbc) Rom-Datei deines Runs."
              onChange={(v) => set({ romPath: v })}
            />
            <Field
              label="Lua-Script-Pfad"
              value={settings.luaPath}
              placeholder="C:\...\emulator\bizhawk\soullink_sync.lua"
              hint="Standard ist der Projektpfad. Für die .bat am besten den ABSOLUTEN Pfad eintragen."
              onChange={(v) => set({ luaPath: v })}
            />
            <Field
              label="Projekt-/Sync-Ordner"
              value={settings.syncFolder}
              placeholder="C:\...\emulator\bizhawk"
              hint="Ordner, in dem soullink_team.json landet (neben dem Lua-Script). Nur informativ."
              onChange={(v) => set({ syncFolder: v })}
            />
          </div>

          {/* Hints when something missing */}
          {!allSet && (
            <div className="rounded-2xl border border-yellow-700/40 bg-yellow-950/20 p-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-400" />
              <p className="text-yellow-200/90 text-xs">
                Noch nicht vollständig: {[!st.bizhawk && 'BizHawk-Pfad', !st.rom && 'ROM-Pfad', !st.lua && 'Lua-Pfad'].filter(Boolean).join(', ')} fehlt.
                Du kannst trotzdem manuell starten — die Felder dienen nur der Start-Hilfe und der .bat-Datei.
              </p>
            </div>
          )}

          {/* Schnellstart */}
          <div>
            <h3 className="text-slate-200 text-xs font-black uppercase tracking-widest mb-2">Schnellstart</h3>
            <ol className="space-y-1.5 text-sm text-slate-300 list-decimal list-inside">
              <li>Website starten (<span className="font-mono text-xs text-slate-400">npm run dev</span>) — läuft bereits, wenn du das hier siehst.</li>
              <li><span className="font-semibold text-slate-100">start-soullink.bat</span> doppelklicken — startet BizHawk mit deiner ROM und lädt das Lua-Script.</li>
              <li>Diesen Run öffnen.</li>
              <li>Live-Sync prüfen: im Panel steht „Verbunden mit …", dein Team erscheint automatisch.</li>
            </ol>
            <p className="text-slate-500 text-[11px] mt-2">
              Eine Browser-App darf keine lokalen Programme starten — deshalb übernimmt das die <span className="text-slate-300 font-semibold">.bat</span> (Schritt&nbsp;2). Die Datei nutzt genau deine oben gespeicherten Pfade.
            </p>
            <p className="text-slate-500 text-[11px] mt-1">
              Lua manuell laden (falls die Auto-Ladung nicht greift): <span className="text-slate-400">Tools → Lua Console → Open Script → soullink_sync.lua</span>
            </p>
          </div>

          {/* .bat */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-200 text-xs font-black uppercase tracking-widest">start-soullink.bat</h3>
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
          </div>

          <div className="flex items-center justify-between pt-1">
            <button onClick={reset} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-300 transition-colors">
              <RotateCcw className="w-3 h-3" /> Zurücksetzen
            </button>
            <button onClick={onClose} className="btn-primary px-6">Fertig</button>
          </div>
        </div>
      </div>
    </div>
  )
}
