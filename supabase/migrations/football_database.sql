-- Football Database: local copy of Wikidata football data
-- Run this in Supabase SQL Editor to create the tables

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Countries (for nationality + flags)
CREATE TABLE IF NOT EXISTS football_countries (
  wikidata_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  flag_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Players
CREATE TABLE IF NOT EXISTS football_players (
  wikidata_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date_of_birth TEXT,
  country_id TEXT,
  position TEXT,
  image_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Clubs / Teams
CREATE TABLE IF NOT EXISTS football_clubs (
  wikidata_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  league TEXT,
  image_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Career history (player <-> club)
CREATE TABLE IF NOT EXISTS football_careers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id TEXT NOT NULL,
  club_id TEXT NOT NULL,
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT,
  UNIQUE(player_id, club_id, start_date)
);

-- Indexes for fast search
CREATE INDEX IF NOT EXISTS idx_fp_name_trgm ON football_players USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_fp_country ON football_players(country_id);
CREATE INDEX IF NOT EXISTS idx_fc_name_trgm ON football_clubs USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_fcar_player ON football_careers(player_id);
CREATE INDEX IF NOT EXISTS idx_fcar_club ON football_careers(club_id);

-- RLS with public read access
ALTER TABLE football_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE football_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE football_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE football_careers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read countries" ON football_countries FOR SELECT USING (true);
CREATE POLICY "Public read players" ON football_players FOR SELECT USING (true);
CREATE POLICY "Public read clubs" ON football_clubs FOR SELECT USING (true);
CREATE POLICY "Public read careers" ON football_careers FOR SELECT USING (true);
