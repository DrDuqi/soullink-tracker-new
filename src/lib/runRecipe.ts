import { supabase } from './supabase'

// The shared randomization recipe stored ON the run (migration v15). The creator
// writes it; a joining player reads it to reproduce locally. preset = rules (always
// shared); world_seed = only set in "Gleiche Welt" mode (else each player's own seed).
export interface RunRecipe { preset_data: string | null; edition: string | null; world_seed: number | null; base_rom: string | null }

export async function saveRunRecipe(runId: string, r: { presetData?: string | null; edition?: string | null; baseRom?: string | null; worldSeed?: number | null }): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (r.presetData != null) patch.preset_data = r.presetData
  if (r.edition != null) patch.edition = r.edition
  if (r.baseRom != null) patch.base_rom = r.baseRom
  if (r.worldSeed != null) patch.world_seed = r.worldSeed
  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from('runs').update(patch).eq('id', runId)
  if (error) throw new Error(error.message)
}

export async function fetchRunRecipe(runId: string): Promise<RunRecipe | null> {
  const { data, error } = await supabase.from('runs').select('preset_data, edition, world_seed, base_rom').eq('id', runId).single()
  if (error) return null
  return (data as RunRecipe) ?? null
}
