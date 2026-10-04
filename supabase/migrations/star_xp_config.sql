-- THE XP BOOK (Mikey, 3 Oct 2026).
--
-- One row holding every XP amount Mikey has changed on /admin/star-xp, plus
-- his checks, notes and new ideas (achievements, records, awards,
-- milestones not built yet). Every career reads it; only an admin can change
-- it (app/api/star/xp-config/route.ts).
--
-- Until this runs, the game uses the amounts built into the code
-- (lib/star/xpConfig.ts DEFAULT_XP) and the admin page saves on that device
-- only, saying so. Safe to re-run.

CREATE TABLE IF NOT EXISTS star_xp_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE star_xp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "star_xp_config public read" ON star_xp_config;
CREATE POLICY "star_xp_config public read" ON star_xp_config FOR SELECT USING (true);
-- No insert/update policy: writes go through the admin-only API route with
-- the service key.

-- Verify:
-- SELECT id, updated_at, jsonb_object_keys(config) FROM star_xp_config;
