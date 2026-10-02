-- THE STAR PASS LAYOUT (Mikey, 2 Oct 2026).
--
-- One row holding which reward sits at which Star Pass level, the idea cards
-- added on /admin/star-pass, and any status changes made there. Every career
-- reads it; only an admin can change it (app/api/star/star-pass/route.ts).
--
-- Until this runs, the Star Pass uses the layout built into the code
-- (lib/star/rewardCatalogue.ts DEFAULT_PASS_LEVELS) and the admin page saves
-- on that device only, saying so. Safe to re-run.

CREATE TABLE IF NOT EXISTS star_pass_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  layout JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE star_pass_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "star_pass_config public read" ON star_pass_config;
CREATE POLICY "star_pass_config public read" ON star_pass_config FOR SELECT USING (true);
-- No insert/update policy: writes go through the admin-only API route with
-- the service key.

-- Verify:
-- SELECT id, updated_at, jsonb_object_keys(layout) FROM star_pass_config;
