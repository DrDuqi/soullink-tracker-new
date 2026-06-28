// SoulLink Companion — Electron tray app.
//
// Goal: the user never opens a terminal. Install → it starts (optionally at login)
// → runs in the background with a tray icon → the website auto-detects it on
// 127.0.0.1:8787. No window is ever shown.
//
// It reuses the EXACT same HTTP/launch/sync/config logic as `npm run companion`
// by dynamically importing emulator/companion/server.mjs (bundled as a resource),
// so there is one implementation and no drift.

const { app, Tray, Menu, shell, nativeImage, Notification, dialog, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')

const WEBSITE = 'https://soullink-tracker-new.vercel.app'

let tray = null
let win = null                  // the main app window (created after the server is up)
let quitting = false            // true → a window 'close' really quits (else hide to tray)
let companionPort = 8787        // actual port the server bound (for the window URL)
let serverState = 'starting'   // 'starting' | 'running' | 'shared' | 'error'
let serverMod = null           // the imported server.mjs (exposes dev helpers)
let pickInFlight = false        // guard: only one native file dialog at a time

// ── Startup diagnostics ──────────────────────────────────────────────────────
// Every launch writes a fresh startup.log so a failed start can be diagnosed from
// a file instead of a console the user never sees. Lives in userData (always
// writable). Each step is logged; any exception writes message + code + stacktrace.
let STARTUP_LOG = null
function startupLogPath() {
  if (STARTUP_LOG) return STARTUP_LOG
  try { STARTUP_LOG = path.join(app.getPath('userData'), 'startup.log') }
  catch { STARTUP_LOG = path.join(__dirname, 'startup.log') }
  return STARTUP_LOG
}
function slog(line) {
  try { fs.appendFileSync(startupLogPath(), `[${new Date().toISOString()}] ${line}\n`) } catch { /* ignore */ }
}
function slogErr(label, e) {
  slog(`✗ ${label} FEHLGESCHLAGEN: ${e && e.code ? '[' + e.code + '] ' : ''}${(e && e.message) || e}`)
  if (e && e.stack) slog('STACK:\n' + e.stack)
}
// Catch-all: anything unhandled (incl. errors before/around startup) lands in the log.
process.on('uncaughtException', (e) => { slogErr('uncaughtException', e) })
process.on('unhandledRejection', (e) => { slogErr('unhandledRejection', e) })

// Only one instance — a second launch quietly exits; the first keeps serving.
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0) }

// server.mjs + the Lua live in resources/ when packaged, in the repo in dev.
const serverPath = app.isPackaged
  ? path.join(process.resourcesPath, 'companion', 'server.mjs')
  : path.join(__dirname, '..', 'emulator', 'companion', 'server.mjs')
const luaSrc = app.isPackaged
  ? path.join(process.resourcesPath, 'companion', 'soullink_sync.lua')
  : path.join(__dirname, '..', 'emulator', 'bizhawk', 'soullink_sync.lua')

function trayImage() {
  const png = path.join(__dirname, 'assets', 'icon.png')
  const img = nativeImage.createFromPath(png)
  return img.isEmpty() ? nativeImage.createEmpty() : img
}

function autoStartEnabled() {
  try { return app.getLoginItemSettings().openAtLogin } catch { return false }
}
function setAutoStart(enabled) {
  // args:['--hidden'] → a login-start runs silently in the tray (no window popping
  // up on every boot); the user opens the window themselves when they want it.
  try { app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true, args: ['--hidden'] }) } catch { /* ignore */ }
  refreshTray()
}

function statusLabel() {
  if (serverState === 'running') return 'Companion läuft · bereit'
  if (serverState === 'shared') return 'Anderer Companion läuft bereits'
  if (serverState === 'error') return 'Fehler – siehe Logs'
  return 'Companion startet …'
}

