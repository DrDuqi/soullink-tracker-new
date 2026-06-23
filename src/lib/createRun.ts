import { supabase } from './supabase'
import type { Run, Player } from '../types/database'

// Create a Supabase run + the owner's player row. Mirrors the website's run creation
// (one implementation of the insert shape) so the Companion's "Neuer SoulLink" makes
// a REAL run that appears in the dashboard and has full team tracking.
export async function createRun(opts: { name: string; game: string; ownerUserId: string; username: string }): Promise<{ run: Run; player: Player }> {
  const payload: Record<string, unknown> = { name: opts.name, game: opts.game, owner_user_id: opts.ownerUserId }
  const { data: run, error: runErr } = await supabase.from('runs').insert(payload).select().single()
  if (runErr || !run) throw new Error(runErr?.message || 'Run konnte nicht erstellt werden.')
  const { data: player, error: pErr } = await supabase.from('players')
    .insert({ run_id: run.id, name: opts.username, player_number: 1, auth_user_id: opts.ownerUserId })
    .select().single()
  if (pErr || !player) throw new Error(pErr?.message || 'Spieler konnte nicht angelegt werden.')
  return { run: run as Run, player: player as Player }
}
