import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { useRunStore } from '../store/runStore'
import { useToastStore } from '../store/toastStore'
import type { TeamSlot } from '../types/database'

export function useTeamSlots(runId: string | null) {
  return useQuery({
    queryKey: ['team_slots', runId],
    queryFn: async () => {
      if (!runId) return []
      const { data, error } = await supabase
        .from('team_slots')
        .select('*')
        .eq('run_id', runId)
        .order('slot_position', { ascending: true })
      if (error) {
        console.error('[useTeamSlots] SELECT FEHLER:', {
          message: error.message, code: error.code,
          details: error.details, hint: error.hint,
          runId,
        })
        throw error
      }
      return data as TeamSlot[]
    },
    enabled: !!runId,
  })
}

interface AddToTeamParams {
  runId: string
  playerId: string
  encounterId: string
  slotPosition: number
  pokemonName?: string
}

function supabaseErrMsg(err: { message: string; code: string; details: string | null; hint: string | null }) {
  return `${err.message} [Code:${err.code}${err.hint ? ' Hint:' + err.hint : ''}${err.details ? ' Details:' + err.details : ''}]`
}

export function useAddToTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: AddToTeamParams) => {
      const { runId, playerId, encounterId, slotPosition, pokemonName } = params

      console.log('[useAddToTeam] START', { runId, playerId, encounterId, slotPosition, pokemonName })

      // ── Step 1: Remove this encounter from any existing slot ──────────────
      const { error: delEncErr } = await supabase
        .from('team_slots')
        .delete()
        .eq('player_id', playerId)
        .eq('encounter_id', encounterId)

      if (delEncErr) {
        console.error('[useAddToTeam] Schritt 1 FEHLER (delete by encounter_id):', {
          message: delEncErr.message, code: delEncErr.code,
          details: delEncErr.details, hint: delEncErr.hint,
          params: { player_id: playerId, encounter_id: encounterId },
        })
        throw new Error(`[S1] ${supabaseErrMsg(delEncErr)}`)
      }
      console.log('[useAddToTeam] Schritt 1 OK')

      // ── Step 2: Clear whatever is already in the target slot ──────────────
      const { error: delSlotErr } = await supabase
        .from('team_slots')
        .delete()
        .eq('player_id', playerId)
        .eq('slot_position', slotPosition)

      if (delSlotErr) {
        console.error('[useAddToTeam] Schritt 2 FEHLER (delete by slot_position):', {
          message: delSlotErr.message, code: delSlotErr.code,
          details: delSlotErr.details, hint: delSlotErr.hint,
          params: { player_id: playerId, slot_position: slotPosition },
        })
        throw new Error(`[S2] ${supabaseErrMsg(delSlotErr)}`)
      }
      console.log('[useAddToTeam] Schritt 2 OK')

      // ── Step 3: Insert fresh row ──────────────────────────────────────────
      const insertPayload = {
        run_id: runId,
        player_id: playerId,
        encounter_id: encounterId,
        slot_position: slotPosition,
      }
      console.log('[useAddToTeam] Schritt 3 INSERT payload:', insertPayload)

      const { data, error: insertErr } = await supabase
        .from('team_slots')
        .insert(insertPayload)
        .select('*')

      if (insertErr) {
        console.error('[useAddToTeam] Schritt 3 FEHLER (insert):', {
          message: insertErr.message, code: insertErr.code,
          details: insertErr.details, hint: insertErr.hint,
          payload: insertPayload,
        })
        throw new Error(`[S3] ${supabaseErrMsg(insertErr)}`)
      }

      const slot = data?.[0]
      if (!slot) {
        console.error('[useAddToTeam] Schritt 3: kein Datensatz zurückgegeben, data:', data)
        throw new Error('[S3] Kein Datensatz zurückgegeben (leeres Array)')
      }
      console.log('[useAddToTeam] Schritt 3 OK, slot:', slot)

      return { slot: slot as TeamSlot, pokemonName: pokemonName ?? '' }
    },

    onSuccess: async ({ slot, pokemonName }) => {
      queryClient.invalidateQueries({ queryKey: ['team_slots', slot.run_id] })
      const { myPlayerId, players } = useRunStore.getState()
      const myPlayer = players.find((p) => p.id === myPlayerId)
      if (myPlayer) {
        await logActivity({
          runId: slot.run_id,
          playerId: myPlayerId,
          eventType: 'team_added',
          description: `${myPlayer.name} hat ${pokemonName || 'ein Pokémon'} ins Hauptteam aufgenommen`,
          encounterId: slot.encounter_id,
          pokemonName: pokemonName || null,
        })
        queryClient.invalidateQueries({ queryKey: ['activity_log', slot.run_id] })
      }
    },

    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[useAddToTeam] onError:', err)
      const { show } = useToastStore.getState()
      // Show exact error so user can identify the cause
      show(`Team-Fehler: ${msg}`, 'error')
    },
  })
}

export function useRemoveFromTeam() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      runId,
      pokemonName,
      encounterId,
    }: {
      id: string
      runId: string
      pokemonName?: string
      encounterId?: string
    }) => {
      const { error } = await supabase.from('team_slots').delete().eq('id', id)
      if (error) {
        console.error('[useRemoveFromTeam] FEHLER:', {
          message: error.message, code: error.code,
          details: error.details, hint: error.hint,
        })
        throw error
      }
      return { runId, pokemonName: pokemonName ?? '', encounterId: encounterId ?? null }
    },
    onSuccess: async ({ runId, pokemonName, encounterId }) => {
      queryClient.invalidateQueries({ queryKey: ['team_slots', runId] })
      const { myPlayerId, players } = useRunStore.getState()
      const myPlayer = players.find((p) => p.id === myPlayerId)
      if (myPlayer) {
        await logActivity({
          runId,
          playerId: myPlayerId,
          eventType: 'team_removed',
          description: `${myPlayer.name} hat ${pokemonName || 'ein Pokémon'} aus dem Hauptteam entfernt`,
          encounterId,
          pokemonName: pokemonName || null,
        })
        queryClient.invalidateQueries({ queryKey: ['activity_log', runId] })
      }
    },
    onError: (err) => {
      console.error('[useRemoveFromTeam] Fehler:', err)
      const { show } = useToastStore.getState()
      show('Fehler beim Entfernen aus dem Team.', 'error')
    },
  })
}
