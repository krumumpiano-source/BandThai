-- ============================================================
-- Setlist v2: per-date storage (แยกตามวันที่)
-- ============================================================

-- Add date column (default empty for old rows)
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS date TEXT DEFAULT '';

-- Drop old band_id-only unique constraint
ALTER TABLE public.setlists DROP CONSTRAINT IF EXISTS setlists_band_id_key;

-- Add new unique constraint on (band_id, date)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'setlists_band_date_key'
  ) THEN
    ALTER TABLE public.setlists ADD CONSTRAINT setlists_band_date_key UNIQUE (band_id, date);
  END IF;
END $$;

-- Migrate existing rows: set date = '' (will be treated as "legacy")
-- No data loss — old rows keep sets_data intact
