-- Migration v3: Team Slots + Activity Log
-- Auf bestehende DB (v2) ausführen

-- 1. Main-Team Slots (max 6 pro Spieler)
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

-- 2. Aktivitäts-Log
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

-- 3. RLS
alter table team_slots enable row level security;
alter table activity_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'team_slots' and policyname = 'Allow all on team_slots') then
    create policy "Allow all on team_slots" on team_slots for all using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'activity_log' and policyname = 'Allow all on activity_log') then
    create policy "Allow all on activity_log" on activity_log for all using (true);
  end if;
end $$;

-- 4. Realtime
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'team_slots') then
    alter publication supabase_realtime add table team_slots;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'activity_log') then
    alter publication supabase_realtime add table activity_log;
  end if;
end $$;
