// Multiplayer randomizer sync. Every player in a run shares the SAME rules/preset,
// edition and FVX version, but gets their OWN deterministic seed derived from one run
// master seed + their player slot — so worlds differ yet are reproducible, and nobody
// compares seeds by hand. Host and partner compute identical results from identical
// inputs (same master seed + same slot ordering).

export interface SlotPlayer { id: string; created_at?: string | null }

/** Stable 0-based slot of a player within a run (join order → id tiebreak). Host = 0. */
export function playerSlotIndex(players: SlotPlayer[], playerId: string): number {
  const sorted = [...players].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id))
  const i = sorted.findIndex((p) => p.id === playerId)
  return i < 0 ? 0 : i
}

/** Deterministic per-player seed = FNV-1a("master|slot") → positive, < 1e9 (UI-friendly).
 *  Same (master, slot) → same seed everywhere; different slots → different worlds. */
export function derivePlayerSeed(master: number, slot: number | string): number {
  let h = 0x811c9dc5
  const s = `${master >>> 0}|${slot}`
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0) % 1_000_000_000
}

/** The seed a given player must use: shared master in "Gleiche Welt", else the derived
 *  per-slot seed. Returns { seed, slot }. */
export function seedForPlayer(opts: { masterSeed: number | null; sameWorld: boolean; players: SlotPlayer[]; playerId: string }): { seed: number; slot: number } {
  const slot = playerSlotIndex(opts.players, opts.playerId)
  const master = opts.masterSeed ?? 0
  const seed = opts.sameWorld ? master : derivePlayerSeed(master, slot)
  return { seed, slot }
}
