-- ============================================================
-- migrate-multi-band-security.sql
-- แก้ไขปัญหา Multi-Band Security ให้ทุกวงใช้งานได้อย่างปลอดภัย
--
-- 1. band_songs RLS — จำกัดให้ดูเฉพาะเพลง global + วงตัวเอง
-- 2. invite_codes RLS — จำกัดให้ดูเฉพาะรหัสวงตัวเอง
-- 3. Admin RPC — เพิ่มการตรวจสอบ role = 'admin'
-- 4. RPC verify_admin — ตรวจสอบ admin จาก server-side
--
-- วิธีใช้: วาง SQL นี้ใน Supabase → SQL Editor → Run
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- 1. แก้ RLS บน band_songs — ดูได้เฉพาะเพลง global + วงตัวเอง
-- ═══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "songs: ดูได้ถ้า login" ON public.band_songs;

CREATE POLICY "songs: ดูได้เฉพาะ global + วงตัวเอง"
  ON public.band_songs FOR SELECT
  USING (
    band_id IS NULL                           -- เพลง global ดูได้ทุกคน
    OR band_id = public.get_my_band_id()      -- เพลงวงตัวเอง
    OR public.get_my_role() = 'admin'         -- admin ดูได้ทั้งหมด
  );

-- ═══════════════════════════════════════════════════════════
-- 2. แก้ RLS บน invite_codes — ดูได้เฉพาะรหัสวงตัวเอง
--    (registration flow ใช้ RPC lookup_invite_code ซึ่ง SECURITY DEFINER)
-- ═══════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "invite_codes: ดูได้ถ้า login" ON public.invite_codes;

CREATE POLICY "invite_codes: ดูได้เฉพาะวงตัวเอง"
  ON public.invite_codes FOR SELECT
  USING (
    band_id = public.get_my_band_id()
    OR public.get_my_role() = 'admin'
  );

-- ═══════════════════════════════════════════════════════════
-- 3. เพิ่ม admin check ใน RPC functions สำคัญ
-- ═══════════════════════════════════════════════════════════

-- 3a. get_pending_band_requests — เฉพาะ admin เท่านั้น
CREATE OR REPLACE FUNCTION get_pending_band_requests()
RETURNS SETOF band_requests LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- ตรวจสอบว่าผู้เรียกเป็น admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  RETURN QUERY
    SELECT * FROM band_requests
    WHERE status = 'pending'
    ORDER BY created_at ASC;
END;
$$;

-- 3b. approve_band_request — เฉพาะ admin เท่านั้น
CREATE OR REPLACE FUNCTION approve_band_request(
  p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req   band_requests%ROWTYPE;
  v_band  bands%ROWTYPE;
  v_code  text;
BEGIN
  -- ตรวจสอบว่าผู้เรียกเป็น admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: admin only');
  END IF;

  SELECT * INTO v_req FROM band_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'ไม่พบคำขอ');
  END IF;
  IF v_req.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'คำขอนี้ถูกดำเนินการแล้ว');
  END IF;

  -- สร้างวง
  INSERT INTO bands (band_name, province, manager_id, manager_email, status)
  VALUES (v_req.band_name, v_req.province, v_req.requester_id, v_req.requester_email, 'active')
  RETURNING * INTO v_band;

  -- สร้าง band code
  v_code := upper(substr(md5(random()::text), 1, 6));
  INSERT INTO invite_codes (band_id, band_name, province, code, status, created_by)
  VALUES (v_band.id, v_band.band_name, v_band.province, v_code, 'permanent', v_req.requester_id);

  -- อัปเดต profile ของผู้ขอ
  UPDATE profiles SET
    band_id   = v_band.id,
    band_name = v_band.band_name,
    province  = v_band.province,
    role      = 'manager',
    status    = 'active'
  WHERE id = v_req.requester_id;

  -- อัปเดต band_requests
  UPDATE band_requests SET
    status     = 'approved',
    band_id    = v_band.id,
    updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'band_id', v_band.id,
    'band_code', v_code,
    'message', 'อนุมัติวง "' || v_band.band_name || '" เรียบร้อย'
  );
END;
$$;

-- 3c. reject_band_request — เฉพาะ admin เท่านั้น
CREATE OR REPLACE FUNCTION reject_band_request(
  p_request_id uuid,
  p_notes      text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req band_requests%ROWTYPE;
BEGIN
  -- ตรวจสอบว่าผู้เรียกเป็น admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: admin only');
  END IF;

  SELECT * INTO v_req FROM band_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'ไม่พบคำขอ');
  END IF;

  UPDATE band_requests SET
    status     = 'rejected',
    admin_notes = p_notes,
    updated_at  = now()
  WHERE id = p_request_id;

  -- อัปเดต profile ผู้ขอ
  UPDATE profiles SET
    status = 'rejected_band'
  WHERE id = v_req.requester_id AND status = 'pending_band';

  RETURN jsonb_build_object('success', true, 'message', 'ปฏิเสธคำขอเรียบร้อย');
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- 4. RPC verify_admin — ใช้ตรวจสอบ admin role จาก server-side
--    เพื่อป้องกันการปลอม localStorage
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.verify_admin()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role = 'admin' THEN
    RETURN jsonb_build_object('success', true, 'role', 'admin');
  ELSE
    RETURN jsonb_build_object('success', false, 'role', coalesce(v_role, 'none'));
  END IF;
END;
$$;
