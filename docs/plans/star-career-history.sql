-- PLAN ONLY — NOT RUN. Needs Harry's yes before anyone runs it (PRO-DAT-001).
--
-- Account-side save backups for Settings → Saves → Backups (28 Nov 2026).
--
-- Why: the Backups list (components/star/SaveBackupsView.tsx) can only show
-- backups kept on the device you are holding. star_careers keeps ONE row per
-- account and slot, and each upload replaces it, so the account has no
-- history at all: a copy that was replaced online is gone unless the device
-- that saw it kept a backup. This table would keep the copies the server
-- replaced in the risky ways, so every device could list and restore them.
--
-- Size (the database is ~0.37 of 0.5 GB): a save is 180-550 KB. Keeping
-- every upload would fill the free tier in days. So only the risky
-- replacements are kept, at most 5 per account and slot, for 30 days:
--   - a different player replaced the slot (a new career over an old one)
--   - the calendar went backwards (an older copy over a newer one)
--   - the slot was deleted (a tombstone written over a career)
-- Estimate: under 2 MB per active player at the cap; most players never
-- trigger one.
--
-- No app change is needed for the copies to start being kept (a trigger
-- does it). Listing them needs one small read route (GET
-- /api/star/career/history?slot=N, headline fields only, the same
-- `career->…` picks as lib/star/onlineSlots.ts ONLINE_SLOT_FIELDS) and the
-- Backups list reading it as rows with where = "account". Restoring one is
-- the same restore as a device backup.
--
-- Run AFTER supabase/migrations/star_career_slots.sql (the triggers read
-- star_careers.slot). Idempotent: safe to run twice.

CREATE TABLE IF NOT EXISTS star_career_history (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot        SMALLINT NOT NULL DEFAULT 1,
  kept_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'different-career' | 'went-back' | 'deleted'
  why         TEXT NOT NULL,
  -- The save exactly as it was in star_careers.career before it was replaced.
  career      JSONB NOT NULL,
  updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS star_career_history_user_slot
  ON star_career_history (user_id, slot, kept_at DESC);

-- Read your own only; nobody writes from the browser (the trigger does).
ALTER TABLE star_career_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'star_career_history' AND policyname = 'own history read') THEN
    CREATE POLICY "own history read" ON star_career_history FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION star_keep_replaced_career() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reason TEXT := NULL;
  old_c JSONB := OLD.career;
  new_c JSONB := NEW.career;
BEGIN
  IF old_c IS NULL OR (old_c->>'tombstone')::boolean IS TRUE OR old_c->'player' IS NULL THEN
    RETURN NEW; -- nothing worth keeping
  END IF;
  IF (new_c->>'tombstone')::boolean IS TRUE THEN
    reason := 'deleted';
  ELSIF coalesce(old_c->'player'->>'firstName', '') <> coalesce(new_c->'player'->>'firstName', '')
     OR coalesce(old_c->'player'->>'lastName', '')  <> coalesce(new_c->'player'->>'lastName', '')
     OR coalesce(old_c->'player'->>'startYear', '') <> coalesce(new_c->'player'->>'startYear', '') THEN
    reason := 'different-career';
  ELSIF coalesce((new_c->>'season')::int, 0) * 100 + coalesce((new_c->>'week')::int, 0)
      < coalesce((old_c->>'season')::int, 0) * 100 + coalesce((old_c->>'week')::int, 0) THEN
    reason := 'went-back';
  END IF;
  IF reason IS NULL THEN RETURN NEW; END IF;

  INSERT INTO star_career_history (user_id, slot, why, career, updated_at)
  VALUES (OLD.user_id, coalesce(OLD.slot, 1), reason, old_c, OLD.updated_at);

  -- The cap: 5 per account and slot, and nothing older than 30 days.
  DELETE FROM star_career_history h
  WHERE h.user_id = OLD.user_id AND h.slot = coalesce(OLD.slot, 1)
    AND (h.kept_at < now() - interval '30 days'
         OR h.id NOT IN (SELECT id FROM star_career_history
                         WHERE user_id = OLD.user_id AND slot = coalesce(OLD.slot, 1)
                         ORDER BY kept_at DESC LIMIT 5));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS star_keep_replaced_career ON star_careers;
CREATE TRIGGER star_keep_replaced_career
  BEFORE UPDATE OF career ON star_careers
  FOR EACH ROW EXECUTE FUNCTION star_keep_replaced_career();

-- A slot deleted outright (DELETE, not a tombstone) is kept too.
CREATE OR REPLACE FUNCTION star_keep_deleted_career() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.career IS NOT NULL AND OLD.career->'player' IS NOT NULL
     AND (OLD.career->>'tombstone')::boolean IS NOT TRUE THEN
    INSERT INTO star_career_history (user_id, slot, why, career, updated_at)
    VALUES (OLD.user_id, coalesce(OLD.slot, 1), 'deleted', OLD.career, OLD.updated_at);
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS star_keep_deleted_career ON star_careers;
CREATE TRIGGER star_keep_deleted_career
  BEFORE DELETE ON star_careers
  FOR EACH ROW EXECUTE FUNCTION star_keep_deleted_career();