// Developer-only tray section. Returns [] for normal users (no dev log dir → the
// section is never shown), so it can never confuse or affect a normal install.
function devMenu() {
  let dir = null
  try { dir = serverMod && serverMod.getDevLogDir && serverMod.getDevLogDir() } catch { dir = null }
  if (!dir) return []
  const ensure = () => { try { fs.mkdirSync(dir, { recursive: true }) } catch { /* ignore */ } }
  return [
    { type: 'separator' },
    { label: 'Entwickler', submenu: [
      { label: 'Status: Developer Mode aktiv', enabled: false },
      { type: 'separator' },
      { label: 'Logs öffnen', click: () => { ensure(); shell.openPath(dir) } },
      { label: 'Aktuelle Log-Datei öffnen', click: () => { ensure(); shell.openPath(path.join(dir, 'current.log')) } },
      { label: 'Diagnose exportieren', click: async () => {
        try {
          const r = await serverMod.buildDiagnose()
          if (r && r.zip) { shell.showItemInFolder(r.zip); notify('SoulLink Diagnose', 'ZIP erstellt: ' + path.basename(r.zip)) }
          else notify('SoulLink Diagnose', 'Export fehlgeschlagen' + (r && r.error ? ' (' + r.error + ')' : ''))
        } catch { notify('SoulLink Diagnose', 'Export fehlgeschlagen') }
      } },
      { label: 'Logs löschen', click: () => { const ok = serverMod.clearDevLogs(); notify('SoulLink Diagnose', ok ? 'Logs gelöscht.' : 'Konnte Logs nicht löschen.') } },
    ] },
  ]
}

function refreshTray() {
  if (!tray) return
  tray.setToolTip('SoulLink Companion — ' + statusLabel())
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'SoulLink öffnen', click: () => showWindow() },
    { type: 'separator' },
    { label: statusLabel(), enabled: false },
    { label: `Version ${app.getVersion()}`, enabled: false },
    { label: 'Nach Updates suchen …', click: () => checkForUpdatesManual() },
    { label: 'Was ist neu? (Changelog)', click: () => shell.openExternal(CHANGELOG_URL) },
    { label: 'Landing-Website öffnen', click: () => shell.openExternal(WEBSITE) },
    { label: 'Mit Windows starten', type: 'checkbox', checked: autoStartEnabled(), click: (mi) => setAutoStart(mi.checked) },
    ...devMenu(),
    { type: 'separator' },
    { label: 'Beenden', click: () => { quitting = true; app.quit() } },
  ]))
}

function notify(title, body) {
  try { if (Notification.isSupported()) new Notification({ title, body }).show() } catch { /* ignore */ }
}

// Native file dialog for the setup wizard (the browser picker can't reveal real
// paths). Returns an absolute path or null (cancelled). Called by the server via
// the pickFile hook passed to startCompanion.
//
// This app has NO window, so dialog.showOpenDialog() has no parent to attach to —
// on Windows the dialog then frequently opens BEHIND the browser and the user
// thinks the button did nothing. Fix: create a transient, invisible, always-on-top
// parent window, anchor the dialog to it (so it is brought to the foreground), and
// destroy the window the moment the dialog closes. A 1×1 opacity-0 window is never
// actually seen, so the "no window ever shown" principle still holds.
async function pickFile({ kind, defaultPath }) {
  if (pickInFlight) return null            // a dialog is already open → ignore re-clicks
  pickInFlight = true
  const filters = kind === 'biz'
    ? [{ name: 'BizHawk (EmuHawk.exe)', extensions: ['exe'] }, { name: 'Alle Dateien', extensions: ['*'] }]
    : kind === 'preset'
      ? [{ name: 'Randomizer-Preset', extensions: ['rnqs'] }, { name: 'Alle Dateien', extensions: ['*'] }]
      : [{ name: 'Pokémon-ROM', extensions: ['nds', 'gba', 'gbc', 'gb'] }, { name: 'Alle Dateien', extensions: ['*'] }]
  const title = kind === 'biz' ? 'EmuHawk.exe auswählen' : kind === 'preset' ? 'Randomizer-Preset (.rnqs) auswählen' : 'Pokémon-ROM auswählen'
  let anchor = null
  try {
    anchor = new BrowserWindow({
      width: 1, height: 1, show: false, frame: false, transparent: true, opacity: 0,
      skipTaskbar: true, resizable: false, movable: false, minimizable: false,
      maximizable: false, focusable: true, alwaysOnTop: true,
    })
    anchor.setAlwaysOnTop(true, 'screen-saver')
    try { app.focus({ steal: true }) } catch { /* ignore */ }
    anchor.show(); anchor.focus()
    const r = await dialog.showOpenDialog(anchor, { title, defaultPath: defaultPath || undefined, properties: ['openFile'], filters })
    return (!r.canceled && r.filePaths && r.filePaths[0]) ? r.filePaths[0] : null
  } catch {
    return null
  } finally {
    try { if (anchor && !anchor.isDestroyed()) anchor.destroy() } catch { /* ignore */ }
    pickInFlight = false
  }
}

