-- Add category to objectives for grouping into sections
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'standard';
