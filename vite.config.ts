import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { spawn, exec } from 'node:child_process'

// Is an EmuHawk.exe process already running? (Windows; resolves false elsewhere.)
function isBizhawkRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      exec('tasklist /FI "IMAGENAME eq EmuHawk.exe" /NH', { windowsHide: true }, (err, stdout) => {
        resolve(!err && /EmuHawk\.exe/i.test(stdout || ''))
      })
    } catch { resolve(false) }
  })
}

// Close any running EmuHawk so it can be relaunched WITH the Lua script (BizHawk
// only loads Lua at startup — it cannot be injected into a running instance).
function killBizhawk(): Promise<void> {
  return new Promise((resolve) => {
    try { exec('taskkill /IM EmuHawk.exe /F', { windowsHide: true }, () => resolve()) } catch { resolve() }
  })
}
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Does the EmuHawk.exe folder look like a COMPLETE BizHawk install (has its DLLs /
// gamedb)? A loose copy of just EmuHawk.exe crashes at startup with a .NET
// exception (0xE0434352) because it can't find its runtime files.
function bizhawkFolderInfo(exeDir: string) {
  let dllCount = 0, hasDllDir = false, hasGamedb = false
  try {
    for (const ent of readdirSync(exeDir, { withFileTypes: true })) {
      const n = ent.name.toLowerCase()
      if (ent.isFile() && n.endsWith('.dll')) dllCount++
      if (ent.isDirectory() && n === 'dll') hasDllDir = true
      if (ent.isDirectory() && n === 'gamedb') hasGamedb = true
    }
  } catch { /* unreadable */ }
  return { complete: dllCount > 0 || hasDllDir || hasGamedb, dllCount, hasDllDir, hasGamedb }
}

interface LaunchAttempt { alive: boolean; code: number | null; signal: string | null; stdout: string; stderr: string; errEvent: string | null; pid?: number; spawnThrew?: string }
// Spawn and OBSERVE for `ms`: capture stdout/stderr/error/exit so a crash is visible
// instead of a silent "launched". Resolves alive=true only if it is still running.
function tryLaunch(exe: string, args: string[], cwd: string, ms: number): Promise<LaunchAttempt> {
  return new Promise((resolve) => {
    let stdout = '', stderr = '', errEvent: string | null = null, exited = false
    let code: number | null = null, signal: string | null = null
    let child
    try { child = spawn(exe, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }) }
    catch (e) { resolve({ alive: false, code: null, signal: null, stdout: '', stderr: '', errEvent: null, spawnThrew: String((e as Error)?.message || e) }); return }
    child.stdout?.on('data', (d) => { if (stdout.length < 4000) stdout += d.toString() })
    child.stderr?.on('data', (d) => { if (stderr.length < 4000) stderr += d.toString() })
    child.on('error', (e) => { errEvent = String((e as Error)?.message || e) })
    child.on('exit', (c, s) => { exited = true; code = c; signal = s })
    setTimeout(() => resolve({ alive: !exited, code, signal, stdout, stderr, errEvent, pid: child.pid }), ms)
  })
}
const hex32 = (n: number | null) => (n != null ? '0x' + (n >>> 0).toString(16).toUpperCase() : '-')

// Dev-only filesystem detection so the setup wizard can auto-fill paths the user
// would otherwise have to type (a browser file picker never reveals absolute paths).
// Bounded scan of the project + its parent only; never touches anything else.
function detectEmulatorPaths(root: string) {
  const lua = join(root, 'emulator', 'bizhawk', 'soullink_sync.lua')
  const parent = dirname(root)

  let bizhawk: string | null = null
  for (const base of [root, parent]) {
    const direct = join(base, 'EmuHawk.exe')
    if (existsSync(direct)) { bizhawk = direct; break }
    try {
      for (const ent of readdirSync(base, { withFileTypes: true })) {
        if (ent.isDirectory() && /bizhawk|emuhawk/i.test(ent.name)) {
          const cand = join(base, ent.name, 'EmuHawk.exe')
          if (existsSync(cand)) { bizhawk = cand; break }
        }
      }
    } catch { /* unreadable dir → skip */ }
    if (bizhawk) break
  }

  const romDirs = [root, join(root, 'roms'), join(root, 'ROMs'), join(root, 'emulator'), parent, join(parent, 'roms')]
  const roms: { name: string; path: string }[] = []
  const seen = new Set<string>()
  for (const dir of romDirs) {
    try {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (ent.isFile() && /\.(nds|gba|gbc|gb)$/i.test(ent.name)) {
          const p = join(dir, ent.name)
          if (!seen.has(p)) { seen.add(p); roms.push({ name: ent.name, path: p }) }
        }
      }
    } catch { /* skip */ }
    if (roms.length >= 60) break
  }

  return { lua: existsSync(lua) ? lua : null, syncFolder: join(root, 'emulator', 'bizhawk'), bizhawk, roms }
}

