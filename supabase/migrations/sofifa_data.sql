-- SoFIFA player data across all FIFA editions (FIFA 07 through FC 26)
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS sofifa_players (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sofifa_id TEXT NOT NULL,
  fifa_year INTEGER NOT NULL,
  fifa_edition TEXT NOT NULL,
  name TEXT NOT NULL,
  positions TEXT,
  nationality TEXT,
  club TEXT,
  league TEXT,
  overall INTEGER,
  potential INTEGER,
  age INTEGER,
  image_url TEXT,
  attributes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sofifa_id, fifa_year)
);

-- idx_sofifa_year was dropped 25 Oct 2026 (fifa_stats_shrink.sql): idx_sofifa_year_league covers it.
CREATE INDEX IF NOT EXISTS idx_sofifa_club_year ON sofifa_players(club, fifa_year);
CREATE INDEX IF NOT EXISTS idx_sofifa_league_year ON sofifa_players(league, fifa_year);
CREATE INDEX IF NOT EXISTS idx_sofifa_overall ON sofifa_players(overall DESC);
-- Name search index. Renamed 25 Oct 2026 (fifa_stats_shrink.sql): the live database had two
-- identical copies, idx_sofifa_name and idx_sofifa_name_trgm; only idx_sofifa_name_trgm is kept.
CREATE INDEX IF NOT EXISTS idx_sofifa_name_trgm ON sofifa_players USING gin(name gin_trgm_ops);

ALTER TABLE sofifa_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sofifa_players" ON sofifa_players FOR SELECT USING (true);
