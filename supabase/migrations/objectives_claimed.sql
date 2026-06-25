-- Add claimed_at to user_objectives so completed objectives require a
-- separate "claim" action before the notification dot clears.
-- Existing completions are auto-claimed so old users don't get a flood of dots.

ALTER TABLE user_objectives ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Auto-claim everything already completed before this migration
UPDATE user_objectives SET claimed_at = completed_at WHERE claimed_at IS NULL AND completed_at IS NOT NULL;
