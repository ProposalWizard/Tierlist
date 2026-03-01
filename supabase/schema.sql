-- =============================================================
-- Tierlist App – Supabase PostgreSQL Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================

-- ---------------------------------------------------------------
-- 1. tierlist_topics
--    Represents a ranking topic (e.g. "Premier League 2024/25").
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tierlist_topics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        NOT NULL UNIQUE,          -- URL-friendly key, e.g. "premier-league-2024"
  title       TEXT        NOT NULL,                 -- Display name
  description TEXT,                                 -- Optional description shown on the page
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed one starter topic
INSERT INTO public.tierlist_topics (slug, title, description)
VALUES (
  'premier-league-2024',
  'Premier League 2024/25',
  'Rank the 12 most influential Premier League players of the 2024/25 season.'
)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------
-- 2. tierlist_players
--    Individual players that belong to a topic.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tierlist_players (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   UUID        NOT NULL REFERENCES public.tierlist_topics(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  position   TEXT,                                  -- e.g. "ST", "CM", "GK"
  club       TEXT,                                  -- e.g. "Manchester City"
  image_url  TEXT,                                  -- Optional player avatar URL
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by topic
CREATE INDEX IF NOT EXISTS idx_tierlist_players_topic_id
  ON public.tierlist_players (topic_id);

-- Seed 12 players for the starter topic
-- (Replace image_url values with real URLs or leave NULL)
DO $$
DECLARE
  topic_uuid UUID;
BEGIN
  SELECT id INTO topic_uuid FROM public.tierlist_topics WHERE slug = 'premier-league-2024';

  INSERT INTO public.tierlist_players (topic_id, name, position, club) VALUES
    (topic_uuid, 'Erling Haaland',   'ST',  'Manchester City'),
    (topic_uuid, 'Mohamed Salah',    'RW',  'Liverpool'),
    (topic_uuid, 'Bukayo Saka',      'RW',  'Arsenal'),
    (topic_uuid, 'Cole Palmer',      'CAM', 'Chelsea'),
    (topic_uuid, 'Phil Foden',       'CAM', 'Manchester City'),
    (topic_uuid, 'Martin Ødegaard',  'CAM', 'Arsenal'),
    (topic_uuid, 'Virgil van Dijk',  'CB',  'Liverpool'),
    (topic_uuid, 'Trent Alexander-Arnold', 'RB', 'Liverpool'),
    (topic_uuid, 'Rodri',            'CDM', 'Manchester City'),
    (topic_uuid, 'Bruno Fernandes',  'CAM', 'Manchester United'),
    (topic_uuid, 'Ollie Watkins',    'ST',  'Aston Villa'),
    (topic_uuid, 'Declan Rice',      'CDM', 'Arsenal')
  ON CONFLICT DO NOTHING;
END $$;


-- ---------------------------------------------------------------
-- 3. tierlist_rankings
--    One row per (user, topic, player) – stores which tier the
--    user placed each player in.
--    The UNIQUE constraint on (user_id, topic_id, player_id)
--    enforces that a player can appear in only ONE tier per user.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tierlist_rankings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id   UUID        NOT NULL REFERENCES public.tierlist_topics(id) ON DELETE CASCADE,
  player_id  UUID        NOT NULL REFERENCES public.tierlist_players(id) ON DELETE CASCADE,
  tier       TEXT        NOT NULL CHECK (tier IN ('S','A','B','C','D')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent a player appearing in more than one tier for the same user+topic
  CONSTRAINT uq_ranking_user_topic_player UNIQUE (user_id, topic_id, player_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tierlist_rankings_user_topic
  ON public.tierlist_rankings (user_id, topic_id);

CREATE INDEX IF NOT EXISTS idx_tierlist_rankings_player
  ON public.tierlist_rankings (player_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rankings_updated_at ON public.tierlist_rankings;
CREATE TRIGGER trg_rankings_updated_at
  BEFORE UPDATE ON public.tierlist_rankings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 4. Row Level Security (RLS)
--    Ensures users can only read/write their own rankings.
-- ---------------------------------------------------------------

-- Topics and players are publicly readable
ALTER TABLE public.tierlist_topics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tierlist_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tierlist_rankings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read topics
CREATE POLICY "topics_select_public"
  ON public.tierlist_topics FOR SELECT
  USING (true);

-- Allow anyone to read players
CREATE POLICY "players_select_public"
  ON public.tierlist_players FOR SELECT
  USING (true);

-- Users can read their own rankings
CREATE POLICY "rankings_select_own"
  ON public.tierlist_rankings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own rankings
CREATE POLICY "rankings_insert_own"
  ON public.tierlist_rankings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own rankings
CREATE POLICY "rankings_update_own"
  ON public.tierlist_rankings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own rankings (needed for upsert logic)
CREATE POLICY "rankings_delete_own"
  ON public.tierlist_rankings FOR DELETE
  USING (auth.uid() = user_id);


-- =============================================================
-- 5. tierlists  (user-created playable tierlist templates)
-- =============================================================
-- IMPORTANT – Storage setup (do this in Supabase Dashboard first):
--   Storage → New bucket → Name: "tierlist-images" → Public: ON
--   This bucket stores the uploaded images for each tierlist.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.tierlists (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  slug            TEXT        NOT NULL UNIQUE,
  cover_image_url TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tierlists_created_by
  ON public.tierlists (created_by);

CREATE INDEX IF NOT EXISTS idx_tierlists_created_at
  ON public.tierlists (created_at DESC);


-- =============================================================
-- 6. tierlist_images  (the images that belong to a tierlist)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.tierlist_images (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tierlist_id  UUID        NOT NULL REFERENCES public.tierlists(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  image_url    TEXT        NOT NULL,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tierlist_images_tierlist_id
  ON public.tierlist_images (tierlist_id);


-- =============================================================
-- RLS for tierlists + tierlist_images
-- =============================================================

ALTER TABLE public.tierlists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tierlist_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view all tierlists (public gallery)
CREATE POLICY "tierlists_select_public"
  ON public.tierlists FOR SELECT
  USING (true);

-- Only the creator can insert
CREATE POLICY "tierlists_insert_own"
  ON public.tierlists FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only the creator can delete
CREATE POLICY "tierlists_delete_own"
  ON public.tierlists FOR DELETE
  USING (auth.uid() = created_by);

-- Anyone can view all images (public gallery)
CREATE POLICY "tierlist_images_select_public"
  ON public.tierlist_images FOR SELECT
  USING (true);

-- Only the tierlist owner can insert images
CREATE POLICY "tierlist_images_insert_own"
  ON public.tierlist_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tierlists
      WHERE id = tierlist_id AND created_by = auth.uid()
    )
  );
