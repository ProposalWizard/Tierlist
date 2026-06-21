-- Admin-controlled objectives system
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  card_image_url TEXT,
  card_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Objectives are publicly readable" ON objectives FOR SELECT USING (true);
CREATE POLICY "Service role manages objectives" ON objectives FOR ALL USING (true) WITH CHECK (true);

-- Track which users have completed which objectives (admin marks completion)
CREATE TABLE IF NOT EXISTS user_objectives (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, objective_id)
);

ALTER TABLE user_objectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own objective completions" ON user_objectives FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages user objectives" ON user_objectives FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_objectives_active ON objectives(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_user_objectives_user ON user_objectives(user_id);
