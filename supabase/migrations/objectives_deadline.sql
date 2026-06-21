-- Add expires_at column to objectives table for time-limited objectives
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;
