// Standalone local sync endpoint (alternative to the Vite dev-server plugin).
// Use this when you don't want to run `npm run dev`, or want the endpoint on a
// fixed port. Zero dependencies (Node built-in http only).
//
//   node emulator/dev-sync-server/server.mjs
//   → POST/GET http://localhost:8787/api/emulator-sync
//
// The BizHawk Lua script POSTs JSON here; a client can GET the latest payload.
// In-memory only. No persistence, no ROM/save handling, no Supabase.

import { createServer } from 'node:http'

const PORT = process.env.SYNC_PORT ? Number(process.env.SYNC_PORT) : 8787
let last = null // { data, at }

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')

  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
  if (!req.url?.startsWith('/api/emulator-sync')) { res.statusCode = 404; return res.end() }

  if (req.method === 'POST') {
    let body = ''
    req.on('data', (c) => { body += c; if (body.length > 1_000_000) req.destroy() })
    req.on('end', () => {
      try {
        last = { data: JSON.parse(body || '{}'), at: Date.now() }
        res.setHeader('content-type', 'application/json')
        res.end('{"ok":true}')
        console.log(`[sync] received team (${last.data?.team?.length ?? 0} mons) @ ${new Date().toLocaleTimeString()}`)
      } catch {
        res.statusCode = 400
        res.end('{"ok":false,"error":"invalid json"}')
      }
    })
    return
  }

  if (req.method === 'GET') {
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({ ok: true, last }))
  }

  res.statusCode = 405
  res.end()
})

server.listen(PORT, () => console.log(`SoulLink sync endpoint → http://localhost:${PORT}/api/emulator-sync`))
