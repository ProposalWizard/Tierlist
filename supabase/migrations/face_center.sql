-- Add face_center JSONB column to tierlist_images
-- Stores the detected face position as { x, y } percentages (0–100) so the
-- play page can apply background-position server-side without client-side
-- face detection on every visit. NULL = not yet detected (will be filled
-- lazily or at upload time).

ALTER TABLE public.tierlist_images
  ADD COLUMN IF NOT EXISTS face_center JSONB;
