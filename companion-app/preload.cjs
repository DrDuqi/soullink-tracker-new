// Preload for the Companion window. Runs in an isolated context (contextIsolation
// on, nodeIntegration off) and exposes a MINIMAL, explicit bridge on window.
//
// Its only job today: let the React app know it is running INSIDE the Companion
// window (kind === 'companion') so it shows the desktop shell instead of the
// website landing, and hides "install the Companion" prompts. Window controls and
// other native extras can be added here later — never broaden it without reason.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('soullinkNative', {
  kind: 'companion',
  // Window controls for the custom (frameless) title bar.
  minimize: () => ipcRenderer.send('win:minimize'),
  toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
  close: () => ipcRenderer.send('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
  // Subscribe to maximize/restore so the title bar can swap its icon. Returns an
  // unsubscribe function.
  onMaximizeChange: (cb) => {
    const handler = (_e, value) => cb(!!value)
    ipcRenderer.on('win:maximize-changed', handler)
    return () => ipcRenderer.removeListener('win:maximize-changed', handler)
  },
  // App version + self-update (Settings → Companion).
  getVersion: () => ipcRenderer.invoke('app:version'),
  // Returns { state:'current'|'available'|'error'|'dev', current, latest, notes, date }.
  checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),
  // Download + install + relaunch (after the user chose to update).
  startUpdate: () => ipcRenderer.send('app:start-update'),
  // Live update lifecycle for the in-app overlay. cb receives { type, ...payload }
  // where type ∈ available | progress | downloaded | error. Returns an unsubscribe fn.
  onUpdate: (cb) => {
    const map = { 'update:available': 'available', 'update:progress': 'progress', 'update:downloaded': 'downloaded', 'update:error': 'error', 'update:phase': 'phase', 'update:none': 'none' }
    const reg = Object.entries(map).map(([ch, type]) => {
      const h = (_e, payload) => { try { cb({ type, ...(payload || {}) }) } catch { /* ignore */ } }
      ipcRenderer.on(ch, h)
      return [ch, h]
    })
    return () => reg.forEach(([ch, h]) => ipcRenderer.removeListener(ch, h))
  },
})
