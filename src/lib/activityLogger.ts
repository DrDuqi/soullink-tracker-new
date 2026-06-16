import { supabase } from './supabase'

export async function logActivity(params: {
  runId: string
  playerId: string | null
  eventType: string
  description: string
  encounterId?: string | null
  pokemonName?: string | null
}) {
  try {
    await supabase.from('activity_log').insert({
      run_id: params.runId,
      player_id: params.playerId ?? null,
      event_type: params.eventType,
      description: params.description,
      encounter_id: params.encounterId ?? null,
      pokemon_name: params.pokemonName ?? null,
    })
  } catch { /* never break the app for a log entry */ }
}
