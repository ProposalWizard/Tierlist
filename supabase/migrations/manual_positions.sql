-- Add manual_positions column to sofifa_players (same pattern as manual_overall)
-- When set, overrides the scraped `positions` value. Survives re-scrapes.
ALTER TABLE sofifa_players ADD COLUMN IF NOT EXISTS manual_positions text;
