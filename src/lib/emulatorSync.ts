// Shared shape for the emulator live-sync prototype.
// The BizHawk Lua script produces an EmulatorPayload; the local dev endpoint
// (Vite middleware) stores the latest one; the test page polls it.
// NOTE: prototype only — no Supabase writes happen from this module.

export type MonStatus = 'ok' | 'slp' | 'psn' | 'tox' | 'brn' | 'frz' | 'par'

export interface EmulatorMon {
  slot: number          // 1..6
  speciesId: number     // national dex id (frontend resolves name/sprite)
  level: number
  hp: number
  maxHp: number
  status: MonStatus
  fainted: boolean      // hp === 0
  // ── Enriched fields (optional; older payloads omit them) ──────────────
  // RAM gives IDs; names are resolved client-side via PokéAPI. null = unknown.
  nickname?: string | null      // best-effort (Gen-4 Western charset), else null
  natureId?: number | null      // 0..24 (PID % 25) → NATURE_DE
  abilityId?: number | null     // ability id (resolve name via PokéAPI)
  heldItemId?: number | null    // item id, 0 = none (resolve name via PokéAPI)
  moveIds?: number[]            // up to 4 move ids, 0 = empty slot
  metLocationId?: number | null // not yet mapped (Roadmap) → usually null
  metLevel?: number | null      // not yet reliably read (Roadmap) → usually null
}

export interface EmulatorPayload {
  game: string          // 'platinum' | 'firered' | 'emerald' | 'heartgold' | 'black'
  trainer: string
  capturedAt: number    // epoch ms on the emulator side (may be 0 if unknown)
  team: EmulatorMon[]
}

export interface SyncEnvelope {
  ok: boolean
  last: { data: EmulatorPayload; at: number } | null  // at = epoch ms the endpoint received it
}

export const SYNC_ENDPOINT = '/api/emulator-sync'

export const STATUS_LABEL_DE: Record<MonStatus, string> = {
  ok: 'OK', slp: 'Schlaf', psn: 'Gift', tox: 'Schwer vergiftet',
  brn: 'Verbrennung', frz: 'Gefroren', par: 'Paralyse',
}

// Nature ids 0..24 (Gen 4 = PID % 25) → German names.
export const NATURE_DE = [
  'Robust', 'Einsam', 'Mutig', 'Hart', 'Frech',
  'Kühn', 'Sanft', 'Locker', 'Pfiffig', 'Lasch',
  'Scheu', 'Hastig', 'Ernst', 'Froh', 'Naiv',
  'Mäßig', 'Mild', 'Ruhig', 'Zaghaft', 'Hitzig',
  'Still', 'Zart', 'Forsch', 'Sacht', 'Kauzig',
] as const

export function natureName(id: number | null | undefined): string | null {
  return id != null && id >= 0 && id < NATURE_DE.length ? NATURE_DE[id] : null
}
