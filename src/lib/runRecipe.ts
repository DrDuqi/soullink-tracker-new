import { supabase } from './supabase'

// The shared randomization recipe stored ON the run. The host writes it once; joining
// players read it to reproduce the SAME rules/edition/FVX version locally — but each
// gets their own deterministic per-slot seed (see randomizerSync). `world_seed` now
// holds the run MASTER seed (always set); `same_world` true → everyone uses it directly
// (identical world), false → derive a per-player seed from it. (migration v15 + v16)
export interface RunRecipe {
  preset_data: string | null
  edition: string | null
  world_seed: number | null     // run master seed
  base_rom: string | null
  same_world: boolean | null
  fvx_version: string | null
}

export async function saveRunRecipe(runId: string, r: {
  presetData?: string | null; edition?: string | null; baseRom?: string | null
  masterSeed?: number | null; sameWorld?: boolean | null; fvxVersion?: string | null
}): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (r.presetData != null) patch.preset_data = r.presetData
  if (r.edition != null) patch.edition = r.edition
  if (r.baseRom != null) patch.base_rom = r.baseRom
  if (r.masterSeed != null) patch.world_seed = r.masterSeed
  if (r.sameWorld != null) patch.same_world = r.sameWorld
  if (r.fvxVersion != null) patch.fvx_version = r.fvxVersion
  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from('runs').update(patch).eq('id', runId)
  if (error) throw new Error(error.message)
}

export async function fetchRunRecipe(runId: string): Promise<RunRecipe | null> {
  const { data, error } = await supabase.from('runs').select('preset_data, edition, world_seed, base_rom, same_world, fvx_version').eq('id', runId).single()
  if (error) return null
  return (data as RunRecipe) ?? null
}
