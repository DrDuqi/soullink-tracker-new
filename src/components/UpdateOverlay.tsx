import { useEffect, useRef, useState } from 'react'
import { Download, X, Loader2, RotateCw, ScrollText, CheckCircle2, AlertTriangle } from 'lucide-react'
import { IN_COMPANION_WINDOW } from '../lib/companion'
import { useSettings } from '../store/settingsStore'
import { DOWNLOADS } from '../lib/downloads'
import ChangelogModal from './ChangelogModal'

// In-app, Discord/Steam-style update flow (Companion only). The main process pushes
// the lifecycle (available → progress → downloaded) here; this card shows the new
// version + changelog, downloads with a progress bar on "Jetzt aktualisieren", then
// the app installs and restarts itself. The browser download is only the last-resort
// fallback shown when the self-update errors.
interface UpdateEvent { type: 'available' | 'progress' | 'downloaded' | 'error' | 'phase' | 'none'; version?: string | null; notes?: string | null; percent?: number; message?: string; phase?: string }
interface NativeApp {
  checkForUpdates?: () => Promise<{ state: string; current: string; latest?: string | null; notes?: string | null }>
  startUpdate?: () => void
  onUpdate?: (cb: (e: UpdateEvent) => void) => () => void
}
function nativeApp(): NativeApp | null {
  return (typeof window !== 'undefined' ? (window as unknown as { soullinkNative?: NativeApp }).soullinkNative : null) ?? null
}

type Phase = 'hidden' | 'available' | 'downloading' | 'installing' | 'restarting' | 'done' | 'uptodate' | 'error'

