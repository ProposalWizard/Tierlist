-- ============================================================================
-- SECURITY: RLS write-policy hardening (July 2026 defensive review)
--
-- Run this in the Supabase SQL Editor. It is idempotent — safe to re-run.
--
-- BACKGROUND
-- Every write in this app goes through an API route that uses the SERVICE ROLE
-- client (lib/supabase/service.ts), which bypasses RLS entirely. Client-facing
-- INSERT/UPDATE policies on those tables are therefore not needed for the app
-- to work — but they ARE reachable by anyone holding the public anon key
-- (which is, by design, in the browser bundle). That lets an attacker call
-- PostgREST directly and skip every validation, cap and ownership check the
-- API routes perform.
--
-- This file drops the unnecessary write policies. Verified before writing:
--   * no "use client" component writes to any table touched below
--   * every server write to these tables uses createServiceClient()
-- Tables that ARE written from the browser or with the user-scoped client
-- (uploaded_images, user_profiles, feedback, draft_runs, saved_profile_images)
-- keep their policies; feedback's is tightened instead of dropped.
-- ============================================================================


-- ── 1. vote_tierlist_votes — UNAUTHENTICATED write access ────────────────────
-- supabase/vote-schema.sql created:
--   "Anyone can vote"              FOR INSERT WITH CHECK (true)
--   "Voters can change their vote" FOR UPDATE USING (true)   -- no WITH CHECK
-- USING(true) on UPDATE also acts as WITH CHECK(true), so ANY anon caller can
-- rewrite EVERY vote row in the table:
--   PATCH /rest/v1/vote_tierlist_votes?vote_tierlist_id=eq.<id>
--   {"tier_label":"D"}
-- All voting goes through POST /api/vote-tierlists/[id]/vote (service role).
DROP POLICY IF EXISTS "Anyone can vote"              ON public.vote_tierlist_votes;
DROP POLICY IF EXISTS "Voters can change their vote" ON public.vote_tierlist_votes;


-- ── 2. tictactoe_puzzles — daily-puzzle hijack ───────────────────────────────
-- tictactoe_user_created.sql allows any authenticated user to INSERT a puzzle
-- with arbitrary column values, including is_daily = true and daily_date =
-- today. app/tic-tac-toe/daily/page.tsx resolves the daily with .single() on
-- (is_active, is_daily, daily_date), so a second row breaks it for everyone —
-- and if no admin daily exists for that date, the attacker's puzzle IS the
-- daily. Creation goes through POST /api/tictactoe, which forces
-- is_daily = false and category = 'User Created'.
DROP POLICY IF EXISTS "Users can create tictactoe_puzzles" ON public.tictactoe_puzzles;


-- ── 3. draft_records — global leaderboard poisoning ──────────────────────────
-- draft_records.sql allows a logged-in user to INSERT straight into the
-- PUBLIC leaderboard, bypassing the VALUE_CAPS table, the Dev-player filter
-- and the server-resolved username in app/api/draft/records/route.ts.
DROP POLICY IF EXISTS "Users can insert own draft records" ON public.draft_records;


-- ── 4. draft_personal_records — server-role only ─────────────────────────────
-- Only app/api/draft/records/route.ts writes these, via the service client.
DROP POLICY IF EXISTS "Users can insert own personal records" ON public.draft_personal_records;
DROP POLICY IF EXISTS "Users can update own personal records" ON public.draft_personal_records;


