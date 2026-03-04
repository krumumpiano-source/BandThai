-- ─────────────────────────────────────────────────────────────────
-- migrate-admin-delete-user.sql
-- RPC สำหรับ Admin ลบ user ออกจากระบบทั้งหมด (auth.users + profiles cascade)
-- วิธีใช้: รันใน Supabase Dashboard → SQL Editor (ทีเดียว)
-- ─────────────────────────────────────────────────────────────────

-- admin_delete_user: ตรวจสอบว่า caller เป็น admin จาก profiles
-- แล้วลบ auth.users row (profiles จะ cascade delete ตามอัตโนมัติ)
CREATE OR REPLACE FUNCTION admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_caller_role text;
BEGIN
  -- ตรวจสอบสิทธิ์ผู้เรียก
  SELECT role INTO v_caller_role
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: เฉพาะ admin เท่านั้นที่ลบ user ได้';
  END IF;

  -- ป้องกันการลบตัวเอง
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'ไม่สามารถลบบัญชีตัวเองได้';
  END IF;

  -- ลบ auth user (profiles จะถูก cascade delete ตาม ON DELETE CASCADE)
  DELETE FROM auth.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบผู้ใช้ ID: %', p_user_id;
  END IF;
END;
$func$;

-- ให้สิทธิ์ authenticated users เรียกใช้ (RPC จะตรวจสิทธิ์ภายใน)
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;
