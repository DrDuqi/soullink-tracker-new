export type PokemonStatus = 'alive' | 'dead' | 'boxed' | 'missing'
export type RequestType = 'link' | 'death' | 'team_sync' | 'team_remove' | 'team_move' | 'revive'
export type RequestStatus = 'pending' | 'accepted' | 'rejected'
export type RouteMatchType = 'exact' | 'similar' | 'manual_exception'

export interface Profile {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  created_at: string
  last_seen: string | null
}

export interface Run {
  id: string
  name: string
  game: string
  created_at: string
  share_code: string
  owner_user_id?: string | null
  max_players?: number | null   // 2 or 3 (default 2; column added in migration v13)
  status?: string | null        // 'active' | 'won' | 'lost' (v16)
  parent_run_id?: string | null // the attempt this one came from (v16)
  attempt_number?: number | null// SoulLink #N (v16)
}

export interface Player {
  id: string
  run_id: string
  name: string
  player_number: number   // 1, 2 or 3 (3-player runs since v13)
  created_at: string
  auth_user_id?: string | null
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
  emu_pid?: string | null   // stable emulator identity (PID), survives evolution; null for manual encounters
  created_at: string
}

export interface SoulLink {
  id: string
  run_id: string
  encounter1_id: string | null   // Spieler 1 (nullable seit v14 für unvollständige 3er-Links)
  encounter2_id: string | null   // Spieler 2
  encounter3_id?: string | null  // Spieler 3 (v14)
  route_match_type: RouteMatchType | null
  created_at: string
}

// 2-Spieler-Paar (unverändert für max_players = 2).
export interface SoulLinkPair {
  id: string
  run_id: string
  encounter1: Encounter
  encounter2: Encounter
  location: string
  route_match_type: RouteMatchType | null
}

// Verallgemeinerter SoulLink für 3-Spieler-Runs (1–3 Mitglieder).
export interface SoulLinkMember {
  playerNumber: number
  player?: Player
  encounter: Encounter
}
export interface SoulLinkGroup {
  id: string
  run_id: string
  members: SoulLinkMember[]          // vorhandene Mitglieder, nach player_number sortiert
  missingPlayerNumbers: number[]     // erwartete Slots (1..maxPlayers) ohne Pokémon
  complete: boolean                  // alle erwarteten Slots gefüllt
  anyDead: boolean                   // mind. ein Mitglied besiegt → ganzer Link betroffen
  location: string | null
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
