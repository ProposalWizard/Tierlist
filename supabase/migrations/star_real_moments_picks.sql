-- Real-moment picks for Real moment highlights (20 Oct 2026).
--
-- Settings → Full highlights rebuild → Real moment highlights serves some
-- open-play chances as REAL moments (lib/star/fhr/realMomentHighlights.ts).
-- By default every fully real open-play shot that passes the automatic checks
-- may be served. The Real moments page (/star-real-moments-dev) marks a moment
-- "Use in game" or "Don't use"; Save writes the mark here, and every game reads
-- it on top of the committed file data/realmoments/picks.json, with no deploy.
-- Commit writes the same marks into the file itself.
--
-- id is the moment's id (dfl…, sc…, st…). in_game: true = "Use in game",
-- false = "Don't use". No row = automatic.
--
-- Reads are public (every game needs the same list). Writes are NOT granted to
-- anon or authenticated at all: the only way in is /api/star/real-moment-picks
-- (POST), which checks isAdmin() and writes with the service-role key. Same
-- shape as star_training_levels.sql.
--
-- Run this in the Supabase SQL Editor. It is idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS star_real_moments_picks (
  id         TEXT PRIMARY KEY CHECK (id ~ '^[a-z]{2,4}[A-Za-z0-9_-]{1,60}$'),
  in_game    BOOLEAN NOT NULL,
  note       TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE star_real_moments_picks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'star_real_moments_picks' AND policyname = 'public read'
  ) THEN
    CREATE POLICY "public read" ON star_real_moments_picks FOR SELECT USING (true);
  END IF;
END $$;

-- ── Verify ───────────────────────────────────────────────────────────────
-- select policyname, cmd, qual from pg_policies where tablename = 'star_real_moments_picks';
-- Expect exactly one row: public read | SELECT | true (no write policy, on purpose).
--
-- select id, in_game, note, updated_at from star_real_moments_picks order by updated_at desc;
-- Expect one row per moment marked on the Real moments page.
