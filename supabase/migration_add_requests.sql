-- Migration: link_requests Tabelle hinzufügen
-- Nur ausführen wenn das Schema bereits existiert (d.h. runs/players/encounters/soul_links schon vorhanden sind)

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
  created_at  timestamptz default now(),
  resolved_at timestamptz
);

alter table link_requests enable row level security;
create policy "Allow all on link_requests" on link_requests for all using (true);

alter publication supabase_realtime add table link_requests;
