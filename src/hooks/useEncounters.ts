import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { useRunStore } from '../store/runStore'
import type { Encounter, PokemonStatus } from '../types/database'

export function useEncounters(runId: string | null) {
  return useQuery({
    queryKey: ['encounters', runId],
    queryFn: async () => {
      if (!runId) return []
      const { data, error } = await supabase
        .from('encounters')
        .select('*')
        .eq('run_id', runId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Encounter[]
    },
    enabled: !!runId,
  })
}

export function useAddEncounter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (encounter: Omit<Encounter, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('encounters').insert(encounter).select().single()
      if (error) throw error
      return data as Encounter
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['encounters', data.run_id] })
      const { myPlayerId, players } = useRunStore.getState()
      const myPlayer = players.find((p) => p.id === myPlayerId)
      if (myPlayer) {
        await logActivity({
          runId: data.run_id,
          playerId: myPlayerId,
          eventType: 'encounter_added',
          description: `${myPlayer.name} hat ${data.pokemon_name} gefangen (${data.location})`,
          encounterId: data.id,
          pokemonName: data.pokemon_name,
        })
        queryClient.invalidateQueries({ queryKey: ['activity_log', data.run_id] })
      }
    },
  })
}

export function useUpdateEncounterStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status, runId }: { id: string; status: PokemonStatus; runId: string }) => {
      const { error } = await supabase.from('encounters').update({ status }).eq('id', id)
      if (error) throw error
      if (status === 'dead') {
        // Auto-remove from team: dead Pokémon must never occupy a team slot
        await supabase.from('team_slots').delete().eq('encounter_id', id)
      }
      return { id, status, runId }
    },
    onSuccess: ({ runId, status }) => {
      queryClient.invalidateQueries({ queryKey: ['encounters', runId] })
      if (status === 'dead') {
        queryClient.invalidateQueries({ queryKey: ['team_slots', runId] })
      }
    },
  })
}

export function useUpdateEncounter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      runId,
      updates,
      prevPokemonName,
    }: {
      id: string
      runId: string
      updates: Partial<Pick<Encounter, 'pokemon_id' | 'pokemon_name' | 'types' | 'nickname' | 'notes' | 'status' | 'emu_pid'>>
      prevPokemonName?: string
    }) => {
      const { data, error } = await supabase.from('encounters').update(updates).eq('id', id).select().single()
      if (error) throw error
      return { data: data as Encounter, runId, prevPokemonName: prevPokemonName ?? '' }
    },
    onSuccess: async ({ data, runId, prevPokemonName }) => {
      queryClient.invalidateQueries({ queryKey: ['encounters', runId] })
      if (data.pokemon_name && prevPokemonName && data.pokemon_name !== prevPokemonName) {
        const { myPlayerId, players } = useRunStore.getState()
        const myPlayer = players.find((p) => p.id === myPlayerId)
        if (myPlayer) {
          await logActivity({
            runId,
            playerId: myPlayerId,
            eventType: 'pokemon_evolved',
            description: `${myPlayer.name}'s ${prevPokemonName} hat sich zu ${data.pokemon_name} entwickelt`,
            encounterId: data.id,
            pokemonName: data.pokemon_name,
          })
          queryClient.invalidateQueries({ queryKey: ['activity_log', runId] })
        }
      }
    },
  })
}

export function useReorderEncounters() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderedIds, runId }: { orderedIds: string[]; runId: string }) => {
      await Promise.all(
        orderedIds.map((id, idx) =>
          supabase.from('encounters').update({ sort_order: idx + 1 }).eq('id', id)
        )
      )
      return runId
    },
    onSuccess: (runId) => {
      queryClient.invalidateQueries({ queryKey: ['encounters', runId] })
    },
  })
}

export function useUpdateMoves() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id, runId, moves,
    }: {
      id: string
      runId: string
      moves: { move_1?: string | null; move_2?: string | null; move_3?: string | null; move_4?: string | null }
    }) => {
      const { data, error } = await supabase
        .from('encounters').update(moves).eq('id', id).select().single()
      if (error) throw error
      return { data: data as Encounter, runId }
    },
    onSuccess: async ({ data, runId }) => {
      queryClient.invalidateQueries({ queryKey: ['encounters', runId] })
      const { myPlayerId, players } = useRunStore.getState()
      const myPlayer = players.find((p) => p.id === myPlayerId)
      if (myPlayer) {
        await logActivity({
          runId,
          playerId: myPlayerId,
          eventType: 'moves_updated',
          description: `${myPlayer.name} hat Attacken für ${data.pokemon_name} geändert`,
          encounterId: data.id,
          pokemonName: data.pokemon_name,
        })
        queryClient.invalidateQueries({ queryKey: ['activity_log', runId] })
      }
    },
  })
}

export function useDeleteEncounter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, runId }: { id: string; runId: string }) => {
      const { error } = await supabase.from('encounters').delete().eq('id', id)
      if (error) throw error
      return { id, runId }
    },
    onSuccess: ({ runId }) => {
      queryClient.invalidateQueries({ queryKey: ['encounters', runId] })
      queryClient.invalidateQueries({ queryKey: ['soul_links', runId] })
      queryClient.invalidateQueries({ queryKey: ['team_slots', runId] })
    },
  })
}
