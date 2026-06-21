import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, User as UserIcon, LayoutGrid, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import ProfileModal from './ProfileModal'
import ShinyAvatar from './ShinyAvatar'

export default function UserMenu() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const name = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Account'

  // Hover intent: keep open while the pointer is on the button OR the menu,
  // close ~200ms after it leaves both (no flicker crossing the gap).
  function cancelClose() { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null } }
  function scheduleClose() { cancelClose(); closeTimer.current = setTimeout(() => setOpen(false), 200) }

  // Close on outside click + Escape.
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

  return (
    <>
      <div
        ref={wrapRef}
        className="relative"
        onMouseEnter={() => { cancelClose(); setOpen(true) }}
        onMouseLeave={scheduleClose}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl transition-all border"
          style={{ background: '#1c1c26', borderColor: '#2e2e42', color: '#e2e8f0' }}
        >
          <ShinyAvatar src={profile?.avatar_url} size={26} />
          <span className="max-w-[120px] truncate">{name}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 z-[1000] bg-[#1c1c26] border border-[#2e2e42] rounded-2xl shadow-2xl overflow-hidden min-w-52"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <div className="px-4 py-3 border-b border-[#2e2e42]">
              <div className="text-white font-black text-sm truncate">{name}</div>
              <div className="text-slate-500 text-xs truncate">{user?.email}</div>
            </div>
            <button role="menuitem" onClick={() => { setOpen(false); setShowProfile(true) }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
              <UserIcon className="w-4 h-4" /> Profil
            </button>
            <button role="menuitem" onClick={() => { setOpen(false); navigate('/') }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
              <LayoutGrid className="w-4 h-4" /> Meine Runs
            </button>
            <button role="menuitem" onClick={() => { setOpen(false); setShowProfile(true) }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
              <Settings className="w-4 h-4" /> Einstellungen
            </button>
            <button role="menuitem" onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-400/5 transition-colors border-t border-[#2e2e42]">
              <LogOut className="w-4 h-4" /> Abmelden
            </button>
          </div>
        )}
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  )
}
