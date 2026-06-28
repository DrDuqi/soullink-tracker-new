import { useAuth } from '../contexts/AuthContext'
import UserMenu from '../components/UserMenu'

// Custom title bar for the Companion window. The bar itself is the OS drag region;
// the account menu opts out of dragging. The minimize/maximize/close buttons are the
// NATIVE Windows controls (window-controls overlay, configured in main.cjs) drawn at
// the top-right → real Snap Layouts, double-click-maximize, drag-snap and taskbar
// behaviour. We only reserve space on the right so nothing sits under them.
const DRAG = { WebkitAppRegion: 'drag' } as unknown as React.CSSProperties
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as unknown as React.CSSProperties
const OVERLAY_W = 140   // px the native min/max/close buttons occupy on the right

export default function TitleBar() {
  const { user } = useAuth()
  return (
    <div className="h-9 shrink-0 flex items-stretch border-b border-[#1f1f2b] bg-[#0b0b10] select-none" style={DRAG}>
      <div className="flex items-center gap-2 pl-4 pr-3">
        <div className="w-4 h-4 rounded bg-pk-red flex items-center justify-center text-white font-black text-[9px]">S</div>
        <span className="text-slate-300 text-xs font-bold">SoulLink Companion</span>
      </div>
      <div className="flex-1" />
      {user && <div className="flex items-center pr-2" style={{ ...NO_DRAG, marginRight: OVERLAY_W }}><UserMenu /></div>}
      {!user && <div style={{ marginRight: OVERLAY_W }} />}
    </div>
  )
}
