-- Tenable game mode: trivia with 10 answers and 3 lives
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS tenable_puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_ordered BOOLEAN DEFAULT false,
  daily_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE tenable_puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenable puzzles are publicly readable"
  ON tenable_puzzles FOR SELECT USING (true);

-- Index for daily date lookups
CREATE INDEX IF NOT EXISTS idx_tenable_puzzles_daily_date ON tenable_puzzles (daily_date DESC);
CREATE INDEX IF NOT EXISTS idx_tenable_puzzles_active ON tenable_puzzles (is_active);
