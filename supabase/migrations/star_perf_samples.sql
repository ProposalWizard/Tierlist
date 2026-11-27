-- CHANGES THE DATABASE. What: one new table, star_perf_samples, for the speed recorder (27 Nov 2026).
-- Why: Harry: "us tracking our own FPS and lag … doesn't really do anything. It should more so be that
-- when we turn on the speed check, it's recording directly back to a database with some understanding
-- of what screens it is on at the time, what actions are being had … automatically tracking over
-- playtests."
--
-- Who writes: only the team's accounts (admins and testers) and phones that opened a page with ?fps=1
-- (lib/star/perfSample.ts perfRecordingWanted). A normal player sends nothing. One row every 5 s at
-- most, sent in batches of 6, at most 2 hours per tab (lib/star/perfRecorder.ts). The same sample also
-- goes to PostHog as the event "perf_sample".
--
-- Until this runs, the game's inserts get a 404 and stop quietly for that tab; nothing is shown.
--
-- RLS: anyone may INSERT (a ?fps=1 phone may be signed out), but only the listed columns, and a row
-- may name an account only with that account's own login (account_id = auth.uid()). created_at and id
-- are the database's own. Only admins may READ; the terminal reads with the service key
-- (npx tsx scripts/perf-report.mts). No UPDATE or DELETE for anyone but the service role.
--
-- Size: about 0.6 KB a row with its indexes; one tester for an hour = 720 rows ≈ 0.45 MB. A daily job
-- (03:20 UTC, pg_cron, as nightly_draft_room_tidy.sql) deletes rows older than 30 days, so the table
-- stays at a few tens of MB at most.
--
-- NOT RUN. Run in the Supabase SQL Editor. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.star_perf_samples (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id      TEXT NOT NULL,
  account_id      UUID,
  reason          TEXT NOT NULL,
  sampled_at      TIMESTAMPTZ NOT NULL,
  page            TEXT NOT NULL,
  screen          TEXT NOT NULL,
  nav             TEXT,
  place           TEXT,
  loading         TEXT,
  actions         JSONB NOT NULL DEFAULT '[]'::jsonb,
  source          TEXT NOT NULL,
  fps             REAL,
  worst_ms        INTEGER,
  frames          INTEGER,
  draws           INTEGER,
  tris            INTEGER,
  js_ms           REAL,
  pixel_ratio     REAL,
  px_cap          REAL,
  res_scale       REAL,
  quality_rung    SMALLINT,
  quality_tier    TEXT,
  quality_setting TEXT,
  gpu             TEXT,
  gpu_class       TEXT,
  device          TEXT,
  browser         TEXT,
  os              TEXT,
  screen_w        INTEGER,
  screen_h        INTEGER,
  viewport_w      INTEGER,
  viewport_h      INTEGER,
  dpr             REAL,
  mem_gb          REAL,
  cores           SMALLINT,
  app_version     TEXT,
  CONSTRAINT star_perf_samples_reason CHECK (reason IN ('team', 'fps')),
  CONSTRAINT star_perf_samples_source CHECK (source IN ('3d', 'page')),
  CONSTRAINT star_perf_samples_text_len CHECK (
    char_length(session_id) <= 40 AND char_length(page) <= 60 AND char_length(screen) <= 60
    AND coalesce(char_length(nav), 0) <= 20 AND coalesce(char_length(place), 0) <= 20
    AND coalesce(char_length(loading), 0) <= 40 AND coalesce(char_length(quality_tier), 0) <= 10
    AND coalesce(char_length(quality_setting), 0) <= 10 AND coalesce(char_length(gpu), 0) <= 80
    AND coalesce(char_length(gpu_class), 0) <= 16 AND coalesce(char_length(device), 0) <= 40
    AND coalesce(char_length(browser), 0) <= 24 AND coalesce(char_length(os), 0) <= 24
    AND coalesce(char_length(app_version), 0) <= 40
  ),
  CONSTRAINT star_perf_samples_actions CHECK (
    jsonb_typeof(actions) = 'array' AND jsonb_array_length(actions) <= 8 AND pg_column_size(actions) <= 2000
  )
);

CREATE INDEX IF NOT EXISTS star_perf_samples_created_idx ON public.star_perf_samples (created_at DESC);
CREATE INDEX IF NOT EXISTS star_perf_samples_screen_idx ON public.star_perf_samples (screen, created_at DESC);

ALTER TABLE public.star_perf_samples ENABLE ROW LEVEL SECURITY;

-- Only these columns may be written from the browser (not id, not created_at). Nothing else at all.
REVOKE ALL ON public.star_perf_samples FROM anon, authenticated;
GRANT INSERT (
  session_id, account_id, reason, sampled_at, page, screen, nav, place, loading, actions,
  source, fps, worst_ms, frames, draws, tris, js_ms, pixel_ratio, px_cap, res_scale,
  quality_rung, quality_tier, quality_setting, gpu, gpu_class, device, browser, os,
  screen_w, screen_h, viewport_w, viewport_h, dpr, mem_gb, cores, app_version
) ON public.star_perf_samples TO anon, authenticated;
GRANT SELECT ON public.star_perf_samples TO authenticated; -- admins only, by the policy below

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'star_perf_samples' AND policyname = 'anyone inserts'
  ) THEN
    CREATE POLICY "anyone inserts" ON public.star_perf_samples FOR INSERT TO anon, authenticated
      WITH CHECK (account_id IS NULL OR account_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'star_perf_samples' AND policyname = 'admins read'
  ) THEN
    CREATE POLICY "admins read" ON public.star_perf_samples FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.is_admin = true)
    );
  END IF;
END $$;

-- Rows older than 30 days go, every night at 03:20 UTC (replaced, not doubled, on a re-run).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tidy-old-perf-samples') THEN
    PERFORM cron.unschedule('tidy-old-perf-samples');
  END IF;
END $$;
SELECT cron.schedule(
  'tidy-old-perf-samples',
  '20 3 * * *',
  $job$ DELETE FROM public.star_perf_samples WHERE created_at < now() - interval '30 days'; $job$
);

-- ── Verify (READ ONLY) ────────────────────────────────────────────────────
-- select policyname, cmd, roles from pg_policies where tablename = 'star_perf_samples';
--   Expect two rows: "anyone inserts" | INSERT, "admins read" | SELECT.
-- select jobname, schedule, active from cron.job where jobname = 'tidy-old-perf-samples';
-- After a playtest:
--   select screen, place, device, count(*), round(avg(fps)::numeric, 1) as fps
--   from star_perf_samples where created_at > now() - interval '1 day'
--   group by 1, 2, 3 order by 4 desc limit 30;
-- To stop the tidy: select cron.unschedule('tidy-old-perf-samples');