// Find a file by its base name under the project / parent (bounded), so a file the
// user picked in the browser dialog can be resolved to an absolute path.
function findFileByName(root: string, name: string): string | null {
  if (!name || /[\\/]/.test(name)) return null
  const skip = new Set(['node_modules', '.git', 'dist', '.vite', 'coverage', 'AppData', '.cache'])
  const roots = [root, dirname(root)]
  try {
    const home = homedir()
    // Common spots where BizHawk / ROMs get extracted.
    roots.push(join(home, 'Downloads'), join(home, 'Desktop'), join(home, 'Documents'), join(home, 'Tools'))
  } catch { /* no home → project/parent only */ }
  const seenRoot = new Set<string>()
  const queue: { dir: string; depth: number }[] = []
  for (const r of roots) { if (!seenRoot.has(r)) { seenRoot.add(r); queue.push({ dir: r, depth: 0 }) } }
  let scanned = 0
  const target = name.toLowerCase()
  while (queue.length && scanned < 12000) {
    const { dir, depth } = queue.shift()!
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const ent of entries) {
      scanned++
      if (ent.isFile() && ent.name.toLowerCase() === target) return join(dir, ent.name)
      if (ent.isDirectory() && depth < 3 && !skip.has(ent.name) && !ent.name.startsWith('.')) {
        queue.push({ dir: join(dir, ent.name), depth: depth + 1 })
      }
    }
  }
  return null
}

