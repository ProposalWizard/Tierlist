-- SECURITY FIX: several progression/objective/config tables were created with
-- policies written as `FOR ALL USING (true) WITH CHECK (true)` and NO role
-- clause. A policy with no `TO` clause defaults to the PUBLIC role, so it
-- applies to `anon` and `authenticated` — not just the service role as the
-- policy names imply. Because permissive RLS policies are OR'd together, this
-- granted ANY client holding the public anon key full INSERT/UPDATE/DELETE on
-- these tables via the Supabase REST API, letting users self-award unlimited
-- XP, levels, rewards, mark objectives complete, and rewrite homepage/card
-- config.
--
-- The service role BYPASSES RLS entirely, so these policies were never needed
-- for server-side code to work. The correct fix is to DROP them. Public SELECT
-- policies (where intended) are left untouched.
--
-- Idempotent — safe to run regardless of which policies currently exist.
-- Run this in the Supabase SQL Editor.

-- progression_system.sql
DROP POLICY IF EXISTS "Service role manages xp"           ON user_xp;
DROP POLICY IF EXISTS "Service role manages xp events"    ON xp_events;
DROP POLICY IF EXISTS "Service role manages user rewards" ON user_rewards;
DROP POLICY IF EXISTS "Service role manages stats"        ON user_stats;

-- objectives.sql
DROP POLICY IF EXISTS "Service role manages objectives"      ON objectives;
DROP POLICY IF EXISTS "Service role manages user objectives" ON user_objectives;

-- card_library.sql
DROP POLICY IF EXISTS "Service role manages card library" ON card_library;

-- category_settings.sql
DROP POLICY IF EXISTS "Service role full access" ON public.category_homepage_settings;

-- NOTE: after dropping these, the tables still have RLS enabled and keep their
-- public `FOR SELECT` policies where present, so reads continue to work for the
-- client and all writes continue to work through the server's service-role
-- client (which bypasses RLS). No application code change is required.
