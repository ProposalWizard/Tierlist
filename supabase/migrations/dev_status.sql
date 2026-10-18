-- dev_status.sql — live progress bars on the team board (/admin/team).
-- Harry, 18 Oct 2026. Each chat's progress update is sent (by a hook) to
-- /api/dev-status, which writes here with the service key.
-- Admins read; nobody writes from a browser (no insert/update/delete policy).
-- Keeps the last 50 rows per person. Safe to run twice.

CREATE TABLE IF NOT EXISTS public.dev_status (
  id bigserial PRIMARY KEY,
  person text NOT NULL CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  body text NOT NULL CHECK (char_length(body) <= 6000),
  session text,
  branch text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dev_status_person_time ON public.dev_status (person, created_at DESC);

ALTER TABLE public.dev_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read dev_status" ON public.dev_status;
CREATE POLICY "admins read dev_status" ON public.dev_status FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.is_admin = true));

CREATE OR REPLACE FUNCTION public.dev_status_prune() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.dev_status d
  WHERE d.person = NEW.person
    AND d.id NOT IN (SELECT id FROM public.dev_status WHERE person = NEW.person ORDER BY created_at DESC LIMIT 50);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS dev_status_prune ON public.dev_status;
CREATE TRIGGER dev_status_prune AFTER INSERT ON public.dev_status FOR EACH ROW EXECUTE FUNCTION public.dev_status_prune();

-- Check: should list one policy, "admins read dev_status".
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'dev_status';
