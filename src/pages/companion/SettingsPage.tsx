import { useNavigate } from 'react-router-dom'
import { Cpu, Users, Dices, ChevronRight } from 'lucide-react'

// Einstellungen = the home for the technical tools, demoted out of the daily
// navigation. The player only comes here to set things up once (or tweak later);
// the everyday app is the Dashboard + the Run.
const SECTIONS = [
  { icon: Cpu, title: 'Emulator', desc: 'BizHawk einrichten — meist nur einmal nötig.', to: '/setup' },
  { icon: Users, title: 'Profile', desc: 'Spieler, Original-ROM, Standard-Preset pro Pairing.', to: '/profiles' },
  { icon: Dices, title: 'Randomizer & Presets', desc: 'Eingebaute und eigene Preset-Regeln verwalten.', to: '/presets' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
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
    </div>
  )
}
