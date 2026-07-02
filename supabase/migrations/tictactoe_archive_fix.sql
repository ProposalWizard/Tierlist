-- Safe to run even if tictactoe_scores table and policies already exist.
-- Run this in Supabase SQL Editor to ensure the archive works correctly.

-- Ensure time_seconds column exists (safe to re-run)
ALTER TABLE tictactoe_scores ADD COLUMN IF NOT EXISTS time_seconds INTEGER DEFAULT NULL;

-- Idempotent policy creation — wraps each CREATE POLICY in a guard so
-- it's safe to run even when the policy already exists.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tictactoe_scores'
      AND policyname = 'Users can read own ttt scores'
  ) THEN
    CREATE POLICY "Users can read own ttt scores"
      ON tictactoe_scores FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tictactoe_scores'
      AND policyname = 'Users can insert own ttt scores'
  ) THEN
    CREATE POLICY "Users can insert own ttt scores"
      ON tictactoe_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
