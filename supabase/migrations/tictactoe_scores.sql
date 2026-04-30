-- TicTacToe score tracking + puzzle enhancements
-- Run this in Supabase SQL Editor

-- Score tracking: one row per user per puzzle (first completion only)
CREATE TABLE IF NOT EXISTS tictactoe_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  puzzle_id UUID REFERENCES tictactoe_puzzles(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  hints_used INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, puzzle_id)
);

ALTER TABLE tictactoe_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own ttt scores"
  ON tictactoe_scores FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ttt scores"
  ON tictactoe_scores FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_tictactoe_scores_user ON tictactoe_scores (user_id);
CREATE INDEX IF NOT EXISTS idx_tictactoe_scores_puzzle ON tictactoe_scores (puzzle_id);

-- Puzzle-level extra information (text or image URL)
ALTER TABLE tictactoe_puzzles ADD COLUMN IF NOT EXISTS info TEXT DEFAULT NULL;

-- Display order for admin-controlled ordering on daily history page
ALTER TABLE tictactoe_puzzles ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
