-- ============================================================================
-- SoulLink Tracker — Migration v13: 2-oder-3-Spieler-Runs
-- Im Supabase SQL-Editor ausführen (NACH migration_v10_run_management.sql).
--
-- ADDITIV & SICHER: bestehende 2-Spieler-Runs bleiben unverändert (max_players
-- = 2 als Default). Es werden KEINE Daten gelöscht. Ohne diese Migration
-- funktionieren 2-Spieler-Runs weiter wie bisher; ein 3. Spieler kann erst nach
-- dem Ausführen beitreten.
-- ============================================================================

-- 1) Run merkt sich die maximale Spieleranzahl (2 oder 3). Default 2 → Altbestand ok.
alter table runs add column if not exists max_players int not null default 2;
alter table runs drop constraint if exists runs_max_players_chk;
alter table runs add constraint runs_max_players_chk check (max_players between 2 and 3);

-- 2) players.player_number von (1,2) auf 1..3 lockern (alten CHECK robust entfernen).
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.players'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%player_number%'
  loop
    execute format('alter table public.players drop constraint %I', c);
  end loop;
end $$;
alter table players add constraint players_player_number_chk check (player_number between 1 and 3);

-- 3) join_run: bis runs.max_players zulassen, nächste freie Nummer (1..3) vergeben.
--    Verhalten für 2-Spieler-Runs identisch zu vorher (max 2).
create or replace function public.join_run(p_share_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_run_id   uuid;
  v_existing uuid;
  v_free     uuid;
  v_count    int;
  v_max      int;
  v_next     int;
  v_uname    text;
begin
  if v_uid is null then raise exception 'Nicht eingeloggt.'; end if;

  select id, coalesce(max_players, 2) into v_run_id, v_max
  from runs where share_code = lower(p_share_code);
  if v_run_id is null then raise exception 'Run nicht gefunden. Code überprüfen.'; end if;

  select id into v_existing from players
  where run_id = v_run_id and auth_user_id = v_uid limit 1;
  if v_existing is not null then return v_run_id; end if;

  select username into v_uname from profiles where user_id = v_uid;

  -- freigewordenen Slot übernehmen (Daten bleiben erhalten)
  select id into v_free from players
  where run_id = v_run_id and auth_user_id is null
  order by player_number limit 1;
  if v_free is not null then
    update players set auth_user_id = v_uid, name = coalesce(v_uname, name) where id = v_free;
    return v_run_id;
  end if;

  -- sonst als nächster Spieler eintreten (bis max_players)
  select count(*) into v_count from players where run_id = v_run_id;
  if v_count >= v_max then raise exception 'Dieser Run ist bereits voll (% Spieler).', v_max; end if;
  select coalesce(min(g), 1) into v_next
  from generate_series(1, 3) g
  where g not in (select player_number from players where run_id = v_run_id);
  insert into players (run_id, name, player_number, auth_user_id)
  values (v_run_id, coalesce(v_uname, 'Spieler'), v_next, v_uid);
  return v_run_id;
end;
$$;

grant execute on function public.join_run(text) to authenticated;
