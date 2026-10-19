-- team_room.sql — the admin Team room (Harry, 19 Oct 2026): chat, ideas,
-- to-dos and notes for Harry, Mikey and Leo. Lives with lib/teamRoom/ and
-- components/teamRoom/ (the "portable kit": those two folders + this file).
--
-- Admins only, everywhere. Each admin account picks once which of the three
-- it is (team_members); every row is written under that name, checked here,
-- so nobody can post as somebody else. Live updates: every table is in the
-- supabase_realtime publication. Safe to run twice.

-- ── Who is who ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  person text NOT NULL UNIQUE CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.team_room_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.is_admin = true);
$$;

CREATE OR REPLACE FUNCTION public.team_room_person() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.person FROM public.team_members m WHERE m.user_id = auth.uid();
$$;

-- ── Chat ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_messages (
  id bigserial PRIMARY KEY,
  person text NOT NULL CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  image_url text CHECK (image_url IS NULL OR char_length(image_url) <= 500),
  page text CHECK (page IS NULL OR char_length(page) <= 200),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(body) > 0 OR image_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS team_messages_time ON public.team_messages (created_at DESC);

-- ── Ideas + votes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_ideas (
  id bigserial PRIMARY KEY,
  person text NOT NULL CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  stage text NOT NULL DEFAULT 'idea' CHECK (stage IN ('idea', 'doing', 'done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.team_idea_votes (
  idea_id bigint NOT NULL REFERENCES public.team_ideas(id) ON DELETE CASCADE,
  person text NOT NULL CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (idea_id, person)
);

-- ── To-dos ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_tasks (
  id bigserial PRIMARY KEY,
  owner text NOT NULL CHECK (owner IN ('Harry', 'Mikey', 'Leo')),
  made_by text NOT NULL CHECK (made_by IN ('Harry', 'Mikey', 'Leo')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_tasks_owner ON public.team_tasks (owner, created_at DESC);

-- ── Notes on an idea or a push ─────────────────────────────────────────
-- owner = whose idea/push it is, so they get the red dot.
CREATE TABLE IF NOT EXISTS public.team_notes (
  id bigserial PRIMARY KEY,
  target_kind text NOT NULL CHECK (target_kind IN ('idea', 'push')),
  target_id text NOT NULL CHECK (char_length(target_id) <= 80),
  owner text CHECK (owner IS NULL OR owner IN ('Harry', 'Mikey', 'Leo')),
  person text NOT NULL CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_notes_target ON public.team_notes (target_kind, target_id);

-- ── Row rules ───────────────────────────────────────────────────────────
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_idea_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_notes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['team_members','team_messages','team_ideas','team_idea_votes','team_tasks','team_notes'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admins read %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "admins read %1$s" ON public.%1$I FOR SELECT USING (public.team_room_admin())', t);
  END LOOP;
END $$;

-- Pick your name once (one account per name; cannot be changed from the browser).
DROP POLICY IF EXISTS "claim own name" ON public.team_members;
CREATE POLICY "claim own name" ON public.team_members FOR INSERT
  WITH CHECK (public.team_room_admin() AND user_id = auth.uid());

-- Chat: post as yourself; delete your own; anyone pins/unpins.
DROP POLICY IF EXISTS "post own" ON public.team_messages;
CREATE POLICY "post own" ON public.team_messages FOR INSERT
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person() AND pinned = false);
DROP POLICY IF EXISTS "pin any" ON public.team_messages;
CREATE POLICY "pin any" ON public.team_messages FOR UPDATE
  USING (public.team_room_admin()) WITH CHECK (public.team_room_admin());
DROP POLICY IF EXISTS "delete own" ON public.team_messages;
CREATE POLICY "delete own" ON public.team_messages FOR DELETE
  USING (public.team_room_admin() AND person = public.team_room_person());

-- Ideas: add as yourself; anyone moves the stage; delete your own.
DROP POLICY IF EXISTS "add own" ON public.team_ideas;
CREATE POLICY "add own" ON public.team_ideas FOR INSERT
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person());
DROP POLICY IF EXISTS "move any" ON public.team_ideas;
CREATE POLICY "move any" ON public.team_ideas FOR UPDATE
  USING (public.team_room_admin()) WITH CHECK (public.team_room_admin());
DROP POLICY IF EXISTS "delete own" ON public.team_ideas;
CREATE POLICY "delete own" ON public.team_ideas FOR DELETE
  USING (public.team_room_admin() AND person = public.team_room_person());

-- Votes: only your own dot.
DROP POLICY IF EXISTS "vote own" ON public.team_idea_votes;
CREATE POLICY "vote own" ON public.team_idea_votes FOR INSERT
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person());
DROP POLICY IF EXISTS "unvote own" ON public.team_idea_votes;
CREATE POLICY "unvote own" ON public.team_idea_votes FOR DELETE
  USING (public.team_room_admin() AND person = public.team_room_person());

-- To-dos: give one to anyone (made_by is you); tick or delete if it is yours or you gave it.
DROP POLICY IF EXISTS "give task" ON public.team_tasks;
CREATE POLICY "give task" ON public.team_tasks FOR INSERT
  WITH CHECK (public.team_room_admin() AND made_by = public.team_room_person() AND done_at IS NULL);
DROP POLICY IF EXISTS "tick task" ON public.team_tasks;
CREATE POLICY "tick task" ON public.team_tasks FOR UPDATE
  USING (public.team_room_admin() AND public.team_room_person() IN (owner, made_by))
  WITH CHECK (public.team_room_admin() AND public.team_room_person() IN (owner, made_by));
DROP POLICY IF EXISTS "delete task" ON public.team_tasks;
CREATE POLICY "delete task" ON public.team_tasks FOR DELETE
  USING (public.team_room_admin() AND public.team_room_person() IN (owner, made_by));

-- Notes: add as yourself; delete your own.
DROP POLICY IF EXISTS "note own" ON public.team_notes;
CREATE POLICY "note own" ON public.team_notes FOR INSERT
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person());
DROP POLICY IF EXISTS "delete own note" ON public.team_notes;
CREATE POLICY "delete own note" ON public.team_notes FOR DELETE
  USING (public.team_room_admin() AND person = public.team_room_person());

-- ── Keep it small: last 5,000 messages, 2,000 notes ─────────────────────
CREATE OR REPLACE FUNCTION public.team_room_prune() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'team_messages' THEN
    DELETE FROM public.team_messages WHERE pinned = false AND id < (SELECT id FROM public.team_messages ORDER BY id DESC OFFSET 5000 LIMIT 1);
  ELSE
    DELETE FROM public.team_notes WHERE id < (SELECT id FROM public.team_notes ORDER BY id DESC OFFSET 2000 LIMIT 1);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS team_messages_prune ON public.team_messages;
CREATE TRIGGER team_messages_prune AFTER INSERT ON public.team_messages FOR EACH STATEMENT EXECUTE FUNCTION public.team_room_prune();
DROP TRIGGER IF EXISTS team_notes_prune ON public.team_notes;
CREATE TRIGGER team_notes_prune AFTER INSERT ON public.team_notes FOR EACH STATEMENT EXECUTE FUNCTION public.team_room_prune();

-- ── Live updates ────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['team_messages','team_ideas','team_idea_votes','team_tasks','team_notes'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
-- Deletes must carry the whole row for live removal to work.
ALTER TABLE public.team_idea_votes REPLICA IDENTITY FULL;
ALTER TABLE public.team_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.team_messages REPLICA IDENTITY FULL;
ALTER TABLE public.team_notes REPLICA IDENTITY FULL;
ALTER TABLE public.team_ideas REPLICA IDENTITY FULL;

-- Check: six tables, each with "admins read …"; five tables in the live list.
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename LIKE 'team_%' ORDER BY tablename, cmd;
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename LIKE 'team_%';
