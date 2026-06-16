export type PokemonStatus = 'alive' | 'dead' | 'boxed' | 'missing'
export type RequestType = 'link' | 'death' | 'team_sync' | 'team_remove' | 'team_move' | 'revive'
export type RequestStatus = 'pending' | 'accepted' | 'rejected'
export type RouteMatchType = 'exact' | 'similar' | 'manual_exception'

export interface Run {
  id: string
  name: string
  game: string
  created_at: string
  share_code: string
}

export interface Player {
  id: string
  run_id: string
  name: string
  player_number: 1 | 2
  created_at: string
}

export interface Encounter {
  id: string
  player_id: string
  run_id: string
  location: string
  pokemon_name: string
  pokemon_id: number | null
  nickname: string | null
  status: PokemonStatus
  notes: string | null
  types: string[] | null
  sort_order?: number | null
  move_1: string | null
  move_2: string | null
  move_3: string | null
  move_4: string | null
  created_at: string
}

export interface SoulLink {
  id: string
  run_id: string
  encounter1_id: string
  encounter2_id: string
  route_match_type: RouteMatchType | null
  created_at: string
}

export interface SoulLinkPair {
  id: string
  run_id: string
  encounter1: Encounter
  encounter2: Encounter
  location: string
  route_match_type: RouteMatchType | null
}

export interface LinkRequest {
  id: string
  run_id: string
  request_type: RequestType
  status: RequestStatus
  requested_by_player_id: string
  target_player_id: string
  encounter1_id: string | null
  encounter2_id: string | null
  soul_link_id: string | null
  trigger_encounter_id: string | null
  route_match_type: RouteMatchType | null
  slot_position?: number | null
  partner_slot_position?: number | null
  created_at: string
  resolved_at: string | null
}

export interface RequestWithDetails extends LinkRequest {
  requesterName: string
  targetName: string
  encounter1: Encounter | null
  encounter2: Encounter | null
  triggerEncounter: Encounter | null
  linkedEncounter: Encounter | null
}

export interface TeamSlot {
  id: string
  run_id: string
  player_id: string
  encounter_id: string
  slot_position: number
  created_at: string
}

export interface ActivityLogEntry {
  id: string
  run_id: string
  player_id: string | null
  event_type: string
  description: string
  encounter_id: string | null
  pokemon_name: string | null
  created_at: string
}
