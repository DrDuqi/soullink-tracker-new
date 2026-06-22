// SoulLink Companion — Electron tray app.
//
// Goal: the user never opens a terminal. Install → it starts (optionally at login)
// → runs in the background with a tray icon → the website auto-detects it on
// 127.0.0.1:8787. No window is ever shown.
//
// It reuses the EXACT same HTTP/launch/sync/config logic as `npm run companion`
// by dynamically importing emulator/companion/server.mjs (bundled as a resource),
// so there is one implementation and no drift.

const { app, Tray, Menu, shell, nativeImage, Notification, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')

const WEBSITE = 'https://soullink-tracker-new.vercel.app'

let tray = null
let serverState = 'starting'   // 'starting' | 'running' | 'shared' | 'error'
let serverMod = null           // the imported server.mjs (exposes dev helpers)

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
  try { app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true }) } catch { /* ignore */ }
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
    { label: statusLabel(), enabled: false },
    { type: 'separator' },
    { label: 'Website öffnen', click: () => shell.openExternal(WEBSITE) },
    { label: 'Mit Windows starten', type: 'checkbox', checked: autoStartEnabled(), click: (mi) => setAutoStart(mi.checked) },
    ...devMenu(),
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() },
  ]))
}

function notify(title, body) {
  try { if (Notification.isSupported()) new Notification({ title, body }).show() } catch { /* ignore */ }
}

// Native file dialog for the setup wizard (the browser picker can't reveal real
// paths). Returns an absolute path or null (cancelled). Called by the server via
// the pickFile hook passed to startCompanion.
async function pickFile({ kind, defaultPath }) {
  const filters = kind === 'biz'
    ? [{ name: 'BizHawk (EmuHawk.exe)', extensions: ['exe'] }, { name: 'Alle Dateien', extensions: ['*'] }]
    : [{ name: 'Pokémon-ROM', extensions: ['nds', 'gba', 'gbc', 'gb'] }, { name: 'Alle Dateien', extensions: ['*'] }]
  const title = kind === 'biz' ? 'EmuHawk.exe auswählen' : 'Pokémon-ROM auswählen'
  try {
    try { app.focus({ steal: true }) } catch { /* ignore */ }
    const r = await dialog.showOpenDialog({ title, defaultPath: defaultPath || undefined, properties: ['openFile'], filters })
    return (!r.canceled && r.filePaths && r.filePaths[0]) ? r.filePaths[0] : null
  } catch {
    return null
  }
}

async function startServer() {
  const userData = app.getPath('userData')
  // The Lua writes its team JSON next to itself, so it must live in a WRITABLE
  // folder (resources/ is read-only). Copy it into userData on every launch (so
  // app updates also ship a fresh Lua) and point the server there.
  const luaDst = path.join(userData, 'soullink_sync.lua')
  try { fs.copyFileSync(luaSrc, luaDst); process.env.SOULLINK_LUA = luaDst } catch (e) { console.error('[companion] Lua-Kopie fehlgeschlagen:', e) }
  process.env.SOULLINK_COMPANION_CONFIG = path.join(userData, 'companion-config.json')

  try {
    serverMod = await import(pathToFileURL(serverPath).href)
    await serverMod.startCompanion({ quiet: true, pickFile, version: app.getVersion() })
    serverState = 'running'
  } catch (e) {
    if (e && e.code === 'EADDRINUSE') {
      // Port already served (e.g. `npm run companion` is open) — that's fine, the
      // website still works; this instance just rides along in the tray.
      serverState = 'shared'
    } else {
      serverState = 'error'
      console.error('[companion] Start fehlgeschlagen:', e)
      notify('SoulLink Companion', 'Der Companion konnte nicht starten. Bitte App neu starten.')
    }
  }
  refreshTray()
}

function checkForUpdates() {
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.autoDownload = true
    autoUpdater.on('update-downloaded', () => notify('SoulLink Companion', 'Update bereit — wird beim nächsten Start installiert.'))
    autoUpdater.checkForUpdatesAndNotify().catch(() => { /* no releases yet → ignore */ })
  } catch { /* updater unavailable in dev → ignore */ }
}

app.on('window-all-closed', () => { /* no windows → stay alive in the tray */ })
app.on('second-instance', () => notify('SoulLink Companion', 'Läuft bereits im System-Tray.'))

app.whenReady().then(() => {
  tray = new Tray(trayImage())
  refreshTray()
  startServer()
  checkForUpdates()
})
