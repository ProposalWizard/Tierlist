-- Blind Rankings schema
-- Run this in Supabase SQL Editor to create the blind rankings tables.

CREATE TABLE IF NOT EXISTS blind_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'General',
  cover_image_url TEXT,
  num_slots INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  face_detection_enabled BOOLEAN NOT NULL DEFAULT false,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blind_ranking_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blind_ranking_id UUID NOT NULL REFERENCES blind_rankings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  face_center JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Likes table
CREATE TABLE IF NOT EXISTS blind_ranking_likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blind_ranking_id UUID NOT NULL REFERENCES blind_rankings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, blind_ranking_id)
);

-- RLS
ALTER TABLE blind_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blind_ranking_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read blind_rankings" ON blind_rankings FOR SELECT USING (true);
CREATE POLICY "Public read blind_ranking_images" ON blind_ranking_images FOR SELECT USING (true);

-- RLS for likes
ALTER TABLE blind_ranking_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read blind_ranking_likes" ON blind_ranking_likes FOR SELECT USING (true);
CREATE POLICY "Users manage own blind_ranking_likes" ON blind_ranking_likes
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blind_ranking_images_ranking_id ON blind_ranking_images (blind_ranking_id);
CREATE INDEX IF NOT EXISTS idx_blind_rankings_active ON blind_rankings (is_active);
CREATE INDEX IF NOT EXISTS idx_blind_ranking_likes_ranking_id ON blind_ranking_likes (blind_ranking_id);

-- View count increment function
CREATE OR REPLACE FUNCTION increment_blind_ranking_view_count(p_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE blind_rankings SET view_count = view_count + 1 WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
