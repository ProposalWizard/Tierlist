-- team_room_v3.sql — the Team room as channels (Harry, 23 Oct 2026):
-- "channels with all of the tools and things we already have available in
-- team board … reactions, threads, private DMs, a bot that automatically
-- uploads patch notes into a patch notes channel and @'s everyone".
--
-- Run AFTER team_room.sql and team_room_v2.sql (it uses their
-- team_room_admin() and team_room_person() checks). Never edit those two.
-- Safe to run twice. Run it once in the Supabase SQL Editor.
--
-- WHAT NEEDS NO DATABASE CHANGE (works before this runs):
--   * Channels and threads: a message's channel and thread ride at the front
--     of its text ("[#ideas] [re:12] …"), like replies already did. Old
--     messages have no tag, so they all land in #general.
--   * The patch-notes bot: drawn from the patch-notes list each deploy
--     carries; its phone buzz is the existing new-patch-notes buzz.
--   * The jobs bot in #bugs and its ✅: the existing to-do ticks.
--
-- WHAT THIS FILE ADDS:
--   1. team_channels   — new channels, and renamed built-in ones.
--   2. team_reactions  — 👍 ✅ 👀 🔥 ❌ on a message, one row per person per emoji.
--   3. team_dms        — private messages between two of the three. The row
--                        rules let ONLY its sender and its reader see a row,
--                        so it is private in the database, not just hidden
--                        on screen. Text only (pictures go to a public folder).
--   4. team_bot_posts  — a place for a future bot (a Claude routine) to post
--                        into a channel. Nobody can write it from a browser:
--                        only the site's own service key.
-- Every table: admins only, you can only write as yourself, live updates on.

-- ── 1. Channels ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_channels (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,29}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  topic text CHECK (topic IS NULL OR char_length(topic) <= 140),
  made_by text NOT NULL CHECK (made_by IN ('Harry', 'Mikey', 'Leo')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Reactions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_reactions (
  message_id bigint NOT NULL REFERENCES public.team_messages(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('👍', '✅', '👀', '🔥', '❌')),
  person text NOT NULL CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, emoji, person)
);

-- ── 3. Private DMs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_dms (
  id bigserial PRIMARY KEY,
  from_person text NOT NULL CHECK (from_person IN ('Harry', 'Mikey', 'Leo')),
  to_person text NOT NULL CHECK (to_person IN ('Harry', 'Mikey', 'Leo')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_person <> to_person)
);
CREATE INDEX IF NOT EXISTS team_dms_pair ON public.team_dms (from_person, to_person, id DESC);

