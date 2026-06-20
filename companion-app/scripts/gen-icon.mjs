// Generates assets/icon.png (256×256) and assets/icon.ico (PNG-wrapped) — a simple
// Pokéball mark — with zero image dependencies, so the build is self-contained.
// Replace assets/icon.png / .ico anytime with a nicer design; nothing else changes.

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ASSETS = join(HERE, '..', 'assets')
const SIZE = 256

// ── colors ──
const RED = [204, 0, 0, 255]
const WHITE = [245, 245, 247, 255]
const DARK = [26, 26, 30, 255]
const CLEAR = [0, 0, 0, 0]

function pixel(x, y) {
  const dx = x - (SIZE / 2 - 0.5)
  const dy = y - (SIZE / 2 - 0.5)
  const r = Math.sqrt(dx * dx + dy * dy)
  const R = SIZE / 2 - 4
  if (r > R) return CLEAR              // outside the ball → transparent
  if (r >= R - 8) return DARK          // outer outline
  if (r <= 34) return r >= 26 ? DARK : WHITE   // center button + ring
  if (Math.abs(dy) <= 12) return DARK  // middle band
  return dy < 0 ? RED : WHITE          // top red / bottom white
}

// ── raw RGBA → PNG ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePng() {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
  let o = 0
  for (let y = 0; y < SIZE; y++) {
    raw[o++] = 0 // filter: none
    for (let x = 0; x < SIZE; x++) { const p = pixel(x, y); raw[o++] = p[0]; raw[o++] = p[1]; raw[o++] = p[2]; raw[o++] = p[3] }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8-bit RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// ── PNG → single-image ICO (Vista+ accepts PNG-compressed entries) ──
function encodeIco(png) {
  const dir = Buffer.alloc(6)
  dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(1, 4)
  const entry = Buffer.alloc(16)
  entry[0] = 0; entry[1] = 0           // 0 = 256
  entry[2] = 0; entry[3] = 0
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(22, 12)
  return Buffer.concat([dir, entry, png])
}

mkdirSync(ASSETS, { recursive: true })
const png = encodePng()
writeFileSync(join(ASSETS, 'icon.png'), png)
writeFileSync(join(ASSETS, 'icon.ico'), encodeIco(png))
console.log(`icon.png (${png.length} B) + icon.ico geschrieben → ${ASSETS}`)
