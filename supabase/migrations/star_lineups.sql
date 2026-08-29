-- Shared team sheets for the star career game.
--
-- The Lineups/Squad Builder page (components/star/LineupBuilder.tsx) used to
-- write only to the browser's own localStorage — never to the database, so
-- a lineup built on one device was invisible everywhere else: a different
-- device signed into the same account, a different player entirely, even
-- the SAME device days later if its storage got cleared. The star career
-- game's own team-sheet generator (lib/star/teamsheet.ts) reads whatever is
-- saved here as "the real, manager-picked side" for that club, so the whole
-- point is one shared answer everyone gets, not a private draft.
--
-- Reads are public (every player's career needs to read every club's
-- lineup, not just their own). Writes are NOT granted to anon/authenticated
-- at all — the only way to write this table is /api/star/lineups (POST),
-- which checks isAdmin() server-side and writes with the service-role key.
-- Run this in the Supabase SQL Editor. It is idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS star_lineups (
  club       TEXT PRIMARY KEY,
  formation  TEXT NOT NULL,
  xi         JSONB NOT NULL,
  bench      JSONB,
  manager    TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE star_lineups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'star_lineups' AND policyname = 'public read'
  ) THEN
    CREATE POLICY "public read" ON star_lineups FOR SELECT USING (true);
  END IF;
END $$;

-- ── Verify ───────────────────────────────────────────────────────────────
-- select policyname, cmd, qual from pg_policies where tablename = 'star_lineups';
-- Expect exactly one row: public read | SELECT | true — no insert/update/
-- delete policy at all, which is deliberate (see the note above).
