-- Multiple save slots for the star career game.
--
-- star_careers has always been one row per account (UNIQUE (user_id)) — a
-- single career, full stop. This turns it into up to three: one row per
-- (account, slot), so a player can keep more than one career going and
-- switch between them from Settings, without touching or migrating any
-- existing data.
--
-- Adding `slot` with a DEFAULT backfills every existing row to slot = 1
-- automatically — Postgres fills the default in for rows that already
-- exist, it does not need to be done by hand, and no career is rewritten or
-- moved. Slot 1 is also, deliberately, what the app's own localStorage
-- scoping already treats as "the account's original save" (see
-- lib/star/storage.ts's slotScope) — so an account that never opens the new
-- saves screen keeps reading and writing the exact same row it always has.
--
-- The app already tolerates this migration not having run yet: the API
-- route (app/api/star/career/route.ts) tries the slot-aware query first and
-- falls back to the exact pre-slots query shape for slot 1 if that errors
-- (the same "column doesn't exist yet" behaviour high_potential.sql's own
-- note describes — Supabase fails the WHOLE query, not just the missing
-- part). Slot 1 cloud saves work identically before and after this runs;
-- slots 2 and 3 simply stay local-only (never a hard failure — see
-- saveCareerToCloud's "fire-and-forget" doc) until it does. Run this in the
-- Supabase SQL Editor. It is idempotent — safe to re-run.

ALTER TABLE star_careers ADD COLUMN IF NOT EXISTS slot SMALLINT NOT NULL DEFAULT 1;

-- Keep it to the three slots the app actually offers (MAX_SAVE_SLOTS,
-- lib/star/storage.ts) — not enforced client-side alone.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'star_careers_slot_range'
  ) THEN
    ALTER TABLE star_careers ADD CONSTRAINT star_careers_slot_range CHECK (slot BETWEEN 1 AND 3);
  END IF;
END $$;

-- Drop whatever the original "one row per account" constraint is actually
-- named — found by what it covers (a unique constraint on user_id alone),
-- not assumed from Postgres's usual auto-naming, so this still works even
-- if it was renamed by hand at some point. Without this step, no account
-- could ever have a second row at all, whatever slot it claimed to be.
--
-- The ::name[] cast on the literal below is load-bearing, not decoration:
-- `attname` is Postgres's internal `name` type, so `array_agg(attname...)`
-- produces a `name[]` — compared bare against `ARRAY['user_id']` (which
-- defaults to `text[]`), Postgres has no `=` operator between those two
-- array types and the whole migration fails with "operator does not
-- exist: name[] = text[]" before it ever gets to drop anything. Caught by
-- actually running it, not guessed.
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT pc.conname
    FROM pg_constraint pc
    JOIN pg_class rel ON rel.oid = pc.conrelid
    WHERE rel.relname = 'star_careers'
      AND pc.contype = 'u'
      AND (
        SELECT array_agg(attname ORDER BY attname)
        FROM pg_attribute
        WHERE attrelid = pc.conrelid AND attnum = ANY(pc.conkey)
      ) = ARRAY['user_id']::name[]
  LOOP
    EXECUTE format('ALTER TABLE star_careers DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

-- One row per account PER SLOT, replacing the one-row-per-account rule just
-- dropped above. This is also the conflict target the API's upsert names
-- (`onConflict: "user_id,slot"`) — without it, saving a second slot fails
-- outright rather than inserting a new row.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'star_careers_user_id_slot_key'
  ) THEN
    ALTER TABLE star_careers ADD CONSTRAINT star_careers_user_id_slot_key UNIQUE (user_id, slot);
  END IF;
END $$;

-- RLS is untouched deliberately — every existing policy (star_careers_select
-- /_insert/_update/_delete) is keyed on `auth.uid() = user_id`, a ROW-level
-- check that already covers every slot of a row you own with no change
-- needed; nothing here grants or restricts access by column.

-- ── Verify ───────────────────────────────────────────────────────────────
-- select conname, contype, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'star_careers'::regclass;
-- Expect: star_careers_pkey (p), star_careers_user_id_fkey (f),
-- star_careers_slot_range (c) CHECK (slot BETWEEN 1 AND 3), and
-- star_careers_user_id_slot_key (u) UNIQUE (user_id, slot) — no remaining
-- unique constraint on user_id alone.
--
-- select user_id, slot, updated_at from star_careers order by user_id, slot;
-- Expect every existing row's slot to read 1 — nothing moved or duplicated.
