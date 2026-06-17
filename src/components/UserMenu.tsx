import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, User as UserIcon, LayoutGrid, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import ProfileModal from './ProfileModal'

export default function UserMenu() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const name = profile?.display_name || profile?.username || user?.email?.split('@')[0] || 'Account'

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <>
      <div className="relative">
        {open && <div className="fixed inset-0 z-[190]" onClick={() => setOpen(false)} />}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl transition-all border"
          style={{ background: '#1c1c26', borderColor: '#2e2e42', color: '#e2e8f0' }}
        >
          <span className="w-6 h-6 rounded-full bg-[#16161f] border border-[#2e2e42] flex items-center justify-center overflow-hidden shrink-0">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : <UserIcon className="w-3.5 h-3.5 text-slate-400" />}
          </span>
          <span className="max-w-[120px] truncate">{name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 z-[200] bg-[#1c1c26] border border-[#2e2e42] rounded-2xl shadow-2xl overflow-hidden min-w-52">
            <div className="px-4 py-3 border-b border-[#2e2e42]">
              <div className="text-white font-black text-sm truncate">{name}</div>
              <div className="text-slate-500 text-xs truncate">{user?.email}</div>
            </div>
            <button onClick={() => { setOpen(false); setShowProfile(true) }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
              <UserIcon className="w-4 h-4" /> Profil
            </button>
            <button onClick={() => { setOpen(false); navigate('/') }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
              <LayoutGrid className="w-4 h-4" /> Meine Runs
            </button>
            <button onClick={() => { setOpen(false); setShowProfile(true) }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
              <Settings className="w-4 h-4" /> Einstellungen
            </button>
            <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-400/5 transition-colors border-t border-[#2e2e42]">
              <LogOut className="w-4 h-4" /> Abmelden
            </button>
          </div>
        )}
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  )
}
