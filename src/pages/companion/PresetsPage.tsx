import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dices, Plus, Upload, Trash2, Pencil, Check, X, Loader2, ExternalLink, ArrowLeft, Star, AlertTriangle, Play, RotateCw } from 'lucide-react'
import { getPlatform } from '../../platform'
import { useProfiles } from '../../hooks/useProfiles'
import { EDITION_OPTIONS, editionLabel, resolveEdition, type EditionKey } from '../../lib/edition'
import type { Preset } from '../../lib/presets'

// Preset management: built-in (shipped, read-only) + custom presets, STRICTLY per edition.
// Custom presets are created in the FVX editor (open FVX, set rules, "Save Settings"),
// auto-imported, then selectable as this edition's default. Back button so you never get
// stuck in this detail page.
export default function PresetsPage() {
  const platform = getPlatform()
  const navigate = useNavigate()
  const { profiles, update } = useProfiles()
  const [presets, setPresets] = useState<Preset[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [presetName, setPresetName] = useState('Eigene Regeln')
  // Presets are edition-bound — created presets are tagged so they only appear for their
  // edition. Default to the last edition the player worked with.
  const [editionKey, setEditionKey] = useState<EditionKey>(() => {
    let last: string | null = null; try { last = localStorage.getItem('soullink:lastEdition') } catch { /* ignore */ }
    return resolveEdition(last) || EDITION_OPTIONS[0].key
  })

  // The "create rules" flow is a small explicit state machine so the user ALWAYS sees
  // where they are: opening FVX → waiting for the save → importing → done (or timeout/error).
  type CreatePhase = 'idle' | 'opening' | 'waiting' | 'importing' | 'done' | 'timeout' | 'error'
  const [phase, setPhase] = useState<CreatePhase>('idle')
  const [phaseMsg, setPhaseMsg] = useState<string | null>(null)
  const watching = phase === 'opening' || phase === 'waiting' || phase === 'importing'
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopPoll = useCallback(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }, [])
  const cancelCreate = useCallback(() => { stopPoll(); setPhase('idle'); setPhaseMsg(null) }, [stopPoll])
  // The interval closure needs the LATEST profiles to auto-select the new preset.
  const profilesRef = useRef(profiles)
  useEffect(() => { profilesRef.current = profiles }, [profiles])

  const reload = useCallback(async () => {
    const list = await platform.listPresets()
    setPresets(list ?? [])
    setLoading(false)
  }, [platform])
  useEffect(() => { reload() }, [reload])
  useEffect(() => () => stopPoll(), [stopPoll])

  // After detection: make the name UI-authoritative (rename to exactly what was typed,
  // regardless of the .rnqs filename) AND auto-select it as this edition's active preset.
  async function finalizeNewPreset(preset: Preset, wantName: string, ek: EditionKey) {
    setPhase('importing')
    let finalName = preset.name
    if (wantName && preset.name !== wantName) {
      try { if (await platform.renamePreset(preset.id, wantName)) finalName = wantName } catch { /* keep import name */ }
    }
    const ep = profilesRef.current.find((p) => resolveEdition(p.edition) === ek) ?? null
    let selected = false
    if (ep) { try { await update(ep.id, { presetId: preset.id }); selected = true } catch { /* not fatal */ } }
    await reload()
    setPhase('done')
    setPhaseMsg(selected
      ? `Regeln erfolgreich übernommen: „${finalName}" ist jetzt das aktive Preset für ${editionLabel(ek)}. Du kannst direkt einen Run starten.`
      : `Regeln erfolgreich übernommen: „${finalName}" wurde für ${editionLabel(ek)} gespeichert. Richte die Edition in „Mein Setup" ein, um sie als Standard zu setzen.`)
  }

  // Open the FVX editor, then WATCH for the .rnqs the user saves and import it
  // automatically — no file dialog, no "where do I save this?".
  async function openEditor() {
    setNotice(null); setPhaseMsg(null); setPhase('opening')
    const ek = editionKey
    const wantName = presetName.trim() || `${editionLabel(ek)}-Regeln`
    const r = await platform.openRandomizer()
    if (!r.ok) {
      setPhase('error')
      setPhaseMsg(r.error === 'fvx_not_found'
        ? 'Der Regel-Editor (FVX) ist noch nicht eingerichtet — richte ihn in „Mein Setup" automatisch ein.'
        : 'Der Regel-Editor konnte nicht geöffnet werden. Versuche es erneut.')
      return
    }
    const since = Date.now() - 3000
    setPhase('waiting')
    let elapsed = 0
    let lastErr: string | null = null
    stopPoll()
    pollRef.current = setInterval(async () => {
      elapsed += 1500
      let res: { preset: Preset | null; detecting: boolean; error?: string | null }
      try { res = await platform.grabRules(since, { name: wantName, edition: ek }) }
      catch { res = { preset: null, detecting: false, error: 'unreachable' } }
      if (res.preset) { stopPoll(); await finalizeNewPreset(res.preset, wantName, ek); return }
      // A file was found but could not be saved as a preset → real, immediate failure.
      if (res.error === 'import_failed') {
        stopPoll(); setPhase('error')
        setPhaseMsg('Eine Regeldatei wurde gefunden, ließ sich aber nicht als Preset speichern. Prüfe, ob es eine gültige .rnqs-Datei ist — oder wähle sie unten manuell aus.')
        return
      }
      if (res.error) lastErr = res.error
      setPhase(res.detecting ? 'importing' : 'waiting')
      if (elapsed >= 30000) {   // clear answer after ~30s, never minutes of silence
        stopPoll(); setPhase('timeout')
        setPhaseMsg(lastErr === 'read_failed'
          ? 'Eine Datei wurde gesehen, konnte aber nicht gelesen werden (evtl. noch gesperrt). Speichere sie erneut — oder wähle die .rnqs unten manuell aus.'
          : 'Ich habe keine gespeicherte Regeldatei gefunden. Klicke in FVX wirklich auf „Save Settings" und speichere die Datei — oder wähle sie unten manuell aus.')
      }
    }, 1500)
  }
  // Manual fallback: pick the .rnqs yourself → imported immediately with the typed name,
  // assigned to the chosen edition and auto-selected (same finalize path as the auto-flow).
  async function pickManual() {
    const ek = editionKey
    const wantName = presetName.trim() || `${editionLabel(ek)}-Regeln`
    const picked = await platform.pickFile('preset')
    if (!picked.path) return   // cancelled → leave the current state untouched
    stopPoll(); setNotice(null); setPhase('importing')
    if (!/\.rnqs$/i.test(picked.path)) { setPhase('error'); setPhaseMsg('Bitte eine FVX-Regeldatei (.rnqs) auswählen.'); return }
    const p = await platform.importPreset({ name: wantName, edition: ek, sourceFile: picked.path })
    if (p) await finalizeNewPreset(p, wantName, ek)
    else { setPhase('error'); setPhaseMsg('Die Datei konnte nicht importiert werden. Ist es eine gültige .rnqs-Datei?') }
  }
  async function saveRename(id: string) {
    const n = editName.trim()
    if (n) { await platform.renamePreset(id, n); await reload() }
    setEditingId(null)
  }
  async function doDelete(id: string) { await platform.deletePreset(id); setConfirmDelete(null); await reload() }

  // STRICTLY the chosen edition's presets, and which one is this edition's default.
  const editionProfile = profiles.find((p) => resolveEdition(p.edition) === editionKey) ?? null
  const activePresetId = editionProfile?.presetId ?? null
  const visible = presets.filter((p) => resolveEdition(p.edition) === editionKey)
  async function setDefault(id: string) { if (editionProfile) await update(editionProfile.id, { presetId: id }) }

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white inline-flex items-center gap-1.5 text-sm font-bold mb-4"><ArrowLeft className="w-4 h-4" /> Zurück</button>
      <h1 className="text-white font-black text-3xl tracking-tight">Spielregeln</h1>
      <p className="text-slate-400 mt-1.5">Deine Regeln bestimmen, <i>wie</i> randomisiert wird (z. B. Pokémon, Trainer, Items zufällig). Der Seed bestimmt das konkrete Ergebnis.</p>

      <div className="mt-5 flex flex-col sm:flex-row gap-3 max-w-2xl">
        <div className="sm:w-56">
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Edition</label>
          <select value={editionKey} disabled={watching} onChange={(e) => setEditionKey(e.target.value as EditionKey)}
            className="mt-1 w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3 py-2 text-sm text-white">
            {EDITION_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Name der Regeln</label>
          <input value={presetName} onChange={(e) => setPresetName(e.target.value)} disabled={watching}
            placeholder="z. B. Hardcore" className="mt-1 w-full rounded-xl bg-[#111116] border border-[#2e2e42] focus:border-pk-red/60 outline-none px-3 py-2 text-sm text-white" />
        </div>
      </div>
      <p className="text-slate-500 text-[11px] mt-1.5">Diese Regeln werden <b className="text-slate-300">{editionLabel(editionKey)}</b> zugeordnet und erscheinen nur dort.</p>
      <div className="flex items-center gap-2.5 mt-3">
        <button onClick={openEditor} disabled={watching} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{ background: '#CC0000' }}>
          {watching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Eigene Regeln erstellen
        </button>
        <button onClick={pickManual} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5">
          <Upload className="w-4 h-4" /> Regeldatei manuell auswählen
        </button>
      </div>
      {notice && <p className="mt-3 text-sm text-slate-300 bg-[#16161f] border border-[#2e2e42] rounded-xl px-3.5 py-2.5 flex items-start gap-2"><ExternalLink className="w-4 h-4 text-pk-red shrink-0 mt-0.5" /> {notice}</p>}

      {/* Guided status: the user always knows whether SoulLink is opening FVX, waiting
          for the save, importing, or done — never a silent spinner or a dead end. */}
      {phase !== 'idle' && (
        <div className="mt-3 rounded-2xl border bg-[#16161f] px-4 py-3.5" style={{ borderColor: phase === 'done' ? 'rgba(74,222,128,0.4)' : phase === 'error' || phase === 'timeout' ? 'rgba(251,191,36,0.4)' : 'rgba(204,0,0,0.35)' }}>
          {(phase === 'opening' || phase === 'waiting' || phase === 'importing') && (
            <>
              <div className="flex items-center gap-2.5 text-white font-bold text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-pk-red shrink-0" />
                {phase === 'opening' ? 'FVX (Regel-Editor) wird geöffnet …'
                  : phase === 'importing' ? 'Regeln erkannt – werden importiert …'
                  : 'Warte auf „Save Settings" in FVX …'}
                <button onClick={cancelCreate} className="ml-auto text-[11px] font-bold text-slate-400 hover:text-white">Abbrechen</button>
              </div>
              <ol className="mt-2.5 space-y-1 text-[12px]">
                <StepRow done label="Editor öffnen" />
                <StepRow done={phase === 'importing'} active={phase === 'waiting'} label={'In FVX Regeln einstellen, dann „Save Settings" → speichern (Ort & Name egal)'} />
                <StepRow active={phase === 'importing'} label="SoulLink erkennt & importiert die Datei automatisch" />
              </ol>
              <button onClick={pickManual} className="mt-2 text-[11px] font-bold text-slate-400 hover:text-white underline-offset-2 hover:underline">Funktioniert nicht? Regeldatei manuell auswählen</button>
            </>
          )}
          {phase === 'done' && (
            <div>
              <div className="flex items-start gap-2.5 text-green-300 font-bold text-sm"><Check className="w-4 h-4 shrink-0 mt-0.5 text-green-400" /> <span>{phaseMsg}</span></div>
              <div className="flex items-center gap-2 mt-3">
                {editionProfile && <button onClick={() => navigate(`/new?edition=${encodeURIComponent(editionKey)}`)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black text-sm text-white" style={{ background: '#CC0000' }}><Play className="w-4 h-4" /> Run starten</button>}
                <button onClick={() => { setPhase('idle'); setPhaseMsg(null) }} className="text-[12px] font-bold text-slate-400 hover:text-white">Schließen</button>
              </div>
            </div>
          )}
          {(phase === 'timeout' || phase === 'error') && (
            <div>
              <div className="flex items-start gap-2.5 text-amber-300 text-sm"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{phaseMsg}</span></div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button onClick={openEditor} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm text-white" style={{ background: '#CC0000' }}><RotateCw className="w-4 h-4" /> Erneut versuchen</button>
                <button onClick={pickManual} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm text-slate-200 border border-[#3a3a4e] hover:bg-white/5"><Upload className="w-4 h-4" /> Regeldatei manuell auswählen</button>
                <button onClick={cancelCreate} className="text-[12px] font-bold text-slate-400 hover:text-white">Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Spielregeln werden geladen…</div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2e2e42] bg-[#16161f] p-6 text-center text-slate-400 text-sm">Für {editionLabel(editionKey)} gibt es noch keine Regeln. Lege oben welche an.</div>
        ) : visible.map((p) => {
          const isActive = p.id === activePresetId
          return (
          <div key={p.id} className="rounded-2xl border bg-[#16161f] p-4 flex items-center gap-3" style={{ borderColor: isActive ? 'rgba(74,222,128,0.5)' : '#2e2e42' }}>
            <Dices className="w-5 h-5 shrink-0" style={{ color: isActive ? '#4ade80' : '#94a3b8' }} />
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
                  {p.edition && <span className="text-[11px] text-slate-500">{editionLabel(p.edition)}</span>}
                </div>
              )}
              {p.description && editingId !== p.id && <p className="text-slate-500 text-xs mt-0.5">{p.description}</p>}
            </div>
            {editingId !== p.id && (isActive
              ? <span className="inline-flex items-center gap-1 text-[11px] font-black text-green-400 shrink-0"><Star className="w-3.5 h-3.5" style={{ fill: '#4ade80' }} /> Aktiv</span>
              : <button onClick={() => setDefault(p.id)} disabled={!editionProfile} title={editionProfile ? 'Als Standard für diese Edition' : 'Edition zuerst in „Mein Setup“ einrichten'} className="text-[11px] font-bold text-white px-2.5 py-1.5 rounded-lg shrink-0 disabled:opacity-40" style={{ background: 'var(--color-pk-red)' }}>Auswählen</button>
            )}
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
          )
        })}
      </div>
    </div>
  )
}

function StepRow({ done = false, active = false, label }: { done?: boolean; active?: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2">
      {done ? <Check className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" /> : active ? <Loader2 className="w-3.5 h-3.5 animate-spin text-pk-red mt-0.5 shrink-0" /> : <span className="w-3.5 h-3.5 rounded-full border border-[#3a3a4e] mt-0.5 shrink-0" />}
      <span className={done ? 'text-green-300' : active ? 'text-white font-semibold' : 'text-slate-500'}>{label}</span>
    </li>
  )
}
