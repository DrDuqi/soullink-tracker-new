import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Check, Trash2, Copy, Pencil, Users, X, Loader2, Download, UserPlus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useProfiles } from '../hooks/useProfiles'
import { useCompanion } from '../hooks/useCompanion'
import AtmosphereBackground from '../components/AtmosphereBackground'
import CompanionVersion from '../components/CompanionVersion'
import { DOWNLOADS } from '../lib/downloads'
import { IN_COMPANION_WINDOW } from '../lib/companion'

const btnRed = 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white transition-transform active:scale-[0.98] disabled:opacity-40'
const btnGhost = 'flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs text-slate-200 border border-[#3a3a4e] hover:bg-white/5 transition-colors disabled:opacity-40'
const inputCls = 'w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600'

export default function ProfilesPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const companion = useCompanion(true)
  const { profiles, activeId, loading, available, create, update, remove, duplicate, select } = useProfiles()

  // create form
  const [name, setName] = useState('')
  const [players, setPlayers] = useState<string[]>(['', ''])
  const [creating, setCreating] = useState(false)
  // inline rename + delete confirm
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { if (!authLoading && !user) navigate('/') }, [authLoading, user, navigate])
  if (authLoading || !user) return null

  const setPlayer = (i: number, v: string) => setPlayers((ps) => ps.map((p, j) => (j === i ? v : p)))
  const addPlayer = () => setPlayers((ps) => (ps.length < 4 ? [...ps, ''] : ps))
  const removePlayer = (i: number) => setPlayers((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : ps))

  async function submitCreate() {
    const cleanName = name.trim()
    if (!cleanName) return
    setCreating(true)
    await create({ name: cleanName, players: players.map((p) => p.trim()).filter(Boolean) })
    setCreating(false)
    setName(''); setPlayers(['', ''])
  }
  async function saveRename(id: string) {
    const n = editName.trim()
    if (n) { setBusyId(id); await update(id, { name: n }); setBusyId(null) }
    setEditingId(null)
  }
  async function withBusy(id: string, fn: () => Promise<unknown>) { setBusyId(id); await fn(); setBusyId(null) }

  return (
    <>
      {!IN_COMPANION_WINDOW && <AtmosphereBackground />}
      <div className="relative z-10 min-h-screen flex flex-col">
        {!IN_COMPANION_WINDOW && (
          <header className="sticky top-0 z-40 border-b border-white/5 backdrop-blur-2xl" style={{ background: 'rgba(17,17,22,0.92)' }}>
            <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center gap-3">
              <button onClick={() => navigate('/')} className="text-slate-500 hover:text-white p-1.5 hover:bg-white/5 rounded-xl transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <Users className="w-5 h-5 text-pk-red hidden sm:block" />
              <div>
                <h1 className="text-white font-black text-base leading-tight">SoulLink-Profile</h1>
                <p className="text-slate-500 text-xs">Pro Mitspieler ein Profil – Pfade & Einstellungen automatisch parat</p>
              </div>
            </div>
          </header>
        )}

        <main className="max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
          {IN_COMPANION_WINDOW && <h1 className="text-white font-black text-2xl">Profile</h1>}
          {!available ? (
            <div className="rounded-2xl border border-[#2e2e42] bg-[#16161f] p-6 text-center">
              <p className="text-white font-black text-lg mb-1">Profile brauchen den SoulLink Companion</p>
              <p className="text-slate-400 text-sm mb-4">
                {companion.usesCompanion
                  ? 'Starte den Companion (Symbol unten rechts im System-Tray), dann erscheinen deine Profile hier automatisch.'
                  : 'In der Entwicklungs-Vorschau gibt es keinen lokalen Companion – Profile sind nur in der installierten App verfügbar.'}
              </p>
              {companion.usesCompanion && (
                <a href={DOWNLOADS.companion} download className={btnRed + ' mx-auto w-fit'} style={{ background: '#CC0000' }}>
                  <Download className="w-4 h-4" /> SoulLink Companion herunterladen
                </a>
              )}
              <div className="mt-3"><CompanionVersion /></div>
            </div>
          ) : (
            <>
              {/* existing profiles */}
              {loading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Profile werden geladen…</div>
              ) : profiles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#2e2e42] bg-[#16161f] p-6 text-center text-slate-400 text-sm">
                  Noch kein Profil. Lege unten dein erstes an – z. B. „Valon + Leon“.
                </div>
              ) : (
                <div className="space-y-3">
                  {profiles.map((p) => {
                    const isActive = p.id === activeId
                    const busy = busyId === p.id
                    return (
                      <div key={p.id} className="rounded-2xl border p-4" style={{ background: '#16161f', borderColor: isActive ? 'rgba(204,0,0,0.5)' : '#2e2e42' }}>
                        <div className="flex items-start gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            {editingId === p.id ? (
                              <div className="flex items-center gap-2">
                                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') saveRename(p.id); if (e.key === 'Escape') setEditingId(null) }}
                                  className={inputCls + ' max-w-xs'} />
                                <button onClick={() => saveRename(p.id)} className="text-green-400 hover:text-green-300 p-1"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-white font-black text-lg">{p.name}</h3>
                                {isActive && <span className="text-[11px] font-bold text-pk-red border border-pk-red/40 rounded-full px-2 py-0.5">aktiv</span>}
                              </div>
                            )}
                            {p.players.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {p.players.map((pl, i) => (
                                  <span key={i} className="text-[11px] font-bold text-slate-300 bg-white/5 border border-[#2e2e42] rounded-full px-2 py-0.5">{pl}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {busy && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        </div>

                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {!isActive && <button onClick={() => withBusy(p.id, () => select(p.id))} disabled={busy} className={btnRed} style={{ background: '#CC0000' }}><Check className="w-3.5 h-3.5" /> Auswählen</button>}
                          <button onClick={() => { setEditingId(p.id); setEditName(p.name) }} disabled={busy} className={btnGhost}><Pencil className="w-3.5 h-3.5" /> Umbenennen</button>
                          <button onClick={() => withBusy(p.id, () => duplicate(p.id))} disabled={busy} className={btnGhost}><Copy className="w-3.5 h-3.5" /> Duplizieren</button>
                          {confirmDelete === p.id ? (
                            <span className="flex items-center gap-1.5">
                              <button onClick={() => withBusy(p.id, () => remove(p.id))} disabled={busy} className={btnGhost + ' text-red-300 border-red-700/50'}>Wirklich löschen</button>
                              <button onClick={() => setConfirmDelete(null)} className={btnGhost}>Abbrechen</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDelete(p.id)} disabled={busy} className={btnGhost + ' text-slate-400 hover:text-red-300'}><Trash2 className="w-3.5 h-3.5" /> Löschen</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* create new */}
              <div className="rounded-2xl border border-[#2e2e42] bg-[#1c1c26] p-5">
                <h3 className="text-white font-black text-base mb-3">Neues Profil</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-400 text-xs font-bold block mb-1.5">Profilname</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Valon + Leon" className={inputCls} />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs font-bold block mb-1.5">Mitspieler</label>
                    <div className="space-y-2">
                      {players.map((pl, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input value={pl} onChange={(e) => setPlayer(i, e.target.value)} placeholder={`Spieler ${i + 1}`} className={inputCls} />
                          {players.length > 1 && <button onClick={() => removePlayer(i)} className="text-slate-500 hover:text-red-300 p-1.5"><X className="w-4 h-4" /></button>}
                        </div>
                      ))}
                    </div>
                    {players.length < 4 && <button onClick={addPlayer} className="mt-2 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5" /> Spieler hinzufügen</button>}
                  </div>
                  <button onClick={submitCreate} disabled={!name.trim() || creating} className={btnRed} style={{ background: '#CC0000' }}>
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Profil erstellen
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}
