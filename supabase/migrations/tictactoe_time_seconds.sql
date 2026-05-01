-- Add time_seconds column to tictactoe_scores
-- Stores the total time in seconds the player took to complete the puzzle
ALTER TABLE tictactoe_scores ADD COLUMN IF NOT EXISTS time_seconds INTEGER DEFAULT NULL;
