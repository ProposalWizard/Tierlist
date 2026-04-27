-- Football Tic Tac Toe schema
-- Run this in Supabase SQL Editor to create the tictactoe tables.

CREATE TABLE IF NOT EXISTS tictactoe_puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'extreme')),
  row_labels JSONB NOT NULL DEFAULT '["","",""]',
  col_labels JSONB NOT NULL DEFAULT '["","",""]',
  grid JSONB NOT NULL DEFAULT '[[],[],[]]',
  three_in_a_row_bonus INTEGER NOT NULL DEFAULT 10,
  is_daily BOOLEAN DEFAULT false,
  daily_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE tictactoe_puzzles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tictactoe_puzzles" ON tictactoe_puzzles FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tictactoe_puzzles_active ON tictactoe_puzzles (is_active);
CREATE INDEX IF NOT EXISTS idx_tictactoe_puzzles_daily ON tictactoe_puzzles (is_daily, daily_date);
