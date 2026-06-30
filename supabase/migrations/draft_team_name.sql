-- Allow players to set a custom team name in multiplayer draft rooms.
-- Falls back to "{display_name} FC" when not set (see lib/seasonSimulator.ts).
ALTER TABLE draft_room_players ADD COLUMN IF NOT EXISTS team_name TEXT;
