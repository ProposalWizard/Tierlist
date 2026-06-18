-- Personal best records per user for the PL Draft game.
-- One row per user per (competition, record_type) — upserted when a user beats their own record.
CREATE TABLE IF NOT EXISTS draft_personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competition TEXT NOT NULL CHECK (competition IN ('pl', 'all')),
  record_type TEXT NOT NULL CHECK (record_type IN ('wins', 'goals', 'assists', 'clean_sheets', 'unbeaten')),
  value INTEGER NOT NULL,
  player_name TEXT,
  player_ovr INTEGER,
  season_number INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, competition, record_type)
);

ALTER TABLE draft_personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personal records"
  ON draft_personal_records FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personal records"
  ON draft_personal_records FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personal records"
  ON draft_personal_records FOR UPDATE USING (auth.uid() = user_id);