// The main app window. Loads the React app the Companion itself serves on
// 127.0.0.1 (same origin as /api → no CORS, the WebBridge just works). Closing
// hides to the tray (Discord-style); the app only quits via the tray's "Beenden".
function appUrl() { return `http://127.0.0.1:${companionPort}/` }
function createWindow(show) {
  if (win && !win.isDestroyed()) { if (show) { win.show(); win.focus() } return win }
  win = new BrowserWindow({
    width: 1120, height: 740, minWidth: 900, minHeight: 600,
    show: false, backgroundColor: '#0b0b10', title: 'SoulLink Companion',
    // Native Windows window controls (real min/max/close) drawn as an overlay on top
    // of our custom title bar → genuine OS behaviour: Snap Layouts on the maximize
    // button, double-click to maximize, drag-to-move, drag-to-edge snap, taskbar.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0b0b10', symbolColor: '#9aa4b2', height: 36 },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  })
  const url = appUrl()
  slog(`Fenster lädt ${url}`)
  win.loadURL(url).catch((e) => slogErr('Fenster-Load', e))
  win.once('ready-to-show', () => { if (show) { win.show(); win.focus() } slog('✓ Fenster bereit') })
  // Tell the custom title bar when the maximize state changes (icon swap).
  win.on('maximize', () => { try { win.webContents.send('win:maximize-changed', true) } catch { /* ignore */ } })
  win.on('unmaximize', () => { try { win.webContents.send('win:maximize-changed', false) } catch { /* ignore */ } })
  // External links open in the system browser; the app window stays on the app.
  win.webContents.setWindowOpenHandler(({ url: u }) => { if (u) shell.openExternal(u); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, u) => { if (u && !u.startsWith(`http://127.0.0.1:${companionPort}`)) { e.preventDefault(); shell.openExternal(u) } })
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide() } })
  return win
}
function showWindow() {
  if (serverState === 'error') { notify('SoulLink Companion', 'Server nicht gestartet — siehe startup.log.'); return }
  createWindow(true)
}
ipcMain.on('win:minimize', () => { if (win && !win.isDestroyed()) win.minimize() })
ipcMain.on('win:toggle-maximize', () => { if (win && !win.isDestroyed()) { win.isMaximized() ? win.unmaximize() : win.maximize() } })
ipcMain.on('win:close', () => { if (win && !win.isDestroyed()) win.close() })
ipcMain.handle('win:is-maximized', () => !!(win && !win.isDestroyed() && win.isMaximized()))
ipcMain.handle('app:version', () => app.getVersion())
// In-app (Settings) update check: returns the RESULT so the React UI can show
// "✓ aktuell" or "neue Version → Jetzt aktualisieren" — no native dialog, no download.
ipcMain.handle('app:check-updates', async () => {
  const current = app.getVersion()
  if (!app.isPackaged) return { state: 'dev', current }
  const au = getUpdater(); if (!au) return { state: 'error', current, error: 'Updater nicht verfügbar' }
  wireUpdater(au)
  _suppressDialog = true
  try {
    const r = await au.checkForUpdates()
    const latest = (r && r.updateInfo && r.updateInfo.version) || null
    const available = !!(latest && semverGt(latest, current))
    let notes = (r && r.updateInfo && r.updateInfo.releaseNotes) || null
    if (Array.isArray(notes)) notes = notes.map((n) => (n && n.note) || '').join('\n')
    return { state: available ? 'available' : 'current', current, latest, notes, date: (r && r.updateInfo && r.updateInfo.releaseDate) || null }
  } catch (e) { slogErr('app:check-updates', e); return { state: 'error', current, error: (e && e.message) || String(e) } }
  finally { _suppressDialog = false }
})
// In-app "Jetzt aktualisieren": download then quit+install (reuses the wired flow).
ipcMain.on('app:start-update', () => {
  const au = getUpdater(); if (!au) return
  wireUpdater(au); _updateAccepted = true
  notify('SoulLink Companion', 'Update wird heruntergeladen …')
  au.downloadUpdate().catch((e) => { slogErr('app:start-update', e); notify('SoulLink Companion', 'Update-Download fehlgeschlagen.') })
})

