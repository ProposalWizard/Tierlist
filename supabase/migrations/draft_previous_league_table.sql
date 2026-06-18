-- Store the previous season's league table on the room so the next season's
-- European competition qualification can reference last season's finish.
ALTER TABLE draft_rooms ADD COLUMN IF NOT EXISTS previous_league_table JSONB;
