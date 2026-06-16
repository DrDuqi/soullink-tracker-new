-- SoulLink Tracker — Vollständiges Schema v4
-- Komplett neu in Supabase SQL Editor ausführen (leere Datenbank)

create extension if not exists "pgcrypto";

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game text not null default 'Rot',
  share_code text unique not null default substr(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade not null,
  name text not null,
  player_number int not null check (player_number in (1, 2)),
  created_at timestamptz default now(),
  unique(run_id, player_number)
);

create table if not exists encounters (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade not null,
  run_id uuid references runs(id) on delete cascade not null,
  location text not null,
  pokemon_name text not null,
  pokemon_id int,
  nickname text,
  status text not null default 'alive' check (status in ('alive', 'dead', 'boxed', 'missing')),
  notes text,
  types text[],
  created_at timestamptz default now()
);

create table if not exists soul_links (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade not null,
  encounter1_id uuid references encounters(id) on delete cascade not null,
  encounter2_id uuid references encounters(id) on delete cascade not null,
  route_match_type text check (route_match_type in ('exact', 'similar', 'manual_exception')),
  created_at timestamptz default now(),
  constraint different_encounters check (encounter1_id != encounter2_id)
);

create table if not exists link_requests (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade not null,
  request_type text not null check (request_type in ('link', 'death', 'team_sync', 'team_remove', 'team_move')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  requested_by_player_id uuid references players(id) on delete cascade not null,
  target_player_id       uuid references players(id) on delete cascade not null,
  encounter1_id uuid references encounters(id) on delete cascade,
  encounter2_id uuid references encounters(id) on delete cascade,
  soul_link_id         uuid references soul_links(id) on delete cascade,
  trigger_encounter_id uuid references encounters(id) on delete set null,
  route_match_type text check (route_match_type in ('exact', 'similar', 'manual_exception')),
  slot_position int,
  partner_slot_position int,
  created_at  timestamptz default now(),
  resolved_at timestamptz
);

create table if not exists team_slots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade not null,
  player_id uuid references players(id) on delete cascade not null,
  encounter_id uuid references encounters(id) on delete cascade not null,
  slot_position int not null check (slot_position between 1 and 6),
  created_at timestamptz default now(),
  unique(player_id, slot_position),
  unique(player_id, encounter_id)
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade not null,
  player_id uuid references players(id) on delete set null,
  event_type text not null,
  description text not null,
  encounter_id uuid references encounters(id) on delete set null,
  pokemon_name text,
  created_at timestamptz default now()
);

-- RLS
alter table runs           enable row level security;
alter table players        enable row level security;
alter table encounters     enable row level security;
alter table soul_links     enable row level security;
alter table link_requests  enable row level security;
alter table team_slots     enable row level security;
alter table activity_log   enable row level security;

create policy "Allow all on runs"          on runs          for all using (true);
create policy "Allow all on players"       on players       for all using (true);
create policy "Allow all on encounters"    on encounters    for all using (true);
create policy "Allow all on soul_links"    on soul_links    for all using (true);
create policy "Allow all on link_requests" on link_requests for all using (true);
create policy "Allow all on team_slots"    on team_slots    for all using (true);
create policy "Allow all on activity_log"  on activity_log  for all using (true);

-- Realtime
alter publication supabase_realtime add table encounters;
alter publication supabase_realtime add table soul_links;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table link_requests;
alter publication supabase_realtime add table team_slots;
alter publication supabase_realtime add table activity_log;
