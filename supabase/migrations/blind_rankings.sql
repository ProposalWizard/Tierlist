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
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blind_ranking_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blind_ranking_id UUID NOT NULL REFERENCES blind_rankings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE blind_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE blind_ranking_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read blind_rankings" ON blind_rankings FOR SELECT USING (true);
CREATE POLICY "Public read blind_ranking_images" ON blind_ranking_images FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blind_ranking_images_ranking_id ON blind_ranking_images (blind_ranking_id);
CREATE INDEX IF NOT EXISTS idx_blind_rankings_active ON blind_rankings (is_active);
