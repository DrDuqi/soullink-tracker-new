import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

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
  const skip = new Set(['node_modules', '.git', 'dist', '.vite', 'coverage'])
  const queue: { dir: string; depth: number }[] = [root, dirname(root)].map((d) => ({ dir: d, depth: 0 }))
  let scanned = 0
  const target = name.toLowerCase()
  while (queue.length && scanned < 6000) {
    const { dir, depth } = queue.shift()!
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const ent of entries) {
      scanned++
      if (ent.isFile() && ent.name.toLowerCase() === target) return join(dir, ent.name)
      if (ent.isDirectory() && depth < 2 && !skip.has(ent.name) && !ent.name.startsWith('.')) {
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
