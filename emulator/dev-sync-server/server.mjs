// Standalone local sync endpoint (alternative to the Vite dev-server plugin).
// Use this when you don't want to run `npm run dev`, or want the endpoint on a
// fixed port. Zero dependencies (Node built-in modules only).
//
//   node emulator/dev-sync-server/server.mjs
//   → GET/POST http://localhost:8787/api/emulator-sync
//
// PRIMARY transport = FILE: reads emulator/bizhawk/soullink_team.json (written
// by the BizHawk Lua script) and returns the newer of (file, last POST).
// Override the file with SOULLINK_TEAM_FILE. No ROM/save handling, no Supabase.

import { createServer } from 'node:http'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PORT = process.env.SYNC_PORT ? Number(process.env.SYNC_PORT) : 8787
const TEAM_FILE = process.env.SOULLINK_TEAM_FILE
  || join(process.cwd(), 'emulator', 'bizhawk', 'soullink_team.json')

let lastPost = null
let fileCache = null

function readFile() {
  try {
    const at = statSync(TEAM_FILE).mtimeMs
    if (fileCache && fileCache.at === at) return fileCache
    fileCache = { data: JSON.parse(readFileSync(TEAM_FILE, 'utf8')), at }
    return fileCache
  } catch {
    return fileCache
  }
}

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
      try { lastPost = { data: JSON.parse(body || '{}'), at: Date.now() }; res.end('{"ok":true}') }
      catch { res.statusCode = 400; res.end('{"ok":false}') }
    })
    return
  }

  if (req.method === 'GET') {
    const fileEntry = readFile()
    let last = lastPost
    if (fileEntry && (!last || fileEntry.at > last.at)) last = fileEntry
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({ ok: true, last }))
  }

  res.statusCode = 405
  res.end()
})

server.listen(PORT, () => {
  console.log(`SoulLink sync endpoint → http://localhost:${PORT}/api/emulator-sync`)
  console.log(`Reading team file: ${TEAM_FILE}`)
})
