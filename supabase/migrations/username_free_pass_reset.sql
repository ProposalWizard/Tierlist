-- Give all existing users their one free username change back.
-- Going forward, first-time setup (/setup-username) no longer stamps
-- username_changed_at, so only voluntary changes in settings count.
-- Resetting here means everyone gets their free pass regardless of
-- when they originally signed up.

UPDATE user_profiles SET username_changed_at = NULL;
