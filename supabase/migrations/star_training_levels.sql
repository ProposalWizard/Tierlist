-- Edited training levels for the star career game (20 Oct 2026).
--
-- Every training level (5 games × 30 levels) is a row of numbers in the
-- committed file lib/star/data/trainingLevels.json. The Training levels page
-- (/star-training-dev → Edit level → Save) writes an edited level here, and
-- every career plays the edited numbers on top of the file, with no deploy.
-- Commit writes the same row into the file itself.
--
-- id is "<skill>:<level>", e.g. "vision:30". config is the level's numbers
-- verbatim (lib/star/trainingLevelData.ts LevelBySkill).
--
-- Reads are public (every career needs the same levels). Writes are NOT
-- granted to anon or authenticated at all: the only way in is
-- /api/star/training-levels (POST/DELETE), which checks isAdmin() and writes
-- with the service-role key. Same shape as star_scenarios.sql.
--
-- Run this in the Supabase SQL Editor. It is idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS star_training_levels (
  id         TEXT PRIMARY KEY,
  skill      TEXT NOT NULL,
  level      INTEGER NOT NULL CHECK (level BETWEEN 1 AND 30),
  config     JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE star_training_levels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'star_training_levels' AND policyname = 'public read'
  ) THEN
    CREATE POLICY "public read" ON star_training_levels FOR SELECT USING (true);
  END IF;
END $$;

-- ── Verify ───────────────────────────────────────────────────────────────
-- select policyname, cmd, qual from pg_policies where tablename = 'star_training_levels';
-- Expect exactly one row: public read | SELECT | true (no write policy, on purpose).
--
-- select id, skill, level, config, updated_at from star_training_levels order by skill, level;
-- Expect one row per level saved on the Training levels page.
