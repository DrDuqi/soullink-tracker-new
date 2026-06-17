-- ============================================================================
-- SoulLink Tracker — Migration v9: Supabase Auth, Profile & Ownership
-- Im Supabase SQL-Editor ausführen (NACH schema.sql + migration_v5..v8).
--
-- ⚠️  ACHTUNG: Diese Migration macht einen SAUBEREN NEUSTART und LÖSCHT alle
--     bestehenden Runs/Spieler/Encounters/SoulLinks/Requests/Team-Slots/Logs.
--     Profile & Auth-User bleiben unberührt.
--
-- Voraussetzung: In Supabase → Authentication → Providers → Email den Schalter
--   "Confirm email" DEAKTIVIEREN (damit Registrierung sofort einloggt).
-- ============================================================================

-- 0) Sauberer Neustart der Spieldaten (CASCADE leert alle abhängigen Tabellen)
truncate table runs cascade;

-- 1) Profile-Tabelle (1:1 zu auth.users)
create table if not exists profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  username     text not null,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz default now(),
  last_seen    timestamptz default now()
);

-- Eindeutiger, case-insensitiver Benutzername
create unique index if not exists profiles_username_lower_idx
  on profiles (lower(username));

-- 2) Ownership-Spalten
alter table runs
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

alter table players
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

-- Ein Auth-User kann pro Run nur EIN Spieler sein
create unique index if not exists players_run_auth_uid_idx
  on players (run_id, auth_user_id) where auth_user_id is not null;

-- 3) RLS für profiles aktivieren (übrige Tabellen sind bereits aktiv)
alter table profiles enable row level security;

-- 4) Alte "allow all" Policies entfernen
drop policy if exists "Allow all on runs"          on runs;
drop policy if exists "Allow all on players"       on players;
drop policy if exists "Allow all on encounters"    on encounters;
drop policy if exists "Allow all on soul_links"    on soul_links;
drop policy if exists "Allow all on link_requests" on link_requests;
drop policy if exists "Allow all on team_slots"    on team_slots;
drop policy if exists "Allow all on activity_log"  on activity_log;

-- 5) Helper: ist der eingeloggte User Mitglied dieses Runs?
--    SECURITY DEFINER umgeht RLS-Rekursion innerhalb der Policies.
create or replace function public.is_run_member(p_run_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from players
    where players.run_id = p_run_id
      and players.auth_user_id = auth.uid()
  );
$$;

-- 6) Policies ---------------------------------------------------------------
-- Grundprinzip: LESEN offen (Realtime/Partneransicht bleiben stabil),
--               SCHREIBEN nur für eingeloggte Mitglieder / eigene Daten.

-- PROFILES: jeder darf lesen; nur eigenes Profil anlegen/ändern
create policy "profiles read"        on profiles for select using (true);
create policy "profiles insert self" on profiles for insert to authenticated with check (user_id = auth.uid());
create policy "profiles update self" on profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RUNS: lesen offen; nur als eigener Owner erstellen; nur Owner ändern/löschen
create policy "runs read"   on runs for select using (true);
create policy "runs insert" on runs for insert to authenticated with check (owner_user_id = auth.uid());
create policy "runs update" on runs for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "runs delete" on runs for delete to authenticated using (owner_user_id = auth.uid());

-- PLAYERS: lesen offen; man darf nur SICH SELBST eintragen/ändern/entfernen
create policy "players read"   on players for select using (true);
create policy "players insert" on players for insert to authenticated with check (auth_user_id = auth.uid());
create policy "players update" on players for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy "players delete" on players for delete to authenticated using (auth_user_id = auth.uid());

-- Spieldaten: lesen offen; schreiben nur als Mitglied des Runs.
-- (Mitglied-Scope deckt die Partner-Bestätigungs-Flows ab: Tod/Revive/Team
--  schreiben beim Annehmen legitim auch die Zeilen des Partners.)
create policy "encounters read"  on encounters    for select using (true);
create policy "encounters write" on encounters    for all to authenticated using (public.is_run_member(run_id)) with check (public.is_run_member(run_id));

create policy "soul_links read"  on soul_links     for select using (true);
create policy "soul_links write" on soul_links     for all to authenticated using (public.is_run_member(run_id)) with check (public.is_run_member(run_id));

create policy "requests read"    on link_requests  for select using (true);
create policy "requests write"   on link_requests  for all to authenticated using (public.is_run_member(run_id)) with check (public.is_run_member(run_id));

create policy "team_slots read"  on team_slots     for select using (true);
create policy "team_slots write" on team_slots     for all to authenticated using (public.is_run_member(run_id)) with check (public.is_run_member(run_id));

create policy "activity read"    on activity_log   for select using (true);
create policy "activity write"   on activity_log   for all to authenticated using (public.is_run_member(run_id)) with check (public.is_run_member(run_id));

-- 7) Realtime: Tabellen sind bereits in der Publication (siehe schema.sql).
--    Da SELECT für alle offen ist, funktioniert postgres_changes unverändert.
