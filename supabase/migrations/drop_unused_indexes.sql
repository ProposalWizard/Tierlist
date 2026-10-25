-- CHANGES THE DATABASE. What: drops 4 small indexes that do nothing useful: one is an exact copy of a table's own key, two are on yes/no columns the database never uses, one serves only a rare admin rename.
-- Why: Harry, 25 Oct 2026: "Drop indexes nobody uses." Each unused index slows every write a little and takes disk.
--
-- NOT RUN. Safe to re-run (IF EXISTS).
--
-- The speed advisor (25 Oct 2026 04:44) listed 14 "unused" indexes. "Unused" only counts since the
-- last stats reset, so each one was checked against the code. Dropped (4):
--
--  * idx_saved_tierlists_user ON saved_tierlists (user_id)
--      An exact copy: the table's primary key is (user_id, tierlist_id) (supabase/schema-additions.sql:58-63),
--      which already starts with user_id. The profile page's per-player read keeps using the key.
--  * idx_tenable_puzzles_active ON tenable_puzzles (is_active)
--  * idx_blind_rankings_active ON blind_rankings (is_active)
--      Pages do filter on is_active = true (app/tenable/page.tsx:35, app/blind-rankings/page.tsx:28), but an
--      index on a yes/no column of a small table is never chosen: reading the table is as fast. The advisor
--      confirms 0 uses. Reads stay exactly as fast.
--  * idx_tierlists_category ON tierlists (category)  (made in the dashboard, not in the repo)
--      The tierlists page loads every tierlist and groups them by category in code
--      (app/tierlists/page.tsx:145-148); nothing filters on category except the admin "rename a
--      category" button (app/api/admin/categories/[id]/route.ts:55-59), rare and on a small table.
--
-- Kept, with the reason (6):
--  * idx_uploaded_images_cleanup: read by scripts/cleanup-unused-images.ts:35 (run by hand, so rarely).
--  * idx_tierlist_rankings_player: backs the link to tierlist_players (ON DELETE CASCADE,
--      supabase/schema.sql:82). Dropping it would add a "missing link index" warning.
--  * idx_tierlist_likes_tierlist_id: every /play and /vote page counts likes by tierlist_id
--      (supabase/migrations/perf_indexes_jul2026.sql:3-11); it also backs the link to tierlists.
--  * star_save_flags_user_at, star_save_flags_at: the save guard is new (7 Oct 2026) and runs in
--      "observe" mode; flags are read by hand when a save looks wrong, so they look unused. Keep.
--  * star_wallet_ledger_user_idx: the wallet is new and barely used yet; a player's history needs it.
--
-- Skipped on purpose, too new to judge (tables made in the live database 19-23 Oct 2026, so only days of stats):
--  team_messages_time, team_tasks_owner, team_notes_target (the Team room) and
--  star_tuning_notes_note_at_idx (star_tuning_notes). Re-check in a month.
--
-- Estimate: under 1 MB in total (these tables are small). The gain is faster writes, not space.

DROP INDEX IF EXISTS public.idx_saved_tierlists_user;
DROP INDEX IF EXISTS public.idx_tenable_puzzles_active;
DROP INDEX IF EXISTS public.idx_blind_rankings_active;
DROP INDEX IF EXISTS public.idx_tierlists_category;
