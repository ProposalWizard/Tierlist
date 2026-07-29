-- American Draft: multiplayer squad-selection mode where all players see
-- the same pool of Premier League players and take turns picking.
-- After all picks are complete, a linked regular draft_rooms record is
-- created automatically so the season simulation can proceed normally.

CREATE TABLE IF NOT EXISTS american_draft_rooms (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,
  host_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'lobby'
                     CHECK (status IN ('lobby', 'drafting', 'complete')),
  position_sequence TEXT[] NOT NULL DEFAULT
    ARRAY['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW','ANY','ANY','ANY'],
  current_round    INT NOT NULL DEFAULT 0,
  pick_order       TEXT[] NOT NULL DEFAULT '{}',
  current_pick_idx INT NOT NULL DEFAULT 0,
  round_players    JSONB NOT NULL DEFAULT '[]',
  linked_room_code TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '4 hours'
);

CREATE TABLE IF NOT EXISTS american_draft_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES american_draft_rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Player',
  squad        JSONB NOT NULL DEFAULT '[]',
  last_pick    JSONB,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

-- Allow all authenticated and anonymous users to read rooms and participants
-- (the room code already acts as an access gate).
ALTER TABLE american_draft_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE american_draft_participants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'american_draft_rooms' AND policyname = 'public read'
  ) THEN
    CREATE POLICY "public read" ON american_draft_rooms FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'american_draft_participants' AND policyname = 'public read'
  ) THEN
    CREATE POLICY "public read" ON american_draft_participants FOR SELECT USING (true);
  END IF;
END $$;

-- Enable Realtime so clients receive live updates
ALTER PUBLICATION supabase_realtime ADD TABLE american_draft_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE american_draft_participants;
