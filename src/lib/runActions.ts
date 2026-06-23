import { supabase } from './supabase'
import type { Run, Player } from '../types/database'

// Load a run + its players (e.g. to open a freshly created attempt).
export async function loadRun(runId: string, userId: string): Promise<{ run: Run; players: Player[]; myPlayerId: string }> {
  const [{ data: run }, { data: players }] = await Promise.all([
    supabase.from('runs').select('*').eq('id', runId).single(),
    supabase.from('players').select('*').eq('run_id', runId),
  ])
  if (!run) throw new Error('Run nicht gefunden.')
  const ps = (players as Player[]) ?? []
  const mine = ps.find((p) => p.auth_user_id === userId)
  return { run: run as Run, players: ps, myPlayerId: mine?.id ?? ps[0]?.id ?? '' }
}

// Mutations on the SHARED Supabase run (rename/delete). Local files are handled
// separately by the PlatformBridge (archiveRun/deleteRun). Delete reuses the same
// server-side RPC the website uses, so cascades + permissions stay correct.
export async function renameRun(runId: string, name: string): Promise<void> {
  const { error } = await supabase.from('runs').update({ name: name.trim() }).eq('id', runId)
  if (error) throw new Error(error.message)
}

export async function deleteRunRemote(runId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_run', { p_run_id: runId })
  if (error) throw new Error(error.message)
}

// Lifecycle (v16): either member can end the run; "Neuer Versuch" clones it for the
// same members + rules into a new active run (old one preserved). Returns new run id.
export async function setRunStatus(runId: string, status: 'active' | 'won' | 'lost'): Promise<void> {
  const { error } = await supabase.rpc('set_run_status', { p_run_id: runId, p_status: status })
  if (error) throw new Error(error.message)
}

export async function newAttemptRemote(runId: string): Promise<string> {
  const { data, error } = await supabase.rpc('new_attempt', { p_run_id: runId })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Neuer Versuch konnte nicht erstellt werden.')
  return data as string
}

