import { useQuery } from '@tanstack/react-query'
import { Wifi, WifiOff, CheckCircle2, ArrowUpCircle, HelpCircle, Download } from 'lucide-react'
import { companionInfo, latestCompanionVersion, updateState } from '../lib/appInfo'
import { DOWNLOADS } from '../lib/downloads'

// Shows: is the Companion running? which version is installed vs. the newest
// published one? is it up to date / an update available? The Companion auto-updates
// itself (electron-updater) — this is purely the on-website status the user asked for.
export default function CompanionVersion() {
  const { data: comp } = useQuery({ queryKey: ['companion-info'], queryFn: () => companionInfo(), staleTime: 10_000, refetchInterval: 8_000 })
  const { data: latest } = useQuery({ queryKey: ['companion-latest'], queryFn: () => latestCompanionVersion(), staleTime: 600_000 })

  const running = !!comp?.ok
  const installed = comp?.version && comp.version !== 'dev' ? comp.version : null
  const state = updateState(installed, latest ?? null)

  const badge =
    state === 'current'
      ? { icon: <CheckCircle2 className="w-3.5 h-3.5" />, text: 'Aktuell', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' }
      : state === 'outdated'
        ? { icon: <ArrowUpCircle className="w-3.5 h-3.5" />, text: 'Update verfügbar', color: '#FFCB05', bg: 'rgba(255,203,5,0.12)' }
        : { icon: <HelpCircle className="w-3.5 h-3.5" />, text: 'Status unbekannt', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' }

  return (
    <div className="rounded-xl border border-[#2e2e42] bg-[#16161f] p-3.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${running ? 'bg-green-500/15 text-green-400' : 'bg-slate-700/30 text-slate-500'}`}>
            {running ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </span>
          <div className="min-w-0 text-sm">
            <div className="text-white font-bold">{running ? 'Companion läuft' : 'Companion nicht gestartet'}</div>
            <div className="text-slate-500 text-xs">
              Installiert: <span className="font-mono text-slate-300">{installed ? `v${installed}` : '—'}</span>
              {'  ·  '}Neueste: <span className="font-mono text-slate-300">{latest ? `v${latest}` : '—'}</span>
            </div>
          </div>
        </div>
        <span className="text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-lg flex items-center gap-1.5 shrink-0" style={{ color: badge.color, background: badge.bg }}>
          {badge.icon} {badge.text}
        </span>
      </div>
      {state === 'outdated' && (
        <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap text-xs">
          <span className="text-slate-400">Der Companion aktualisiert sich automatisch beim Neustart — oder jetzt neu laden:</span>
          <a href={DOWNLOADS.companion} download className="inline-flex items-center gap-1.5 font-bold text-pk-yellow hover:underline">
            <Download className="w-3.5 h-3.5" /> v{latest} herunterladen
          </a>
        </div>
      )}
    </div>
  )
}