async function startServer() {
  const userData = app.getPath('userData')
  slog(`userData = ${userData}`)
  // The Lua writes its team JSON next to itself, so it must live in a WRITABLE
  // folder (resources/ is read-only). Copy it into userData on every launch (so
  // app updates also ship a fresh Lua) and point the server there.
  const luaDst = path.join(userData, 'soullink_sync.lua')
  try { fs.copyFileSync(luaSrc, luaDst); process.env.SOULLINK_LUA = luaDst; slog('✓ Lua kopiert') }
  catch (e) { console.error('[companion] Lua-Kopie fehlgeschlagen:', e); slogErr('Lua-Kopie', e) }
  process.env.SOULLINK_COMPANION_CONFIG = path.join(userData, 'companion-config.json')

  try {
    slog(`Schritt: server.mjs importieren … (existiert: ${fs.existsSync(serverPath)})`)
    serverMod = await import(pathToFileURL(serverPath).href)
    slog('✓ server.mjs importiert')
    slog('Schritt: startCompanion() …')
    const server = await serverMod.startCompanion({ quiet: true, pickFile, version: app.getVersion(), log: slog })
    serverState = 'running'
    try { const a = server && server.address(); if (a && typeof a === 'object' && a.port) companionPort = a.port } catch { /* keep default */ }
    slog(`✓ HTTP-Server gestartet (Port ${companionPort})`)
  } catch (e) {
    if (e && e.code === 'EADDRINUSE') {
      // Port already served (e.g. `npm run companion` is open) — that's fine, the
      // website still works; this instance just rides along in the tray.
      serverState = 'shared'
      slog('✓ Port belegt → teile bestehenden Companion (kein Fehler)')
    } else {
      serverState = 'error'
      console.error('[companion] Start fehlgeschlagen:', e)
      slogErr('startServer', e)
      notify('SoulLink Companion', 'Der Companion konnte nicht starten. Bitte App neu starten.')
    }
  }
  refreshTray()
}

// ── Auto-Update (electron-updater + GitHub Releases) ─────────────────────────
// Discord/Steam-style: check on start (and manually via the tray), ASK before
// downloading, then download → quit → install → relaunch in one click. No more
// manual GitHub installer downloads. The release already ships latest.yml + the
// installer + blockmap, which is everything electron-updater needs.
let _updater = null
let _updaterWired = false
let _updateAccepted = false     // user chose "Jetzt aktualisieren" → install once downloaded
let _suppressDialog = false     // true while the in-app (Settings) check runs → no native dialog
const CHANGELOG_URL = 'https://github.com/DrDuqi/soullink-tracker-new/releases'

// a.b.c semver compare → true if A is strictly newer than B.
function semverGt(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 }
  return false
}

function parentWin() { return (win && !win.isDestroyed()) ? win : null }
function msgBox(opts) { const p = parentWin(); return p ? dialog.showMessageBoxSync(p, opts) : dialog.showMessageBoxSync(opts) }
// Push an update-lifecycle event to the React window (the in-app overlay). No-op when
// there is no window (login-hidden tray mode) → the native dialog path takes over.
function sendUI(channel, payload) { try { const p = parentWin(); if (p) p.webContents.send(channel, payload) } catch { /* ignore */ } }

function getUpdater() {
  if (_updater) return _updater
  try { _updater = require('electron-updater').autoUpdater } catch { return null }
  _updater.autoDownload = false            // ask first (don't surprise-download)
  _updater.autoInstallOnAppQuit = true     // if they pick "Später" after a download, install on quit
  return _updater
}

