import { useEffect, useState } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import UserMenu from '../components/UserMenu'

// Custom title bar for the frameless Companion window. The bar itself is the OS
// drag region; the account menu + window buttons opt out of dragging. This is what
// makes the window feel like a native desktop app rather than a browser.
interface Native {
  minimize?: () => void
  toggleMaximize?: () => void
  close?: () => void
  isMaximized?: () => Promise<boolean>
  onMaximizeChange?: (cb: (v: boolean) => void) => (() => void)
}
function native(): Native | null {
  return (typeof window !== 'undefined' ? (window as unknown as { soullinkNative?: Native }).soullinkNative : null) ?? null
}
const DRAG = { WebkitAppRegion: 'drag' } as unknown as React.CSSProperties
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as unknown as React.CSSProperties

export default function TitleBar() {
  const { user } = useAuth()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    const n = native()
    if (!n) return
    n.isMaximized?.().then((v) => setMaximized(!!v)).catch(() => { /* ignore */ })
    return n.onMaximizeChange?.((v) => setMaximized(v))
  }, [])

  const n = native()
  const ctrl = 'h-full px-3.5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors'

  return (
    <div className="h-9 shrink-0 flex items-stretch border-b border-[#1f1f2b] bg-[#0b0b10] select-none" style={DRAG}>
      <div className="flex items-center gap-2 pl-4 pr-3">
        <div className="w-4 h-4 rounded bg-pk-red flex items-center justify-center text-white font-black text-[9px]">S</div>
        <span className="text-slate-300 text-xs font-bold">SoulLink Companion</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-stretch" style={NO_DRAG}>
        {user && <div className="flex items-center pr-1"><UserMenu /></div>}
        <button className={ctrl} onClick={() => n?.minimize?.()} aria-label="Minimieren"><Minus className="w-4 h-4" /></button>
        <button className={ctrl} onClick={() => n?.toggleMaximize?.()} aria-label={maximized ? 'Wiederherstellen' : 'Maximieren'}>
          {maximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        </button>
        <button className="h-full px-3.5 flex items-center justify-center text-slate-400 hover:bg-red-600 hover:text-white transition-colors" onClick={() => n?.close?.()} aria-label="Schließen"><X className="w-4 h-4" /></button>
      </div>
    </div>
  )
}
