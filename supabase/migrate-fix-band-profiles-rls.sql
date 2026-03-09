-- ============================================================
-- migrate-fix-band-profiles-rls.sql
-- แก้ไขปัญหา: สมาชิกวงไม่แสดงในหน้าข้อมูลวง / ตั้งค่าวง
--
-- สาเหตุ: RLS policy บน profiles อนุญาตให้ดูเฉพาะ profile ตัวเอง
--         ไม่มี policy ให้สมาชิกวงเดียวกันดูกันได้
--
-- วิธีใช้: วาง SQL นี้ใน Supabase → SQL Editor → Run
-- ============================================================

-- 1. เพิ่ม RLS policy: สมาชิกวงเดียวกันดูกันได้
DROP POLICY IF EXISTS "profiles: สมาชิกวงเดียวกันดูกันได้" ON public.profiles;

CREATE POLICY "profiles: สมาชิกวงเดียวกันดูกันได้"
  ON public.profiles FOR SELECT
  USING (
    band_id IS NOT NULL
    AND band_id != ''
    AND band_id = public.get_my_band_id()
  );

-- 2. เพิ่ม RPC function สำหรับดึง band profiles (SECURITY DEFINER — bypass RLS)
--    เพื่อความมั่นใจว่าจะดึงได้แม้ RLS มีปัญหา
--    ตรวจสอบว่าผู้เรียกอยู่วงเดียวกัน (ป้องกันดูข้อมูลวงอื่น)
CREATE OR REPLACE FUNCTION public.get_band_profiles(p_band_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Security: ตรวจสอบว่าผู้เรียกเป็นสมาชิกของวงนี้จริง
  IF p_band_id != public.get_my_band_id() AND public.get_my_role() != 'admin' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',              p.id,
      'email',           p.email,
      'user_name',       p.user_name,
      'nickname',        p.nickname,
      'first_name',      p.first_name,
      'last_name',       p.last_name,
      'instrument',      p.instrument,
      'phone',           p.phone,
      'role',            p.role,
      'status',          p.status,
      'title',           p.title,
      'band_id',         p.band_id,
      'band_name',       p.band_name,
      'payment_method',  p.payment_method,
      'payment_account', p.payment_account,
      'created_at',      p.created_at
    ) ORDER BY p.role, p.nickname), '[]'::jsonb)
    FROM public.profiles p
    WHERE p.band_id = p_band_id
      AND p.status = 'active'
      AND p.role != 'pending'
  );
END;
$$;
