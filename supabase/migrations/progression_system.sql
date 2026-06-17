-- Progression System: XP, levels, rewards, user stats
-- Run this in Supabase SQL Editor

-- 1. User XP tracking
CREATE TABLE IF NOT EXISTS user_xp (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own xp" ON user_xp FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages xp" ON user_xp FOR ALL USING (true) WITH CHECK (true);

-- 2. XP event log (prevents double-counting)
CREATE TABLE IF NOT EXISTS xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_ref TEXT,
  xp_awarded INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, event_type, event_ref)
);
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own xp events" ON xp_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages xp events" ON xp_events FOR ALL USING (true) WITH CHECK (true);

-- 3. Master rewards list
CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'bronze',
  icon_name TEXT,
  unlock_type TEXT NOT NULL,
  unlock_stat TEXT,
  unlock_value INTEGER,
  sort_order INTEGER DEFAULT 0
);
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rewards are publicly readable" ON rewards FOR SELECT USING (true);

-- 4. User unlocked rewards
CREATE TABLE IF NOT EXISTS user_rewards (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, reward_id)
);
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own rewards" ON user_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages user rewards" ON user_rewards FOR ALL USING (true) WITH CHECK (true);

-- 5. Aggregated user stats
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  drafts_played INTEGER DEFAULT 0,
  draft_wins INTEGER DEFAULT 0,
  draft_invincibles INTEGER DEFAULT 0,
  total_goals_scored INTEGER DEFAULT 0,
  tierlists_created INTEGER DEFAULT 0,
  tierlists_likes_received INTEGER DEFAULT 0,
  votes_cast INTEGER DEFAULT 0,
  seasons_played INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own stats" ON user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages stats" ON user_stats FOR ALL USING (true) WITH CHECK (true);

-- 6. Add equipped frame and title to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS equipped_frame TEXT DEFAULT 'frame_default',
  ADD COLUMN IF NOT EXISTS equipped_title TEXT DEFAULT 'title_rookie';

-- 7. Seed rewards data

-- Manager Titles (level-gated)
INSERT INTO rewards (id, name, description, category, rarity, icon_name, unlock_type, unlock_stat, unlock_value, sort_order) VALUES
  ('title_rookie', 'Rookie Manager', 'Every legend starts somewhere', 'title', 'bronze', 'user', 'level', 'level', 1, 1),
  ('title_rising', 'Rising Talent', 'Showing real promise', 'title', 'bronze', 'trending-up', 'level', 'level', 5, 2),
  ('title_promising', 'Promising Coach', 'The board is impressed', 'title', 'silver', 'award', 'level', 'level', 10, 3),
  ('title_established', 'Established Pro', 'A proven track record', 'title', 'silver', 'shield', 'level', 'level', 15, 4),
  ('title_tactical', 'Tactical Genius', 'Your tactics are revolutionary', 'title', 'gold', 'brain', 'level', 'level', 20, 5),
  ('title_elite', 'Elite Manager', 'Among the very best', 'title', 'gold', 'crown', 'level', 'level', 25, 6),
  ('title_mastermind', 'Mastermind', 'They write books about you', 'title', 'gold', 'sparkles', 'level', 'level', 30, 7),
  ('title_world_class', 'World Class', 'A generational talent', 'title', 'diamond', 'globe', 'level', 'level', 40, 8),
  ('title_legend', 'Legend', 'Immortalised in football history', 'title', 'diamond', 'trophy', 'level', 'level', 50, 9)
ON CONFLICT (id) DO NOTHING;

