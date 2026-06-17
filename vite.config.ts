import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

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
