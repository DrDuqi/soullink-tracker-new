import { supabase } from './supabase'
import type { Run, Player } from '../types/database'

// Join an existing run by its share code, then load the run + players. Mirrors the
// website's join (the secure server-side join_run RPC claims a slot / rejoins).
export async function joinRunByCode(code: string, myUserId: string): Promise<{ run: Run; players: Player[]; myPlayerId: string }> {
  const { data: runId, error: rpcErr } = await supabase.rpc('join_run', { p_share_code: code.trim() })
  if (rpcErr) throw new Error(rpcErr.message)
  if (!runId) throw new Error('Run nicht gefunden — prüfe den Code.')
  const [{ data: run, error: rErr }, { data: players }] = await Promise.all([
    supabase.from('runs').select('*').eq('id', runId).single(),
    supabase.from('players').select('*').eq('run_id', runId),
  ])
  if (rErr || !run) throw new Error(rErr?.message || 'Run konnte nicht geladen werden.')
  const ps = (players as Player[]) ?? []
  const mine = ps.find((p) => p.auth_user_id === myUserId)
  return { run: run as Run, players: ps, myPlayerId: mine?.id ?? ps[0]?.id ?? '' }
}
