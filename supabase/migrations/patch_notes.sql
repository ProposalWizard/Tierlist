-- The patch notes archive.
--
-- Every version of the Knowitball patch notes, readable inside the app at
-- /admin/patch-notes instead of through an artifact link. Artifact links
-- drift: they are private by default, they live in whoever's chat produced
-- them, and an old one gets lost the moment a newer page replaces it. The
-- notes themselves are the record of what shipped, so they belong in the
-- same database as everything else the site knows.
--
-- WHAT IS STORED, AND WHY IT IS NOT HTML
-- --------------------------------------
-- `stats` and `sections` are STRUCTURED JSON, not markup — the shape is
-- defined once in lib/patchNotes.ts and used on both sides. Three reasons,
-- all deliberate:
--   1. The page renders in the site's own style, so it matches the rest of
--      /admin instead of carrying a second stylesheet around with it.
--   2. Stored markup is stored injection. Nothing written here can put a
--      tag on the page; the renderer only ever reads known fields.
--   3. It stays queryable — "which versions still list this known issue"
--      is a SQL question against sections, not a text search.
-- `artifact_url` keeps the original artifact link when one exists, so the
-- page it came from is one tap away without being the only copy.
--
-- Reads are public (there is nothing private in a changelog, and the page
-- gates itself as admin-only anyway — see app/admin/patch-notes/page.tsx).
-- Writes are NOT granted to anon or authenticated at all: the only way to
-- write this table is /api/admin/patch-notes (POST), which checks isAdmin()
-- server-side and writes with the service-role key. Exactly the shape
-- star_lineups.sql already uses.
--
-- Run this in the Supabase SQL Editor. It is idempotent — safe to re-run.
-- Then run patch_notes_v0_1.sql to load the first version's real content.

CREATE TABLE IF NOT EXISTS patch_notes (
  version      TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary      TEXT,
  stats        JSONB NOT NULL DEFAULT '[]'::jsonb,
  sections     JSONB NOT NULL DEFAULT '[]'::jsonb,
  artifact_url TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Newest first is the only order this table is ever read in.
CREATE INDEX IF NOT EXISTS patch_notes_published_at_idx
  ON patch_notes (published_at DESC);

ALTER TABLE patch_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'patch_notes' AND policyname = 'public read'
  ) THEN
    CREATE POLICY "public read" ON patch_notes FOR SELECT USING (true);
  END IF;
END $$;

-- ── Verify ───────────────────────────────────────────────────────────────
-- select policyname, cmd, qual from pg_policies where tablename = 'patch_notes';
-- Expect exactly one row: public read | SELECT | true — no insert/update/
-- delete policy at all, which is deliberate (see the note above).
