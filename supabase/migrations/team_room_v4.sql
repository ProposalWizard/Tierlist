-- CHANGES THE DATABASE. What: four small Team room tables (team_status, team_welcome,
-- team_welcome_reads, team_bug_marks), one new column on team_bot_posts (meta), and a
-- trigger on feedback that posts each new bug report into #bugs as the Bug bot.
-- Why: the Slack-style Team room (Harry, 25 Oct 2026): status and schedules on each
-- person, a note shown once when someone first opens the room, and #bugs filling
-- itself from players' reports. Nothing existing is changed or deleted.
--
-- team_room_v4.sql — run AFTER team_room.sql, team_room_v2.sql and team_room_v3.sql
-- (it uses their team_room_admin() and team_room_person() checks and the
-- team_bot_posts table). Safe to run twice. Run it once in the Supabase SQL Editor.
--
-- Until it runs the room still works: status is kept on the device that set it,
-- #bugs shows a quiet "needs setup" line, and the note is not shown.
--
-- WHAT THIS FILE ADDS:
--   1. team_status        — one row per person: status emoji + words, "clear after",
--                           do-not-disturb until, repeating schedules, time zone.
--                           Everyone on the team reads; each person writes only theirs.
--   2. team_welcome       — one row: the note (one message for everyone + a short line
--                           per person) and its version. Only Harry can write it.
--   3. team_welcome_reads — who pressed "Got it" on which version, and when.
--   4. team_bot_posts.meta — extra facts for a bot's post (a bug report's page, who sent it).
--   5. team_bug_marks     — on a bug report: who it was handed to, and who marked it fixed.
--   6. A trigger on feedback: each new row becomes one Bug bot post in #bugs, at once,
--      inside the database (nobody's browser writes it).

-- ── 1. Status ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_status (
  person text PRIMARY KEY CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  emoji text CHECK (emoji IS NULL OR char_length(emoji) <= 16),
  text text CHECK (text IS NULL OR char_length(text) <= 100),
  clear_at timestamptz,
  dnd_until timestamptz,
  schedules jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(schedules) = 'array' AND jsonb_array_length(schedules) <= 8),
  tz text CHECK (tz IS NULL OR char_length(tz) <= 64),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2 + 3. The note shown once on first open, and who has read it ──────
CREATE TABLE IF NOT EXISTS public.team_welcome (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 3000),
  lines jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(lines) = 'object'),
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text CHECK (updated_by IS NULL OR updated_by IN ('Harry', 'Mikey', 'Leo'))
);
CREATE TABLE IF NOT EXISTS public.team_welcome_reads (
  person text NOT NULL CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  version int NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person, version)
);

-- ── 4. A bot post's extra facts ────────────────────────────────────────
ALTER TABLE public.team_bot_posts ADD COLUMN IF NOT EXISTS meta jsonb;

-- ── 5. Bug report marks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_bug_marks (
  post_id bigint PRIMARY KEY REFERENCES public.team_bot_posts(id) ON DELETE CASCADE,
  handed_to text CHECK (handed_to IS NULL OR handed_to IN ('Harry', 'Mikey', 'Leo')),
  fixed_by text CHECK (fixed_by IS NULL OR fixed_by IN ('Harry', 'Mikey', 'Leo')),
  fixed_at timestamptz,
  updated_by text NOT NULL CHECK (updated_by IN ('Harry', 'Mikey', 'Leo')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Row rules ───────────────────────────────────────────────────────────
ALTER TABLE public.team_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_welcome ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_welcome_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_bug_marks ENABLE ROW LEVEL SECURITY;

-- Status: everyone on the team reads; each person writes only their own row.
DROP POLICY IF EXISTS "admins read team_status" ON public.team_status;
CREATE POLICY "admins read team_status" ON public.team_status FOR SELECT USING (public.team_room_admin());
DROP POLICY IF EXISTS "status own insert" ON public.team_status;
CREATE POLICY "status own insert" ON public.team_status FOR INSERT
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person());
DROP POLICY IF EXISTS "status own update" ON public.team_status;
CREATE POLICY "status own update" ON public.team_status FOR UPDATE
  USING (public.team_room_admin() AND person = public.team_room_person())
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person());