export default function UpdateOverlay() {
  const lang = useSettings((s) => s.language)
  const tr = (de: string, en: string) => (lang === 'de' ? de : en)
  const [phase, setPhase] = useState<Phase>('hidden')
  const [version, setVersion] = useState<string | null>(null)
  const [notes, setNotes] = useState<string | null>(null)
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const dismissed = useRef<string | null>(null)   // version the user closed → don't re-nag

  useEffect(() => {
    if (!IN_COMPANION_WINDOW) return
    const n = nativeApp()
    if (!n?.onUpdate) return
    const showAvailable = (v: string | null, nt: string | null) => {
      if (!v || dismissed.current === v) return
      setVersion(v); setNotes(nt || null)
      setPhase((p) => (p === 'downloading' || p === 'done' ? p : 'available'))
    }
    const off = n.onUpdate((e) => {
      if (e.type === 'available') showAvailable(e.version ?? null, e.notes ?? null)
      else if (e.type === 'progress') { setPhase((p) => (p === 'installing' || p === 'restarting' ? p : 'downloading')); setPercent(Math.round(e.percent || 0)) }
      else if (e.type === 'phase') { if (e.phase === 'installing' || e.phase === 'restarting' || e.phase === 'downloading') setPhase(e.phase) }
      else if (e.type === 'downloaded') setPercent(100)
      else if (e.type === 'none') { setPhase('uptodate'); setTimeout(() => setPhase((p) => (p === 'uptodate' ? 'hidden' : p)), 2800) }
      else if (e.type === 'error') { setError(e.message || null); setPhase('error') }
    })
    // Initial pull so a brand-new window also learns about an update it missed.
    n.checkForUpdates?.().then((r) => { if (r?.state === 'available') showAvailable(r.latest ?? null, r.notes ?? null) }).catch(() => {})
    return off
  }, [])

  if (!IN_COMPANION_WINDOW || phase === 'hidden') return null

  function startUpdate() { setError(null); setPhase('downloading'); setPercent(0); nativeApp()?.startUpdate?.() }
  function dismiss() { if (version) dismissed.current = version; setPhase('hidden') }

  return (
    <>
      <div className="fixed bottom-5 right-5 z-[60] w-[360px] max-w-[calc(100vw-2.5rem)] anim-fade-up">
        <div className="rounded-2xl border border-white/10 shadow-2xl overflow-hidden" style={{ background: 'linear-gradient(160deg, rgba(24,24,34,0.98), rgba(14,14,20,0.98))', backdropFilter: 'blur(12px)' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--color-pk-red), #ff7a59)' }} />
          <div className="p-4">
            {phase === 'available' && (
              <>
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(204,0,0,0.15)', color: '#ff6b6b' }}><Download className="w-5 h-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-black text-sm">{tr('Neue Version verfügbar', 'Update available')}</div>
                    <div className="text-slate-400 text-xs mt-0.5">SoulLink Companion <span className="font-mono text-slate-200">v{version}</span></div>
                  </div>
                  <button onClick={dismiss} aria-label="close" className="text-slate-500 hover:text-white -mt-1 -mr-1 p-1"><X className="w-4 h-4" /></button>
                </div>
                {notes && <p className="text-slate-400 text-xs mt-3 leading-relaxed line-clamp-3 whitespace-pre-line">{notes}</p>}
                <div className="flex items-center gap-2 mt-4">
                  <button onClick={startUpdate} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-black text-sm text-white" style={{ background: '#CC0000' }}><Download className="w-4 h-4" /> {tr('Jetzt aktualisieren', 'Update now')}</button>
                  <button onClick={() => setShowLog(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs text-slate-200 border border-white/10 hover:bg-white/5"><ScrollText className="w-4 h-4" /> {tr('Changelog', 'Changelog')}</button>
                </div>
              </>
            )}

            {phase === 'downloading' && (
              <>
                <div className="flex items-center gap-2.5 text-white font-bold text-sm"><Loader2 className="w-4 h-4 animate-spin text-pk-red" /> {tr('Update wird geladen …', 'Downloading update …')}</div>
                <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-2 rounded-full transition-[width] duration-200" style={{ width: `${percent}%`, background: 'linear-gradient(90deg, var(--color-pk-red), #ff7a59)' }} />
                </div>
                <div className="text-right text-slate-400 text-xs mt-1.5 font-mono">{percent}%</div>
              </>
            )}

            {phase === 'installing' && (
              <div className="flex items-center gap-2.5 text-white font-bold text-sm"><Loader2 className="w-4 h-4 animate-spin text-pk-red" /> {tr('Installation wird vorbereitet …', 'Preparing installation …')}</div>
            )}

            {phase === 'restarting' && (
              <div className="flex items-center gap-2.5 text-white font-bold text-sm"><Loader2 className="w-4 h-4 animate-spin text-pk-red" /> {tr('Companion wird neu gestartet …', 'Restarting Companion …')}</div>
            )}

            {phase === 'done' && (
              <div className="flex items-center gap-2.5 text-green-400 font-bold text-sm"><CheckCircle2 className="w-4 h-4" /> {tr('Update erfolgreich installiert.', 'Update installed successfully.')}</div>
            )}

            {phase === 'uptodate' && (
              <div className="flex items-center gap-2.5 text-green-400 font-bold text-sm"><CheckCircle2 className="w-4 h-4" /> {tr('Du bist bereits auf der neuesten Version.', 'You are already on the latest version.')}</div>
            )}

            {phase === 'error' && (
              <>
                <div className="flex items-start gap-2.5 text-amber-400 font-bold text-sm"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{tr('Update fehlgeschlagen', 'Update failed')}</span></div>
                {error && <p className="text-slate-500 text-xs mt-1.5 break-words line-clamp-2">{error}</p>}
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={startUpdate} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs text-white" style={{ background: '#CC0000' }}><RotateCw className="w-4 h-4" /> {tr('Erneut versuchen', 'Retry')}</button>
                  <a href={DOWNLOADS.companion} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs text-slate-200 border border-white/10 hover:bg-white/5"><Download className="w-4 h-4" /> {tr('Im Browser laden', 'Browser download')}</a>
                  <button onClick={dismiss} className="ml-auto text-xs font-bold text-slate-500 hover:text-white">{tr('Schließen', 'Close')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {showLog && <ChangelogModal onClose={() => setShowLog(false)} />}
    </>
  )
}
