-- READ ONLY. What: lists every row rule (RLS policy) on our tables that asks "who is signed in?" (auth.uid(), auth.role(), auth.jwt()) once per row, with the exact new wording rls_select_auth_uid.sql would give it. Also lists every rule on the 4 tables with doubled-up rules. Changes nothing.
-- Why: the repo's migration files do not hold every live rule (some were made in the dashboard), so the rewrite works from the live wording. Run this first to see each before/after and check the count is 42.

-- 1. Each rule to rewrite: before and after. Expect about 42 rows (speed advisor, 25 Oct 2026).
WITH p AS (
  SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
), w AS (
  SELECT *,
    -- Same three swaps the migration makes: protect already-wrapped calls, wrap the rest, restore.
    replace(replace(replace(replace(replace(replace(replace(replace(replace(qual,
      '( SELECT auth.uid() AS uid)', '@@U@@'), '( SELECT auth.role() AS role)', '@@R@@'), '( SELECT auth.jwt() AS jwt)', '@@J@@'),
      'auth.uid()', '(SELECT auth.uid())'), 'auth.role()', '(SELECT auth.role())'), 'auth.jwt()', '(SELECT auth.jwt())'),
      '@@U@@', '(SELECT auth.uid())'), '@@R@@', '(SELECT auth.role())'), '@@J@@', '(SELECT auth.jwt())') AS qual_after,
    replace(replace(replace(replace(replace(replace(replace(replace(replace(with_check,
      '( SELECT auth.uid() AS uid)', '@@U@@'), '( SELECT auth.role() AS role)', '@@R@@'), '( SELECT auth.jwt() AS jwt)', '@@J@@'),
      'auth.uid()', '(SELECT auth.uid())'), 'auth.role()', '(SELECT auth.role())'), 'auth.jwt()', '(SELECT auth.jwt())'),
      '@@U@@', '(SELECT auth.uid())'), '@@R@@', '(SELECT auth.role())'), '@@J@@', '(SELECT auth.jwt())') AS check_after
  FROM p
)
SELECT tablename, policyname, cmd, roles, qual AS using_now, qual_after AS using_after,
       with_check AS check_now, check_after
FROM w
WHERE (replace(replace(replace(COALESCE(qual, '') || ' ' || COALESCE(with_check, ''),
        '( SELECT auth.uid() AS uid)', ''), '( SELECT auth.role() AS role)', ''), '( SELECT auth.jwt() AS jwt)', '')
       ~ 'auth\.(uid|role|jwt)\(\)')
ORDER BY tablename, policyname;

-- 2. Every rule on the 4 tables the advisor says have two rules doing the same job.
SELECT tablename, policyname, permissive, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('blind_ranking_likes', 'saved_tierlists', 'tierlist_likes', 'user_objectives')
ORDER BY tablename, cmd, policyname;
