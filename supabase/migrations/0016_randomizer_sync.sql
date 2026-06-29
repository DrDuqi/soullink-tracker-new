-- Phase 4.1 — Multiplayer randomizer sync.
-- Same rules/edition/FVX for everyone; each player gets a deterministic per-slot seed
-- derived from the run MASTER seed. `world_seed` now always holds the master seed.
alter table public.runs add column if not exists same_world boolean not null default false;
alter table public.runs add column if not exists fvx_version text;

comment on column public.runs.world_seed is 'Run master seed (per-player seeds are derived from it unless same_world).';
comment on column public.runs.same_world is 'true → all players use the master seed directly (identical world); false → derive per-player seed.';
comment on column public.runs.fvx_version is 'FVX randomizer version the host used (joining players validate against it).';
