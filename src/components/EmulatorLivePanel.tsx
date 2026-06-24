import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff, Loader2, Gamepad2, Heart, Skull, Play, Pause, Plus, Check, MapPin, ChevronDown, ChevronUp, AlertTriangle, Settings } from 'lucide-react'
import { getSpriteUrl, getTypeColor, fetchMoveById, fetchItemName, fetchAbilityName } from '../lib/pokemon-api'
import { STATUS_LABEL_DE, natureName } from '../lib/emulatorSync'
import type { EmulatorMon } from '../lib/emulatorSync'
import { buildLivePrefill, type EncounterPrefill } from '../lib/liveSync'
import { matchRoute, isGameMismatch, emulatorGameLabel } from '../lib/routes'
import EmulatorSettingsModal from './EmulatorSettingsModal'
import EmulatorSetupWizard from './EmulatorSetupWizard'
import { useEmulatorSettings, useEmulatorSettingsStore, isConfigured, launchEmulator, detectEmulator, findFile, fileName, type EmulatorSettings } from '../lib/emulatorSettings'
import { getLearnedRoute, useLocationMap } from '../lib/locationMap'
import LocationMapManager from './LocationMapManager'
import { useEmulatorSync, useEmulatorAgeSec } from '../hooks/useEmulatorSync'
import CompanionVersion from './CompanionVersion'
import { useCompanion } from '../hooks/useCompanion'
import { USES_COMPANION, companionConfig, saveCompanionConfig } from '../lib/companion'
import { DOWNLOADS } from '../lib/downloads'

const ENABLED_KEY = 'soullink-emusync-enabled'
const COLLAPSED_KEY = 'soullink-emusync-collapsed'
const GAME_LABEL: Record<string, string> = { platinum: 'Platinum', heartgold: 'HeartGold', firered: 'FireRed', emerald: 'Emerald', black: 'Black' }
// Chromium browsers (Chrome/Edge/Brave/Opera) allow the HTTPS→localhost
// (Private Network Access) call to the Companion; Firefox/Safari may block it.
const IS_CHROMIUM = typeof navigator !== 'undefined'
  && /Chrome|Chromium|Edg\//.test(navigator.userAgent)
  && !/Firefox|FxiOS/.test(navigator.userAgent)

// Resolves ability / item / move names (by id, cached) for one Pokémon and
// renders the enriched detail. Keyed on the ids so the 1s status ticker doesn't
// cause refetches; cache makes repeats free.
// Isolated leaf: the only element that re-renders every second (for "vor Xs"),
// so the heavy live panel doesn't.
function SyncAge() {
  const age = useEmulatorAgeSec()
  if (age == null) return null
  return <span className="text-slate-500 font-medium"> · vor {age}s</span>
}

