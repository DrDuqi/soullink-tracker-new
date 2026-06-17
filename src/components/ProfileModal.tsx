import { useState } from 'react'
import { X, User as UserIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToastStore } from '../store/toastStore'

interface Props {
  onClose: () => void
}

export default function ProfileModal({ onClose }: Props) {
  const { user, profile, refreshProfile } = useAuth()
  const toast = useToastStore()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    const { error } = await supabase.from('profiles')
      .update({ display_name: displayName.trim() || profile?.username, avatar_url: avatarUrl.trim() || null })
      .eq('user_id', user.id)
    setSaving(false)
    if (error) { toast.show('Profil konnte nicht gespeichert werden.', 'error'); return }
    await refreshProfile()
    toast.show('Profil gespeichert.', 'success')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[210] p-4 anim-fade">
      <div className="bg-[#1c1c26] rounded-3xl w-full max-w-md border border-[#2e2e42] shadow-2xl anim-pop">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2e2e42]">
          <h2 className="text-white font-black text-lg">Profil &amp; Einstellungen</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#16161f] border border-[#2e2e42] flex items-center justify-center overflow-hidden shrink-0">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : <UserIcon className="w-7 h-7 text-slate-600" />}
            </div>
            <div className="min-w-0">
              <div className="text-white font-black">{profile?.username}</div>
              <div className="text-slate-500 text-xs truncate">{user?.email}</div>
            </div>
          </div>

          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">Benutzername</label>
            <input value={profile?.username ?? ''} disabled className="pk-input opacity-60 cursor-not-allowed" />
            <p className="text-slate-600 text-xs mt-1.5">Der Benutzername ist eindeutig und kann nicht geändert werden.</p>
          </div>

          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">Anzeigename</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={profile?.username} className="pk-input" />
          </div>

          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">Avatar-URL <span className="text-slate-600 font-normal">(optional)</span></label>
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className="pk-input" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Speichern…' : 'Speichern'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
