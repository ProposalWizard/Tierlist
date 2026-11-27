-- rate_limits.sql — counts requests per person per minute for the site's write
-- routes (lib/rateLimit/index.ts), and caps the feedback form, which writes
-- from the browser straight into public.feedback (Mikey, 26 Nov 2026: stop one
-- person or a bot from using up the free plan, without ever blocking real play).
--
-- CHANGES THE DATABASE: one small table, one function, one trigger. Rows older
-- than a day are deleted as new ones come in, so the table stays tiny.
-- Safe to run again.

CREATE TABLE IF NOT EXISTS public.rate_hits (
  key          text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE public.rate_hits ENABLE ROW LEVEL SECURITY; -- no policies: only the site's server key reads or writes it

-- One more hit for p_key in the current window. Returns true while still under p_max.
CREATE OR REPLACE FUNCTION public.rate_hit(p_key text, p_window_seconds integer, p_max integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w timestamptz := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  n integer;
BEGIN
  INSERT INTO public.rate_hits (key, window_start, hits) VALUES (p_key, w, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = public.rate_hits.hits + 1
  RETURNING hits INTO n;
  IF random() < 0.01 THEN
    DELETE FROM public.rate_hits WHERE window_start < now() - interval '1 day';
  END IF;
  RETURN n <= p_max;
END $$;
REVOKE ALL ON FUNCTION public.rate_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;

-- The feedback form: at most 20 messages a minute in total, from everyone.
-- Real feedback arrives a few a day; a flood is refused instead of filling the table.
CREATE OR REPLACE FUNCTION public.feedback_flood_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.rate_hit('feedback:all', 60, 20) THEN
    RAISE EXCEPTION 'Too much feedback at once. Please try again in a minute.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS feedback_flood_guard ON public.feedback;
CREATE TRIGGER feedback_flood_guard BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.feedback_flood_guard();
