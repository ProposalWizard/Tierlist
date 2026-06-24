-- Road to Legend season configuration + per-level card rewards
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS season_config (
  season INTEGER PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Season 1',
  total_levels INTEGER NOT NULL DEFAULT 50
);

INSERT INTO season_config (season, name, total_levels)
VALUES (1, 'Season 1', 50)
ON CONFLICT (season) DO NOTHING;

CREATE TABLE IF NOT EXISTS season_level_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season INTEGER NOT NULL DEFAULT 1,
  level INTEGER NOT NULL,
  card_library_id UUID REFERENCES card_library(id) ON DELETE SET NULL,
  card_name TEXT,
  subtitle TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season, level)
);

ALTER TABLE season_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_level_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read season_config" ON season_config FOR SELECT USING (true);
CREATE POLICY "Public read season_level_rewards" ON season_level_rewards FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_season_level_rewards_season ON season_level_rewards(season, level);
