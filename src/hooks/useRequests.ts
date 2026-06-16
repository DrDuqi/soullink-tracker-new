import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { useRunStore } from '../store/runStore'
import type {
  LinkRequest,
  RequestWithDetails,
  Encounter,
  Player,
} from '../types/database'
import { useCreateSoulLink } from './useSoulLinks'
import { useUpdateEncounterStatus } from './useEncounters'
import { useToastStore } from '../store/toastStore'

export function useRequests(runId: string | null) {
  return useQuery({
    queryKey: ['requests', runId],
    queryFn: async () => {
      if (!runId) return []
      const { data, error } = await supabase
        .from('link_requests')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as LinkRequest[]
    },
    enabled: !!runId,
    refetchInterval: 5000,
  })
}

export function usePendingRequests(
  runId: string | null,
  encounters: Encounter[],
  players: Player[],
) {
  const { data: requests = [] } = useRequests(runId)

  const enriched: RequestWithDetails[] = requests
    .filter((r) => r.status === 'pending')
    .map((r) => {
      const requester = players.find((p) => p.id === r.requested_by_player_id)
      const target = players.find((p) => p.id === r.target_player_id)
      const enc1 = r.encounter1_id ? (encounters.find((e) => e.id === r.encounter1_id) ?? null) : null
      const enc2 = r.encounter2_id ? (encounters.find((e) => e.id === r.encounter2_id) ?? null) : null
      const triggerEnc = r.trigger_encounter_id
        ? (encounters.find((e) => e.id === r.trigger_encounter_id) ?? null)
        : null
      return {
        ...r,
        requesterName: requester?.name ?? 'Unbekannt',
        targetName: target?.name ?? 'Unbekannt',
        encounter1: enc1,
        encounter2: enc2,
        triggerEncounter: triggerEnc,
        linkedEncounter: null,
      }
    })

  return enriched
}

export function useCreateRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      req: Omit<LinkRequest, 'id' | 'created_at' | 'resolved_at' | 'status'>
    ) => {
      const { data, error } = await supabase
        .from('link_requests')
        .insert({ ...req, status: 'pending' })
        .select()
        .single()
      if (error) throw error
      return data as LinkRequest
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requests', data.run_id] })
    },
  })
}

