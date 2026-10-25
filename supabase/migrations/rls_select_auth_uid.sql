-- CHANGES THE DATABASE. What: rewords about 42 row rules (RLS policies) so each asks "who is signed in?" once per request instead of once per row, and merges doubled-up rules on 3 tables. Who can read or write what stays exactly the same.
-- Why: the speed advisor (25 Oct 2026) flagged all 42 (WARN): auth.uid() inside a rule runs again for every row read. Supabase's fix is to write it as (select auth.uid()), which runs once. Harry: the login checks "obviously need to be dealt with".
--
-- NOT RUN. Run supabase/checks/rls_policies_auth_uid.sql first (READ ONLY): it shows each rule's wording
-- now and after. Safe to re-run: a rule already in the new wording is left alone.
--
-- HOW IT STAYS FAITHFUL
-- The repo does not hold every live rule (e.g. user_objectives has 2 live rules using auth.uid(); the repo
-- shows 1; feedback's live rule is not in the repo at all). So part 2 does not retype any rule from the repo.
-- It reads each live rule's own wording from the database and changes only the words auth.uid(),
-- auth.role() and auth.jwt() into (SELECT auth.uid()) etc. ALTER POLICY keeps the rule's name, its
-- command (read/insert/update/delete) and its roles. Nothing else in the wording changes.
--
-- PART 1 merges doubled-up rules only where the live wording matches the repo exactly (checked first;
-- if it does not match, that table is skipped with a notice):
--  * saved_tierlists: "Users can read own saves" (read, own rows) sits inside "Users can manage own saves"
--    (everything, own rows), supabase/schema-additions.sql:66-67. The read one is dropped; same access.
--  * tierlist_likes, blind_ranking_likes: "anyone can read" + "users manage own" (FOR ALL) overlap on
--    reading (schema-additions.sql:54-55, blind_rankings.sql:45-47). The FOR ALL rule becomes three rules
--    (insert, update, delete, own rows only), so reading has one rule. Same access: everyone reads,
--    only you add, change or remove your own likes.
--  * user_objectives: skipped. Its live rules differ from the repo; read check block 2 first.
--
-- Estimate: no MB change. Reads on tables with these rules get faster as tables grow (the check runs
-- once per request, not per row). Reasoned, not measured.

-- Wording swap used by both parts: protect calls already wrapped, wrap the rest, restore.
CREATE OR REPLACE FUNCTION pg_temp.kib_wrap_auth(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT replace(replace(replace(replace(replace(replace(replace(replace(replace(t,
    '( SELECT auth.uid() AS uid)', '@@U@@'), '( SELECT auth.role() AS role)', '@@R@@'), '( SELECT auth.jwt() AS jwt)', '@@J@@'),
    'auth.uid()', '(SELECT auth.uid())'), 'auth.role()', '(SELECT auth.role())'), 'auth.jwt()', '(SELECT auth.jwt())'),
    '@@U@@', '(SELECT auth.uid())'), '@@R@@', '(SELECT auth.role())'), '@@J@@', '(SELECT auth.jwt())')
$$;

-- ── PART 1: merge doubled-up rules ─────────────────────────────────────────
DO $$
DECLARE
  own CONSTANT text := '((SELECT auth.uid()) = user_id)';
  a record; b record; t text;
BEGIN
  -- saved_tierlists
  SELECT * INTO a FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saved_tierlists'
    AND policyname = 'Users can manage own saves' AND cmd = 'ALL';
  SELECT * INTO b FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saved_tierlists'
    AND policyname = 'Users can read own saves' AND cmd = 'SELECT';
  IF a.policyname IS NOT NULL AND b.policyname IS NOT NULL
     AND pg_temp.kib_wrap_auth(a.qual) = own AND pg_temp.kib_wrap_auth(b.qual) = own
     AND a.roles = b.roles AND a.permissive = 'PERMISSIVE' AND b.permissive = 'PERMISSIVE' THEN
    DROP POLICY "Users can read own saves" ON public.saved_tierlists;
    RAISE NOTICE 'saved_tierlists: dropped "Users can read own saves" (covered by "Users can manage own saves").';
  ELSE
    RAISE NOTICE 'saved_tierlists: skipped, live rules differ from the repo.';
  END IF;

  -- tierlist_likes and blind_ranking_likes: same shape.
  FOREACH t IN ARRAY ARRAY['tierlist_likes', 'blind_ranking_likes'] LOOP
    SELECT * INTO a FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND cmd = 'ALL'
      AND policyname = CASE t WHEN 'tierlist_likes' THEN 'Users can manage own likes' ELSE 'Users manage own blind_ranking_likes' END;
    SELECT * INTO b FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND cmd = 'SELECT'
      AND policyname = CASE t WHEN 'tierlist_likes' THEN 'Anyone can read likes' ELSE 'Public read blind_ranking_likes' END;
    IF a.policyname IS NOT NULL AND b.policyname IS NOT NULL
       AND pg_temp.kib_wrap_auth(a.qual) = own AND a.with_check IS NULL
       AND b.qual = 'true' AND a.roles = '{public}' AND a.permissive = 'PERMISSIVE' THEN
      EXECUTE format('DROP POLICY %I ON public.%I', a.policyname, t);
      -- FOR ALL with no WITH CHECK used its USING wording as the check for insert and update; kept so.
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id)', t || ': insert own', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)', t || ': update own', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE USING ((SELECT auth.uid()) = user_id)', t || ': delete own', t);
      RAISE NOTICE '%: split "%" into insert / update / delete own rules.', t, a.policyname;
    ELSE
      RAISE NOTICE '%: skipped, live rules differ from the repo.', t;
    END IF;
  END LOOP;
END $$;

-- ── PART 2: reword every remaining rule, from its live wording ────────────
-- A rule needs it when, after setting aside calls already wrapped, a bare auth call is left.
CREATE OR REPLACE FUNCTION pg_temp.kib_needs(t text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT replace(replace(replace(COALESCE(t, ''),
    '( SELECT auth.uid() AS uid)', ''), '( SELECT auth.role() AS role)', ''), '( SELECT auth.jwt() AS jwt)', '')
    ~ 'auth\.(uid|role|jwt)\(\)'
$$;

DO $$
DECLARE
  p record; stmt text; n int := 0;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND (pg_temp.kib_needs(qual) OR pg_temp.kib_needs(with_check))
  LOOP
    stmt := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF pg_temp.kib_needs(p.qual) THEN
      stmt := stmt || ' USING (' || pg_temp.kib_wrap_auth(p.qual) || ')';
    END IF;
    IF pg_temp.kib_needs(p.with_check) THEN
      stmt := stmt || ' WITH CHECK (' || pg_temp.kib_wrap_auth(p.with_check) || ')';
    END IF;
    EXECUTE stmt;
    n := n + 1;
    RAISE NOTICE 'reworded: %.% "%"', p.schemaname, p.tablename, p.policyname;
  END LOOP;
  RAISE NOTICE 'Part 2 reworded % rules (expected about 42, minus the ones Part 1 replaced).', n;
END $$;

-- Verify afterwards (READ ONLY): re-run supabase/checks/rls_policies_auth_uid.sql. Block 1 should return
-- 0 rows; block 2 should show one read rule per table on the three merged tables. The speed advisor's
-- "auth RLS initplan" and "multiple permissive policies" lists should shrink to user_objectives only.
