-- ============================================================================
-- SoulLink Tracker — Migration v12: stabile Emulator-Identität pro Encounter
-- Im Supabase SQL-Editor ausführen (NACH den bisherigen Migrationen).
--
-- Fügt EINE nullable Spalte hinzu. Bestehende & manuell angelegte Encounters
-- bleiben unberührt (emu_pid = null). RLS unverändert.
--
-- emu_pid = Personality Value (PID) des Pokémon als Text. Die PID ändert sich
-- NICHT bei Entwicklung → so bleibt die Identität über Shinx→Luxio→… stabil.
-- ============================================================================

alter table encounters add column if not exists emu_pid text;

-- Schnelles Nachschlagen je Run (Identitäts-Match beim Sync).
create index if not exists encounters_run_emu_pid_idx on encounters (run_id, emu_pid);
