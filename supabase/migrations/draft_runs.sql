-- Draft run history table
-- Stores completed draft runs for signed-in users

CREATE TABLE IF NOT EXISTS draft_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  formation TEXT NOT NULL,
  season_number INT NOT NULL DEFAULT 1,
  finish INT NOT NULL,
  points INT NOT NULL,
  wins INT NOT NULL,
  draws INT NOT NULL,
  losses INT NOT NULL,
  goals_for INT NOT NULL,
  goals_against INT NOT NULL,
  avg_ovr INT NOT NULL,
  players JSONB NOT NULL
);

CREATE INDEX idx_draft_runs_user_id ON draft_runs(user_id);
CREATE INDEX idx_draft_runs_created_at ON draft_runs(created_at DESC);

ALTER TABLE draft_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own draft runs"
  ON draft_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own draft runs"
  ON draft_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
