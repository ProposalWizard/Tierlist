-- CHANGES THE DATABASE. What: lets the Publish tool hold several sets of accounts ("spaces"), one per page:
--   football  Mikey's football accounts (knowitballjr, Knowitballjr Page, KnowItBall YouTube) - every existing row
--   content   Mikey's other content accounts (cutcutthings and its Page and YouTube)
--   kib       the Knowitball team accounts (later)
-- Why: Mikey, 24 Nov 2026: separate pages for football content, other content and Knowitball, each posting to its
-- own accounts. Before this the tool held one login per app, so connecting a second Instagram replaced the first.
--
-- NOT RUN. Order matters: run it once in the Supabase SQL Editor, then merge the spaces code straight after
-- (the new site reads the new column; the old site's account save stops working once the key changes, so keep the
-- gap to a few minutes). Safe to re-run. Existing accounts and posts all become "football".

ALTER TABLE public.publish_accounts ADD COLUMN IF NOT EXISTS space text NOT NULL DEFAULT 'football';
ALTER TABLE public.publish_posts    ADD COLUMN IF NOT EXISTS space text NOT NULL DEFAULT 'football';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publish_accounts_space_check') THEN
    ALTER TABLE public.publish_accounts ADD CONSTRAINT publish_accounts_space_check CHECK (space IN ('football', 'content', 'kib'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publish_posts_space_check') THEN
    ALTER TABLE public.publish_posts ADD CONSTRAINT publish_posts_space_check CHECK (space IN ('football', 'content', 'kib'));
  END IF;
  -- One login per app PER SPACE (was: one per app).
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publish_accounts_pkey'
             AND pg_get_constraintdef(oid) NOT LIKE '%space%') THEN
    ALTER TABLE public.publish_accounts DROP CONSTRAINT publish_accounts_pkey;
    ALTER TABLE public.publish_accounts ADD CONSTRAINT publish_accounts_pkey PRIMARY KEY (space, platform);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS publish_posts_space ON public.publish_posts (space, scheduled_at DESC);
