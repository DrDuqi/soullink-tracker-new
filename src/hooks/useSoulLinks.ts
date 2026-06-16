import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { useRunStore } from '../store/runStore'
import type { SoulLink, SoulLinkPair, Encounter } from '../types/database'

export function useSoulLinks(runId: string | null) {
  return useQuery({
    queryKey: ['soul_links', runId],
    queryFn: async () => {
      if (!runId) return []
      const { data, error } = await supabase
        .from('soul_links')
        .select('*')
        .eq('run_id', runId)
      if (error) throw error
      return data as SoulLink[]
    },
    enabled: !!runId,
  })
}

export function useSoulLinkPairs(runId: string | null, encounters: Encounter[]) {
  const { data: links = [] } = useSoulLinks(runId)

  const pairs: SoulLinkPair[] = links
    .map((link) => {
      const enc1 = encounters.find((e) => e.id === link.encounter1_id)
      const enc2 = encounters.find((e) => e.id === link.encounter2_id)
      if (!enc1 || !enc2) return null
      return {
        id: link.id,
        run_id: link.run_id,
        encounter1: enc1,
        encounter2: enc2,
        location: enc1.location,
        route_match_type: link.route_match_type ?? null,
      }
    })
    .filter(Boolean) as SoulLinkPair[]

  return pairs
}

export function useCreateSoulLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (link: Omit<SoulLink, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('soul_links').insert(link).select().single()
      if (error) throw error
      return data as SoulLink
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['soul_links', data.run_id] })
    },
  })
}

export function useCreateSoulLinkWithLog() {
  const queryClient = useQueryClient()
  const createLink = useCreateSoulLink()
  return useMutation({
    mutationFn: async ({
      link,
      enc1Name,
      enc2Name,
      enc1Id,
      enc2Id,
    }: {
      link: Omit<SoulLink, 'id' | 'created_at'>
      enc1Name: string
      enc2Name: string
      enc1Id?: string
      enc2Id?: string
    }) => {
      const result = await createLink.mutateAsync(link)
      return { result, enc1Name, enc2Name, enc1Id: enc1Id ?? null, enc2Id: enc2Id ?? null }
    },
    onSuccess: async ({ result, enc1Name, enc2Name }) => {
      const { myPlayerId } = useRunStore.getState()
      await logActivity({
        runId: result.run_id,
        playerId: myPlayerId,
        eventType: 'soul_link_created',
        description: `Soul Link erstellt: ${enc1Name} ↔ ${enc2Name}`,
        pokemonName: enc1Name,
      })
      queryClient.invalidateQueries({ queryKey: ['activity_log', result.run_id] })
    },
  })
}

export function useDeleteSoulLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      runId,
      enc1Name,
      enc2Name,
    }: {
      id: string
      runId: string
      enc1Name?: string
      enc2Name?: string
    }) => {
      const { error } = await supabase.from('soul_links').delete().eq('id', id)
      if (error) throw error
      return { id, runId, enc1Name: enc1Name ?? '', enc2Name: enc2Name ?? '' }
    },
    onSuccess: async ({ runId, enc1Name, enc2Name }) => {
      queryClient.invalidateQueries({ queryKey: ['soul_links', runId] })
      const { myPlayerId, players } = useRunStore.getState()
      const myPlayer = players.find((p) => p.id === myPlayerId)
      if (myPlayer) {
        await logActivity({
          runId,
          playerId: myPlayerId,
          eventType: 'soul_link_deleted',
          description: `${myPlayer.name} hat den Soul Link aufgehoben${enc1Name ? `: ${enc1Name} ↔ ${enc2Name}` : ''}`,
        })
        queryClient.invalidateQueries({ queryKey: ['activity_log', runId] })
      }
    },
  })
}
