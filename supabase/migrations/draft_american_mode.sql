-- American draft mode, run inside an ordinary multiplayer room.
--
-- The earlier implementation lived in its own american_draft_rooms table and
-- tried to hand off to a second, linked draft_rooms row when the draft
-- finished. That handoff is what dumped players back on the draft home page.
-- Now the American draft is just an alternative squad-selection phase of the
-- room they are already in: its live state sits on the room, and when the last
-- pick lands each player's finished squad is written straight to their own
-- draft_room_players row with status 'ready', so the normal simulate flow takes
-- over with nothing to hand off.
--
-- Shape of american_state:
--   {
--     "position_sequence": ["GK","RB",...],   -- 14 slots
--     "current_round":     0,
--     "pick_order":        ["<user_id>", ...], -- reshuffled each round
--     "current_pick_idx":  0,
--     "round_players":     [ <AmPlayer>, ... ], -- the pool for this round
--     "picks":             { "<user_id>": [ {round, position, player}, ... ] },
--     "last_pick":         { "<user_id>": <AmPlayer> },
--     "complete":          false
--   }
-- NULL means this room is not running an American draft.

ALTER TABLE draft_rooms ADD COLUMN IF NOT EXISTS american_state JSONB;

-- draft_rooms is already in the supabase_realtime publication, so clients get
-- live american_state updates through the subscription they already hold.