-- The note: everyone on the team reads; only Harry writes it.
DROP POLICY IF EXISTS "admins read team_welcome" ON public.team_welcome;
CREATE POLICY "admins read team_welcome" ON public.team_welcome FOR SELECT USING (public.team_room_admin());
DROP POLICY IF EXISTS "harry writes team_welcome" ON public.team_welcome;
CREATE POLICY "harry writes team_welcome" ON public.team_welcome FOR INSERT
  WITH CHECK (public.team_room_admin() AND public.team_room_person() = 'Harry');
DROP POLICY IF EXISTS "harry updates team_welcome" ON public.team_welcome;
CREATE POLICY "harry updates team_welcome" ON public.team_welcome FOR UPDATE
  USING (public.team_room_admin() AND public.team_room_person() = 'Harry')
  WITH CHECK (public.team_room_admin() AND public.team_room_person() = 'Harry');

-- Reads: everyone on the team reads (Harry sees who has read it); add only your own.
DROP POLICY IF EXISTS "admins read team_welcome_reads" ON public.team_welcome_reads;
CREATE POLICY "admins read team_welcome_reads" ON public.team_welcome_reads FOR SELECT USING (public.team_room_admin());
DROP POLICY IF EXISTS "welcome read own" ON public.team_welcome_reads;
CREATE POLICY "welcome read own" ON public.team_welcome_reads FOR INSERT
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person());

-- Bug marks: everyone on the team reads and writes (hand a report on, mark it fixed).
DROP POLICY IF EXISTS "admins read team_bug_marks" ON public.team_bug_marks;
CREATE POLICY "admins read team_bug_marks" ON public.team_bug_marks FOR SELECT USING (public.team_room_admin());
DROP POLICY IF EXISTS "bug marks insert" ON public.team_bug_marks;
CREATE POLICY "bug marks insert" ON public.team_bug_marks FOR INSERT
  WITH CHECK (public.team_room_admin() AND updated_by = public.team_room_person());
DROP POLICY IF EXISTS "bug marks update" ON public.team_bug_marks;
CREATE POLICY "bug marks update" ON public.team_bug_marks FOR UPDATE
  USING (public.team_room_admin() AND public.team_room_person() IS NOT NULL)
  WITH CHECK (public.team_room_admin() AND updated_by = public.team_room_person());

-- ── 6. #bugs fills itself: each new feedback row → one Bug bot post ─────
-- SECURITY DEFINER: the trigger writes team_bot_posts as the database owner, so the
-- player's browser (which may only INSERT into feedback) never gets any rights here.
-- The post keeps the report's words, the page it came from (as a path on this site)
-- and the feedback row's id; who sent it is looked up only by the admin page.
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
  -- A problem here must never stop a player's report from saving.
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feedback_to_team_bugs ON public.feedback;
CREATE TRIGGER feedback_to_team_bugs AFTER INSERT ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.team_room_bug_post();

-- ── Live updates ────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['team_status','team_welcome','team_welcome_reads','team_bug_marks'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
ALTER TABLE public.team_status REPLICA IDENTITY FULL;
ALTER TABLE public.team_welcome REPLICA IDENTITY FULL;
ALTER TABLE public.team_welcome_reads REPLICA IDENTITY FULL;
ALTER TABLE public.team_bug_marks REPLICA IDENTITY FULL;

-- Check: the four tables and their rules, the trigger, and the live list.
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('team_status', 'team_welcome', 'team_welcome_reads', 'team_bug_marks') ORDER BY tablename, cmd;
SELECT tgname FROM pg_trigger WHERE tgname = 'feedback_to_team_bugs';
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('team_status', 'team_welcome', 'team_welcome_reads', 'team_bug_marks');
