-- ============================================================
--  Allow anonymous (guest QR scan) to read playlist_history
--
--  ปัญหา: RLS policy เดิมใช้ get_my_band_id() ซึ่ง return NULL
--  สำหรับ anon user → guest ไม่สามารถอ่าน playlist ได้
--
--  แก้: เพิ่ม policy สำหรับ anon ให้อ่าน SELECT ได้
--  (playlist คือข้อมูลสาธารณะสำหรับผู้ชม live performance)
-- ============================================================

CREATE POLICY "anon can read playlist_history"
  ON public.playlist_history
  FOR SELECT
  TO anon
  USING (band_id IS NOT NULL);
