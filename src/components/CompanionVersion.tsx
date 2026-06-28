import { useQuery } from '@tanstack/react-query'
import { Wifi, WifiOff, CheckCircle2, ArrowUpCircle, AlertTriangle, Download } from 'lucide-react'
import { companionInfo, latestCompanionVersion, updateState } from '../lib/appInfo'
import { DOWNLOADS } from '../lib/downloads'
import { IN_COMPANION_WINDOW } from '../lib/companion'

function startInAppUpdate() {
  try { (window as unknown as { soullinkNative?: { startUpdate?: () => void } }).soullinkNative?.startUpdate?.() } catch { /* ignore */ }
}

// Companion version / update status. `hideWhenCurrent` lets callers (e.g. the
// live-sync panel) show it only when something needs attention.
export default function CompanionVersion({ hideWhenCurrent = false, className = '' }: { hideWhenCurrent?: boolean; className?: string }) {
  const { data: comp } = useQuery({ queryKey: ['companion-info'], queryFn: () => companionInfo(), staleTime: 10_000, refetchInterval: 8_000 })
  const { data: latest } = useQuery({ queryKey: ['companion-latest'], queryFn: () => latestCompanionVersion(), staleTime: 60_000, refetchOnWindowFocus: true, refetchOnMount: true })

  const running = !!comp?.ok
  const installed = comp?.version && comp.version !== 'dev' ? comp.version : null
  const state = updateState(installed, latest ?? null)
  // running but no version → the build can't report it (or predates this fix)
  const unknownVersion = running && !installed

  if (hideWhenCurrent && running && installed && state === 'current') return null

  let icon: React.ReactNode, title: string, color: string, bg: string
  if (!running) {
    icon = <WifiOff className="w-4 h-4" />; title = 'Companion nicht gestartet'; color = '#94a3b8'; bg = 'rgba(148,163,184,0.12)'
  } else if (unknownVersion) {
    icon = <AlertTriangle className="w-4 h-4" />; title = 'Companion-Version nicht erkannt'; color = '#f87171'; bg = 'rgba(248,113,113,0.12)'
  } else if (state === 'outdated') {
    icon = <ArrowUpCircle className="w-4 h-4" />; title = 'Companion-Update verfügbar'; color = '#FFCB05'; bg = 'rgba(255,203,5,0.12)'
  } else if (state === 'current') {
    icon = <CheckCircle2 className="w-4 h-4" />; title = 'Companion aktuell'; color = '#4ade80'; bg = 'rgba(74,222,128,0.12)'
  } else {
    icon = <Wifi className="w-4 h-4" />; title = 'Companion läuft'; color = '#94a3b8'; bg = 'rgba(148,163,184,0.12)'
  }

  return (
    <div className={`rounded-xl border p-3.5 ${className}`} style={{ borderColor: `${color}40`, background: '#16161f' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ color, background: bg }}>{icon}</span>
          <div className="min-w-0 text-sm">
            <div className="font-bold" style={{ color }}>{title}</div>
            <div className="text-slate-500 text-xs">
              Installiert: <span className="font-mono text-slate-300">{installed ? `v${installed}` : '—'}</span>
              {'  ·  '}Neueste: <span className="font-mono text-slate-300">{latest ? `v${latest}` : '—'}</span>
            </div>
          </div>
        </div>
        {state === 'outdated' && IN_COMPANION_WINDOW ? (
          <button onClick={startInAppUpdate} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shrink-0" style={{ color: '#fff', background: 'var(--color-pk-red)' }}>
            <Download className="w-3.5 h-3.5" /> Jetzt aktualisieren
          </button>
        ) : (state === 'outdated' || unknownVersion) && (
          <a href={DOWNLOADS.companion} download className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg shrink-0" style={{ color: '#fff', background: 'var(--color-pk-red)' }}>
            <Download className="w-3.5 h-3.5" /> {state === 'outdated' ? 'Jetzt aktualisieren' : 'Neu installieren'}
          </a>
        )}
      </div>
      {unknownVersion && (
        <p className="text-slate-400 text-xs mt-2">Bitte den Companion einmal <b>neu starten</b>. Hilft das nicht, lade ihn oben neu herunter und installiere ihn erneut.</p>
      )}
      {state === 'outdated' && (
        <p className="text-slate-400 text-xs mt-2">{IN_COMPANION_WINDOW ? 'Das Update wird direkt in der App geladen und installiert – kein Browser nötig.' : 'Der Companion aktualisiert sich auch automatisch beim nächsten Neustart.'}</p>
      )}
    </div>
  )
}
