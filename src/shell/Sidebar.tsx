import { useLocation, useNavigate } from 'react-router-dom'
import { Wifi, Globe } from 'lucide-react'
import { NAV } from './nav'
import { LINKS } from '../lib/appInfo'
import { useCompanion } from '../hooks/useCompanion'

function GitHubMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577 0-.285-.01-1.04-.015-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.237 1.84 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.776.42-1.305.762-1.605-2.665-.305-5.467-1.335-5.467-5.93 0-1.31.467-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

// Persistent left navigation for the Companion window. Stays mounted while the work
// area (Outlet) changes — like Steam / Discord / VS Code. Glassy over the cinematic
// atmosphere, with a glowing active item, a live connection chip and a social footer,
// so the shell reads like a premium launcher. "soon" sections render dimmed.
function DiscordIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a18.3 18.3 0 0 1 4.3 1.3 16.6 16.6 0 0 0-5-1.6 17 17 0 0 0-5 0 16.6 16.6 0 0 0-5 1.6A18.3 18.3 0 0 1 8.8 3.5L8.6 3a19.8 19.8 0 0 0-4.9 1.4C1.3 8.4.4 12.3.8 16.1a19.9 19.9 0 0 0 6 3l.8-1.3a13 13 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12 0l.5.4a13 13 0 0 1-2 1l.8 1.3a19.9 19.9 0 0 0 6-3c.5-4.5-.8-8.4-3.4-11.7ZM8.9 13.9c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Zm6.2 0c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.7 2-1.7 2Z" />
    </svg>
  )
}
export default function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const companion = useCompanion(true)
  const connected = companion.status !== 'absent'   // in the Companion window it serves itself

  const isActive = (to?: string) => {
    if (!to) return false
    return to === '/' ? pathname === '/' : pathname.startsWith(to)
  }

  const social = 'w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-colors'

  return (
    <nav className="w-[17rem] shrink-0 h-full flex flex-col border-r border-white/[0.06] bg-[#0b0c12]/70 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-[4.75rem] shrink-0">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-pk-red/30"
          style={{ background: 'linear-gradient(135deg,#ff2d2d,#b80018)' }}>S</div>
        <div className="leading-none">
          <div className="text-white font-black tracking-tight text-lg">SoulLink</div>
          <div className="text-[10px] font-black tracking-[0.25em] text-pk-red/80 mt-1">COMPANION</div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-1.5">
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
                'group relative w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[15px] font-bold transition-all duration-200 ease-out',
                active ? 'text-white' : 'text-slate-400',
                item.soon ? 'opacity-45 cursor-default' : 'hover:bg-white/[0.06] hover:text-white hover:translate-x-1',
              ].join(' ')}
              style={active ? { background: 'linear-gradient(100deg, rgba(204,0,0,0.24), rgba(204,0,0,0.06))', boxShadow: 'inset 0 0 0 1px rgba(255,60,60,0.3), 0 8px 24px -8px rgba(204,0,0,0.65)' } : undefined}
            >
              {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full bg-pk-red shadow-[0_0_14px_3px_rgba(204,0,0,0.75)]" />}
              <Icon className={`w-[22px] h-[22px] shrink-0 transition-transform duration-200 ${active ? 'text-pk-red' : 'group-hover:scale-110'}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.soon && <span className="text-[9px] font-black uppercase tracking-wide text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">Bald</span>}
            </button>
          )
        })}
      </div>

      {/* Connection chip */}
      <div className="px-3 pb-2">
        <div className="rounded-xl px-3 py-2.5 flex items-center gap-2.5 border border-white/[0.06] bg-white/[0.03]">
          <span className="relative flex w-2.5 h-2.5 shrink-0">
            {connected && <span className="absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-60 animate-ping" />}
            <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-400' : 'bg-slate-500'}`} />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-[11px] font-black text-slate-200 flex items-center gap-1"><Wifi className="w-3 h-3" /> Live-Sync</div>
            <div className={`text-[10px] font-bold ${connected ? 'text-green-400' : 'text-slate-500'}`}>{connected ? 'Verbunden' : 'Getrennt'}</div>
          </div>
        </div>
      </div>

      {/* Social footer */}
      <div className="px-4 pb-4 pt-1 flex items-center gap-1 border-t border-white/[0.05]">
        <button onClick={() => LINKS.discord && window.open(LINKS.discord, '_blank')} className={`${social} ${!LINKS.discord ? 'opacity-40 cursor-default' : ''}`} title="Discord" disabled={!LINKS.discord}><DiscordIcon className="w-4 h-4" /></button>
        <a href={LINKS.github} target="_blank" rel="noreferrer" className={social} title="GitHub"><GitHubMark className="w-4 h-4" /></a>
        <a href={LINKS.changelog} target="_blank" rel="noreferrer" className={social} title="Website / Changelog"><Globe className="w-4 h-4" /></a>
      </div>
    </nav>
  )
}
