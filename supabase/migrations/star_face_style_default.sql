-- Global default for the Face Editor's shared player-head style.
--
-- FaceStyle (lib/star/faceStyle.ts) has always been a per-device localStorage
-- preference — deliberately so, since it's a personal display choice with
-- nothing to sync. This table is the one deliberate exception: an ADMIN-set
-- style every device with no override of its own picks up automatically,
-- instead of the hardcoded DEFAULT_FACE_STYLE fallback baked into the code.
-- Requested directly: "an admin button to set the custom player face values
-- as official and global default values... so it naturally looks like that
-- unless the user changes it."
--
-- Reads are public (every device needs to check this before falling back to
-- the hardcoded default). Writes are NOT granted to anon/authenticated at
-- all — the only way to write this table is /api/star/face-style-default
-- (POST), which checks isAdmin() server-side and writes with the
-- service-role key. Same shape as star_lineups.sql.
--
-- Seeded with one row using the numbers reported as "the perfect values":
-- "3x size, 0.03 left/right, -2.04 left/right, like 10% circular crop" — read
-- as scale 3, offsetX 0.03, offsetY -2.04 (the repeated "left/right" is very
-- likely "up/down" — the editor's own two sliders are literally labelled
-- "Left / Right" and "Up / Down"), and "10% circular crop" as a modest
-- zoom (1.1) to trim the neck/shirt real photos include, since the crop's
-- own zoom range (CROP_ZOOM_RANGE, faceStyle.ts) is [1, 4] with 1 meaning
-- "no crop at all." This is a best-effort READING of a hand-typed
-- description, not a captured exact export — ON CONFLICT DO NOTHING, so it
-- only ever fills in an empty table. The real, exact numbers are whatever
-- the Face Editor's own "Set as Global Default" button last posted, which
-- always overwrites this seed the first time anyone with admin rights
-- opens the editor (with their own already-dialled-in local style showing,
-- if this device still has one) and presses it.
--
-- Run this in the Supabase SQL Editor. It is idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS star_face_style_default (
  id         TEXT PRIMARY KEY DEFAULT 'default',
  style      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE star_face_style_default ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'star_face_style_default' AND policyname = 'public read'
  ) THEN
    CREATE POLICY "public read" ON star_face_style_default FOR SELECT USING (true);
  END IF;
END $$;

INSERT INTO star_face_style_default (id, style)
VALUES ('default', '{
  "scale": 3,
  "offsetX": 0.03,
  "offsetY": -2.04,
  "showBacking": true,
  "backingColor": "#c68642",
  "outlineEnabled": true,
  "outlineColor": "rgba(0,0,0,0.35)",
  "outlineWidth": 1,
  "crop": { "zoom": 1.1, "x": 0, "y": 0 },
  "facesEnabled": true,
  "namesEnabled": false
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Verify ───────────────────────────────────────────────────────────────
-- select id, style, updated_at from star_face_style_default;
-- Expect exactly one row, id = 'default'.
-- select policyname, cmd, qual from pg_policies where tablename = 'star_face_style_default';
-- Expect exactly one row: public read | SELECT | true — no insert/update/
-- delete policy at all, which is deliberate (see the note above).
