-- ============================================================================
-- SoulLink Tracker — Migration v14: 3-Spieler-SoulLinks (Triples)
-- Im Supabase SQL-Editor ausführen (NACH migration_v13_multiplayer.sql).
--
-- ADDITIV & SICHER. Bestehende 2-Spieler-SoulLinks bleiben unverändert:
-- encounter1_id = Pokémon von Spieler 1, encounter2_id = Spieler 2 (wie bisher).
-- Neu: encounter3_id = Spieler 3 (nullable). Für unvollständige 3er-Links dürfen
-- einzelne Slots NULL sein (mind. ein Pokémon muss gesetzt sein).
-- Es werden KEINE Daten gelöscht.
-- ============================================================================

-- 3. Slot hinzufügen (Spieler 3), nullable.
alter table soul_links add column if not exists encounter3_id uuid references encounters(id) on delete cascade;

-- Slots dürfen für unvollständige Links NULL sein (bestehende Zeilen haben 1+2 gesetzt).
alter table soul_links alter column encounter1_id drop not null;
alter table soul_links alter column encounter2_id drop not null;

-- Alten Zwei-Encounter-Check entfernen (passte nur zu Paaren).
alter table soul_links drop constraint if exists different_encounters;

-- Mindestens ein Pokémon muss im Link sein.
alter table soul_links drop constraint if exists soul_links_at_least_one_chk;
alter table soul_links add constraint soul_links_at_least_one_chk
  check (encounter1_id is not null or encounter2_id is not null or encounter3_id is not null);