-- ── 5. draft_rooms / draft_room_players — multiplayer state tampering ────────
-- "Players can update own row" lets a player PATCH their own draft_room_players
-- row directly and set squad / avg_ovr / team_strength / season_result /
-- actual_finish to anything, which the host's simulate route then trusts.
-- "Auth users can create rooms" only checks auth.uid() IS NOT NULL, so a room
-- can be created with someone else as host_id.
-- All room writes go through app/api/draft/rooms/** (service role); the client
-- only SELECTs (components/draft/american/AmericanDraftPhase.tsx).
DROP POLICY IF EXISTS "Auth users can create rooms"  ON public.draft_rooms;
DROP POLICY IF EXISTS "Host can update room"         ON public.draft_rooms;
DROP POLICY IF EXISTS "Auth users can join rooms"    ON public.draft_room_players;
DROP POLICY IF EXISTS "Players can update own row"   ON public.draft_room_players;


-- ── 6. tictactoe scores / difficulty ratings — server-role only ──────────────
-- Both are written only by app/api/tictactoe/[id]/score and
-- app/api/tictactoe/[id]/difficulty-rating via the service client. The direct
-- paths skip the score clamps and the 0.5-step rating validation.
DROP POLICY IF EXISTS "Users can insert own ttt scores" ON public.tictactoe_scores;
DROP POLICY IF EXISTS "Users can insert own ratings"    ON public.tictactoe_difficulty_ratings;
DROP POLICY IF EXISTS "Users can update own ratings"    ON public.tictactoe_difficulty_ratings;


-- ── 7. vote_tierlists / vote_tierlist_images — admin-managed ─────────────────
-- Created and edited only through app/api/admin/vote-tierlists/** (service
-- role). The client policies let any user create vote tierlists outside the
-- admin flow.
DROP POLICY IF EXISTS "Authenticated users can create vote tierlists" ON public.vote_tierlists;
DROP POLICY IF EXISTS "Creators can update their vote tierlists"      ON public.vote_tierlists;
DROP POLICY IF EXISTS "Creators can manage vote tierlist images"      ON public.vote_tierlist_images;


-- ── 8. feedback — tighten rather than drop (browser writes this) ─────────────
-- components/FeedbackForm.tsx inserts directly with the anon key, so the
-- INSERT policy must stay. But WITH CHECK (true) lets a caller set user_id to
-- any UUID — and user_profiles is world-readable, so every user_id is
-- discoverable. That means abusive feedback can be attributed to any user.
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
CREATE POLICY "Anyone can insert feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());


-- ── 9. Re-assert fix_rls_service_role_policies.sql ───────────────────────────
-- That file was authored 2026-07-02 but is not recorded as applied anywhere in
-- CLAUDE.md or SESSION_LOG.md. If it was never run, the policies below give
-- ANY anon caller full INSERT/UPDATE/DELETE on the XP, objective, reward and
-- homepage-config tables. Re-running the drops is harmless if already done.
DROP POLICY IF EXISTS "Service role manages xp"              ON public.user_xp;
DROP POLICY IF EXISTS "Service role manages xp events"       ON public.xp_events;
DROP POLICY IF EXISTS "Service role manages user rewards"    ON public.user_rewards;
DROP POLICY IF EXISTS "Service role manages stats"           ON public.user_stats;
DROP POLICY IF EXISTS "Service role manages objectives"      ON public.objectives;
DROP POLICY IF EXISTS "Service role manages user objectives" ON public.user_objectives;
DROP POLICY IF EXISTS "Service role manages card library"    ON public.card_library;
DROP POLICY IF EXISTS "Service role full access"             ON public.category_homepage_settings;


-- ── 10. Verification query ───────────────────────────────────────────────────
-- After running the above, this should return ZERO rows. Any row it returns is
-- a table where anon/authenticated can still write directly via PostgREST.
--
--   SELECT tablename, policyname, cmd, qual, with_check
--     FROM pg_policies
--    WHERE schemaname = 'public'
--      AND cmd <> 'SELECT'
--      AND (roles = '{public}' OR 'anon' = ANY(roles) OR 'authenticated' = ANY(roles))
--    ORDER BY tablename;
--
-- Expected remaining (intentional) writers:
--   uploaded_images     INSERT  (CreateTierlistForm / UploadTierlistModal)
--   user_profiles       INSERT/UPDATE (setup-username, profile page)
--   feedback            INSERT  (FeedbackForm, now user_id-checked)
--   draft_runs          INSERT  (api/draft/history uses the user-scoped client)
--   saved_profile_images INSERT/DELETE (api/profile/images, user-scoped client)
--   tierlists / tierlist_images / tierlist_rankings / *_likes / saved_tierlists
--                       (all ownership-scoped: auth.uid() = <owner column>)
