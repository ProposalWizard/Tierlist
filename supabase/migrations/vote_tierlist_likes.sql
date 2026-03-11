-- Vote tierlist likes table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.vote_tierlist_likes (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  vote_tierlist_id UUID        NOT NULL REFERENCES public.vote_tierlists(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vote_tierlist_id, user_id)
);

ALTER TABLE public.vote_tierlist_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can read like counts
CREATE POLICY "Anyone can view vote likes"
  ON public.vote_tierlist_likes FOR SELECT USING (true);

-- Users manage only their own likes
CREATE POLICY "Users manage own vote likes"
  ON public.vote_tierlist_likes
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
