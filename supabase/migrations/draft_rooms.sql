-- Draft multiplayer rooms
CREATE TABLE IF NOT EXISTS draft_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'lobby', -- 'lobby' | 'simulating' | 'complete'
  season_number INTEGER NOT NULL DEFAULT 1,
  settings JSONB, -- host's DraftSettings (formation, eraStart, eraEnd, mode, draftOrder, respins)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE TABLE IF NOT EXISTS draft_room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES draft_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drafting', -- 'drafting' | 'ready' | 'simulated'
  squad JSONB,
  avg_ovr INTEGER,
  team_strength NUMERIC(5,1),
  season_result JSONB,
  actual_finish INTEGER,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE draft_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_room_players ENABLE ROW LEVEL SECURITY;

-- Room policies
CREATE POLICY "Anyone can read rooms" ON draft_rooms FOR SELECT USING (true);
CREATE POLICY "Auth users can create rooms" ON draft_rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Host can update room" ON draft_rooms FOR UPDATE USING (auth.uid() = host_id);

-- Room player policies
CREATE POLICY "Anyone can read room players" ON draft_room_players FOR SELECT USING (true);
CREATE POLICY "Auth users can join rooms" ON draft_room_players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Players can update own row" ON draft_room_players FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE draft_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE draft_room_players;
