import { useNavigate } from 'react-router-dom'
import { Users, Cpu, Swords, Plus, ArrowRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCompanion } from '../../hooks/useCompanion'
import CompanionVersion from '../../components/CompanionVersion'

// The Companion's home screen — the first thing a signed-in user sees in the
// window. No marketing: a greeting, the live setup status, and quick actions into
// the sections that exist today. "Neuer SoulLink" is the future end-to-end flow
// (P4/P5); shown as the primary goal but marked Bald until it's wired.
export default function DashboardPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const companion = useCompanion(true)
  const name = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Trainer'

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      <h1 className="text-white font-black text-3xl tracking-tight">Willkommen zurück, {name}</h1>
      <p className="text-slate-400 mt-1.5">Starte einen SoulLink oder richte deine Tools ein.</p>

      {/* primary goal */}
      <button onClick={() => navigate('/new')} className="mt-7 w-full text-left rounded-2xl border border-pk-red/30 bg-gradient-to-r from-pk-red/10 to-transparent p-6 flex items-center gap-5 hover:border-pk-red/60 transition-colors">
        <div className="w-12 h-12 rounded-2xl bg-pk-red/20 border border-pk-red/40 flex items-center justify-center shrink-0">
          <Plus className="w-6 h-6 text-pk-red" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-white font-black text-lg">Neuer SoulLink</h2>
          <p className="text-slate-400 text-sm mt-0.5">Seed erzeugen, automatisch randomisieren und BizHawk starten.</p>
        </div>
        <ArrowRight className="w-5 h-5 text-pk-red shrink-0" />
      </button>

      {/* quick actions into what exists today */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <QuickCard icon={Users} title="Profile" desc="Mitspieler-Profile anlegen und wählen." onClick={() => navigate('/profiles')} />
        <QuickCard icon={Cpu} title="Emulator" desc="BizHawk und deine ROM einrichten." onClick={() => navigate('/setup')} />
        <QuickCard icon={Swords} title="SoulLinks" desc="Deine laufenden Runs — bald hier." soon />
      </div>

      {/* live status */}
      <div className="mt-7 rounded-2xl border border-[#2e2e42] bg-[#16161f] p-5">
        <h3 className="text-slate-200 text-xs font-black uppercase tracking-widest mb-3">Status</h3>
        <div className="flex items-center gap-2.5 text-sm">
          <span className={`w-2.5 h-2.5 rounded-full ${companion.status === 'connected' ? 'bg-green-400' : 'bg-amber-400'}`} />
          <span className="text-slate-300 font-bold">{companion.status === 'connected' ? 'Companion läuft' : 'Companion startet …'}</span>
        </div>
        <div className="mt-3"><CompanionVersion hideWhenCurrent /></div>
      </div>
    </div>
  )
}

function QuickCard({ icon: Icon, title, desc, onClick, soon }: {
  icon: typeof Users; title: string; desc: string; onClick?: () => void; soon?: boolean
}) {
  return (
    <button onClick={onClick} disabled={soon}
      className={`text-left rounded-2xl border border-[#2e2e42] bg-[#16161f] p-5 transition-colors group ${soon ? 'opacity-50 cursor-default' : 'hover:border-pk-red/50 hover:bg-[#1a1a24]'}`}>
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-slate-300" />
        <span className="text-white font-black">{title}</span>
        {soon && <span className="text-[9px] font-black uppercase tracking-wide text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">Bald</span>}
        {!soon && <ArrowRight className="w-4 h-4 text-slate-600 ml-auto group-hover:text-pk-red transition-colors" />}
      </div>
      <p className="text-slate-400 text-sm mt-1.5">{desc}</p>
    </button>
  )
}
