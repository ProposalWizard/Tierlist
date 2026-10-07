-- STAR SAVE GUARD (Harry, 7 Oct 2026).
--
-- "We need to fix that… ideally everything is safe and working." A Star
-- Career save is worked out on the player's device and sent whole to
-- /api/star/career. Anyone could edit money, skills or trophies in the
-- browser's developer tools and the edited save went straight to the cloud.
-- The route now checks every save against the last trusted one
-- (lib/star/saveGuard.ts). This file does the two database halves:
--
--  1. star_save_flags — one row per save that looked wrong: who, which slot,
--     when, what was found, and the key numbers before and after. Read it in
--     the Table Editor (or the queries at the bottom). Nobody can read or
--     write it from the browser; the server writes it with the service key.
--
--  2. star_careers stops taking writes from the browser. Until now its RLS
--     let a signed-in player insert, update and delete their own row
--     DIRECTLY (the public anon key plus their own login), which skips the
--     route — and its checks — entirely. After this, only the server writes
--     saves (with the service key). Players can still READ their own save.
--
-- ORDER: deploy the code first, then run this. The new route writes saves
-- with the service key (SUPABASE_SERVICE_ROLE_KEY, already set in Vercel),
-- so it works before and after this file. An OLD deploy still writing with
-- the player's own login would be refused once this has run.
--
-- Until this runs: saves are checked and stored exactly the same, the
-- findings are only written to the server log ("[star/career] save guard"),
-- and the direct-write hole stays open. Safe to re-run.

-- 1. The flags.
CREATE TABLE IF NOT EXISTS public.star_save_flags (
  id         BIGSERIAL    PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot       SMALLINT     NOT NULL DEFAULT 1,
  at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- observe | enforce: what the server did with the save.
  mode       TEXT         NOT NULL,
  -- cheat (outside every limit) | watch (unusual but possible, e.g. casino luck).
  verdict    TEXT         NOT NULL,
  findings   JSONB        NOT NULL,
  prev_keys  JSONB,
  next_keys  JSONB,
  corrected  TEXT[]       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS star_save_flags_user_at ON public.star_save_flags (user_id, at DESC);
CREATE INDEX IF NOT EXISTS star_save_flags_at      ON public.star_save_flags (at DESC);

-- RLS on, no policies: invisible to the browser. Only the service key.
ALTER TABLE public.star_save_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.star_save_flags FROM anon, authenticated;

-- 2. star_careers: reads only from the browser.
--    Drops every policy that is not SELECT-only (the original
--    star_careers_insert / _update / _delete, and anything else that grants a
--    write), then makes sure the read-own-row policy is still there.
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'star_careers' AND cmd <> 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.star_careers', p.policyname);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'star_careers' AND cmd = 'SELECT'
  ) THEN
    CREATE POLICY "star_careers_select" ON public.star_careers
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.star_careers ENABLE ROW LEVEL SECURITY;

-- ── Verify ───────────────────────────────────────────────────────────────
-- select policyname, cmd from pg_policies where tablename = 'star_careers';
--   Expect exactly one row: star_careers_select | SELECT.
-- select count(*) from star_save_flags;
--   Expect a number (0 at first), not an error.
--
-- ── Reading the flags ────────────────────────────────────────────────────
-- Newest first:
--   select at, user_id, slot, verdict, findings, prev_keys, next_keys
--   from star_save_flags order by at desc limit 50;
-- How often each field trips, last 7 days (the false-alarm check):
--   select f->>'field' as field, f->>'level' as level, count(*)
--   from star_save_flags, jsonb_array_elements(findings) f
--   where at > now() - interval '7 days' group by 1, 2 order by 3 desc;
