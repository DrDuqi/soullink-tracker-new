import { useLocation, useNavigate } from 'react-router-dom'
import { NAV } from './nav'

// Persistent left navigation for the Companion window. Stays mounted while the work
// area (Outlet) changes — like Steam / Discord / VS Code. Active routes navigate;
// "soon" sections render dimmed with a Bald tag so the product's shape is visible.
export default function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isActive = (to?: string) => {
    if (!to) return false
    return to === '/' ? pathname === '/' : pathname.startsWith(to)
  }

  return (
    <nav className="w-60 shrink-0 h-full flex flex-col border-r border-[#1f1f2b] bg-[#0e0e13]">
      <div className="flex items-center gap-2.5 px-5 h-14 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-pk-red flex items-center justify-center text-white font-black text-sm">S</div>
        <span className="text-white font-black tracking-tight">SoulLink</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(item.to)
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => item.to && navigate(item.to)}
              disabled={item.soon}
              aria-current={active ? 'page' : undefined}
              className={[
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors',
                active ? 'bg-pk-red/12 text-white' : 'text-slate-400',
                item.soon ? 'opacity-45 cursor-default' : 'hover:bg-white/5 hover:text-white',
              ].join(' ')}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-pk-red" />}
              {item.soon && <span className="text-[9px] font-black uppercase tracking-wide text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">Bald</span>}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