// Dev-only local endpoint for the emulator live-sync prototype.
//   GET  /api/emulator-sync  → returns { ok, last: { data, at } | null }
//   POST /api/emulator-sync  → (optional) stores a payload in memory
//
// PRIMARY transport = FILE: the BizHawk Lua script writes soullink_team.json
// (next to itself, i.e. emulator/bizhawk/soullink_team.json). On GET we read
// that file and return the newer of (file, last POST). This needs no special
// BizHawk start parameters and no HTTP init. Override the path with the
// SOULLINK_TEAM_FILE env var if you keep the .lua elsewhere.
// Runs ONLY on the dev server (`apply: 'serve'`) → zero impact on `vite build`.
function emulatorSyncPlugin(): Plugin {
  let lastPost: { data: unknown; at: number } | null = null
  let fileCache: { data: unknown; at: number } | null = null

  return {
    name: 'emulator-sync-dev',
    apply: 'serve',
    configureServer(server) {
      const teamFile = process.env.SOULLINK_TEAM_FILE
        || join(server.config.root, 'emulator', 'bizhawk', 'soullink_team.json')

      function readFile(): { data: unknown; at: number } | null {
        try {
          const at = statSync(teamFile).mtimeMs
          if (fileCache && fileCache.at === at) return fileCache   // unchanged
          const data = JSON.parse(readFileSync(teamFile, 'utf8'))
          fileCache = { data, at }
          return fileCache
        } catch {
          return fileCache // file missing or mid-write → last good parse
        }
      }

      // Setup-wizard helper: GET /api/emulator-detect → { lua, syncFolder, bizhawk, roms }
      //                       GET /api/emulator-detect?find=NAME → { path }
      server.middlewares.use('/api/emulator-detect', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('content-type', 'application/json')
        try {
          const u = new URL(req.originalUrl || req.url || '/', 'http://localhost')
          const find = u.searchParams.get('find')
          if (find) { res.end(JSON.stringify({ ok: true, path: findFileByName(server.config.root, find) })); return }
          res.end(JSON.stringify({ ok: true, ...detectEmulatorPaths(server.config.root) }))
        } catch {
          res.statusCode = 500; res.end(JSON.stringify({ ok: false }))
        }
      })

      // One-click launch: start BizHawk with the saved ROM + Lua (dev-only).
      // POST { bizhawk, rom, lua } → { ok, launched|already, lua } or { ok:false, error }
      server.middlewares.use('/api/emulator-launch', (req, res) => {
        res.setHeader('content-type', 'application/json')
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{"ok":false}'); return }
        let body = ''
        req.on('data', (c) => { body += c; if (body.length > 100_000) req.destroy() })
        req.on('end', async () => {
          const send = (obj: unknown) => { try { res.end(JSON.stringify(obj)) } catch { /* already sent */ } }
          let cfg: { bizhawk?: string; rom?: string; lua?: string; restart?: boolean } = {}
          try { cfg = JSON.parse(body || '{}') } catch { /* invalid */ }
          const bizhawk = String(cfg.bizhawk || '').trim()
          const rom = String(cfg.rom || '').trim()
          const lua = String(cfg.lua || '').trim()
          const restart = !!cfg.restart

          console.log('\n[launch] ── Request erhalten ───────────────────────────')
          console.log('[launch] restart :', restart)
          console.log('[launch] bizhawk :', bizhawk || '(leer)')
          console.log('[launch] rom     :', rom || '(leer)')
          console.log('[launch] lua     :', lua || '(leer)')

          if (!bizhawk || !existsSync(bizhawk)) { console.error('[launch] FEHLER: BizHawk-Pfad fehlt/existiert nicht.'); send({ ok: false, error: 'bizhawk_not_found' }); return }
          if (!rom || !existsSync(rom)) { console.error('[launch] FEHLER: ROM-Pfad fehlt/existiert nicht.'); send({ ok: false, error: 'rom_not_found' }); return }
          if (!lua || !existsSync(lua)) { console.error('[launch] FEHLER: Lua-Pfad fehlt/existiert nicht.'); send({ ok: false, error: 'lua_not_found' }); return }

          const running = await isBizhawkRunning()
          console.log('[launch] EmuHawk laeuft bereits:', running)
          // Already running and we are NOT restarting → Lua cannot be injected.
          if (running && !restart) { console.log('[launch] → bereits offen, kein Neustart angefordert.'); send({ ok: true, already: true, lua: true }); return }
          // Restart requested → close the running instance first, then relaunch with Lua.
          if (running && restart) { console.log('[launch] → schliesse laufendes EmuHawk …'); await killBizhawk(); await delay(1200) }

          const cwd = dirname(bizhawk)   // BizHawk findet seine DLLs/Ressourcen relativ zum eigenen Ordner
          const folder = bizhawkFolderInfo(cwd)
          console.log('[launch] cwd     :', cwd, '· existiert:', existsSync(cwd))
          console.log('[launch] BizHawk-Ordner:', JSON.stringify(folder), folder.complete ? '(sieht vollständig aus)' : '(UNVOLLSTÄNDIG – evtl. lose EmuHawk.exe ohne DLLs!)')

          // BizHawk akzeptiert beide Reihenfolgen; wir testen sie und nehmen die,
          // die wirklich läuft.
          const variants = [
            { label: 'rom --lua', args: [rom, '--lua=' + lua] },
            { label: '--lua rom', args: ['--lua=' + lua, rom] },
          ]
          let last: LaunchAttempt | null = null
          for (const v of variants) {
            console.log(`[launch] Variante "${v.label}" → ${JSON.stringify([bizhawk, ...v.args])}`)
            const r = await tryLaunch(bizhawk, v.args, cwd, 2500)
            last = r
            console.log(`[launch]   alive=${r.alive} exitCode=${r.code} (${hex32(r.code)}) signal=${r.signal} errorEvent=${r.errEvent ?? '-'} pid=${r.pid ?? '-'}`)
            if (r.spawnThrew) console.log('[launch]   spawn() warf:', r.spawnThrew)
            if (r.stdout.trim()) console.log('[launch]   stdout:', r.stdout.trim())
            if (r.stderr.trim()) console.log('[launch]   stderr:', r.stderr.trim())
            if (r.alive) {
              console.log(`[launch] ✅ Variante "${v.label}" läuft (pid ${r.pid}).`)
              send({ ok: true, launched: true, lua: true, restarted: running && restart, variant: v.label })
              return
            }
            console.log(`[launch] ✗ Variante "${v.label}" sofort beendet — nächste Variante …`)
          }

          // Alle Varianten fehlgeschlagen → echten Fehler + Hinweise zurückgeben.
          const code = last?.code ?? null
          let hint = ''
          if (hex32(code) === '0xE0434352') hint += ' .NET-Ausnahme beim Start (0xE0434352) – meist unvollständiger BizHawk-Ordner (DLLs fehlen) oder fehlende .NET-Runtime.'
          if (!folder.complete) hint += ' Der gewählte Ordner enthält keine BizHawk-DLLs – bitte die EmuHawk.exe aus dem VOLLSTÄNDIGEN BizHawk-Ordner wählen.'
          const detail = `Exit ${code} (${hex32(code)}).${hint}`.trim()
          console.error('[launch] ❌ Alle Varianten fehlgeschlagen:', detail)
          send({ ok: false, error: 'launch_exited', detail })
        })
      })

      server.middlewares.use('/api/emulator-sync', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'content-type')
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (c) => { body += c; if (body.length > 1_000_000) req.destroy() })
          req.on('end', () => {
            try {
              lastPost = { data: JSON.parse(body || '{}'), at: Date.now() }
              res.setHeader('content-type', 'application/json'); res.end('{"ok":true}')
            } catch {
              res.statusCode = 400; res.setHeader('content-type', 'application/json')
              res.end('{"ok":false,"error":"invalid json"}')
            }
          })
          return
        }

        if (req.method === 'GET') {
          const fileEntry = readFile()
          // Return whichever source is newer.
          let last = lastPost
          if (fileEntry && (!last || fileEntry.at > last.at)) last = fileEntry
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ ok: true, last }))
          return
        }

        res.statusCode = 405
        res.end()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), emulatorSyncPlugin()],
  server: {
    watch: {
      // The BizHawk Lua script rewrites these runtime files ~2x/second. Without
      // ignoring them, Vite's file watcher would trigger a full-page reload on
      // every write → constant flickering. They are not source files.
      ignored: [
        '**/emulator/bizhawk/soullink_team.json',
        '**/emulator/bizhawk/soullink_party_addr.txt',
        '**/soullink_team.json',
        '**/soullink_party_addr.txt',
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split rarely-changing vendor code into long-cacheable chunks so the
        // app shell loads faster and repeat visits hit the browser cache.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@tanstack')) return 'query'
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react-vendor'
          return 'vendor'
        },
      },
    },
  },
})
