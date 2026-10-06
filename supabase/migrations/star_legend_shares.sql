-- Shared careers: one public link per retired career (Leo, 6 Oct 2026).
--
-- "Online: share a career, compare with a friend. Friends first. A public
-- board only with cheat checks." A retired career from the Hall of Fame can
-- be shared as a short code (knowitball.co.uk/legend/K7Q2XM). Anyone with the
-- code sees that career, read only, with no sign-in, and can compare it with
-- one of their own. There is NO leaderboard: nothing lists every share (a
-- career is read by its code only, through get_legend_share below), and a
-- public board would need cheat checks first.
--
-- One row per shared career: the code, who shared it, which Hall entry
-- (lib/star/hallOfFame.ts), and the slim career itself (the same copy the
-- Hall keeps). Sharing the same career again gives the same code. Stopping
-- sharing deletes the row: the link stops working.
--
-- Until this runs, Share link says it isn't switched on yet
-- (app/api/star/legend/route.ts answers `migrationMissing: true`). Nothing
-- else breaks.
--
-- Run in the Supabase SQL Editor. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS star_legend_shares (
  code       TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hall_id    TEXT NOT NULL,
  entry      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, hall_id)
);

DO $$ BEGIN
  -- Six letters and digits, no look-alikes (no I, O, 0 or 1).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_legend_shares_code_shape') THEN
    ALTER TABLE star_legend_shares ADD CONSTRAINT star_legend_shares_code_shape
      CHECK (code ~ '^[A-HJ-NP-Z2-9]{6}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_legend_shares_hall_id_shape') THEN
    ALTER TABLE star_legend_shares ADD CONSTRAINT star_legend_shares_hall_id_shape
      CHECK (hall_id ~ '^hof-[a-z0-9]{1,16}$');
  END IF;
  -- A slim 20-season career is about 30-60 KB. Refuse anything far bigger.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_legend_shares_entry_size') THEN
    ALTER TABLE star_legend_shares ADD CONSTRAINT star_legend_shares_entry_size
      CHECK (pg_column_size(entry) < 1000000);
  END IF;
END $$;

ALTER TABLE star_legend_shares ENABLE ROW LEVEL SECURITY;

-- A player reads their own shares (to find the code of one already shared).
DROP POLICY IF EXISTS "star_legend_shares_select" ON star_legend_shares;
CREATE POLICY "star_legend_shares_select" ON star_legend_shares
  FOR SELECT USING (auth.uid() = user_id);

-- Anyone WITH THE CODE reads that one career, through this function: there
-- is no way to list every share, and the sharer's account id is not shown.
CREATE OR REPLACE FUNCTION get_legend_share(p_code TEXT)
RETURNS TABLE (code TEXT, entry JSONB, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.code, s.entry, s.created_at
  FROM star_legend_shares s
  WHERE s.code = upper(p_code)
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION get_legend_share(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_legend_share(TEXT) TO anon, authenticated;

-- Only the player shares (and stops sharing) their own careers.
DROP POLICY IF EXISTS "star_legend_shares_insert" ON star_legend_shares;
CREATE POLICY "star_legend_shares_insert" ON star_legend_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "star_legend_shares_delete" ON star_legend_shares;
CREATE POLICY "star_legend_shares_delete" ON star_legend_shares
  FOR DELETE USING (auth.uid() = user_id);

-- No UPDATE policy: a shared career does not change.

-- Verify (should list the three policies, the three checks and the function):
-- SELECT polname FROM pg_policy WHERE polrelid = 'star_legend_shares'::regclass;
-- SELECT conname FROM pg_constraint WHERE conrelid = 'star_legend_shares'::regclass;
-- SELECT proname FROM pg_proc WHERE proname = 'get_legend_share';