function MonRich({ mon, imported, game, currentLocationName, currentLocationId, suppressLocation, onImport }: {
  mon: EmulatorMon
  imported: boolean
  game?: string
  currentLocationName?: string | null
  currentLocationId?: number | null
  suppressLocation?: boolean   // emulator game ≠ run edition → no route/learn
  onImport?: (p: EncounterPrefill, suggestedRoute?: string) => void
}) {
  const [moves, setMoves] = useState<({ name: string; type: string } | null)[]>([])
  const [ability, setAbility] = useState<string | null>(null)
  const [item, setItem] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const moveKey = (mon.moveIds ?? []).join(',')

  useEffect(() => {
    let cancelled = false
    const ids = (mon.moveIds ?? []).filter((x) => x > 0)
    Promise.all(ids.map((id) => fetchMoveById(id))).then((r) => { if (!cancelled) setMoves(r) })
    if (mon.abilityId) fetchAbilityName(mon.abilityId).then((n) => { if (!cancelled) setAbility(n) })
    if (mon.heldItemId) fetchItemName(mon.heldItemId).then((n) => { if (!cancelled) setItem(n) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveKey, mon.abilityId, mon.heldItemId])

  // Build the prefill via the shared live-sync model, then hand it to the EXISTING
  // encounter modal/save-flow (no new system). The user still picks the route.
  async function doImport() {
    if (!onImport) return
    setImporting(true)
    try {
      const res = await buildLivePrefill(mon, {
        game: game ?? '',
        currentLocationName: currentLocationName ?? null,
        currentLocationId: currentLocationId ?? null,
        suppressLocation: !!suppressLocation,
      })
      if (res) onImport(res.prefill, res.route)
    } finally {
      setImporting(false)
    }
  }

  const hpPct = mon.maxHp > 0 ? Math.round((mon.hp / mon.maxHp) * 100) : 0
  const hpColor = hpPct > 50 ? '#4ade80' : hpPct > 20 ? '#fbbf24' : '#f87171'
  const nature = natureName(mon.natureId)
  const title = mon.nickname || `#${mon.speciesId}`

  return (
    <div className={`rounded-xl border p-3 ${mon.fainted ? 'border-red-900/40 bg-red-950/15 opacity-70' : 'border-[#2e2e42] bg-[#1c1c26]'}`}>
      <div className="flex items-center gap-3">
        <img src={getSpriteUrl(mon.speciesId)} alt="" className={`w-12 h-12 object-contain shrink-0 ${mon.fainted ? 'grayscale' : ''}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-white text-sm font-bold capitalize truncate">{title}</span>
            {mon.nickname && <span className="text-slate-500 text-[10px]">#{mon.speciesId}</span>}
            {mon.fainted ? <Skull className="w-3.5 h-3.5 text-red-400 shrink-0" /> : <Heart className="w-3.5 h-3.5 text-green-400 shrink-0" />}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
            <span>Lv {mon.level}</span>
            {mon.status !== 'ok' && <span className="font-bold" style={{ color: '#fbbf24' }}>{STATUS_LABEL_DE[mon.status]}</span>}
          </div>
          {/* HP bar */}
          <div className="mt-1 flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-1.5 rounded-full" style={{ width: `${hpPct}%`, background: hpColor }} />
            </div>
            <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{mon.hp}/{mon.maxHp}</span>
          </div>
        </div>
      </div>

      {/* Enriched detail */}
      <div className="mt-2 pt-2 border-t border-[#2e2e42] space-y-1 text-[10px]">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-400">
          <span>Wesen: <span className="text-slate-200">{nature ?? '—'}</span></span>
          <span>Fähigkeit: <span className="text-slate-200">{ability ?? (mon.abilityId ? '…' : '—')}</span></span>
          <span>Item: <span className="text-slate-200">{item ?? (mon.heldItemId ? '…' : '—')}</span></span>
          {mon.metLocationName && <span>Fangort: <span className="text-slate-200">{mon.metLocationName}</span></span>}
        </div>
        <div className="flex flex-wrap gap-1 pt-0.5">
          {(mon.moveIds ?? []).filter((x) => x > 0).length === 0 ? (
            <span className="text-slate-600">Keine Attacken</span>
          ) : (
            (mon.moveIds ?? []).filter((x) => x > 0).map((id, i) => {
              const mv = moves[i]
              return (
                <span key={id} className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: mv ? getTypeColor(mv.type) : '#3e3e52' }}>
                  {mv ? mv.name : `#${id}`}
                </span>
              )
            })
          )}
        </div>
      </div>

      {onImport && (
        <div className="mt-2">
          {imported ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400">
              <Check className="w-3 h-3" /> Bereits übernommen
            </span>
          ) : (
            <button
              onClick={doImport}
              disabled={importing}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ color: '#CC0000', background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.3)' }}
            >
              <Plus className="w-3 h-3" /> {importing ? 'Übernehme…' : 'Als Encounter übernehmen'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Online only: explains that a local Companion must run so the website (which
 *  can't start BizHawk itself) can launch the emulator + read the live team. */
function CompanionBanner({ status, onRecheck }: { status: 'checking' | 'absent'; onRecheck: () => void }) {
  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2 text-[12px] text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Companion wird gesucht …
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-3">
      <div className="flex items-center gap-1.5 text-amber-300 text-sm font-bold mb-1.5">
        <WifiOff className="w-4 h-4" /> Companion nicht gestartet
      </div>
      {!IS_CHROMIUM && (
        <p className="text-amber-200 text-[12px] leading-relaxed mb-2 font-semibold">
          Bitte öffne diese Seite in <span className="underline">Chrome</span> oder <span className="underline">Edge</span> –
          in Firefox/Safari blockiert der Browser die Verbindung zum lokalen Companion.
        </p>
      )}
      <p className="text-slate-300 text-[12px] leading-relaxed mb-2">
        Der <span className="font-semibold">SoulLink Companion</span> ist eine kleine App auf deinem PC,
        die BizHawk für dich startet. Einmal einrichten, dann läuft alles automatisch:
      </p>
      <ol className="text-slate-300 text-[12px] leading-relaxed list-decimal pl-5 space-y-1 mb-2.5">
        <li>
          <a href={DOWNLOADS.companion} download className="text-amber-300 font-semibold underline underline-offset-2">
            SoulLink Companion herunterladen &amp; installieren
          </a>
        </li>
        <li>Companion starten – er läuft dann unten rechts im <span className="font-semibold">System-Tray</span>.</li>
      </ol>
      <div className="flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300/80 shrink-0" />
        <span className="text-amber-200/90 text-[12px] font-semibold">Läuft der Companion, verbindet sich die Seite automatisch …</span>
      </div>
      <button onClick={onRecheck} className="mt-2 text-slate-400 hover:text-white text-[11px] underline underline-offset-2">Jetzt sofort prüfen</button>
    </div>
  )
}

/** Live in-game party from the local emulator sync. Additive & non-destructive:
 *  it does NOT touch tracked encounters / soul links / the team system. */
export default function EmulatorLivePanel({
  game, runId, onImport, importedSpeciesIds, importedPids,
}: {
  game?: string
  runId?: string
  onImport?: (p: EncounterPrefill, suggestedRoute?: string) => void
  importedSpeciesIds?: Set<number>
  importedPids?: Set<string>
}) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(ENABLED_KEY) !== '0' } catch { return true }
  })
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
  })
  const [showSettings, setShowSettings] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const emuSettings = useEmulatorSettings()
  const settingsHydrated = useEmulatorSettingsStore((s) => s.hydrated)
  const configured = isConfigured(emuSettings)
  const updateSettings = useEmulatorSettingsStore((s) => s.update)
  // Online (Vercel) the emulator endpoints come from a local Companion. Probe it
  // so we can guide the user, and only poll the sync once it's actually reachable
  // (avoids failing localhost requests when no Companion is running).
  const companion = useCompanion(enabled)
  const companionReady = companion.status === 'connected'

  // Phase 2: the Companion remembers BizHawk/ROM/Lua machine-side. Pull them on
  // connect so a configured machine skips the wizard (even in a fresh browser),
  // and push them back when they change so the Companion stays the source of truth.
  const [companionPulled, setCompanionPulled] = useState(!USES_COMPANION)
  useEffect(() => {
    if (!USES_COMPANION || companion.status !== 'connected' || companionPulled) return
    let cancelled = false
    companionConfig().then((cfg) => {
      if (cancelled) return
      if (cfg && !isConfigured(emuSettings)) {
        const patch: Partial<EmulatorSettings> = {}
        if (cfg.config.bizhawk) patch.bizhawkPath = cfg.config.bizhawk
        if (cfg.config.rom) patch.romPath = cfg.config.rom
        if (cfg.config.lua) patch.luaPath = cfg.config.lua
        if (cfg.config.syncFolder) patch.syncFolder = cfg.config.syncFolder
        if (Object.keys(patch).length) updateSettings(patch)
      }
      setCompanionPulled(true)
    }).catch(() => { if (!cancelled) setCompanionPulled(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companion.status, companionPulled])
  useEffect(() => {
    if (!USES_COMPANION || companion.status !== 'connected' || !companionPulled || !configured) return
    const t = setTimeout(() => {
      saveCompanionConfig({ bizhawk: emuSettings.bizhawkPath, rom: emuSettings.romPath, lua: emuSettings.luaPath })
    }, 800)
    return () => clearTimeout(t)
  }, [emuSettings.bizhawkPath, emuSettings.romPath, emuSettings.luaPath, configured, companion.status, companionPulled])

  // First time without setup → open the wizard. In prod wait until we've checked
  // the Companion's saved config (a configured Companion skips the wizard entirely;
  // if the Companion is absent the start-banner guides the user instead).
  const autoOpened = useRef(false)
  useEffect(() => {
    if (!settingsHydrated || configured || autoOpened.current) return
    if (USES_COMPANION && (companion.status !== 'connected' || !companionPulled)) return
    autoOpened.current = true
    setShowWizard(true)
  }, [settingsHydrated, configured, companion.status, companionPulled])

  const { phase, team, game: liveGame, currentLocationName, currentLocationId, runId: syncRunId } = useEmulatorSync(enabled && companionReady)

  // ── One-click launch (▶ Live-Sync starten) ───────────────────────────────
  const [launching, setLaunching] = useState(false)
  const [launchMsg, setLaunchMsg] = useState<string | null>(null)
  const [launchErr, setLaunchErr] = useState<{ msg: string; actionLabel: string; action: () => void } | null>(null)
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const romPick = useRef<HTMLInputElement>(null)
  const bizPick = useRef<HTMLInputElement>(null)

  // Connection established while launching → success, clear the waiting state.
  useEffect(() => {
    if (launching && phase === 'connected') {
      setLaunching(false); setLaunchMsg(null); setLaunchErr(null)
      if (launchTimer.current) { clearTimeout(launchTimer.current); launchTimer.current = null }
    }
  }, [launching, phase])
  useEffect(() => () => { if (launchTimer.current) clearTimeout(launchTimer.current) }, [])

  async function launchSync(restart = false, override?: Partial<EmulatorSettings>) {
    if (!configured) { setShowWizard(true); return }
    if (phase === 'connected') return                          // already connected
    if (!enabled) { setEnabled(true); try { localStorage.setItem(ENABLED_KEY, '1') } catch { /* ignore */ } }
    setLaunchErr(null); setLaunching(true)
    setLaunchMsg(restart ? 'BizHawk wird neu gestartet …' : 'Verbinde …')

    const eff = { ...emuSettings, ...override }   // override = frischer Pfad bei einem internen Retry
    const res = await launchEmulator(eff, restart)
    if (!res.ok) {
      if (res.error === 'rom_not_found') {
        // Self-heal: nach einem Ordner-Umzug kennt der Companion die neue ROM oft
        // schon (aus seiner gespeicherten Config) → automatisch übernehmen, statt
        // den Nutzer neu auswählen zu lassen.
        if (!override) {
          const cfg = await companionConfig()
          if (cfg?.config.rom && cfg.config.rom !== eff.romPath) {
            updateSettings({ romPath: cfg.config.rom }); launchSync(restart, { romPath: cfg.config.rom }); return
          }
        }
        setLaunching(false)
        setLaunchErr({ msg: 'ROM wurde verschoben.', actionLabel: 'Neue ROM auswählen', action: () => romPick.current?.click() })
      } else if (res.error === 'lua_not_found') {
        // Lua fehlt → automatisch erneut suchen, sonst Wizard-Schritt für Lua/Sync.
        const d = await detectEmulator()
        if (d?.lua) { updateSettings({ luaPath: d.lua, syncFolder: d.syncFolder }); launchSync(restart, { luaPath: d.lua }) }
        else { setLaunching(false); setLaunchErr({ msg: 'Sync-Script nicht gefunden.', actionLabel: 'Einrichtung öffnen', action: () => setShowWizard(true) }) }
      } else {
        // BizHawk-Start fehlgeschlagen. Erst den Companion fragen (kennt nach einem
        // Umzug evtl. den neuen Pfad), dann eine VOLLSTÄNDIGE Installation auto-suchen.
        if (!override) {
          const cfg = await companionConfig()
          if (cfg?.config.bizhawk && cfg.config.bizhawk !== eff.bizhawkPath) {
            updateSettings({ bizhawkPath: cfg.config.bizhawk })
            launchSync(restart, { bizhawkPath: cfg.config.bizhawk })
            return
          }
          const better = await findFile(fileName(eff.bizhawkPath) || 'EmuHawk.exe')
          if (better && better !== eff.bizhawkPath) {
            updateSettings({ bizhawkPath: better })
            launchSync(restart, { bizhawkPath: better })
            return
          }
        }
        setLaunching(false)
        const detail = res.detail ? ` ${res.detail}` : ''
        setLaunchErr({ msg: 'BizHawk konnte nicht gestartet werden.' + detail, actionLabel: 'Andere EmuHawk.exe wählen', action: () => bizPick.current?.click() })
      }
      return
    }

    if (res.already) {
      // BizHawk runs but Lua cannot be injected into a running instance. Give the
      // sync a short grace period (maybe it IS already connected), else offer a
      // restart-with-Lua — the only realistic way to auto-load the script.
      setLaunchMsg('Prüfe Verbindung …')
      if (launchTimer.current) clearTimeout(launchTimer.current)
      launchTimer.current = setTimeout(() => {
        setLaunching(false)
        setLaunchErr({
          msg: 'BizHawk läuft bereits. Lua kann nur beim Start automatisch geladen werden. Bitte BizHawk schließen und erneut über Live-Sync starten.',
          actionLabel: 'BizHawk mit Lua neu starten',
          action: () => launchSync(true),
        })
      }, 6000)
      return
    }

    // launched / restarted → wait for the live sync to connect.
    setLaunchMsg(res.restarted ? 'Neu gestartet – warte auf Verbindung …' : 'Warte auf Verbindung …')
    if (launchTimer.current) clearTimeout(launchTimer.current)
    launchTimer.current = setTimeout(() => {
      setLaunching(false)
      setLaunchErr({ msg: 'Keine Verbindung. Läuft BizHawk mit Lua? Notfalls neu starten.', actionLabel: 'BizHawk mit Lua neu starten', action: () => launchSync(true) })
    }, 45000)
  }

  async function reselectRom(file: File | undefined) {
    if (!file) return
    const path = await findFile(file.name)
    if (path) { updateSettings({ romPath: path }); setLaunchErr(null); launchSync() }
    else setLaunchErr({ msg: 'ROM nicht gefunden. Bitte in den Einstellungen festlegen.', actionLabel: 'Einstellungen öffnen', action: () => setShowSettings(true) })
  }

  async function reselectBizhawk(file: File | undefined) {
    if (!file) return
    const path = await findFile(file.name)
    if (path) { updateSettings({ bizhawkPath: path }); setLaunchErr(null); launchSync() }
    else setLaunchErr({ msg: 'EmuHawk.exe nicht gefunden. Bitte in den Einstellungen festlegen.', actionLabel: 'Einstellungen öffnen', action: () => setShowSettings(true) })
  }

  // The RUN edition decides the available routes; the emulator must match it.
  const runGame = game ?? ''
  // BizHawk is still on a DIFFERENT run's ROM (old run open while a new one started).
  // null syncRunId = unknown → assume it's this run. Only fires when we're SURE.
  const wrongRun = phase === 'connected' && runId != null && syncRunId != null && syncRunId !== runId
  // Only flag an edition mismatch once we're actually connected to THIS run — never
  // from a stale game value while still connecting.
  const mismatch = phase === 'connected' && !wrongRun && isGameMismatch(runGame, liveGame)
  useLocationMap(runGame)   // reaktiv: Ort-Anzeige aktualisiert sich nach dem Lernen
  // Aktueller Ort: bei Spiel-Mismatch KEINE Zuordnung (kein falsches Auto-Matching).
  const learnedLoc = !mismatch && currentLocationId != null ? getLearnedRoute(runGame, currentLocationId) : null
  const matchedRoute = mismatch ? null : (learnedLoc ?? (currentLocationName ? matchRoute(currentLocationName, runGame) : null))
  const locText = learnedLoc
    ?? currentLocationName
    ?? (currentLocationId != null ? `Unbekannter Ort (ID ${currentLocationId})` : 'unbekannt')

  function toggle() {
    const v = !enabled
    setEnabled(v)
    try { localStorage.setItem(ENABLED_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }
  function toggleCollapse() {
    const v = !collapsed
    setCollapsed(v)
    try { localStorage.setItem(COLLAPSED_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }

  const gameName = GAME_LABEL[(liveGame ?? game ?? '').toLowerCase()] ?? (liveGame ?? game ?? 'Spiel')

  let icon = <Gamepad2 className="w-4 h-4" />
  let title = ''
  let color = '#64748b'
  if (!enabled) { icon = <WifiOff className="w-4 h-4" />; title = 'Live-Sync deaktiviert'; color = '#64748b' }
  else if (companion.usesCompanion && companion.status === 'absent') { icon = <WifiOff className="w-4 h-4" />; title = 'Companion nicht gestartet'; color = '#fbbf24' }
  else if (companion.usesCompanion && companion.status === 'checking') { icon = <Loader2 className="w-4 h-4 animate-spin" />; title = 'Companion wird gesucht…'; color = '#64748b' }
  else if (phase === 'init') { icon = <Loader2 className="w-4 h-4 animate-spin" />; title = 'Suche Emulator…'; color = '#64748b' }
  else if (phase === 'error') { icon = <WifiOff className="w-4 h-4" />; title = companion.usesCompanion ? 'Companion erreichbar, aber kein Sync' : 'Emulator-Sync nicht erreichbar – läuft „npm run dev"?'; color = '#f87171' }
  else if (phase === 'offline') { icon = <WifiOff className="w-4 h-4" />; title = 'Emulator nicht gefunden'; color = '#94a3b8' }
  else if (phase === 'waiting') { icon = <Loader2 className="w-4 h-4 animate-spin" />; title = 'Datei gefunden – warte auf Pokémon'; color = '#fbbf24' }
  else { icon = <Wifi className="w-4 h-4" />; title = `Verbunden mit ${gameName}`; color = '#4ade80' }
  // BizHawk is on another run → don't claim this run is connected.
  if (wrongRun) { icon = <AlertTriangle className="w-4 h-4" />; title = 'Anderer Run im Emulator'; color = '#fbbf24' }

  const showAge = enabled && !wrongRun && (phase === 'connected' || phase === 'waiting')
  const monCount = enabled && phase === 'connected' && !wrongRun ? team.length : null

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: mismatch ? 'rgba(248,113,113,0.55)' : `${color}40` }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#1c1c26' }}>
        <span style={{ color }}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-slate-200 text-xs font-black uppercase tracking-widest">Emulator Live-Sync</div>
          <div className="text-[11px] font-bold truncate" style={{ color }}>
            {title}
            {monCount != null && <span className="text-slate-400 font-medium"> · {monCount} Pokémon</span>}
            {showAge && <SyncAge />}
          </div>
        </div>
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors border shrink-0"
          style={enabled
            ? { color: '#f87171', background: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.3)' }
            : { color: '#4ade80', background: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' }}
        >
          {enabled ? <><Pause className="w-3 h-3" /> Sync stoppen</> : <><Play className="w-3 h-3" /> Sync starten</>}
        </button>
        <button
          onClick={() => (configured ? setShowSettings(true) : setShowWizard(true))}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Emulator-Einstellungen"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={toggleCollapse}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title={collapsed ? 'Ausklappen' : 'Einklappen'}
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Companion-Update/-Version: nur sichtbar, wenn etwas zu tun ist (Update / Version unbekannt) */}
      <CompanionVersion hideWhenCurrent className="mx-3 mt-3" />

      {showWizard && <EmulatorSetupWizard onClose={() => setShowWizard(false)} />}
      {showSettings && <EmulatorSettingsModal onClose={() => setShowSettings(false)} />}
      <input ref={romPick} type="file" accept=".nds,.gba,.gbc,.gb" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => reselectRom(e.target.files?.[0])} />
      <input ref={bizPick} type="file" accept=".exe" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => reselectBizhawk(e.target.files?.[0])} />

      {/* BizHawk zeigt noch einen anderen Run → freundlicher Hinweis statt Fehler */}
      {enabled && wrongRun && (
        <div className="flex items-start gap-1.5 px-4 py-2 text-[11px] border-t" style={{ background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span className="text-amber-200 font-medium">
            Bitte starte den neuen Run oder öffne die neu erzeugte ROM. Sobald dieser Run im Emulator läuft, verbindet sich SoulLink automatisch.
          </span>
        </div>
      )}

      {/* Spiel-Mismatch — auch im eingeklappten Zustand sichtbar */}
      {enabled && mismatch && (
        <div className="flex items-start gap-1.5 px-4 py-2 text-[11px] border-t" style={{ background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span className="text-amber-200 font-medium">
            Der Emulator zeigt gerade {emulatorGameLabel(liveGame) ?? gameName}, dieser Run ist aber {runGame || '—'}. Bitte öffne die ROM dieses Runs — dann passt alles automatisch zusammen.
          </span>
        </div>
      )}

      {/* ▶ Live-Sync starten — startet BizHawk + ROM + Lua mit einem Klick */}
      {!collapsed && enabled && phase !== 'connected' && (
        <div className="p-3 border-t" style={{ background: '#16161f', borderColor: '#2e2e42' }}>
          {companion.usesCompanion && !companionReady ? (
            <CompanionBanner status={companion.status === 'checking' ? 'checking' : 'absent'} onRecheck={companion.recheck} />
          ) : launchErr ? (
            <div className="rounded-xl border border-red-800/50 bg-red-950/25 p-3">
              <p className="text-red-300 text-sm font-semibold mb-2">{launchErr.msg}</p>
              <button onClick={launchErr.action} className="btn-primary text-xs py-2 px-3">{launchErr.actionLabel}</button>
            </div>
          ) : (
            <>
              <button
                onClick={() => launchSync()}
                disabled={launching}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-70"
                style={{ background: '#CC0000', color: '#fff' }}
              >
                {launching
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> {launchMsg ?? 'Verbinde …'}</>
                  : <><Play className="w-4 h-4" /> Lua-Sync verbinden</>}
              </button>
              <p className="text-slate-500 text-[11px] mt-2 text-center">Lädt das Sync-Script automatisch – startet BizHawk, falls nötig.</p>
            </>
          )}
        </div>
      )}

      {!collapsed && enabled && phase === 'connected' && !mismatch && !wrongRun && (
        <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] border-t" style={{ background: '#16161f', borderColor: '#2e2e42' }}>
          <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: matchedRoute ? '#4ade80' : '#64748b' }} />
          <span className="text-slate-400 font-medium">Aktueller Ort:</span>
          <span className="font-bold" style={{ color: matchedRoute ? '#4ade80' : '#cbd5e1' }}>{locText}</span>
          {matchedRoute
            ? <span className="text-slate-500">→ Route wird beim Import vorgeschlagen</span>
            : currentLocationId != null && <span className="text-slate-500">→ beim Import lernt die App diese Route</span>}
        </div>
      )}

      {!collapsed && enabled && !wrongRun && team.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3" style={{ background: '#161620' }}>
          {team.map((m) => (
            <MonRich
              key={m.slot}
              mon={m}
              imported={(m.pid != null && !!importedPids?.has(String(m.pid))) || !!importedSpeciesIds?.has(m.speciesId)}
              game={game}
              currentLocationName={currentLocationName}
              currentLocationId={currentLocationId}
              suppressLocation={mismatch}
              onImport={onImport}
            />
          ))}
        </div>
      )}

      {!collapsed && enabled && !mismatch && <LocationMapManager game={runGame} />}

      {!collapsed && enabled && team.length === 0 && phase !== 'init' && (
        <div className="px-4 py-3 text-slate-600 text-[11px]" style={{ background: '#161620' }}>
          {phase === 'connected' || phase === 'waiting'
            ? 'Noch keine Pokémon im Team erkannt.'
            : 'BizHawk + Lua starten (soullink_sync.lua) – das Team erscheint automatisch.'}
        </div>
      )}
    </div>
  )
}
