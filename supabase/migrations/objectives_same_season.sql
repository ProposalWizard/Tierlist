-- Add same_season flag to objectives.
-- When true, ALL conditions must be met in a single season
-- (e.g. Treble = win PL + UCL + FA Cup in one season).
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS same_season BOOLEAN NOT NULL DEFAULT false;
