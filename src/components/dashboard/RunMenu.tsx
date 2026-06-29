import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, ArrowRight, RefreshCw, Trophy, Skull, Pencil, Copy, Archive, Trash2 } from 'lucide-react'

// Smart run menu: rendered in a portal with FIXED positioning measured from the trigger,
// so it can never be clipped by a card's overflow and always flips to stay on-screen
// (down → up when low, right-aligned → clamped when near an edge).
export interface RunMenuActions {
  finished?: boolean
  onTracker: () => void; onAttempt: () => void; onWon: () => void; onLost: () => void
  onRename: () => void; onDuplicate: () => void; onArchive: () => void; onDelete: () => void
}

export default function RunMenu(a: RunMenuActions) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Position after the menu is in the DOM so we can measure its real size.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const b = btnRef.current?.getBoundingClientRect()
    const m = menuRef.current?.getBoundingClientRect()
    if (!b) return
    const gap = 6, pad = 10
    const mw = m?.width || 224, mh = m?.height || 320
    let top = b.bottom + gap
    if (top + mh > window.innerHeight - pad) top = Math.max(pad, b.top - gap - mh)   // flip up
    let left = b.right - mw                                                          // right-align to trigger
    if (left < pad) left = pad
    if (left + mw > window.innerWidth - pad) left = window.innerWidth - pad - mw
    setPos({ top, left })
  }, [open])

  // Close on outside click, scroll, resize or Escape.
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) }
  }, [open])

  const run = (fn: () => void) => () => { setOpen(false); fn() }
  const item = 'w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/[0.07] text-left transition-colors'

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button ref={btnRef} onClick={() => setOpen((v) => !v)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors" aria-label="Menü"><MoreVertical className="w-5 h-5" /></button>
      {open && createPortal(
        <div ref={menuRef} onClick={(e) => e.stopPropagation()}
          className="fixed z-[100] w-56 bg-[#16161f]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden py-1 anim-fade"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}>
          <button onClick={run(a.onTracker)} className={item}><ArrowRight className="w-4 h-4" /> Nur Tracker öffnen</button>
          <button onClick={run(a.onAttempt)} className={item}><RefreshCw className="w-4 h-4" /> Neuer Versuch</button>
          {!a.finished && <button onClick={run(a.onWon)} className={item}><Trophy className="w-4 h-4 text-green-400" /> Als gewonnen</button>}
          {!a.finished && <button onClick={run(a.onLost)} className={item}><Skull className="w-4 h-4" /> Als verloren</button>}
          <button onClick={run(a.onRename)} className={item}><Pencil className="w-4 h-4" /> Umbenennen</button>
          <button onClick={run(a.onDuplicate)} className={item}><Copy className="w-4 h-4" /> Duplizieren</button>
          <button onClick={run(a.onArchive)} className={item}><Archive className="w-4 h-4" /> Archivieren</button>
          <button onClick={run(a.onDelete)} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 text-left border-t border-white/10 transition-colors"><Trash2 className="w-4 h-4" /> Löschen</button>
        </div>, document.body)}
    </div>
  )
}
