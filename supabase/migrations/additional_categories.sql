-- Add additional_categories column to tierlists table
-- This allows a tierlist to appear in multiple categories on the homepage
ALTER TABLE tierlists ADD COLUMN IF NOT EXISTS additional_categories TEXT[] DEFAULT '{}';
