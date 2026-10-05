-- TESTER ACCESS (Harry, 5 Oct 2026).
--
-- "a 'tester access' link and accounts that we will use for our testers to be
-- able to have god mode too".
--
-- Three groups: player, tester, admin. A tester gets the Star Career
-- Settings → Developer tools and the test pages that only play the game. An
-- admin makes a link on /admin/testers (/tester/K7Q2XM); a signed-in person
-- who opens it becomes a tester.
--
--  1. user_roles.is_tester — the tester mark (admins count as testers too).
--  2. tester_links — one row per link. Switch a link off with active = false.
--
-- Nobody writes either from the browser. Every write goes through the
-- server routes with the service key (app/api/admin/testers,
-- app/api/tester/claim), which bypasses RLS. user_roles keeps its existing
-- "read own role" policy and nothing else.
--
-- Until this runs: nobody is a tester, every admin feature works as before,
-- /tester/... links say they aren't set up yet, and /admin/testers shows a
-- red line naming this file. Safe to re-run.

-- 1. The tester mark.
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_tester BOOLEAN NOT NULL DEFAULT false;

-- 2. The links.
CREATE TABLE IF NOT EXISTS public.tester_links (
  code       TEXT        PRIMARY KEY,
  created_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active     BOOLEAN     NOT NULL DEFAULT true,
  uses       INT         NOT NULL DEFAULT 0,
  note       TEXT
);

-- RLS on, no policies at all: the browser (anon or signed in) can't read or
-- write a single link. Only the service key can.
ALTER TABLE public.tester_links ENABLE ROW LEVEL SECURITY;

-- Belt and braces: no client write policy on user_roles. Only the existing
-- "read own role" policy should be listed by the check below.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ── Verify (run after) ──────────────────────────────────────────────────────
-- Expect: is_tester | boolean | NO | false
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'is_tester';
--
-- Expect: tester_links with rls on (true), and 0 policies on it.
-- SELECT c.relname, c.relrowsecurity,
--        (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public' AND c.relname IN ('tester_links', 'user_roles');
--
-- Expect: only a SELECT policy on user_roles (user_roles_select_own).
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND tablename IN ('user_roles', 'tester_links');
--
-- Who is a tester now:
-- SELECT user_id, is_admin, is_tester FROM public.user_roles WHERE is_tester OR is_admin;
