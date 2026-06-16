-- SoulLink Tracker — Migration v6
-- Ausführen in: Supabase Dashboard → SQL Editor → Paste → Run

-- Add sort_order column to encounters for custom drag-and-drop sorting
ALTER TABLE encounters ADD COLUMN IF NOT EXISTS sort_order int;

-- Initialize sort_order based on creation time per player (preserves existing order)
UPDATE encounters e
SET sort_order = sub.rn
FROM (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY created_at) AS rn
  FROM encounters
) sub
WHERE e.id = sub.id;
