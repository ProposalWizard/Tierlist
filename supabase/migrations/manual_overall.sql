-- Add manual_overall column for admin OVR overrides that survive re-scrapes
ALTER TABLE sofifa_players ADD COLUMN IF NOT EXISTS manual_overall integer;
