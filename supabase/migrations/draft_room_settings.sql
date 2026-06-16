-- Add settings JSONB column to draft_rooms (host's DraftSettings shared with all players)
ALTER TABLE draft_rooms ADD COLUMN IF NOT EXISTS settings JSONB;
