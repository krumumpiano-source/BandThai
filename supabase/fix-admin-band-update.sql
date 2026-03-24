-- ============================================================
-- Fix: Admin ไม่สามารถเปลี่ยนแพ็กเกจวงได้ (setBandPlan)
-- ============================================================
-- สาเหตุ: RLS policy "bands: แก้ไขได้เฉพาะ manager" อนุญาตเฉพาะ
--         manager_id = auth.uid() ทำให้ admin ที่ไม่ใช่ manager ของวง
--         update ไม่ได้ (Supabase return 0 rows, ไม่ error)
--
-- วิธีแก้: เพิ่ม policy ให้ admin update bands ได้ทุกวง
-- ============================================================

-- 1. ตรวจว่า function is_admin() มีอยู่แล้ว (ถ้าไม่มีให้สร้าง)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. ลบ policy เก่า (ถ้ามี) แล้วสร้างใหม่
DROP POLICY IF EXISTS "bands: admin จัดการทั้งหมด" ON public.bands;

CREATE POLICY "bands: admin จัดการทั้งหมด"
  ON public.bands
  FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 3. Fix: NOT NULL constraints เพื่อป้องกันข้อมูลเสีย
-- ============================================================

-- band_songs.name — ต้องมีชื่อเพลง
-- อัปเดต NULL ก่อน แล้วเพิ่ม constraint
UPDATE public.band_songs SET name = '(ไม่ระบุชื่อ)' WHERE name IS NULL;
ALTER TABLE public.band_songs ALTER COLUMN name SET NOT NULL;

-- schedule.date — ต้องมีวันที่
DELETE FROM public.schedule WHERE date IS NULL;
ALTER TABLE public.schedule ALTER COLUMN date SET NOT NULL;

-- ============================================================
-- 4. Security Fix: ป้องกัน Manager เปลี่ยน band_plan เอง
-- ============================================================
-- ปัญหา: "bands: แก้ไขได้เฉพาะ manager" ไม่ lock column band_plan
--         manager อาจยิง .update({ band_plan: 'pro' }) แล้วอัปเกรดฟรีได้!
-- แก้: WITH CHECK ให้ band_plan ต้องเท่ากับค่าเดิม (admin ยังเปลี่ยนได้)

DROP POLICY IF EXISTS "bands: แก้ไขได้เฉพาะ manager" ON public.bands;
CREATE POLICY "bands: แก้ไขได้เฉพาะ manager"
  ON public.bands
  FOR UPDATE
  USING (manager_id = auth.uid())
  WITH CHECK (
    band_plan = (SELECT b.band_plan FROM public.bands b WHERE b.id = bands.id)
  );

-- ============================================================
-- 5. Security Fix: song_suggestions — Member ห้าม approve ของคนอื่น
-- ============================================================
DROP POLICY IF EXISTS "song_suggestions: authenticated update" ON public.song_suggestions;
CREATE POLICY "song_suggestions: manager+ can update"
  ON public.song_suggestions
  FOR UPDATE
  USING (
    public.is_admin()
    OR public.get_my_role() = 'manager'
    OR suggested_by = auth.uid()
  );

-- ============================================================
-- 6. Security Fix: band_songs — Member ทำได้แค่ SELECT + INSERT
-- ============================================================
-- ปัญหา: "songs: แก้ไข/ลบเฉพาะวงตัวเอง" ใช้ FOR ALL ไม่ check role
--         member ลบเพลงของวงผ่าน API ได้
DROP POLICY IF EXISTS "songs: แก้ไข/ลบเฉพาะวงตัวเอง" ON public.band_songs;
DROP POLICY IF EXISTS "songs: ดูได้ถ้า login" ON public.band_songs;

CREATE POLICY "songs: select วงตัวเอง"
  ON public.band_songs FOR SELECT
  USING (public.is_admin() OR band_id = public.get_my_band_id());

CREATE POLICY "songs: insert วงตัวเอง"
  ON public.band_songs FOR INSERT
  WITH CHECK (public.is_admin() OR band_id = public.get_my_band_id());

CREATE POLICY "songs: update manager+"
  ON public.band_songs FOR UPDATE
  USING (
    public.is_admin()
    OR (band_id = public.get_my_band_id() AND public.get_my_role() IN ('manager', 'admin'))
  );

CREATE POLICY "songs: delete manager+"
  ON public.band_songs FOR DELETE
  USING (
    public.is_admin()
    OR (band_id = public.get_my_band_id() AND public.get_my_role() IN ('manager', 'admin'))
  );

-- ============================================================
-- 7. Security Fix: equipment — Member ทำได้แค่ SELECT
-- ============================================================
DROP POLICY IF EXISTS "equipment: เห็นเฉพาะวงตัวเอง" ON public.equipment;

CREATE POLICY "equipment: select วงตัวเอง"
  ON public.equipment FOR SELECT
  USING (public.is_admin() OR band_id = public.get_my_band_id());

CREATE POLICY "equipment: insert manager+"
  ON public.equipment FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (band_id = public.get_my_band_id() AND public.get_my_role() IN ('manager', 'admin'))
  );

CREATE POLICY "equipment: update manager+"
  ON public.equipment FOR UPDATE
  USING (
    public.is_admin()
    OR (band_id = public.get_my_band_id() AND public.get_my_role() IN ('manager', 'admin'))
  );

CREATE POLICY "equipment: delete manager+"
  ON public.equipment FOR DELETE
  USING (
    public.is_admin()
    OR (band_id = public.get_my_band_id() AND public.get_my_role() IN ('manager', 'admin'))
  );
