-- Add is_published column so admins can create objectives in draft and release them later
-- Run this in Supabase SQL Editor
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;
