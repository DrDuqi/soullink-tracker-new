-- ============================================================================
-- SoulLink Tracker — Migration v10: Run-Management (Verlassen / Löschen / Owner)
-- Im Supabase SQL-Editor ausführen (NACH migration_v9_auth.sql).
--
-- Fügt sichere SECURITY-DEFINER-Funktionen hinzu. Es werden KEINE Tabellen,
-- Spalten oder Daten gelöscht. RLS bleibt unverändert.
-- ============================================================================

-- leave_run: entfernt NUR die eigene Mitgliedschaft (auth_user_id => NULL).
-- Alle Daten (Pokémon, SoulLinks, Requests, Team, Log) bleiben erhalten.
-- Ein Owner muss vorher übertragen (oder löschen).
create or replace function public.leave_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_active int;
begin
  if v_uid is null then raise exception 'Nicht eingeloggt.'; end if;

  select owner_user_id into v_owner from runs where id = p_run_id;
  select count(*) into v_active from players where run_id = p_run_id and auth_user_id is not null;

  if v_owner = v_uid and v_active > 1 then
    raise exception 'Bitte übertrage zuerst den Besitz, bevor du den Run verlässt.';
  end if;
  if v_owner = v_uid and v_active <= 1 then
    raise exception 'Als alleiniger Owner kannst du den Run nicht verlassen — bitte lösche ihn.';
  end if;

  update players set auth_user_id = null
  where run_id = p_run_id and auth_user_id = v_uid;
end;
$$;

-- delete_run: nur Owner; entfernt Run + abhängige Daten (FK ON DELETE CASCADE).
create or replace function public.delete_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'Nicht eingeloggt.'; end if;
  select owner_user_id into v_owner from runs where id = p_run_id;
  if v_owner is distinct from v_uid then
    raise exception 'Nur der Owner darf den Run löschen.';
  end if;
  delete from runs where id = p_run_id;
end;
$$;

-- transfer_run_owner: Owner überträgt den Besitz an ein anderes Mitglied.
create or replace function public.transfer_run_owner(p_run_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_owner     uuid;
  v_is_member int;
begin
  if v_uid is null then raise exception 'Nicht eingeloggt.'; end if;
  select owner_user_id into v_owner from runs where id = p_run_id;
  if v_owner is distinct from v_uid then
    raise exception 'Nur der Owner darf den Besitz übertragen.';
  end if;
  select count(*) into v_is_member
  from players where run_id = p_run_id and auth_user_id = p_new_owner;
  if v_is_member = 0 then
    raise exception 'Der neue Owner muss Mitglied des Runs sein.';
  end if;
  update runs set owner_user_id = p_new_owner where id = p_run_id;
end;
$$;

-- join_run: per Share-Code beitreten. Idempotent für Mitglieder; übernimmt einen
-- freigewordenen Slot (rejoin nach Verlassen behält die alten Daten) oder legt
-- einen neuen Spieler an. Gibt die Run-ID zurück.
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
  v_uname    text;
begin
  if v_uid is null then raise exception 'Nicht eingeloggt.'; end if;

  select id into v_run_id from runs where share_code = lower(p_share_code);
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

  -- sonst als nächster Spieler eintreten (max. 2)
  select count(*) into v_count from players where run_id = v_run_id;
  if v_count >= 2 then raise exception 'Dieser Run hat bereits zwei Spieler.'; end if;
  insert into players (run_id, name, player_number, auth_user_id)
  values (v_run_id, coalesce(v_uname, 'Spieler'), case when v_count = 0 then 1 else 2 end, v_uid);
  return v_run_id;
end;
$$;

grant execute on function public.leave_run(uuid)                 to authenticated;
grant execute on function public.delete_run(uuid)                to authenticated;
grant execute on function public.transfer_run_owner(uuid, uuid)  to authenticated;
grant execute on function public.join_run(text)                  to authenticated;
