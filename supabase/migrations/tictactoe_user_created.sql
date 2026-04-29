-- Add category column to tictactoe_puzzles for user-created puzzles
-- Run this in Supabase SQL Editor

ALTER TABLE tictactoe_puzzles ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;

-- Allow authenticated users to insert their own puzzles
CREATE POLICY "Users can create tictactoe_puzzles" ON tictactoe_puzzles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_tictactoe_puzzles_category ON tictactoe_puzzles (category);
