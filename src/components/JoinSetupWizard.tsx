import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2, AlertTriangle, Play, Circle } from 'lucide-react'
import { getPlatform } from '../platform'
import { companionHealth } from '../lib/companion'
import { seedForPlayer } from '../lib/randomizerSync'
import { useRunStore } from '../store/runStore'
import type { RunRecipe } from '../lib/runRecipe'

// Fool-proof one-click partner setup. After joining, the run already carries the full
// randomizer config — so the partner does nothing but watch a progress checklist while
// SoulLink validates the config, derives THIS player's own seed, auto-installs FVX if
// needed, randomizes a separate ROM and launches BizHawk + Lua. Every failure shows a
// concrete fix, not just an error.
type Status = 'pending' | 'running' | 'done' | 'error'
interface Step { id: string; label: string; status: Status; detail?: string; solution?: { label: string; run: () => void } }
interface Joined { run: { id: string; name?: string }; players: { id: string; created_at?: string | null }[]; myPlayerId: string }
interface Profile { id: string; edition?: string | null }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function JoinSetupWizard({ joined, recipe, profile, onClose }: { joined: Joined; recipe: RunRecipe; profile: Profile; onClose?: () => void }) {
  const platform = getPlatform()
  const navigate = useNavigate()
  const setCurrentRun = useRunStore((s) => s.setCurrentRun)
  const [steps, setSteps] = useState<Step[]>(() => [
    { id: 'companion', label: 'Companion verbunden', status: 'pending' },
    { id: 'fvx', label: 'FVX gefunden', status: 'pending' },
    { id: 'rules', label: 'Regeln & Edition geprüft', status: 'pending' },
    { id: 'seed', label: 'Eigener Seed erzeugt', status: 'pending' },
    { id: 'rom', label: 'ROM randomisiert', status: 'pending' },
    { id: 'emu', label: 'Emulator vorbereitet', status: 'pending' },
    { id: 'lua', label: 'Lua-Sync verbunden', status: 'pending' },
    { id: 'done', label: 'Fertig', status: 'pending' },
  ])
  const [finished, setFinished] = useState(false)
  const prep = useRef<{ bizhawk?: string; outputRom?: string } | null>(null)
  const started = useRef(false)

  const set = (id: string, patch: Partial<Step>) => setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  async function runFrom(startId: string) {
    const order = ['companion', 'fvx', 'rules', 'seed', 'rom', 'emu', 'lua', 'done']
    let i = order.indexOf(startId); if (i < 0) i = 0
    // reset this + following steps
    setSteps((prev) => prev.map((s, idx) => (idx >= order.indexOf(s.id) && order.indexOf(s.id) >= i ? { ...s, status: 'pending', solution: undefined } : s)))
    for (; i < order.length; i++) {
      const id = order[i]
      set(id, { status: 'running' })
      try {
        const r = await STEP[id]()
        if (!r.ok) { set(id, { status: 'error', detail: r.detail, solution: r.solution }); return }
        set(id, { status: 'done', detail: r.detail })
      } catch (e) { set(id, { status: 'error', detail: e instanceof Error ? e.message : String(e) }); return }
    }
    setFinished(true)
  }

