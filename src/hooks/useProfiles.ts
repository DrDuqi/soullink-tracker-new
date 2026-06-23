import { useCallback, useEffect, useState } from 'react'
import { getPlatform, type Profile, type NewProfileInput, type ProfilePatch } from '../platform'

// Loads + mutates local game profiles through the PlatformBridge. `available` is
// false when no Companion is reachable (dev / not started) → the UI shows a hint
// instead of an empty list. Every mutation reloads so the view stays authoritative
// (the Companion's profiles.json is the single source of truth).
export function useProfiles() {
  const platform = getPlatform()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)

  const reload = useCallback(async () => {
    const list = await platform.listProfiles()
    if (list) { setProfiles(list.profiles); setActiveId(list.activeProfileId); setAvailable(true) }
    else { setProfiles([]); setActiveId(null); setAvailable(false) }
    setLoading(false)
  }, [platform])

  useEffect(() => { reload() }, [reload])

  const create = useCallback(async (input: NewProfileInput) => { const p = await platform.createProfile(input); await reload(); return p }, [platform, reload])
  const update = useCallback(async (id: string, patch: ProfilePatch) => { const p = await platform.updateProfile(id, patch); await reload(); return p }, [platform, reload])
  const remove = useCallback(async (id: string) => { const ok = await platform.deleteProfile(id); await reload(); return ok }, [platform, reload])
  const duplicate = useCallback(async (id: string) => { const p = await platform.duplicateProfile(id); await reload(); return p }, [platform, reload])
  const select = useCallback(async (id: string) => { await platform.setActiveProfile(id); await reload() }, [platform, reload])

  const active = profiles.find((p) => p.id === activeId) ?? null
  return { profiles, activeId, active, loading, available, reload, create, update, remove, duplicate, select }
}
