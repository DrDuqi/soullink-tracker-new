import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cpu, Gamepad2, Dices, ChevronRight, RefreshCw, FileText } from 'lucide-react'
import { LINKS } from '../../lib/appInfo'

// Einstellungen = the home for the technical tools, demoted out of the daily
// navigation. The player only comes here to set things up once (or tweak later);
// the everyday app is the Dashboard + the Run.
const SECTIONS = [
  { icon: Gamepad2, title: 'Mein Setup', desc: 'Original-ROM und Emulator — einmal auswählen, danach übernimmt SoulLink alles.', to: '/mysetup' },
  { icon: Dices, title: 'Spielregeln', desc: 'Wie randomisiert wird (Pokémon, Trainer, Items …) — eingebaute und eigene Regeln.', to: '/presets' },
  { icon: Cpu, title: 'Emulator (erweitert)', desc: 'BizHawk automatisch finden, herunterladen oder im Detail einrichten.', to: '/setup' },
]

interface NativeApp { getVersion?: () => Promise<string>; checkForUpdates?: () => void }
function nativeApp(): NativeApp | null {
  return (typeof window !== 'undefined' ? (window as unknown as { soullinkNative?: NativeApp }).soullinkNative : null) ?? null
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [version, setVersion] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => { nativeApp()?.getVersion?.().then(setVersion).catch(() => { /* ignore */ }) }, [])

  function checkUpdates() {
    setChecking(true)
    nativeApp()?.checkForUpdates?.()
    // The check runs in the main process and shows its own dialog; just give feedback.
    setTimeout(() => setChecking(false), 4000)
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <h1 className="text-white font-black text-3xl tracking-tight">Einstellungen</h1>
      <p className="text-slate-400 mt-1.5">Einmalige Einrichtung und Werkzeuge — im Alltag brauchst du sie selten.</p>
      <div className="mt-7 space-y-2.5">
        {SECTIONS.map((s) => (
          <button key={s.to} onClick={() => navigate(s.to)} className="w-full text-left rounded-2xl border border-[#2e2e42] bg-[#16161f] hover:border-pk-red/50 hover:bg-[#1a1a24] transition-colors p-5 flex items-center gap-4">
            <s.icon className="w-5 h-5 text-slate-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-white font-black">{s.title}</div>
              <div className="text-slate-400 text-sm mt-0.5">{s.desc}</div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 shrink-0" />
          </button>
        ))}
      </div>

      {/* Über & Updates */}
      <h2 className="text-slate-200 text-xs font-black uppercase tracking-widest mt-9 mb-2.5">Über &amp; Updates</h2>
      <div className="rounded-2xl border border-[#2e2e42] bg-[#16161f] p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-white font-black">SoulLink Companion {version ? `v${version}` : ''}</div>
            <div className="text-slate-400 text-sm mt-0.5">Updates installiert SoulLink automatisch — du musst nie wieder einen Installer herunterladen.</div>
          </div>
          <button onClick={checkUpdates} disabled={checking} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60" style={{ background: '#CC0000' }}>
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} /> Nach Updates suchen
          </button>
        </div>
        <a href={LINKS.changelog} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-300 hover:text-white">
          <FileText className="w-4 h-4" /> Was ist neu? (Changelog)
        </a>
      </div>
    </div>
  )
}
