-- Add manual_nationality column to sofifa_players
-- Run this in Supabase SQL Editor
ALTER TABLE sofifa_players ADD COLUMN IF NOT EXISTS manual_nationality TEXT;
