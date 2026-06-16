-- Migration v2: Neue Felder + link_requests Tabelle
-- Nur ausführen wenn Schema v1 bereits existiert (encounters/soul_links/link_requests vorhanden)
-- REIHENFOLGE BEACHTEN

-- 1. Encounters: types-Spalte hinzufügen
alter table encounters add column if not exists types text[];

-- 2. soul_links: route_match_type hinzufügen
alter table soul_links add column if not exists route_match_type text
  check (route_match_type in ('exact', 'similar', 'manual_exception'));

-- 3. link_requests: route_match_type hinzufügen (falls Tabelle aus v1 bereits existiert)
alter table link_requests add column if not exists route_match_type text
  check (route_match_type in ('exact', 'similar', 'manual_exception'));

-- 4. Falls link_requests noch nicht existiert (direkt von v0 kommend):
create table if not exists link_requests (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade not null,
  request_type text not null check (request_type in ('link', 'death')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  requested_by_player_id uuid references players(id) on delete cascade not null,
  target_player_id       uuid references players(id) on delete cascade not null,
  encounter1_id uuid references encounters(id) on delete cascade,
  encounter2_id uuid references encounters(id) on delete cascade,
  soul_link_id         uuid references soul_links(id) on delete cascade,
  trigger_encounter_id uuid references encounters(id) on delete set null,
  route_match_type text check (route_match_type in ('exact', 'similar', 'manual_exception')),
  created_at  timestamptz default now(),
  resolved_at timestamptz
);

-- 5. RLS & Realtime für link_requests (idempotent)
alter table link_requests enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'link_requests' and policyname = 'Allow all on link_requests') then
    create policy "Allow all on link_requests" on link_requests for all using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'link_requests'
  ) then
    alter publication supabase_realtime add table link_requests;
  end if;
end $$;
