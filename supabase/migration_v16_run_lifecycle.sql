-- v16: Shared run lifecycle. A run can be active / won / lost; "Neuer Versuch"
-- spins off a NEW shared run that inherits the partner(s), preset, edition and
-- player count (new seed/ROM/save per player). The old run is preserved forever.

alter table runs add column if not exists status         text default 'active';  -- active | won | lost
alter table runs add column if not exists parent_run_id  uuid;                    -- the attempt this one came from
alter table runs add column if not exists attempt_number int  default 1;          -- SoulLink #N

-- Either MEMBER can end the run (e.g. a linked pair died on the partner's side).
create or replace function set_run_status(p_run_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('active', 'won', 'lost') then
    raise exception 'invalid status %', p_status;
  end if;
  if not exists (select 1 from players where run_id = p_run_id and auth_user_id = auth.uid()) then
    raise exception 'not a member of this run';
  end if;
  update runs set status = p_status where id = p_run_id;
end;
$$;

-- New attempt: clone the run for the SAME members + rules, new code + attempt no.
-- world_seed is regenerated only if the old run used one ("Gleiche Welt" mode),
-- otherwise null so each player re-rolls their own world. Returns the new run id.
create or replace function new_attempt(p_run_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old runs;
  v_new uuid;
begin
  select * into v_old from runs where id = p_run_id;
  if v_old is null then raise exception 'run not found'; end if;
  if not exists (select 1 from players where run_id = p_run_id and auth_user_id = auth.uid()) then
    raise exception 'not a member of this run';
  end if;

  insert into runs (name, game, owner_user_id, max_players, preset_data, edition, base_rom, world_seed, parent_run_id, attempt_number, status)
  values (
    v_old.name, v_old.game, v_old.owner_user_id, v_old.max_players,
    v_old.preset_data, v_old.edition, v_old.base_rom,
    case when v_old.world_seed is not null then floor(random() * 1000000000)::bigint else null end,
    p_run_id, coalesce(v_old.attempt_number, 1) + 1, 'active'
  )
  returning id into v_new;

  insert into players (run_id, name, player_number, auth_user_id)
  select v_new, name, player_number, auth_user_id from players where run_id = p_run_id;

  return v_new;
end;
$$;
