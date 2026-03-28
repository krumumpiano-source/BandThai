-- Migration: Add UNIQUE constraint on playlist_history to prevent duplicate rows
-- from multiple devices pressing "จบเบรค" simultaneously in live mode.

-- Step 1: Normalize NULLs to empty string (JS code always sends '' not null)
UPDATE public.playlist_history SET date = '' WHERE date IS NULL;
UPDATE public.playlist_history SET venue = '' WHERE venue IS NULL;
UPDATE public.playlist_history SET time_slot = '' WHERE time_slot IS NULL;

-- Step 2: Remove existing duplicates (keep the latest row per group)
DELETE FROM public.playlist_history
WHERE id NOT IN (
  SELECT DISTINCT ON (band_id, date, venue, time_slot) id
  FROM public.playlist_history
  ORDER BY band_id, date, venue, time_slot, created_at DESC NULLS LAST
);

-- Step 3: Add NOT NULL defaults to prevent future NULLs
ALTER TABLE public.playlist_history ALTER COLUMN date SET DEFAULT '';
ALTER TABLE public.playlist_history ALTER COLUMN venue SET DEFAULT '';
ALTER TABLE public.playlist_history ALTER COLUMN time_slot SET DEFAULT '';

-- Step 4: Create UNIQUE constraint for upsert onConflict support
ALTER TABLE public.playlist_history
  ADD CONSTRAINT uq_playlist_history_band_date_venue_slot
  UNIQUE (band_id, date, venue, time_slot);
