CREATE TABLE IF NOT EXISTS draft_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL DEFAULT 'Player',
  competition TEXT NOT NULL CHECK (competition IN ('pl', 'all')),
  record_type TEXT NOT NULL CHECK (record_type IN ('wins', 'goals', 'assists', 'clean_sheets', 'unbeaten')),
  value INTEGER NOT NULL,
  player_name TEXT,
  player_ovr INTEGER,
  season_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE draft_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view draft records"
  ON draft_records FOR SELECT USING (true);

CREATE POLICY "Users can insert own draft records"
  ON draft_records FOR INSERT WITH CHECK (auth.uid() = user_id);
