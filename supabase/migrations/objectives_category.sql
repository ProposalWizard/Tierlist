-- Add category to objectives for grouping into sections (daily, weekly, monthly, foundation, elite, goat)
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'foundation';
