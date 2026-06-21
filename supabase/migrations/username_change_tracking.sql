-- Track when a user last changed their username (for 30-day rate limiting)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ DEFAULT NULL;
