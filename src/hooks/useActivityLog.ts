import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ActivityLogEntry } from '../types/database'

export function useActivityLog(runId: string | null) {
  return useQuery({
    queryKey: ['activity_log', runId],
    queryFn: async () => {
      if (!runId) return []
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: false })
        .limit(60)
      if (error) throw error
      return data as ActivityLogEntry[]
    },
    enabled: !!runId,
    // Lightweight polling as fallback if realtime misses
    refetchInterval: 15000,
  })
}
