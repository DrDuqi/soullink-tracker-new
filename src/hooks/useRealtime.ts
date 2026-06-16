import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useRealtime(runId: string | null) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!runId) return

    const channel = supabase
      .channel(`run:${runId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'encounters', filter: `run_id=eq.${runId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['encounters', runId] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'soul_links', filter: `run_id=eq.${runId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['soul_links', runId] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `run_id=eq.${runId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['players', runId] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'link_requests', filter: `run_id=eq.${runId}` }, () => {
        // Immediately refetch so both players see resolution without waiting for polling
        queryClient.refetchQueries({ queryKey: ['requests', runId] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_slots', filter: `run_id=eq.${runId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['team_slots', runId] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `run_id=eq.${runId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['activity_log', runId] })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [runId, queryClient])
}
