-- Add mode column to draft_records and draft_personal_records
-- to separate Normal vs Prime mode leaderboards.
-- Existing records are set to 'normal' by default.
-- Run this in Supabase SQL Editor.

ALTER TABLE draft_records ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE draft_personal_records ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'normal';

-- Add check constraints
ALTER TABLE draft_records DROP CONSTRAINT IF EXISTS draft_records_mode_check;
ALTER TABLE draft_records ADD CONSTRAINT draft_records_mode_check
  CHECK (mode IN ('normal', 'prime'));

ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_mode_check;
ALTER TABLE draft_personal_records ADD CONSTRAINT draft_personal_records_mode_check
  CHECK (mode IN ('normal', 'prime'));