function wireUpdater(au) {
  if (_updaterWired) return
  _updaterWired = true
  au.on('update-available', (info) => {
    const v = (info && info.version) || '?'
    slog(`Update verfügbar: v${v}`)
    if (_suppressDialog) return   // the in-app Settings flow shows its own UI
    let notes = (info && info.releaseNotes) || null
    if (Array.isArray(notes)) notes = notes.map((n) => (n && n.note) || '').join('\n')
    // Window present → the React overlay drives the whole flow (version, changelog,
    // "Jetzt aktualisieren", progress bar). Only fall back to a native dialog when
    // running headless in the tray (login-hidden), where there is no UI to show.
    if (parentWin()) { sendUI('update:available', { version: v, notes, date: (info && info.releaseDate) || null }); return }
    const r = msgBox({
      type: 'info', noLink: true, defaultId: 0, cancelId: 1,
      title: 'Update verfügbar',
      message: `Neue Version verfügbar: v${v}`,
      detail: 'SoulLink Companion kann sich jetzt selbst aktualisieren: Update laden, neu starten und installieren — alles automatisch.',
      buttons: ['Jetzt aktualisieren', 'Später'],
    })
    if (r === 0) {
      _updateAccepted = true
      notify('SoulLink Companion', `Update v${v} wird heruntergeladen …`)
      au.downloadUpdate().catch((e) => { slogErr('downloadUpdate', e); notify('SoulLink Companion', 'Update-Download fehlgeschlagen.') })
    }
  })
  au.on('download-progress', (p) => {
    try { if (tray) tray.setToolTip(`SoulLink Companion — Update lädt … ${Math.round(p.percent || 0)}%`) } catch { /* ignore */ }
    sendUI('update:progress', { percent: p.percent || 0, transferred: p.transferred || 0, total: p.total || 0, bytesPerSecond: p.bytesPerSecond || 0 })
  })
  au.on('update-downloaded', (info) => {
    slog('Update heruntergeladen.')
    try { refreshTray() } catch { /* ignore */ }
    sendUI('update:downloaded', { version: (info && info.version) || null })
    if (_updateAccepted) { quitting = true; setImmediate(() => { try { au.quitAndInstall() } catch (e) { slogErr('quitAndInstall', e) } }) }
    else notify('SoulLink Companion', 'Update bereit — wird beim nächsten Start installiert.')
  })
  au.on('error', (e) => { slogErr('autoUpdater', e); sendUI('update:error', { message: (e && e.message) || String(e) }) })
}

// Automatic, silent check on startup (only nags when an update actually exists).
function checkForUpdates() {
  if (!app.isPackaged) return
  const au = getUpdater(); if (!au) return
  wireUpdater(au)
  au.checkForUpdates().catch((e) => slogErr('checkForUpdates', e))
}

// Manual check from the tray → also confirms when already up to date.
function checkForUpdatesManual() {
  if (!app.isPackaged) { msgBox({ type: 'info', noLink: true, message: 'Updates sind nur in der installierten App verfügbar.', buttons: ['OK'] }); return }
  const au = getUpdater(); if (!au) return
  wireUpdater(au)
  const onNone = () => { au.removeListener('update-not-available', onNone); msgBox({ type: 'info', noLink: true, title: 'Kein Update', message: `Du hast bereits die neueste Version (v${app.getVersion()}).`, buttons: ['OK'] }) }
  au.once('update-not-available', onNone)
  au.checkForUpdates().catch((e) => { au.removeListener('update-not-available', onNone); slogErr('checkForUpdatesManual', e); msgBox({ type: 'warning', noLink: true, message: 'Update-Prüfung fehlgeschlagen. Bist du online?', buttons: ['OK'] }) })
}

app.on('window-all-closed', () => { /* close-to-tray → stay alive in the tray */ })
// A second launch reveals the existing window instead of starting another instance.
app.on('second-instance', () => showWindow())

app.whenReady().then(async () => {
  try { fs.writeFileSync(startupLogPath(), '') } catch { /* ignore */ }   // fresh log each launch
  slog(`START — SoulLink Companion v${app.getVersion()} · packaged=${app.isPackaged}`)
  slog(`node=${process.version} · electron=${process.versions.electron}`)
  slog(`serverPath = ${serverPath} (existiert: ${fs.existsSync(serverPath)})`)
  slog(`profiles.mjs daneben (existiert: ${fs.existsSync(path.join(path.dirname(serverPath), 'profiles.mjs'))})`)
  try { tray = new Tray(trayImage()); refreshTray(); tray.on('double-click', () => showWindow()); slog('✓ Tray erstellt') }
  catch (e) { slogErr('Tray', e) }
  await startServer()
  // Open the window — unless launched hidden at login (then it waits in the tray).
  const startHidden = process.argv.includes('--hidden')
  if (serverState !== 'error') { try { createWindow(!startHidden); slog(`✓ Fenster erstellt (sichtbar=${!startHidden})`) } catch (e) { slogErr('Fenster', e) } }
  try { checkForUpdates(); slog('✓ Update-Check angestoßen') } catch (e) { slogErr('Update-Check', e) }
  slog(`✓ App bereit (Status=${serverState})`)
})
