-- A per-edition admin flag: "this player has real potential to improve" —
-- a wonderkid tag, ticked by hand in /admin/football/players, one row
-- (sofifa_id, fifa_year) at a time. Read by the Star Career game to grant
-- high-potential squad players a real growth mechanic, a transfer-fee
-- premium, a bias toward big-club moves, and their own media hype — see
-- lib/star/leagueSquads.ts's growWonderkids and lib/star/leagueTransfers.ts.
-- Not scraped data, so — same as manual_overall/manual_positions — it is
-- never wiped by a re-import; it defaults to false rather than null since
-- there is no "unknown" state, only ticked or not.
ALTER TABLE sofifa_players ADD COLUMN IF NOT EXISTS high_potential boolean NOT NULL DEFAULT false;
