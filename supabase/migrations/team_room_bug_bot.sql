-- team_room_bug_bot.sql — the Bug bot's rule inside the database, on its own
-- (12 Nov 2026). It is the same rule as section 6 of team_room_v4.sql, in a
-- small file, for when only this part is missing (a new database, a restore).
--
-- STATUS ON THE LIVE DATABASE: ALREADY THERE. Read on 12 Nov 2026 with PART 1
-- below: trigger_live = 1, tables_live = 3. So nothing needs running today.
-- The site also has a safety net that needs no SQL: every 15 minutes it posts
-- a card for any report of the last 3 days that has none
-- (lib/teamRoom/botsServer.ts runBugBot).
--
-- Run each part by itself in the Supabase SQL Editor.

-- ═══════════════════════════════════════════════════════════════════════
-- PART 1 — READ ONLY. Changes nothing. Run this first.
-- ═══════════════════════════════════════════════════════════════════════
-- trigger_live 1 = the rule is there (stop here). 0 = run PART 2.
-- tables_live must be 3 before PART 2 (else run team_room_v3.sql and
-- team_room_v4.sql first: they make the tables).
SELECT
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'feedback_to_team_bugs') AS trigger_live,
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('team_bot_posts', 'team_bug_marks', 'feedback')) AS tables_live,
  (SELECT count(*) FROM public.feedback WHERE created_at > now() - interval '3 days') AS reports_last_3_days;

-- ═══════════════════════════════════════════════════════════════════════
-- PART 2 — CHANGES THE DATABASE. Only if PART 1 said trigger_live = 0.
-- ═══════════════════════════════════════════════════════════════════════
-- Adds one function and one trigger on public.feedback. It adds no table and
-- deletes nothing. Safe to run twice (CREATE OR REPLACE, DROP TRIGGER IF EXISTS).
-- A player's browser gets no new rights: the trigger writes the card as the
-- database owner (SECURITY DEFINER), and a problem inside it never stops a
-- player's report from saving (EXCEPTION … RETURN NEW).
-- To undo: DROP TRIGGER feedback_to_team_bugs ON public.feedback;
CREATE OR REPLACE FUNCTION public.team_room_bug_post() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  first_line text := left(btrim(split_part(coalesce(NEW.message, ''), E'\n', 1)), 140);
  path text := NULLIF(regexp_replace(coalesce(NEW.page_url, ''), '^https?://[^/]+', ''), '');
BEGIN
  IF path IS NOT NULL AND left(path, 1) <> '/' THEN path := NULL; END IF;
  INSERT INTO public.team_bot_posts (bot, channel, title, body, url, everyone, meta)
  VALUES (
    'bug', 'bugs',
    CASE WHEN first_line = '' THEN 'Bug report' ELSE first_line END,
    left(coalesce(NEW.message, ''), 2000),
    left(path, 300),
    false,
    jsonb_build_object('feedback_id', NEW.id::text, 'page', left(coalesce(NEW.page_url, ''), 300), 'signed_in', NEW.user_id IS NOT NULL)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feedback_to_team_bugs ON public.feedback;
CREATE TRIGGER feedback_to_team_bugs AFTER INSERT ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.team_room_bug_post();

-- Check (READ ONLY): should say 1.
SELECT count(*) AS trigger_live FROM pg_trigger WHERE tgname = 'feedback_to_team_bugs';
