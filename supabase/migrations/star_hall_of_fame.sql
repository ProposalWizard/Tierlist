-- The Hall of Fame: every retired star career, kept (Leo, 5 Oct 2026).
--
-- A retired career used to live only in its save slot (star_careers), and
-- starting a new career in that slot deleted it. The game now keeps a slim
-- copy of every retired career in a Hall of Fame (lib/star/hallOfFame.ts):
-- on the device straight away, and in this table so it follows the player to
-- every device.
--
-- One row per (account, career). `entry` is the slim career plus its list
-- card, written once and never changed (a finished career does not change).
-- Taking a career out of the Hall leaves the row as a tombstone
-- (removed = true, entry = null), so another device's copy cannot bring it
-- back.
--
-- Until this runs, the game keeps the Hall on the device it was made on and
-- the Hall screen says so: the API answers `migrationMissing: true`
-- (app/api/star/hall-of-fame/route.ts). Nothing breaks.
--
-- Run in the Supabase SQL Editor. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS star_hall_of_fame (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id   TEXT NOT NULL,
  entry      JSONB,
  removed    BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entry_id)
);

-- A slim 20-season career is about 30-60 KB. Refuse anything far bigger, so
-- one account cannot fill the database through its own rows.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_hall_of_fame_entry_size') THEN
    ALTER TABLE star_hall_of_fame ADD CONSTRAINT star_hall_of_fame_entry_size
      CHECK (entry IS NULL OR pg_column_size(entry) < 1000000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_hall_of_fame_entry_id_shape') THEN
    ALTER TABLE star_hall_of_fame ADD CONSTRAINT star_hall_of_fame_entry_id_shape
      CHECK (entry_id ~ '^hof-[a-z0-9]{1,16}$');
  END IF;
END $$;

-- At most 30 careers per account, and 200 rows (careers plus tombstones)
-- (8 Oct 2026). The API checks this too (app/api/star/hall-of-fame/route.ts,
-- HALL_MAX_ENTRIES in lib/star/hallOfFame.ts); this trigger stops a direct
-- write from the browser going round it. An id already there is left to
-- ON CONFLICT, so re-sending a career is never refused.
CREATE OR REPLACE FUNCTION star_hall_of_fame_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  live_count INT;
  row_count INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM star_hall_of_fame WHERE user_id = NEW.user_id AND entry_id = NEW.entry_id) THEN
      RETURN NEW;
    END IF;
    SELECT count(*) INTO row_count FROM star_hall_of_fame WHERE user_id = NEW.user_id;
    IF row_count >= 200 THEN
      RAISE EXCEPTION 'hall_full: at most 200 Hall of Fame rows per account';
    END IF;
  END IF;
  IF NEW.removed = false AND (TG_OP = 'INSERT' OR OLD.removed = true) THEN
    SELECT count(*) INTO live_count FROM star_hall_of_fame
      WHERE user_id = NEW.user_id AND removed = false AND entry_id <> NEW.entry_id;
    IF live_count >= 30 THEN
      RAISE EXCEPTION 'hall_full: at most 30 careers per account';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS star_hall_of_fame_limit ON star_hall_of_fame;
CREATE TRIGGER star_hall_of_fame_limit
  BEFORE INSERT OR UPDATE ON star_hall_of_fame
  FOR EACH ROW EXECUTE FUNCTION star_hall_of_fame_limit();

ALTER TABLE star_hall_of_fame ENABLE ROW LEVEL SECURITY;

-- Each player reads and writes only their own Hall.
DROP POLICY IF EXISTS "star_hall_of_fame_select" ON star_hall_of_fame;
CREATE POLICY "star_hall_of_fame_select" ON star_hall_of_fame
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "star_hall_of_fame_insert" ON star_hall_of_fame;
CREATE POLICY "star_hall_of_fame_insert" ON star_hall_of_fame
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "star_hall_of_fame_update" ON star_hall_of_fame;
CREATE POLICY "star_hall_of_fame_update" ON star_hall_of_fame
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "star_hall_of_fame_delete" ON star_hall_of_fame;
CREATE POLICY "star_hall_of_fame_delete" ON star_hall_of_fame
  FOR DELETE USING (auth.uid() = user_id);

-- Verify (should list the four policies, the two checks and the trigger):
-- SELECT polname FROM pg_policy WHERE polrelid = 'star_hall_of_fame'::regclass;
-- SELECT conname FROM pg_constraint WHERE conrelid = 'star_hall_of_fame'::regclass;
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'star_hall_of_fame'::regclass AND NOT tgisinternal;
