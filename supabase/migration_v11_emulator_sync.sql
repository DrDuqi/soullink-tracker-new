-- ============================================================================
-- SoulLink Tracker — Migration v11: Emulator Live-Sync  (PHASE 3 — VORBEREITUNG)
--
-- ⚠️  NOCH NICHT AUSFÜHREN. Dies ist die vorbereitete Struktur für die spätere
--     Supabase-Anbindung des Emulator-Live-Sync. Erst ausführen, wenn Phase 3
--     bewusst aktiviert wird. Es werden KEINE bestehenden Tabellen verändert.
--
-- Speichert NUR Spielstatus-Daten (ein Live-Snapshot pro Spieler & Run).
-- KEINE ROM-/Save-Dateien. RLS: lesen offen (wie der Rest, Realtime-stabil),
-- schreiben nur der eingeloggte Eigentümer der Zeile & Run-Mitglied.
-- ============================================================================

create table if not exists emulator_live (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references runs(id)    on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  game        text,
  payload     jsonb not null default '{}'::jsonb,   -- { trainer, team:[{slot,speciesId,level,hp,maxHp,status,fainted}] }
  updated_at  timestamptz not null default now(),
  unique (run_id, player_id)
);

create index if not exists emulator_live_run_idx on emulator_live (run_id);

alter table emulator_live enable row level security;

-- Lesen: offen (Mitglieder sehen das Live-Team des Partners; Realtime bleibt simpel)
create policy "emulator_live read" on emulator_live for select using (true);

-- Schreiben: nur die eigene Zeile (user_id = auth.uid()) UND als Run-Mitglied.
-- public.is_run_member(uuid) stammt aus migration_v9_auth.sql.
create policy "emulator_live insert" on emulator_live for insert to authenticated
  with check (user_id = auth.uid() and public.is_run_member(run_id));
create policy "emulator_live update" on emulator_live for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_run_member(run_id));
create policy "emulator_live delete" on emulator_live for delete to authenticated
  using (user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table emulator_live;
