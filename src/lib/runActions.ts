import { supabase } from './supabase'

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
