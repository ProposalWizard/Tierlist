-- CHANGES THE DATABASE. What: switches on Supabase's timed jobs (pg_cron) and adds one job that runs at 3 am (UK time in winter, 4 am in summer) every night and deletes multiplayer draft rooms more than 30 days old, with their players.
-- Why: Harry, 25 Oct 2026: the nightly draft-room tidy "sounds fine". Rooms are never deleted today (draft_rooms 12 MB, draft_room_players 4.7 MB, 23 Oct 2026), so the tables only grow.
--
-- NOT RUN. Run supabase/checks/draft_room_tidy_dryrun.sql first (READ ONLY): it counts what the first night
-- deletes. Safe to re-run (the job is replaced, not doubled).
--
-- WHAT GOES, AND WHAT IS KEPT
--  * A room goes when it was made more than 30 days ago. Every such room is finished or left:
--    draft rooms expire after 24 hours and American draft rooms after 4 hours (expires_at defaults,
--    supabase/migrations/draft_rooms.sql:10, american_draft.sql:20). As extra care, a draft room where
--    anyone joined in the last 30 days is kept.
--  * Its players go with it (ON DELETE CASCADE: draft_rooms.sql:15, american_draft.sql:25).
--    Challenge rooms (/draft-challenge) live in draft_rooms too and follow the same rule.
--  * Kept: draft_records (the records board) and draft_runs (a player's own solo history) are separate
--    tables with no link to rooms. Checked 25 Oct 2026: no room route writes draft_runs, so after 30 days a
--    multiplayer room's code no longer opens it in the PL Draft lobby. That is the only loss.
--
-- Estimate: -5 to -15 MB of the 17 MB the first night (reasoned: most rooms are older than a month),
-- then flat. Postgres reuses freed space for new rows; the disk number itself only drops after a VACUUM FULL
-- of those tables, which is not needed.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Replace any earlier copy of the job, then schedule it. 03:00 UTC every day.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'tidy-old-draft-rooms') THEN
    PERFORM cron.unschedule('tidy-old-draft-rooms');
  END IF;
END $$;

SELECT cron.schedule(
  'tidy-old-draft-rooms',
  '0 3 * * *',
  $job$
    DELETE FROM public.draft_rooms r
    WHERE r.created_at < now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.draft_room_players p
                      WHERE p.room_id = r.id AND p.joined_at >= now() - interval '30 days');
    DELETE FROM public.american_draft_rooms
    WHERE created_at < now() - interval '30 days';
  $job$
);

-- Verify afterwards (READ ONLY):
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'tidy-old-draft-rooms';
--   After the first night: SELECT status, return_message, start_time FROM cron.job_run_details
--     WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'tidy-old-draft-rooms')
--     ORDER BY start_time DESC LIMIT 5;
-- To stop it: SELECT cron.unschedule('tidy-old-draft-rooms');
