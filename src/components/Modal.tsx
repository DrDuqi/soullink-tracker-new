import { useEffect } from 'react'
import { X } from 'lucide-react'

// One dialog shell for the whole app. Always centered, never clipped at the top
// (the overlay itself scrolls), capped at 85vh with the body scrolling inside,
// blurred backdrop, scale-in. Esc and backdrop-click close it; body scroll locks.
export default function Modal({
  onClose, title, icon, children, footer, maxWidth = 'max-w-lg', headerRight,
}: {
  onClose: () => void
  title?: React.ReactNode
  icon?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: string
  headerRight?: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[210] overflow-y-auto anim-fade" style={{ background: 'rgba(4,5,9,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className={`relative w-full ${maxWidth} bg-[#16161f] rounded-3xl border border-[#2e2e42] shadow-2xl anim-pop flex flex-col`}
          style={{ maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
          {(title || headerRight) && (
            <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-5 border-b border-[#2e2e42]">
              <h2 className="text-white font-black text-lg flex items-center gap-2.5 min-w-0">{icon}<span className="truncate">{title}</span></h2>
              <div className="flex items-center gap-1 shrink-0">
                {headerRight}
                <button onClick={onClose} aria-label="Schließen" className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
          )}
          <div className="flex-1 min-h-0 flex flex-col">{children}</div>
          {footer && <div className="shrink-0 px-6 py-4 border-t border-[#2e2e42]">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

/** Small building blocks so Profile & Settings share one design language. */
export function SettingRow({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-white font-semibold text-sm">{title}</div>
        {hint && <div className="text-slate-500 text-xs mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="relative w-11 h-6 rounded-full transition-colors shrink-0"
      style={{ background: on ? 'var(--color-pk-red)' : '#2e2e42' }}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: on ? 'translateX(20px)' : 'none' }} />
    </button>
  )
}
