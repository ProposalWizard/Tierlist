-- Add popularity score to football_players for search ranking
-- Run this in Supabase SQL Editor

ALTER TABLE football_players ADD COLUMN IF NOT EXISTS popularity INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_fp_popularity ON football_players(popularity);
