import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { useRunStore } from '../store/runStore'
import type { SoulLink, SoulLinkPair, SoulLinkGroup, SoulLinkMember, Encounter, Player, RouteMatchType } from '../types/database'

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

// 3-Spieler-Runs: jeden Link in eine Gruppe (1–3 Mitglieder, per player_number)
// auflösen. encounterN_id ↔ Spieler N. Wird NUR bei max_players = 3 genutzt.
export function useSoulLinkGroups(
  runId: string | null, encounters: Encounter[], players: Player[], maxPlayers: number,
): SoulLinkGroup[] {
  const { data: links = [] } = useSoulLinks(runId)
  const byId = new Map(encounters.map((e) => [e.id, e]))
  const playerByNum = new Map(players.map((p) => [p.player_number, p]))
  const expected = Array.from({ length: Math.max(2, Math.min(3, maxPlayers)) }, (_, i) => i + 1)

  return links
    .map((link): SoulLinkGroup => {
      const slots: [number, string | null | undefined][] = [
        [1, link.encounter1_id], [2, link.encounter2_id], [3, link.encounter3_id],
      ]
      const members: SoulLinkMember[] = []
      for (const [pn, encId] of slots) {
        if (!encId) continue
        const enc = byId.get(encId)
        if (enc) members.push({ playerNumber: pn, player: playerByNum.get(pn), encounter: enc })
      }
      members.sort((a, b) => a.playerNumber - b.playerNumber)
      const present = new Set(members.map((m) => m.playerNumber))
      const missingPlayerNumbers = expected.filter((n) => !present.has(n))
      return {
        id: link.id,
        run_id: link.run_id,
        members,
        missingPlayerNumbers,
        complete: missingPlayerNumbers.length === 0 && members.length === expected.length,
        anyDead: members.some((m) => m.encounter.status === 'dead'),
        location: members[0]?.encounter.location ?? null,
        route_match_type: link.route_match_type ?? null,
      }
    })
    .filter((g) => g.members.length > 0)
}

// 3-Spieler: SoulLink DIREKT anlegen (keine Bestätigungs-Anfrage). Bis zu 3 Slots.
export function useCreateSoulLink3() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ link, names }: {
      link: { run_id: string; encounter1_id: string | null; encounter2_id: string | null; encounter3_id: string | null; route_match_type: RouteMatchType | null }
      names: string[]
    }) => {
      const { data, error } = await supabase.from('soul_links').insert(link).select().single()
      if (error) throw error
      return { data: data as SoulLink, names }
    },
    onSuccess: async ({ data, names }) => {
      queryClient.invalidateQueries({ queryKey: ['soul_links', data.run_id] })
      const { myPlayerId } = useRunStore.getState()
      await logActivity({
        runId: data.run_id, playerId: myPlayerId, eventType: 'soul_link_created',
        description: `3er-SoulLink erstellt: ${names.join(' ↔ ')}`,
      })
      queryClient.invalidateQueries({ queryKey: ['activity_log', data.run_id] })
    },
  })
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
