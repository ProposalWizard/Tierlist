-- Fix draft_records rows where username was saved as email prefix instead of profile username
-- Run this in Supabase SQL Editor once.
UPDATE draft_records dr
SET username = up.username
FROM user_profiles up
WHERE dr.user_id = up.user_id
  AND dr.user_id IS NOT NULL
  AND dr.username != up.username
  AND dr.username != 'Official';