-- Trophies (stat-gated)
INSERT INTO rewards (id, name, description, category, rarity, icon_name, unlock_type, unlock_stat, unlock_value, sort_order) VALUES
  ('trophy_first_draft', 'First Draft', 'Complete your first draft', 'trophy', 'bronze', 'clipboard', 'stat', 'drafts_played', 1, 10),
  ('trophy_10_drafts', 'Draft Regular', 'Complete 10 drafts', 'trophy', 'silver', 'clipboard-list', 'stat', 'drafts_played', 10, 11),
  ('trophy_50_drafts', 'Draft Veteran', 'Complete 50 drafts', 'trophy', 'gold', 'medal', 'stat', 'drafts_played', 50, 12),
  ('trophy_first_win', 'First Trophy', 'Win your first league title', 'trophy', 'bronze', 'trophy', 'stat', 'draft_wins', 1, 13),
  ('trophy_10_wins', 'Serial Winner', 'Win 10 league titles', 'trophy', 'silver', 'trophy', 'stat', 'draft_wins', 10, 14),
  ('trophy_50_wins', 'Dynasty Builder', 'Win 50 league titles', 'trophy', 'gold', 'crown', 'stat', 'draft_wins', 50, 15),
  ('trophy_invincible', 'Invincibles', 'Complete an unbeaten season', 'trophy', 'gold', 'shield-check', 'stat', 'draft_invincibles', 1, 16),
  ('trophy_100_goals', 'Century of Goals', 'Score 100 total goals', 'trophy', 'bronze', 'target', 'stat', 'total_goals_scored', 100, 17),
  ('trophy_500_goals', 'Goal Machine', 'Score 500 total goals', 'trophy', 'silver', 'zap', 'stat', 'total_goals_scored', 500, 18),
  ('trophy_1000_goals', 'Legendary Striker', 'Score 1000 total goals', 'trophy', 'gold', 'flame', 'stat', 'total_goals_scored', 1000, 19),
  ('trophy_tierlist_maker', 'Tierlist Creator', 'Create 5 tierlists', 'trophy', 'bronze', 'layout-grid', 'stat', 'tierlists_created', 5, 20),
  ('trophy_popular', 'Fan Favourite', 'Receive 50 likes on your tierlists', 'trophy', 'silver', 'heart', 'stat', 'tierlists_likes_received', 50, 21),
  ('trophy_voter', 'Democracy', 'Cast 50 votes on vote tierlists', 'trophy', 'bronze', 'vote', 'stat', 'votes_cast', 50, 22),
  ('trophy_streak_7', 'Dedicated Fan', 'Achieve a 7-day login streak', 'trophy', 'bronze', 'flame', 'stat', 'longest_streak', 7, 23),
  ('trophy_streak_30', 'Die Hard', 'Achieve a 30-day login streak', 'trophy', 'gold', 'flame', 'stat', 'longest_streak', 30, 24)
ON CONFLICT (id) DO NOTHING;

-- Card Frames (level + stat gated)
INSERT INTO rewards (id, name, description, category, rarity, icon_name, unlock_type, unlock_stat, unlock_value, sort_order) VALUES
  ('frame_default', 'Standard', 'The default card frame', 'frame', 'bronze', 'square', 'level', 'level', 1, 30),
  ('frame_silver', 'Silver', 'A sleek silver frame', 'frame', 'silver', 'square', 'level', 'level', 5, 31),
  ('frame_gold', 'Gold', 'A prestigious gold frame', 'frame', 'gold', 'square', 'level', 'level', 15, 32),
  ('frame_champions', 'Champions League', 'The iconic starball design', 'frame', 'gold', 'star', 'level', 'level', 20, 33),
  ('frame_diamond', 'Diamond', 'For the elite few', 'frame', 'diamond', 'diamond', 'level', 'level', 30, 34),
  ('frame_invincibles', 'Invincibles', 'Earned through an unbeaten season', 'frame', 'gold', 'shield', 'stat', 'draft_invincibles', 1, 35),
  ('frame_future_stars', 'Future Stars', 'A rising star design', 'frame', 'diamond', 'sparkles', 'stat', 'draft_wins', 50, 36),
  ('frame_ballon_dor', 'Ballon d''Or', 'The ultimate achievement', 'frame', 'diamond', 'award', 'level', 'level', 50, 37)
ON CONFLICT (id) DO NOTHING;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_xp_events_user ON xp_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_rewards_user ON user_rewards(user_id);
