-- Add progress JSONB column to user_objectives so the check route can
-- track incremental progress between seasons without failing silently.
ALTER TABLE user_objectives ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{}';

-- Remove the automatic DEFAULT on completed_at so that in-progress rows
-- inserted without an explicit completed_at don't get auto-marked as done.
-- (Previously DEFAULT now() caused every INSERT to set completed_at immediately.)
ALTER TABLE user_objectives ALTER COLUMN completed_at DROP DEFAULT;
