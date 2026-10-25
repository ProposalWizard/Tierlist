-- READ ONLY. What: counts the multiplayer draft rooms (and their players) that the nightly tidy would delete, and how much space they take. Deletes nothing.
-- Why: nightly_draft_room_tidy.sql removes rooms over 30 days old every night. Run this first so Harry sees how many go on the first night, and that every status is one that has finished or been left.

-- 1. What would go tonight, by kind of room and status.
SELECT 'draft_rooms' AS rooms, status, count(*) AS rooms_to_delete,
       min(created_at) AS oldest, max(created_at) AS newest
FROM public.draft_rooms r
WHERE r.created_at < now() - interval '30 days'
  AND NOT EXISTS (SELECT 1 FROM public.draft_room_players p
                  WHERE p.room_id = r.id AND p.joined_at >= now() - interval '30 days')
GROUP BY status
UNION ALL
SELECT 'american_draft_rooms', status, count(*), min(created_at), max(created_at)
FROM public.american_draft_rooms
WHERE created_at < now() - interval '30 days'
GROUP BY status
ORDER BY 1, 2;

-- 2. The player rows that go with them (deleted automatically with their room).
SELECT
  (SELECT count(*) FROM public.draft_room_players p JOIN public.draft_rooms r ON r.id = p.room_id
    WHERE r.created_at < now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM public.draft_room_players p2
                      WHERE p2.room_id = r.id AND p2.joined_at >= now() - interval '30 days'))  AS draft_room_players_to_delete,
  (SELECT count(*) FROM public.american_draft_participants p JOIN public.american_draft_rooms r ON r.id = p.room_id
    WHERE r.created_at < now() - interval '30 days')                                          AS american_participants_to_delete;

-- 3. Space the four tables take today.
SELECT c.relname AS table_name, pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
       c.reltuples::bigint AS rows_estimate
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('draft_rooms', 'draft_room_players', 'american_draft_rooms', 'american_draft_participants')
ORDER BY pg_total_relation_size(c.oid) DESC;

-- 4. Is the timed-jobs tool (pg_cron) switched on yet? 0 rows = not yet; the migration switches it on.
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';
