-- =============================================================
-- Vote Tierlists Schema
-- Run this in the Supabase SQL Editor after the main schema.
-- =============================================================

-- ---------------------------------------------------------------
-- 1. vote_tierlists
--    A tierlist where visitors vote rather than drag-and-drop.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_tierlists (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  category        TEXT        NOT NULL DEFAULT 'General',
  cover_image_url TEXT,
  description     TEXT,
  -- JSON array of {label: string, color: string} in display order
  tiers           JSONB       NOT NULL DEFAULT '[
    {"label":"S","color":"#ff7f7f"},
    {"label":"A","color":"#ffbf7f"},
    {"label":"B","color":"#ffdf80"},
    {"label":"C","color":"#bfff7f"},
    {"label":"D","color":"#7fbfff"}
  ]',
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- 2. vote_tierlist_images
--    The items users vote on (e.g. individual players/movies).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_tierlist_images (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_tierlist_id UUID        NOT NULL REFERENCES public.vote_tierlists(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  image_url        TEXT        NOT NULL,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vote_images_tierlist
  ON public.vote_tierlist_images (vote_tierlist_id, sort_order);

-- ---------------------------------------------------------------
-- 3. vote_tierlist_votes
--    One row per voter per image.
--    voter_id = auth user UUID for logged-in users,
--               or a client-generated UUID stored in localStorage
--               for anonymous users.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vote_tierlist_votes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_tierlist_id UUID        NOT NULL REFERENCES public.vote_tierlists(id) ON DELETE CASCADE,
  image_id         UUID        NOT NULL REFERENCES public.vote_tierlist_images(id) ON DELETE CASCADE,
  tier_label       TEXT        NOT NULL,
  voter_id         TEXT        NOT NULL,  -- UUID string (auth user ID or anon UUID)
  is_anonymous     BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Exactly one vote per voter per image
  UNIQUE (image_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_vote_votes_tierlist
  ON public.vote_tierlist_votes (vote_tierlist_id, image_id);

-- Auto-update updated_at on vote changes
CREATE OR REPLACE FUNCTION public.update_vote_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_vote_updated_at ON public.vote_tierlist_votes;
CREATE TRIGGER set_vote_updated_at
  BEFORE UPDATE ON public.vote_tierlist_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_vote_updated_at();

-- ---------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------
ALTER TABLE public.vote_tierlists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_tierlist_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_tierlist_votes  ENABLE ROW LEVEL SECURITY;

-- vote_tierlists: anyone can read active ones
CREATE POLICY "Public read active vote tierlists"
  ON public.vote_tierlists FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can create vote tierlists"
  ON public.vote_tierlists FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their vote tierlists"
  ON public.vote_tierlists FOR UPDATE
  USING (auth.uid() = created_by);

-- vote_tierlist_images: public read
CREATE POLICY "Public read vote tierlist images"
  ON public.vote_tierlist_images FOR SELECT
  USING (true);

CREATE POLICY "Creators can manage vote tierlist images"
  ON public.vote_tierlist_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vote_tierlists
      WHERE id = vote_tierlist_images.vote_tierlist_id
        AND created_by = auth.uid()
    )
  );

-- vote_tierlist_votes: public read, public insert/update
-- (actual uniqueness is enforced by the DB constraint; API routes use
--  the service role client so RLS is bypassed server-side)
CREATE POLICY "Public read votes"
  ON public.vote_tierlist_votes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can vote"
  ON public.vote_tierlist_votes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Voters can change their vote"
  ON public.vote_tierlist_votes FOR UPDATE
  USING (true);
