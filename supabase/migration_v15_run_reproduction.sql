-- v15: Shared randomization recipe on the RUN. A SoulLink is linked BY ROUTE, not by
-- byte-identical ROMs, so players share the PRESET (rules) but by default each has
-- their OWN seed/ROM/savegame (independent worlds, linked per route). The per-player
-- seed stays local; only an optional "same world" mode puts a shared seed here.
--
-- All columns nullable (website-only runs leave them null) and inherit the existing
-- `runs` RLS: members already SELECT the run, the owner already UPDATEs it.

alter table runs add column if not exists preset_data text;    -- base64 of the .rnqs (the SHARED rules)
alter table runs add column if not exists edition     text;    -- e.g. 'platinum' (which game)
alter table runs add column if not exists world_seed  bigint;  -- ONLY set in "Gleiche Welt" mode (shared seed); null = own seed per player
alter table runs add column if not exists base_rom    text;    -- 'GAMECODE-REV' (e.g. 'CPUE-1') — same-version check for "Gleiche Welt"
