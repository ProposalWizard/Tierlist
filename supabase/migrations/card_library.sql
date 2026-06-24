-- Centralized card image library so admins can upload once and reuse across features
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS card_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE card_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Card library publicly readable" ON card_library FOR SELECT USING (true);
CREATE POLICY "Service role manages card library" ON card_library FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_card_library_name ON card_library(name);