export function useResolveRequest() {
  const queryClient = useQueryClient()
  const createSoulLink = useCreateSoulLink()
  const updateStatus = useUpdateEncounterStatus()
  const toast = useToastStore()

  return useMutation({
    mutationFn: async ({
      request,
      action,
      enc1Name,
      enc2Name,
      triggerName,
    }: {
      request: LinkRequest
      action: 'accepted' | 'rejected'
      enc1Name?: string
      enc2Name?: string
      triggerName?: string
    }) => {
      const resolved_at = new Date().toISOString()

      // Optimistically update local cache
      queryClient.setQueryData(
        ['requests', request.run_id],
        (old: LinkRequest[] | undefined) =>
          old?.map((r) => (r.id === request.id ? { ...r, status: action, resolved_at } : r)) ?? []
      )

      const { error } = await supabase
        .from('link_requests')
        .update({ status: action, resolved_at })
        .eq('id', request.id)
      if (error) throw error

      if (action === 'accepted') {
        if (request.request_type === 'link') {
          if (!request.encounter1_id || !request.encounter2_id) throw new Error('Fehlende Encounter-IDs')
          await createSoulLink.mutateAsync({
            run_id: request.run_id,
            encounter1_id: request.encounter1_id,
            encounter2_id: request.encounter2_id,
            route_match_type: request.route_match_type,
          })
        }

        if (request.request_type === 'death' && request.soul_link_id) {
          const { data: link, error: linkErr } = await supabase
            .from('soul_links')
            .select('*')
            .eq('id', request.soul_link_id)
            .single()
          if (linkErr || !link) throw new Error('Soul Link nicht gefunden')
          await Promise.all([
            updateStatus.mutateAsync({ id: link.encounter1_id, status: 'dead', runId: request.run_id }),
            updateStatus.mutateAsync({ id: link.encounter2_id, status: 'dead', runId: request.run_id }),
          ])
        }

        if (request.request_type === 'team_sync') {
          // Add requester's encounter (encounter1) to slot_position
          if (request.encounter1_id && request.slot_position != null) {
            await supabase.from('team_slots').delete()
              .eq('player_id', request.requested_by_player_id)
              .eq('encounter_id', request.encounter1_id)
            await supabase.from('team_slots').delete()
              .eq('player_id', request.requested_by_player_id)
              .eq('slot_position', request.slot_position)
            const { error: slotErr1 } = await supabase.from('team_slots').insert({
              run_id: request.run_id,
              player_id: request.requested_by_player_id,
              encounter_id: request.encounter1_id,
              slot_position: request.slot_position,
            })
            if (slotErr1) throw slotErr1
          }
          // Add partner's encounter (encounter2) to partner_slot_position
          if (request.encounter2_id && request.partner_slot_position != null) {
            await supabase.from('team_slots').delete()
              .eq('player_id', request.target_player_id)
              .eq('encounter_id', request.encounter2_id)
            await supabase.from('team_slots').delete()
              .eq('player_id', request.target_player_id)
              .eq('slot_position', request.partner_slot_position)
            const { error: slotErr2 } = await supabase.from('team_slots').insert({
              run_id: request.run_id,
              player_id: request.target_player_id,
              encounter_id: request.encounter2_id,
              slot_position: request.partner_slot_position,
            })
            if (slotErr2) throw slotErr2
          }
        }

        if (request.request_type === 'team_remove') {
          // Remove both encounters from team_slots
          if (request.encounter1_id) {
            await supabase.from('team_slots').delete()
              .eq('player_id', request.requested_by_player_id)
              .eq('encounter_id', request.encounter1_id)
          }
          if (request.encounter2_id) {
            await supabase.from('team_slots').delete()
              .eq('player_id', request.target_player_id)
              .eq('encounter_id', request.encounter2_id)
          }
        }

        if (request.request_type === 'revive') {
          if (request.encounter1_id && request.encounter2_id) {
            await Promise.all([
              updateStatus.mutateAsync({ id: request.encounter1_id, status: 'alive', runId: request.run_id }),
              updateStatus.mutateAsync({ id: request.encounter2_id, status: 'alive', runId: request.run_id }),
            ])
          }
        }

        if (request.request_type === 'team_move') {
          // Move requester's encounter to new slot
          if (request.encounter1_id && request.slot_position != null) {
            await supabase.from('team_slots').delete()
              .eq('player_id', request.requested_by_player_id)
              .eq('encounter_id', request.encounter1_id)
            await supabase.from('team_slots').delete()
              .eq('player_id', request.requested_by_player_id)
              .eq('slot_position', request.slot_position)
            const { error: mv1Err } = await supabase.from('team_slots').insert({
              run_id: request.run_id,
              player_id: request.requested_by_player_id,
              encounter_id: request.encounter1_id,
              slot_position: request.slot_position,
            })
            if (mv1Err) throw mv1Err
          }
          // Move partner's encounter to new slot
          if (request.encounter2_id && request.partner_slot_position != null) {
            await supabase.from('team_slots').delete()
              .eq('player_id', request.target_player_id)
              .eq('encounter_id', request.encounter2_id)
            await supabase.from('team_slots').delete()
              .eq('player_id', request.target_player_id)
              .eq('slot_position', request.partner_slot_position)
            const { error: mv2Err } = await supabase.from('team_slots').insert({
              run_id: request.run_id,
              player_id: request.target_player_id,
              encounter_id: request.encounter2_id,
              slot_position: request.partner_slot_position,
            })
            if (mv2Err) throw mv2Err
          }
        }
      }

      // team_sync rejected, team_remove rejected, team_move rejected: do nothing — encounters stay as-is

      return { request, action, enc1Name, enc2Name, triggerName }
    },
    onSuccess: async ({ request, action, enc1Name, enc2Name, triggerName }) => {
      if (action === 'accepted') {
        const msg =
          request.request_type === 'link' ? '✓ Soul Link akzeptiert!' :
          request.request_type === 'team_sync' ? '✓ Team-Aufnahme akzeptiert!' :
          request.request_type === 'team_remove' ? '✓ Aus Team entfernt.' :
          request.request_type === 'team_move' ? '✓ Slot-Wechsel durchgeführt.' :
          request.request_type === 'revive' ? '✓ Wiederbeleben akzeptiert!' :
          '✓ Tod bestätigt.'
        toast.show(msg, 'success')
      } else {
        const msg =
          request.request_type === 'link' ? 'Soul Link abgelehnt.' :
          request.request_type === 'team_sync' ? 'Team-Aufnahme abgelehnt.' :
          request.request_type === 'team_remove' ? 'Entfernung abgelehnt.' :
          request.request_type === 'team_move' ? 'Slot-Wechsel abgelehnt.' :
          request.request_type === 'revive' ? 'Wiederbeleben abgelehnt.' :
          'Tod abgelehnt.'
        toast.show(msg, 'warning')
      }

      // Force-refetch so both players sync immediately
      queryClient.refetchQueries({ queryKey: ['requests', request.run_id] })
      queryClient.invalidateQueries({ queryKey: ['soul_links', request.run_id] })
      queryClient.invalidateQueries({ queryKey: ['encounters', request.run_id] })
      if (
        request.request_type === 'death' ||
        request.request_type === 'team_sync' ||
        request.request_type === 'team_remove' ||
        request.request_type === 'team_move'
      ) {
        queryClient.invalidateQueries({ queryKey: ['team_slots', request.run_id] })
      }

      // Activity logging
      const { myPlayerId } = useRunStore.getState()
      if (request.request_type === 'link' && action === 'accepted') {
        await logActivity({
          runId: request.run_id,
          playerId: myPlayerId,
          eventType: 'soul_link_created',
          description: `Soul Link bestätigt: ${enc1Name ?? '?'} ↔ ${enc2Name ?? '?'}`,
        })
      } else if (request.request_type === 'death' && action === 'accepted') {
        await logActivity({
          runId: request.run_id,
          playerId: myPlayerId,
          eventType: 'death_confirmed',
          description: `Tod bestätigt – ${triggerName ?? 'Pokémon'} und sein Soul-Link-Partner sind gefallen`,
          pokemonName: triggerName,
        })
      } else if (request.request_type === 'team_sync' && action === 'accepted') {
        await logActivity({
          runId: request.run_id,
          playerId: myPlayerId,
          eventType: 'team_sync_accepted',
          description: `Team-Aufnahme bestätigt: ${enc1Name ?? '?'} und ${enc2Name ?? '?'} sind jetzt im Hauptteam`,
        })
      } else if (request.request_type === 'team_remove' && action === 'accepted') {
        await logActivity({
          runId: request.run_id,
          playerId: myPlayerId,
          eventType: 'team_removed',
          description: `Aus Hauptteam entfernt: ${enc1Name ?? '?'} und ${enc2Name ?? '?'}`,
        })
      } else if (request.request_type === 'team_move' && action === 'accepted') {
        await logActivity({
          runId: request.run_id,
          playerId: myPlayerId,
          eventType: 'team_moved',
          description: `Slot-Wechsel: ${enc1Name ?? '?'} und ${enc2Name ?? '?'} verschoben`,
        })
      } else if (request.request_type === 'revive' && action === 'accepted') {
        await logActivity({
          runId: request.run_id,
          playerId: myPlayerId,
          eventType: 'pokemon_revived',
          description: `Wiederbeleben bestätigt – ${enc1Name ?? '?'} und ${enc2Name ?? '?'} sind wieder am Leben`,
        })
      } else if (action === 'rejected') {
        const what =
          request.request_type === 'link' ? 'Soul Link-Anfrage' :
          request.request_type === 'team_sync' ? 'Team-Aufnahme' :
          request.request_type === 'team_remove' ? 'Team-Entfernung' :
          request.request_type === 'team_move' ? 'Slot-Wechsel' :
          request.request_type === 'revive' ? 'Wiederbeleben-Anfrage' :
          'Tod-Meldung'
        await logActivity({
          runId: request.run_id,
          playerId: myPlayerId,
          eventType: 'request_rejected',
          description: `${what} abgelehnt`,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['activity_log', request.run_id] })
    },
    onError: (_err, { request }) => {
      queryClient.invalidateQueries({ queryKey: ['requests', request.run_id] })
    },
  })
}

export function useSendDeathRequest() {
  const createRequest = useCreateRequest()
  return (params: {
    runId: string
    requestedByPlayerId: string
    targetPlayerId: string
    soulLinkId: string
    triggerEncounterId: string
  }) =>
    createRequest.mutateAsync({
      run_id: params.runId,
      request_type: 'death',
      requested_by_player_id: params.requestedByPlayerId,
      target_player_id: params.targetPlayerId,
      encounter1_id: null,
      encounter2_id: null,
      soul_link_id: params.soulLinkId,
      trigger_encounter_id: params.triggerEncounterId,
      route_match_type: null,
    })
}
