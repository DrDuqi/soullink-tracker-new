import { useCallback, useEffect, useRef, useState } from 'react'
import { Dices, Plus, Upload, Trash2, Pencil, Check, X, Loader2, ExternalLink } from 'lucide-react'
import { getPlatform } from '../../platform'
import type { Preset } from '../../lib/presets'

// Preset management: built-in (shipped, read-only) + custom presets. Custom presets
// are created in the FVX editor (Stufe 1) — open FVX, set rules, "Save Settings",
// then import the .rnqs here — or imported/renamed/deleted directly. The own in-app
// editor (Stufe 2) can replace the FVX step later without changing this page.
export default function PresetsPage() {
  const platform = getPlatform()
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [presetName, setPresetName] = useState('Eigene Regeln')

  const [watching, setWatching] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopWatch = useCallback(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } setWatching(false) }, [])

  const reload = useCallback(async () => {
    const list = await platform.listPresets()
    setPresets(list ?? [])
    setLoading(false)
  }, [platform])
  useEffect(() => { reload() }, [reload])
  useEffect(() => () => stopWatch(), [stopWatch])

  // Open the FVX editor, then WATCH for the .rnqs the user saves and import it
  // automatically — no file dialog, no "where do I save this?".
  async function openEditor() {
    setNotice(null)
    const r = await platform.openRandomizer()
    if (!r.ok) { setNotice(r.error === 'fvx_not_found' ? 'Der Regel-Editor wurde noch nicht eingerichtet.' : 'Der Editor konnte nicht geöffnet werden.'); return }
    setNotice('Der Regel-Editor öffnet sich. Stelle deine Regeln ein und klicke „Save Settings" — Ordner und Dateiname sind egal, SoulLink übernimmt die Datei automatisch.')
    const since = Date.now() - 3000
    const name = presetName.trim() || 'Eigene Regeln'
    let elapsed = 0
    stopWatch(); setWatching(true)
    pollRef.current = setInterval(async () => {
      elapsed += 3000
      const p = await platform.grabRules(since, { name })
      if (p) { stopWatch(); setNotice(`Deine Regeln „${p.name}" wurden automatisch übernommen.`); await reload() }
      else if (elapsed >= 240000) { stopWatch() }   // give up after 4 min
    }, 3000)
  }
  async function importPreset() {
    setBusy(true); setNotice(null)
    const picked = await platform.pickFile('preset')
    if (picked.path) {
      const base = picked.path.split(/[\\/]/).pop()?.replace(/\.rnqs$/i, '') || 'Eigene Regeln'
      const p = await platform.importPreset({ name: base, sourceFile: picked.path })
      setNotice(p ? `Regeln „${p.name}" importiert.` : 'Import fehlgeschlagen.')
      await reload()
    }
    setBusy(false)
  }
  async function saveRename(id: string) {
    const n = editName.trim()
    if (n) { await platform.renamePreset(id, n); await reload() }
    setEditingId(null)
  }
  async function doDelete(id: string) { await platform.deletePreset(id); setConfirmDelete(null); await reload() }

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <h1 className="text-white font-black text-3xl tracking-tight">Spielregeln</h1>
      <p className="text-slate-400 mt-1.5">Deine Regeln bestimmen, <i>wie</i> randomisiert wird (z. B. Pokémon, Trainer, Items zufällig). Der Seed bestimmt das konkrete Ergebnis.</p>

      <div className="mt-5">
        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Name der Regeln</label>
        <input value={presetName} onChange={(e) => setPresetName(e.target.value)} disabled={watching}
          placeholder="z. B. Pokémon Platin – LeonValon"
          className="mt-1 w-full max-w-md rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3 py-2 text-sm text-white" />
      </div>
      <div className="flex items-center gap-2.5 mt-3">
        <button onClick={openEditor} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: '#CC0000' }}>
          <Plus className="w-4 h-4" /> Eigene Regeln erstellen
        </button>
        <button onClick={importPreset} disabled={busy} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5 disabled:opacity-40">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Regeln importieren
        </button>
      </div>
      {notice && <p className="mt-3 text-sm text-slate-300 bg-[#16161f] border border-[#2e2e42] rounded-xl px-3.5 py-2.5 flex items-start gap-2"><ExternalLink className="w-4 h-4 text-pk-red shrink-0 mt-0.5" /> {notice}</p>}
      {watching && (
        <div className="mt-2 text-sm text-slate-300 bg-[#16161f] border border-pk-red/30 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-pk-red shrink-0" />
          <span className="flex-1">Warte auf deine gespeicherten Regeln … sobald du in FVX „Save Settings" klickst, übernehme ich sie automatisch.</span>
          <button onClick={stopWatch} className="text-[11px] font-bold text-slate-400 hover:text-white">Abbrechen</button>
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Spielregeln werden geladen…</div>
        ) : presets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2e2e42] bg-[#16161f] p-6 text-center text-slate-400 text-sm">Noch keine Regeln vorhanden.</div>
        ) : presets.map((p) => (
          <div key={p.id} className="rounded-2xl border border-[#2e2e42] bg-[#16161f] p-4 flex items-center gap-3">
            <Dices className="w-5 h-5 text-slate-400 shrink-0" />
            <div className="min-w-0 flex-1">
              {editingId === p.id ? (
                <div className="flex items-center gap-2">
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveRename(p.id); if (e.key === 'Escape') setEditingId(null) }}
                    className="rounded-lg bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-2.5 py-1.5 text-sm text-white max-w-xs" />
                  <button onClick={() => saveRename(p.id)} className="text-green-400 hover:text-green-300 p-1"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-bold">{p.name}</span>
                  {p.builtin
                    ? <span className="text-[10px] font-black uppercase tracking-wide text-pk-yellow bg-pk-yellow/10 px-1.5 py-0.5 rounded">Standard</span>
                    : <span className="text-[10px] font-black uppercase tracking-wide text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">eigenes</span>}
                  {p.edition && <span className="text-[11px] text-slate-500">{p.edition}</span>}
                </div>
              )}
              {p.description && editingId !== p.id && <p className="text-slate-500 text-xs mt-0.5">{p.description}</p>}
            </div>
            {!p.builtin && editingId !== p.id && (
              confirmDelete === p.id ? (
                <span className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => doDelete(p.id)} className="text-[11px] font-bold text-red-300 border border-red-700/50 rounded-lg px-2.5 py-1">Löschen</button>
                  <button onClick={() => setConfirmDelete(null)} className="text-[11px] font-bold text-slate-400 border border-[#3a3a4e] rounded-lg px-2.5 py-1">Abbrechen</button>
                </span>
              ) : (
                <span className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditingId(p.id); setEditName(p.name) }} className="text-slate-400 hover:text-white p-1.5" aria-label="Umbenennen"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setConfirmDelete(p.id)} className="text-slate-400 hover:text-red-300 p-1.5" aria-label="Löschen"><Trash2 className="w-4 h-4" /></button>
                </span>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
