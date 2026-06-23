import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Run, Player } from '../types/database'

// The signed-in user's SoulLinks, newest activity first. Shared by the website
// HomePage and the Companion Dashboard so the run list has ONE implementation.
export interface RunVM { run: Run; players: Player[]; partnerName: string; lastActivity: string }

export function useMyRuns() {
  const { user } = useAuth()
  return useQuery<RunVM[]>({
    queryKey: ['my-runs', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: mine } = await supabase.from('players').select('run_id').eq('auth_user_id', user!.id)
      const runIds = [...new Set((mine ?? []).map((r) => r.run_id as string))]
      if (runIds.length === 0) return []
      const [{ data: runs }, { data: players }, { data: acts }] = await Promise.all([
        supabase.from('runs').select('*').in('id', runIds),
        supabase.from('players').select('*').in('run_id', runIds),
        supabase.from('activity_log').select('run_id, created_at').in('run_id', runIds).order('created_at', { ascending: false }),
      ])
      const allP = (players as Player[]) ?? []
      const lastByRun = new Map<string, string>()
      for (const a of (acts as { run_id: string; created_at: string }[]) ?? []) if (!lastByRun.has(a.run_id)) lastByRun.set(a.run_id, a.created_at)
      return ((runs as Run[]) ?? []).map((run) => {
        const ps = allP.filter((p) => p.run_id === run.id)
        const partner = ps.find((p) => p.auth_user_id && p.auth_user_id !== user!.id)
        return { run, players: ps, partnerName: partner?.name ?? '—', lastActivity: lastByRun.get(run.id) ?? run.created_at }
      }).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
    },
  })
}
