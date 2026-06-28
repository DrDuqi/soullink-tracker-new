// Auto-install BizHawk so the player never hunts for an emulator. We download a
// PINNED BizHawk release (small ~65 MB) into the Companion's managed folder, extract
// it and verify the folder is complete — then it's used like a hand-picked install.
// Keeps the installer lean (no redistributing BizHawk) and the version easy to bump.
//
// Honest limit: BizHawk 2.9.1 is framework-dependent → it needs the .NET 6 Desktop
// Runtime. If a launch later fails with 0xE0434352, the launcher already points the
// user at the runtime; we never silently run admin installers.

import { createWriteStream, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { get as httpsGet } from 'node:https'
import { exec } from 'node:child_process'
import { tmpdir } from 'node:os'

export const BIZHAWK_VERSION = '2.9.1'
export const DOTNET_URL = 'https://dotnet.microsoft.com/download/dotnet/6.0/runtime' // .NET 6 Desktop Runtime (fallback hint)
const BIZHAWK_URL = `https://github.com/TASEmulators/BizHawk/releases/download/${BIZHAWK_VERSION}/BizHawk-${BIZHAWK_VERSION}-win-x64.zip`

// One in-flight install at a time; the client polls this state for a progress bar.
let STATE = { state: 'idle', percent: 0, exe: null, error: null, version: BIZHAWK_VERSION }
export function bizhawkInstallState() { return STATE }

function download(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) { reject(new Error('Zu viele Weiterleitungen')); return }
    const req = httpsGet(url, { headers: { 'User-Agent': 'SoulLink-Companion' } }, (res) => {
      // GitHub release downloads 302 to a CDN — follow it.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); resolve(download(res.headers.location, dest, onProgress, redirects + 1)); return
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let got = 0
      const out = createWriteStream(dest)
      res.on('data', (c) => { got += c.length; if (total) onProgress(got / total) })
      res.pipe(out)
      out.on('finish', () => out.close(() => resolve()))
      out.on('error', reject)
    })
    req.on('error', reject)
  })
}

function unzip(zip, dir) {
  return new Promise((resolve, reject) => {
    // Expand-Archive ships with Windows PowerShell — no extra dependency. -LiteralPath
    // handles the space in "SoulLink Companion".
    const cmd = `powershell -NoProfile -NonInteractive -Command "Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force"`
    exec(cmd, { windowsHide: true, maxBuffer: 1 << 24 }, (err) => err ? reject(err) : resolve())
  })
}

// EmuHawk.exe sits at the extraction root (or one level down, depending on the zip).
function findEmuHawk(dir) {
  if (existsSync(join(dir, 'EmuHawk.exe'))) return join(dir, 'EmuHawk.exe')
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && existsSync(join(dir, e.name, 'EmuHawk.exe'))) return join(dir, e.name, 'EmuHawk.exe')
    }
  } catch { /* ignore */ }
  return null
}

/** Download + extract the pinned BizHawk into targetDir. Resolves with the final
 *  STATE; the client polls bizhawkInstallState() for live progress. onDone(exe) fires
 *  once the install verified (so the server can remember the path). */
export async function installBizhawk({ targetDir, onDone } = {}) {
  if (STATE.state === 'downloading' || STATE.state === 'extracting') return STATE
  STATE = { state: 'downloading', percent: 0, exe: null, error: null, version: BIZHAWK_VERSION }
  const zip = join(tmpdir(), `bizhawk-${BIZHAWK_VERSION}.zip`)
  try {
    try { mkdirSync(targetDir, { recursive: true }) } catch { /* ignore */ }
    await download(BIZHAWK_URL, zip, (p) => { STATE.percent = Math.round(p * 95) })
    STATE = { ...STATE, state: 'extracting', percent: 96 }
    await unzip(zip, targetDir)
    try { rmSync(zip, { force: true }) } catch { /* ignore */ }
    const exe = findEmuHawk(targetDir)
    if (!exe || !existsSync(join(dirname(exe), 'dll'))) throw new Error('BizHawk-Ordner ist nach dem Entpacken unvollständig.')
    STATE = { state: 'done', percent: 100, exe, error: null, version: BIZHAWK_VERSION }
    if (typeof onDone === 'function') { try { onDone(exe) } catch { /* ignore */ } }
    return STATE
  } catch (e) {
    try { rmSync(zip, { force: true }) } catch { /* ignore */ }
    STATE = { state: 'error', percent: 0, exe: null, error: (e && e.message) || String(e), version: BIZHAWK_VERSION }
    return STATE
  }
}