-- ── 4. Bot posts (written only with the site's service key) ────────────
CREATE TABLE IF NOT EXISTS public.team_bot_posts (
  id bigserial PRIMARY KEY,
  bot text NOT NULL CHECK (bot ~ '^[a-z0-9][a-z0-9_-]{0,29}$'),
  channel text NOT NULL CHECK (channel ~ '^[a-z0-9][a-z0-9-]{0,29}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  url text CHECK (url IS NULL OR char_length(url) <= 300),
  everyone boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_bot_posts_time ON public.team_bot_posts (created_at DESC);

-- ── Row rules ───────────────────────────────────────────────────────────
ALTER TABLE public.team_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_dms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_bot_posts ENABLE ROW LEVEL SECURITY;

-- Channels: everyone on the team reads; add as yourself; anyone renames.
DROP POLICY IF EXISTS "admins read team_channels" ON public.team_channels;
CREATE POLICY "admins read team_channels" ON public.team_channels FOR SELECT USING (public.team_room_admin());
DROP POLICY IF EXISTS "add channel own" ON public.team_channels;
CREATE POLICY "add channel own" ON public.team_channels FOR INSERT
  WITH CHECK (public.team_room_admin() AND made_by = public.team_room_person());
DROP POLICY IF EXISTS "rename channel any" ON public.team_channels;
CREATE POLICY "rename channel any" ON public.team_channels FOR UPDATE
  USING (public.team_room_admin() AND public.team_room_person() IS NOT NULL)
  WITH CHECK (public.team_room_admin() AND public.team_room_person() IS NOT NULL);

-- Reactions: everyone reads; add and take back only your own.
DROP POLICY IF EXISTS "admins read team_reactions" ON public.team_reactions;
CREATE POLICY "admins read team_reactions" ON public.team_reactions FOR SELECT USING (public.team_room_admin());
DROP POLICY IF EXISTS "react own" ON public.team_reactions;
CREATE POLICY "react own" ON public.team_reactions FOR INSERT
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person());
DROP POLICY IF EXISTS "unreact own" ON public.team_reactions;
CREATE POLICY "unreact own" ON public.team_reactions FOR DELETE
  USING (public.team_room_admin() AND person = public.team_room_person());

-- DMs: ONLY the two people in it can read a row. Send as yourself; delete your own.
-- (No "admins read" rule here on purpose: being an admin is not enough.)
DROP POLICY IF EXISTS "read own dms" ON public.team_dms;
CREATE POLICY "read own dms" ON public.team_dms FOR SELECT
  USING (public.team_room_admin() AND public.team_room_person() IN (from_person, to_person));
DROP POLICY IF EXISTS "send dm own" ON public.team_dms;
CREATE POLICY "send dm own" ON public.team_dms FOR INSERT
  WITH CHECK (public.team_room_admin() AND from_person = public.team_room_person());
DROP POLICY IF EXISTS "delete dm own" ON public.team_dms;
CREATE POLICY "delete dm own" ON public.team_dms FOR DELETE
  USING (public.team_room_admin() AND from_person = public.team_room_person());

-- Bot posts: everyone on the team reads. No insert/update/delete rule at all,
-- so only the site's service key (which skips row rules) can write one.
DROP POLICY IF EXISTS "admins read team_bot_posts" ON public.team_bot_posts;
CREATE POLICY "admins read team_bot_posts" ON public.team_bot_posts FOR SELECT USING (public.team_room_admin());

-- ── Keep it small: last 2,000 DMs, 500 bot posts ───────────────────────
CREATE OR REPLACE FUNCTION public.team_room_prune_v3() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'team_dms' THEN
    DELETE FROM public.team_dms WHERE id < (SELECT id FROM public.team_dms ORDER BY id DESC OFFSET 2000 LIMIT 1);
  ELSE
    DELETE FROM public.team_bot_posts WHERE id < (SELECT id FROM public.team_bot_posts ORDER BY id DESC OFFSET 500 LIMIT 1);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS team_dms_prune ON public.team_dms;
CREATE TRIGGER team_dms_prune AFTER INSERT ON public.team_dms FOR EACH STATEMENT EXECUTE FUNCTION public.team_room_prune_v3();
DROP TRIGGER IF EXISTS team_bot_posts_prune ON public.team_bot_posts;
CREATE TRIGGER team_bot_posts_prune AFTER INSERT ON public.team_bot_posts FOR EACH STATEMENT EXECUTE FUNCTION public.team_room_prune_v3();

-- ── Live updates ────────────────────────────────────────────────────────
-- Supabase checks the row rules above before sending a live change, so a DM
-- only reaches its two people live too.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['team_channels','team_reactions','team_dms','team_bot_posts'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
-- Deletes carry the whole row, so a reaction taken back disappears live.
-- (For a table with row rules, Supabase sends only the key of a deleted row,
-- so a deleted DM never leaks its words.)
ALTER TABLE public.team_channels REPLICA IDENTITY FULL;
ALTER TABLE public.team_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.team_dms REPLICA IDENTITY FULL;
ALTER TABLE public.team_bot_posts REPLICA IDENTITY FULL;

-- Check: four tables with their rules (team_dms has NO "admins read" rule); all four in the live list.
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('team_channels', 'team_reactions', 'team_dms', 'team_bot_posts') ORDER BY tablename, cmd;
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('team_channels', 'team_reactions', 'team_dms', 'team_bot_posts');
