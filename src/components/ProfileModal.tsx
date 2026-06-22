import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Star, Swords, Link2, Sparkles, User as UserIcon, Trash2, AlertTriangle, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToastStore } from '../store/toastStore'
import { useSettings } from '../store/settingsStore'
import { useT } from '../lib/i18n'
import ShinyAvatar from './ShinyAvatar'
import ShinyAvatarPicker from './ShinyAvatarPicker'
import { avatarPokemonId } from '../lib/shinyAvatar'
import Modal from './Modal'

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const toast = useToastStore()
  const t = useT()
  const language = useSettings((s) => s.language)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [danger, setDanger] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const { data: stats } = useQuery({
    queryKey: ['profile-stats', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const uid = user!.id
      const [runsRes, mine] = await Promise.all([
        supabase.from('runs').select('id', { count: 'exact', head: true }).eq('owner_user_id', uid),
        supabase.from('players').select('id, run_id').eq('auth_user_id', uid),
      ])
      const playerIds = (mine.data ?? []).map((p) => p.id)
      const runIds = [...new Set((mine.data ?? []).map((p) => p.run_id))]
      let caught = 0, links = 0
      if (playerIds.length) {
        const { count } = await supabase.from('encounters').select('id', { count: 'exact', head: true }).in('player_id', playerIds).neq('status', 'missing')
        caught = count ?? 0
      }
      if (runIds.length) {
        const { count } = await supabase.from('soul_links').select('id', { count: 'exact', head: true }).in('run_id', runIds)
        links = count ?? 0
      }
      return { runs: runsRes.count ?? 0, caught, links }
    },
  })

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'

  async function handleSave() {
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

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.functions.invoke('delete-account')
    setDeleting(false)
    if (error) {
      toast.show('Account-Löschung ist serverseitig noch nicht aktiviert (Edge Function „delete-account" deployen).', 'error')
      return
    }
    await signOut()
    toast.show('Account gelöscht.', 'success')
  }

  const stat = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="rounded-2xl bg-[#1c1c26] border border-[#2e2e42] p-4 text-center">
      <div className="flex items-center justify-center text-pk-red mb-2">{icon}</div>
      <div className="text-white font-black text-2xl tabular-nums leading-none">{value}</div>
      <div className="text-slate-500 text-xs font-bold mt-1.5 uppercase tracking-wide">{label}</div>
    </div>
  )

  return (
    <Modal onClose={onClose} title={t('profile.title')} icon={<UserIcon className="w-5 h-5 text-pk-red" />} maxWidth="max-w-xl"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">{t('common.cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? t('common.saving') : t('common.save')}</button>
        </div>
      }>
      <div className="flex-1 min-h-0 overflow-y-auto modal-scroll px-6 py-6 space-y-6">
        {/* Profile card */}
        <div className="relative rounded-3xl border border-[#2e2e42] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-pk-red/15 via-transparent to-pk-yellow/5" />
          <div className="relative flex flex-col items-center text-center px-6 pt-7 pb-6">
            <div className="relative">
              <ShinyAvatar src={avatarUrl} size={104} />
              <button onClick={() => setPickerOpen(true)} title={t('profile.chooseShiny')}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-pk-red text-white flex items-center justify-center shadow-lg border-2 border-[#16161f] hover:scale-110 transition-transform">
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-pk-yellow text-xs font-black"><Star className="w-3.5 h-3.5 fill-pk-yellow" /> SHINY-AVATAR <Star className="w-3.5 h-3.5 fill-pk-yellow" /></div>
            <div className="text-white font-black text-2xl mt-1">{displayName || profile?.username}</div>
            <div className="text-slate-500 text-sm">@{profile?.username}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stat(<CalendarDays className="w-5 h-5" />, t('profile.memberSince'), <span className="text-sm">{memberSince}</span>)}
          {stat(<Swords className="w-5 h-5" />, t('profile.runsCreated'), stats?.runs ?? '–')}
          {stat(<Sparkles className="w-5 h-5" />, t('profile.pokemonCaught'), stats?.caught ?? '–')}
          {stat(<Link2 className="w-5 h-5" />, t('profile.soulLinks'), stats?.links ?? '–')}
        </div>

        {/* Edit */}
        <div className="space-y-4">
          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">{t('profile.displayName')}</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={profile?.username} className="pk-input" />
          </div>
          <div>
            <label className="text-slate-300 text-sm font-bold mb-2 block">{t('profile.shinyAvatar')}</label>
            <button type="button" onClick={() => setPickerOpen(true)} className="btn-ghost flex items-center gap-2">
              <Star className="w-4 h-4 text-pk-yellow" /> {t('profile.chooseShiny')}
            </button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-5">
          <div className="flex items-center gap-2 text-red-400 font-black text-sm mb-1"><AlertTriangle className="w-4 h-4" /> {t('profile.danger')}</div>
          <p className="text-slate-500 text-xs mb-3">{t('profile.deleteHint')}</p>
          {!danger ? (
            <button onClick={() => setDanger(true)} className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-bold border border-red-900/60 hover:bg-red-950/40 rounded-xl px-4 py-2 transition-colors">
              <Trash2 className="w-4 h-4" /> {t('profile.deleteAccount')}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-400 text-xs">{t('profile.deleteConfirm')}</p>
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={profile?.username} className="pk-input" />
              <div className="flex gap-2">
                <button onClick={() => { setDanger(false); setConfirmText('') }} className="btn-ghost flex-1 text-sm">{t('common.cancel')}</button>
                <button onClick={handleDelete} disabled={confirmText !== profile?.username || deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold rounded-xl px-4 py-2.5 text-sm transition-colors flex items-center justify-center gap-2">
                  <Trash2 className="w-4 h-4" /> {deleting ? '…' : t('profile.deleteAccount')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {pickerOpen && (
        <ShinyAvatarPicker
          currentId={avatarPokemonId(avatarUrl)}
          onSelect={(url) => { setAvatarUrl(url); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </Modal>
  )
}
