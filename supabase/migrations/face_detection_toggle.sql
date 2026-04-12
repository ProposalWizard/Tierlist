-- Add face_detection_enabled toggle to both tierlist types, and
-- face_center JSONB to vote_tierlist_images.
--
-- Regular tierlists default ON (face detection is standard behaviour).
-- Vote tierlists default OFF (opt-in via admin toggle).

ALTER TABLE public.tierlists
  ADD COLUMN IF NOT EXISTS face_detection_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.vote_tierlists
  ADD COLUMN IF NOT EXISTS face_detection_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.vote_tierlist_images
  ADD COLUMN IF NOT EXISTS face_center JSONB;
