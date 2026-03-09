-- ============================================================
-- Fix INSERT policies on band_songs
-- Ensure both global (admin, band_id IS NULL) and band
-- (own-band or admin) insert policies exist.
-- ============================================================

-- Drop any old insert policies that may conflict
DROP POLICY IF EXISTS "songs_insert"        ON public.band_songs;
DROP POLICY IF EXISTS "songs_insert_global" ON public.band_songs;
DROP POLICY IF EXISTS "songs_insert_band"   ON public.band_songs;
DROP POLICY IF EXISTS "band_songs_insert"   ON public.band_songs;
DROP POLICY IF EXISTS "Allow insert band songs" ON public.band_songs;
-- Drop the legacy FOR ALL policy that blocks inserts with band_id IS NULL
DROP POLICY IF EXISTS "songs: แก้ไข/ลบเฉพาะวงตัวเอง" ON public.band_songs;
-- Drop existing update/delete policies if any
DROP POLICY IF EXISTS "songs_update" ON public.band_songs;
DROP POLICY IF EXISTS "songs_delete" ON public.band_songs;

-- Re-create UPDATE/DELETE from the old FOR ALL policy so they still work
CREATE POLICY "songs_update"
  ON public.band_songs FOR UPDATE
  USING (
    public.is_admin() OR band_id = public.get_my_band_id()
  )
  WITH CHECK (
    public.is_admin() OR band_id = public.get_my_band_id()
  );

CREATE POLICY "songs_delete"
  ON public.band_songs FOR DELETE
  USING (
    public.is_admin() OR band_id = public.get_my_band_id()
  );

-- INSERT global songs: admin only, band_id must be NULL
CREATE POLICY "songs_insert_global"
  ON public.band_songs FOR INSERT
  WITH CHECK (
    public.is_admin() AND band_id IS NULL
  );

-- INSERT band songs: members of that band, or admin
CREATE POLICY "songs_insert_band"
  ON public.band_songs FOR INSERT
  WITH CHECK (
    band_id IS NOT NULL AND (band_id = public.get_my_band_id() OR public.is_admin())
  );
