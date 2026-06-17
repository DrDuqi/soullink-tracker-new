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
