-- frequent_jobs_cron.sql — the two frequent timed jobs, run by Supabase instead of Vercel
-- (Mikey, 20 Nov 2026: back to Vercel's free plan, which only allows timed jobs once a day).
--
--   patch-notes-media-sync   every 5 minutes   GET /api/admin/patch-notes/media-sync
--   team-room-quarter-hour   every 15 minutes  GET /api/cron/patch-bot  (Patch, Bug and Today bots)
--
-- Both routes need "Authorization: Bearer <CRON_SECRET>", the same CRON_SECRET as in Vercel.
-- The secret lives in the Supabase Vault under the name 'cron_secret', never in this file.
-- Add it ONCE in the Supabase SQL Editor (paste the value from Vercel → Settings →
-- Environment Variables → CRON_SECRET):
--
--   select vault.create_secret('PASTE_CRON_SECRET_HERE', 'cron_secret');
--
-- Until it is there, each job finds no secret and makes no call (nothing fails, nothing posts).
-- Safe to run again: it replaces the two jobs.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'patch-notes-media-sync') THEN
    PERFORM cron.unschedule('patch-notes-media-sync');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'team-room-quarter-hour') THEN
    PERFORM cron.unschedule('team-room-quarter-hour');
  END IF;
END $$;

SELECT cron.schedule(
  'patch-notes-media-sync',
  '*/5 * * * *',
  $job$
    SELECT net.http_get(
      url     := 'https://knowitball.co.uk/api/admin/patch-notes/media-sync',
      headers := jsonb_build_object('Authorization', 'Bearer ' || s.decrypted_secret),
      timeout_milliseconds := 60000
    )
    FROM vault.decrypted_secrets s
    WHERE s.name = 'cron_secret';
  $job$
);

SELECT cron.schedule(
  'team-room-quarter-hour',
  '*/15 * * * *',
  $job$
    SELECT net.http_get(
      url     := 'https://knowitball.co.uk/api/cron/patch-bot',
      headers := jsonb_build_object('Authorization', 'Bearer ' || s.decrypted_secret),
      timeout_milliseconds := 30000
    )
    FROM vault.decrypted_secrets s
    WHERE s.name = 'cron_secret';
  $job$
);
