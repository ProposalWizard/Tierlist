-- Add user_id to feedback so admin can see who submitted each entry.
-- Nullable so anonymous (logged-out) submissions still work.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
