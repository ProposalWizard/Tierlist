-- Difficulty ratings for Tic Tac Toe puzzles
-- Players rate difficulty (0.5–5.0 in 0.5 steps) after finishing a puzzle.
-- The archive shows the average rating rounded to the nearest 0.5 star.

CREATE TABLE IF NOT EXISTS tictactoe_difficulty_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id UUID REFERENCES tictactoe_puzzles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  rating NUMERIC(2,1) NOT NULL CHECK (rating >= 0.5 AND rating <= 5.0),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(puzzle_id, user_id)
);

ALTER TABLE tictactoe_difficulty_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read difficulty ratings"
  ON tictactoe_difficulty_ratings FOR SELECT USING (true);

CREATE POLICY "Users can insert own ratings"
  ON tictactoe_difficulty_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings"
  ON tictactoe_difficulty_ratings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ttt_diff_ratings_puzzle
  ON tictactoe_difficulty_ratings (puzzle_id);
