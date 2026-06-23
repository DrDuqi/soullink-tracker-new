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
  // Thin, explicit IPC surface (room to grow: window controls, native menus, …).
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
})
