-- ============================================================
--  แก้ RLS policies ของ live_guest_tokens
--  ปัญหา: migration เดิมอ้าง public.band_profiles (ไม่มีอยู่จริง)
--  แก้เป็น: ใช้ public.get_my_band_id() ซึ่งมีอยู่ใน schema
-- ============================================================

-- ลบ policies เดิมที่ผิด
DROP POLICY IF EXISTS "members can read own band tokens"    ON public.live_guest_tokens;
DROP POLICY IF EXISTS "members can create tokens for own band" ON public.live_guest_tokens;
DROP POLICY IF EXISTS "members can delete own band tokens" ON public.live_guest_tokens;

-- สร้าง policies ใหม่ที่ถูกต้อง (ใช้ get_my_band_id() แทน band_profiles)

-- สมาชิก (authenticated) อ่านได้เฉพาะ token ของวงตัวเอง
CREATE POLICY "members can read own band tokens"
  ON public.live_guest_tokens
  FOR SELECT
  TO authenticated
  USING (band_id = public.get_my_band_id());

-- Anonymous user (guest) อ่านได้ทุก token ที่ยังไม่หมดอายุ
-- (policy นี้น่าจะยังมีอยู่แล้ว แต่ drop/recreate เพื่อความชัวร์)
DROP POLICY IF EXISTS "anon can verify token" ON public.live_guest_tokens;
CREATE POLICY "anon can verify token"
  ON public.live_guest_tokens
  FOR SELECT
  TO anon
  USING (expires_at > now());

-- สมาชิก (authenticated) สร้าง token ได้เฉพาะวงตัวเอง
CREATE POLICY "members can create tokens for own band"
  ON public.live_guest_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (band_id = public.get_my_band_id());

-- สมาชิก (authenticated) ลบ token ของวงตัวเองได้
CREATE POLICY "members can delete own band tokens"
  ON public.live_guest_tokens
  FOR DELETE
  TO authenticated
  USING (band_id = public.get_my_band_id());
