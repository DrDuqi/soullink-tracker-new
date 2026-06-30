// Preset transport — HTTP layer for the Companion's /api/presets endpoints.
// A preset is the rule set (separate from the seed). null when no Companion.

import { EMU_BASE, USES_COMPANION } from './companion'

export interface Preset {
  id: string
  name: string
  edition: string | null
  description?: string | null
  builtin: boolean
}

export async function fetchPresets(edition?: string): Promise<Preset[] | null> {
  if (!USES_COMPANION) return null
  try {
    const r = await fetch(`${EMU_BASE}/api/presets${edition ? `?edition=${encodeURIComponent(edition)}` : ''}`, { cache: 'no-store' })
    const j = await r.json().catch(() => null)
    return j?.ok ? (j.presets as Preset[]) : null
  } catch { return null }
}

export interface ImportPresetInput { name: string; edition?: string | null; sourceFile: string }
export async function importPresetHttp(input: ImportPresetInput): Promise<Preset | null> {
  if (!USES_COMPANION) return null
  try {
    const r = await fetch(`${EMU_BASE}/api/presets/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) })
    const j = await r.json().catch(() => null)
    return j?.ok ? (j.preset as Preset) : null
  } catch { return null }
}

export async function renamePresetHttp(id: string, name: string): Promise<boolean> {
  if (!USES_COMPANION) return false
  try {
    const r = await fetch(`${EMU_BASE}/api/presets?id=${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
    const j = await r.json().catch(() => null)
    return !!j?.ok
  } catch { return false }
}

export async function deletePresetHttp(id: string): Promise<boolean> {
  if (!USES_COMPANION) return false
  try {
    const r = await fetch(`${EMU_BASE}/api/presets?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    const j = await r.json().catch(() => null)
    return !!j?.ok
  } catch { return false }
}

/** Auto-import the newest .rnqs the user saved in FVX after `sinceMs` (no file dialog).
 *  `opts.name`/`opts.edition` name the preset so the user never types a filename. */
export interface GrabResult { preset: Preset | null; detecting: boolean; error?: string | null }
export async function grabRulesHttp(sinceMs: number, opts?: { name?: string; edition?: string | null }): Promise<GrabResult> {
  if (!USES_COMPANION) return { preset: null, detecting: false }
  try {
    const q = new URLSearchParams({ since: String(sinceMs) })
    if (opts?.name) q.set('name', opts.name)
    if (opts?.edition) q.set('edition', opts.edition)
    const r = await fetch(`${EMU_BASE}/api/presets/grab?${q.toString()}`, { method: 'POST' })
    const j = await r.json().catch(() => null)
    return { preset: j?.ok && j.found ? (j.preset as Preset) : null, detecting: !!j?.detecting, error: j?.error ?? null }
  } catch { return { preset: null, detecting: false, error: 'unreachable' } }
}
