-- Tuning notes: "Say what feels off" from the Tuning panel (14 Oct 2026).
--
-- The team tunes by playing. On the Scenario Gallery, Infinite Highlights and
-- Infinite Match, the Tuning panel lets anyone tap a chip ("too many
-- cutbacks", "never on my wing") or write a line. Each note keeps what was on
-- screen: page, chance kind, league, position, seed, minute, time.
-- (lib/star/tuningNotes.ts, components/star/TuningSessionPanel.tsx,
-- /api/star/tuning-notes.)
--
-- Until this runs, notes stay in the browser that wrote them and the panel
-- says "Saved on this device only". The next save after it runs sends them.
--
-- RLS: anyone may INSERT (testers are not all admins, and a note is harmless
-- words); only admins may READ. The terminal reads it with the service key
-- (scripts/tuning-notes.mts). No UPDATE or DELETE policy: notes are kept.
--
-- Run in the Supabase SQL Editor. Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS star_tuning_notes (
  id         TEXT PRIMARY KEY,
  page       TEXT NOT NULL,
  chips      TEXT[] NOT NULL DEFAULT '{}',
  text       TEXT NOT NULL DEFAULT '',
  kind       TEXT,
  league     TEXT,
  position   TEXT,
  seed       BIGINT,
  minute     INTEGER,
  seen       INTEGER,
  note_at    TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT star_tuning_notes_text_len CHECK (char_length(text) <= 500),
  CONSTRAINT star_tuning_notes_page_len CHECK (char_length(page) <= 60),
  CONSTRAINT star_tuning_notes_chips_len CHECK (coalesce(array_length(chips, 1), 0) <= 12),
  CONSTRAINT star_tuning_notes_not_empty CHECK (coalesce(array_length(chips, 1), 0) > 0 OR char_length(text) > 0)
);

CREATE INDEX IF NOT EXISTS star_tuning_notes_note_at_idx ON star_tuning_notes (note_at DESC);

ALTER TABLE star_tuning_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'star_tuning_notes' AND policyname = 'anyone inserts'
  ) THEN
    CREATE POLICY "anyone inserts" ON star_tuning_notes FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'star_tuning_notes' AND policyname = 'admins read'
  ) THEN
    CREATE POLICY "admins read" ON star_tuning_notes FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.is_admin = true)
    );
  END IF;
END $$;

-- ── Verify ───────────────────────────────────────────────────────────────
-- select policyname, cmd, roles from pg_policies where tablename = 'star_tuning_notes';
-- Expect two rows: "anyone inserts" | INSERT, "admins read" | SELECT.
--
-- select page, chips, text, kind, league, note_at from star_tuning_notes order by note_at desc limit 20;
