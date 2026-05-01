-- Add label_extras column for info/hints on row and column labels
-- Run this in Supabase SQL Editor

ALTER TABLE tictactoe_puzzles ADD COLUMN IF NOT EXISTS label_extras JSONB DEFAULT NULL;
