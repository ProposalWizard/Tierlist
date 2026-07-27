-- American-style multiplayer draft

CREATE TABLE IF NOT EXISTS american_draft_rooms (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  code              text        UNIQUE NOT NULL,
  host_id           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status            text        NOT NULL DEFAULT 'lobby',
  position_sequence text[]      NOT NULL DEFAULT ARRAY['GK','RB','CB','CB','LB','CM','CM','CM','RW','ST','LW','ANY','ANY','ANY'],
  current_round     int         NOT NULL DEFAULT 0,
  pick_order        text[]      NOT NULL DEFAULT '{}',
  current_pick_idx  int         NOT NULL DEFAULT 0,
  round_players     jsonb       NOT NULL DEFAULT '[]',
  created_at        timestamptz DEFAULT now(),
  expires_at        timestamptz DEFAULT (now() + interval '24 hours')
);

CREATE TABLE IF NOT EXISTS american_draft_participants (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id      uuid        NOT NULL REFERENCES american_draft_rooms(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text        NOT NULL,
  squad        jsonb       NOT NULL DEFAULT '[]',
  last_pick    jsonb,
  joined_at    timestamptz DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- RLS: anyone authenticated can read; service role handles all writes
ALTER TABLE american_draft_rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE american_draft_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read rooms"        ON american_draft_rooms        FOR SELECT USING (true);
CREATE POLICY "public read participants" ON american_draft_participants  FOR SELECT USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE american_draft_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE american_draft_participants;
