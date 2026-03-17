-- ============================================================
-- fix_song_manager_update_policy.sql
-- แก้ปัญหา: ผู้ดูแลเพลง (songManagers) ไม่สามารถแก้ไข/ลบเพลง global ได้
-- 
-- ปัญหา: UPDATE/DELETE RLS policy อนุญาตเฉพาะ admin หรือเพลงวงตัวเอง
--         แต่เพลง global มี band_id = NULL → songManager แก้ไขไม่ได้
--
-- แก้ไข: สร้าง function is_song_manager() ตรวจจาก band_settings.songManagers
--         แล้วเพิ่มเงื่อนไขใน UPDATE/DELETE policy
--
-- วิธีใช้: วาง SQL นี้ใน Supabase → SQL Editor → Run
-- ============================================================

-- ─── Helper: ตรวจว่า user ปัจจุบันเป็นผู้ดูแลเพลงหรือไม่ ────────
CREATE OR REPLACE FUNCTION public.is_song_manager()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_band_id text;
  v_managers jsonb;
BEGIN
  v_band_id := public.get_my_band_id();
  IF v_band_id IS NULL THEN RETURN false; END IF;

  SELECT settings->'songManagers' INTO v_managers
  FROM band_settings WHERE band_id = v_band_id;

  IF v_managers IS NULL OR jsonb_typeof(v_managers) != 'array' THEN RETURN false; END IF;

  RETURN v_managers @> to_jsonb(auth.uid()::text);
END;
$$;

-- ─── UPDATE policy: เพิ่ม songManagers ให้แก้เพลง global ได้ ─────
DROP POLICY IF EXISTS "songs_update" ON public.band_songs;
CREATE POLICY "songs_update"
  ON public.band_songs FOR UPDATE
  USING (
    public.is_admin()
    OR band_id = public.get_my_band_id()
    OR (band_id IS NULL AND public.is_song_manager())
  )
  WITH CHECK (
    public.is_admin()
    OR band_id = public.get_my_band_id()
    OR (band_id IS NULL AND public.is_song_manager())
  );

-- ─── DELETE policy: เพิ่ม songManagers ให้ลบเพลง global ได้ ─────
DROP POLICY IF EXISTS "songs_delete" ON public.band_songs;
CREATE POLICY "songs_delete"
  ON public.band_songs FOR DELETE
  USING (
    public.is_admin()
    OR band_id = public.get_my_band_id()
    OR (band_id IS NULL AND public.is_song_manager())
  );

-- ─── INSERT policy (global): เพิ่ม songManagers ให้เพิ่มเพลง global ได้ ───
DROP POLICY IF EXISTS "songs_insert_global" ON public.band_songs;
CREATE POLICY "songs_insert_global"
  ON public.band_songs FOR INSERT
  WITH CHECK (
    (band_id IS NULL) AND (public.is_admin() OR public.is_song_manager())
  );
