-- star_cutscene_edits — the 3D Scene Editor's shared saves (/star-scene-editor-dev).
-- One row per cut-scene script id:
--   { shots: { "<shot index>": ShotEdit }, scene: { mood, exposure, keyLight, keyAngle, keyColor, spot } }
-- Public read, admin-only write (through /api/star/cutscene-edits with the service key; no browser writes).
-- The game's own cut scenes do NOT read these yet. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS star_cutscene_edits (
  script_id  TEXT PRIMARY KEY,
  edits      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE star_cutscene_edits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'star_cutscene_edits' AND policyname = 'public read'
  ) THEN
    CREATE POLICY "public read" ON star_cutscene_edits FOR SELECT USING (true);
  END IF;
END $$;

-- No INSERT/UPDATE/DELETE policy: with RLS on, the browser cannot write.
-- The route checks isAdmin() and writes with the service role.

-- Verify:
-- SELECT script_id, updated_at FROM star_cutscene_edits ORDER BY updated_at DESC;