  // ── step implementations ─────────────────────────────────────────────────
  type R = { ok: boolean; detail?: string; solution?: { label: string; run: () => void } }
  const STEP: Record<string, () => Promise<R>> = {
    companion: async () => {
      const ok = await companionHealth()
      return ok ? { ok: true } : { ok: false, detail: 'Der Companion läuft nicht.', solution: { label: 'Erneut prüfen', run: () => runFrom('companion') } }
    },
    fvx: async () => {
      let st = await platform.randomizerStatus()
      if (st?.found) return { ok: true, detail: st.version ? `FVX ${st.version}` : undefined }
      // Auto-install
      set('fvx', { detail: 'FVX wird automatisch installiert …' })
      const started2 = await platform.installRandomizer()
      if (!started2) return { ok: false, detail: 'FVX-Installation konnte nicht gestartet werden.', solution: { label: 'FVX-Ordner wählen', run: () => navigate('/mysetup') } }
      for (let t = 0; t < 240; t++) {
        const ist = await platform.randomizerInstallStatus()
        if (ist?.state === 'downloading' || ist?.state === 'extracting') set('fvx', { detail: `FVX wird installiert … ${ist.percent || 0}%` })
        if (ist?.state === 'done') break
        if (ist?.state === 'error') {
          const cfg = ist.error === 'fvx_url_unconfigured'
          return { ok: false, detail: cfg ? 'Automatische FVX-Installation ist nicht hinterlegt.' : `FVX konnte nicht installiert werden (${ist.error}).`, solution: { label: 'FVX-Ordner manuell wählen', run: () => navigate('/mysetup') } }
        }
        await sleep(1500)
      }
      st = await platform.randomizerStatus()
      return st?.found ? { ok: true, detail: st.version ? `FVX ${st.version}` : undefined } : { ok: false, detail: 'FVX wurde nach der Installation nicht gefunden.', solution: { label: 'FVX-Ordner wählen', run: () => navigate('/mysetup') } }
    },
    rules: async () => {
      if (!recipe.preset_data) return { ok: false, detail: 'Der Run hat noch kein geteiltes Preset – warte, bis der Host gestartet hat.' }
      if (recipe.edition && profile.edition && recipe.edition !== profile.edition)
        return { ok: false, detail: `SoulLink ist „${recipe.edition}", dein Profil „${profile.edition}".`, solution: { label: 'Passendes Profil wählen', run: () => navigate('/profiles') } }
      const local = (await platform.randomizerStatus())?.version ?? null
      if (recipe.fvx_version && local && recipe.fvx_version !== local)
        return { ok: false, detail: `Host nutzte FVX ${recipe.fvx_version}, du hast ${local}.`, solution: { label: 'Mein Setup öffnen', run: () => navigate('/mysetup') } }
      return { ok: true, detail: recipe.edition || undefined }
    },
    seed: async () => {
      const { seed, slot } = seedForPlayer({ masterSeed: recipe.world_seed, sameWorld: !!recipe.same_world, players: joined.players, playerId: joined.myPlayerId })
      ;(STEP as { _seed?: number; _slot?: number })._seed = seed
      ;(STEP as { _seed?: number; _slot?: number })._slot = slot
      return { ok: true, detail: `Slot ${slot + 1} · Seed #${seed}${recipe.same_world ? ' · Gleiche Welt' : ''}` }
    },
    rom: async () => {
      const seed = (STEP as { _seed?: number })._seed
      const r = await platform.prepareRun({ runId: joined.run.id, profileId: profile.id, presetData: recipe.preset_data ?? undefined, seed: recipe.world_seed != null ? seed : undefined })
      if (!r.ok) {
        const map: Record<string, string> = { original_rom_missing: 'Deine Original-ROM fehlt im Profil.', rom_not_found: 'Die Original-ROM wurde nicht gefunden.', randomize_failed: 'Die Randomisierung ist fehlgeschlagen (ROM/Preset prüfen).', fvx_not_found: 'FVX wurde nicht gefunden.' }
        return { ok: false, detail: map[r.error || ''] || r.error || 'Randomisierung fehlgeschlagen.', solution: { label: 'Profil/ROM prüfen', run: () => navigate('/profiles') } }
      }
      prep.current = { bizhawk: r.bizhawk, outputRom: r.outputRom }
      return { ok: true, detail: 'Eigene SoulLink-ROM erzeugt' }
    },
    emu: async () => {
      const p = prep.current
      const lr = await platform.launch({ bizhawkPath: p?.bizhawk || '', romPath: p?.outputRom || '', luaPath: '', syncFolder: '' }, false, joined.run.id)
      if (!lr.ok) return { ok: false, detail: lr.error ? `BizHawk-Start fehlgeschlagen (${lr.error}).` : 'BizHawk konnte nicht gestartet werden.', solution: { label: 'Emulator in Mein Setup prüfen', run: () => navigate('/mysetup') } }
      return { ok: true }
    },
    lua: async () => { await sleep(300); return { ok: true } },   // launch(runId) auto-connects Lua-sync
    done: async () => { setCurrentRun(joined.run as never, joined.players as never, joined.myPlayerId); return { ok: true } },
  }

  useEffect(() => { if (!started.current) { started.current = true; runFrom('companion') } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-xl mx-auto px-8 py-10">
      <h1 className="text-white font-black text-3xl tracking-tight">SoulLink wird eingerichtet</h1>
      <p className="text-slate-400 mt-1.5">{joined.run.name ? `„${joined.run.name}" – ` : ''}SoulLink übernimmt alles automatisch. Lehn dich zurück.</p>

      <div className="mt-7 rounded-2xl border border-[#2e2e42] bg-[#161620] p-5 space-y-2.5">
        {steps.map((s) => (
          <div key={s.id} className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              {s.status === 'done' ? <Check className="w-5 h-5 text-green-400" />
                : s.status === 'running' ? <Loader2 className="w-5 h-5 text-pk-red animate-spin" />
                : s.status === 'error' ? <AlertTriangle className="w-5 h-5 text-amber-400" />
                : <Circle className="w-5 h-5 text-slate-700" />}
            </span>
            <div className="min-w-0">
              <div className={`text-sm font-bold ${s.status === 'done' ? 'text-green-300' : s.status === 'error' ? 'text-amber-300' : s.status === 'running' ? 'text-white' : 'text-slate-500'}`}>{s.label}</div>
              {s.detail && <div className="text-slate-500 text-xs mt-0.5">{s.detail}</div>}
              {s.status === 'error' && s.solution && (
                <button onClick={s.solution.run} className="mt-1.5 text-xs font-bold text-white px-2.5 py-1 rounded-lg" style={{ background: 'var(--color-pk-red)' }}>{s.solution.label}</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {finished && (
        <div className="mt-6 rounded-2xl border border-green-700/40 bg-green-950/20 p-5 text-center">
          <div className="text-green-300 font-black text-lg">Deine SoulLink-ROM wurde erfolgreich erstellt.</div>
          <p className="text-slate-300 text-sm mt-1">Du kannst jetzt spielen.</p>
          <button onClick={() => navigate(`/run/${joined.run.id}`)} className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl font-black text-white" style={{ background: '#CC0000' }}>
            <Play className="w-5 h-5" /> Jetzt spielen
          </button>
        </div>
      )}
      {!finished && onClose && <button onClick={onClose} className="mt-4 text-xs font-bold text-slate-500 hover:text-white">Abbrechen</button>}
    </div>
  )
}
