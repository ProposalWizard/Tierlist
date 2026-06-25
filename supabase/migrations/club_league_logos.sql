-- Club and league logo URL lookup tables.
-- Populated from the scraper's club_logos.json and league_logos.json files.

CREATE TABLE IF NOT EXISTS club_logos (
  club       TEXT PRIMARY KEY,
  logo_url   TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE club_logos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read club_logos" ON club_logos FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS league_logos (
  league     TEXT PRIMARY KEY,
  logo_url   TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE league_logos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read league_logos" ON league_logos FOR SELECT USING (true);
