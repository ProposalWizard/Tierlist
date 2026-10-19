-- dev_recordings.sql — recordings waiting to be read by Claude (Harry, 19 Oct 2026:
-- "shouldn't recordings put by the name of the person be automatically read").
-- Admin → Videos adds a row after each Drive upload (/api/dev-recordings).
-- Each chat's UserPromptSubmit hook (scripts/hooks/recordings-hook.mjs) claims
-- that person's unread rows and tells Claude to break the video down first.
-- Admins read; nobody writes from a browser (the route uses the service key).
-- Keeps the last 100 rows per person. Safe to run twice.

CREATE TABLE IF NOT EXISTS public.dev_recordings (
  id bigserial PRIMARY KEY,
  person text NOT NULL CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  title text NOT NULL CHECK (char_length(title) <= 200),
  link text NOT NULL CHECK (link LIKE 'https://drive.google.com/%' AND char_length(link) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS dev_recordings_unread ON public.dev_recordings (person, created_at DESC) WHERE read_at IS NULL;

ALTER TABLE public.dev_recordings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read dev_recordings" ON public.dev_recordings;
CREATE POLICY "admins read dev_recordings" ON public.dev_recordings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.is_admin = true));

CREATE OR REPLACE FUNCTION public.dev_recordings_prune() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.dev_recordings d
  WHERE d.person = NEW.person
    AND d.id NOT IN (SELECT id FROM public.dev_recordings WHERE person = NEW.person ORDER BY created_at DESC LIMIT 100);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS dev_recordings_prune ON public.dev_recordings;
CREATE TRIGGER dev_recordings_prune AFTER INSERT ON public.dev_recordings FOR EACH ROW EXECUTE FUNCTION public.dev_recordings_prune();

-- Check: should list one policy, "admins read dev_recordings".
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'dev_recordings';
