-- Nationality → flag image URL lookup table.
-- Populated automatically when importing sofifa_players data.
-- Lets the UI show correct country flags without re-querying each player.

CREATE TABLE IF NOT EXISTS nationality_flags (
  nationality TEXT PRIMARY KEY,
  flag_url    TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nationality_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read nationality_flags" ON nationality_flags FOR SELECT USING (true);
