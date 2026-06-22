import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, User as UserIcon, Settings, LogOut, ScrollText, MessageCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useT } from '../lib/i18n'
import { LINKS } from '../lib/appInfo'
import ProfileModal from './ProfileModal'
import SettingsModal from './SettingsModal'
import ShinyAvatar from './ShinyAvatar'

export default function UserMenu() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const name = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Account'

  function cancelClose() { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null } }
  function scheduleClose() { cancelClose(); closeTimer.current = setTimeout(() => setOpen(false), 200) }

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  useEffect(() => () => cancelClose(), [])

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }
  function openLink(url: string) { setOpen(false); if (url) window.open(url, '_blank', 'noopener,noreferrer') }

  const item = 'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors'

  return (
    <>
      <div ref={wrapRef} className="relative" onMouseEnter={() => { cancelClose(); setOpen(true) }} onMouseLeave={scheduleClose}>
        <button onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}
          className="flex items-center gap-2 text-xs font-bold pl-1.5 pr-3 py-1.5 rounded-full transition-all border hover:border-pk-red/50"
          style={{ background: '#1c1c26', borderColor: '#2e2e42', color: '#e2e8f0' }}>
          <ShinyAvatar src={profile?.avatar_url} size={28} />
          <span className="max-w-[120px] truncate">{name}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div role="menu" className="absolute right-0 top-full mt-2 z-[1000] bg-[#1c1c26] border border-[#2e2e42] rounded-2xl shadow-2xl overflow-hidden min-w-56 anim-pop" onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#2e2e42] bg-gradient-to-r from-pk-red/10 to-transparent">
              <ShinyAvatar src={profile?.avatar_url} size={40} />
              <div className="min-w-0">
                <div className="text-white font-black text-sm truncate">{name}</div>
                <div className="text-slate-500 text-xs truncate">{user?.email}</div>
              </div>
            </div>
            <div className="py-1.5">
              <button role="menuitem" onClick={() => { setOpen(false); setShowProfile(true) }} className={item}><UserIcon className="w-4 h-4" /> {t('menu.profile')}</button>
              <button role="menuitem" onClick={() => { setOpen(false); setShowSettings(true) }} className={item}><Settings className="w-4 h-4" /> {t('menu.settings')}</button>
              <button role="menuitem" onClick={() => openLink(LINKS.changelog)} className={item}><ScrollText className="w-4 h-4" /> {t('menu.changelog')}</button>
              <button role="menuitem" onClick={() => openLink(LINKS.discord)} disabled={!LINKS.discord} title={LINKS.discord ? undefined : 'Discord-Link folgt'} className={`${item} disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed`}><MessageCircle className="w-4 h-4" /> {t('menu.discord')}</button>
            </div>
            <button role="menuitem" onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-400/5 transition-colors border-t border-[#2e2e42]">
              <LogOut className="w-4 h-4" /> {t('menu.signout')}
            </button>
          </div>
        )}
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
