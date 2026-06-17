import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only local endpoint for the emulator live-sync prototype.
// POST /api/emulator-sync  → stores the latest JSON payload in memory
// GET  /api/emulator-sync  → returns { ok, last: { data, at } | null }
// Runs ONLY on the dev server (`apply: 'serve'`) → zero impact on `vite build`.
function emulatorSyncPlugin(): Plugin {
  let last: { data: unknown; at: number } | null = null
  return {
    name: 'emulator-sync-dev',
    apply: 'serve',
    configureServer(server) {
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
              last = { data: JSON.parse(body || '{}'), at: Date.now() }
              res.setHeader('content-type', 'application/json')
              res.end('{"ok":true}')
            } catch {
              res.statusCode = 400
              res.setHeader('content-type', 'application/json')
              res.end('{"ok":false,"error":"invalid json"}')
            }
          })
          return
        }
        if (req.method === 'GET') {
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
