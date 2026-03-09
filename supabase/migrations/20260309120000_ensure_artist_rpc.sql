-- ensure_artist: ใครก็เรียกได้ (login) — ถ้ายังไม่มีก็เพิ่มให้อัตโนมัติ
-- ใช้สำหรับ auto-save ชื่อศิลปินเมื่อบันทึกเพลง
CREATE OR REPLACE FUNCTION ensure_artist(p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_norm TEXT;
BEGIN
    IF TRIM(COALESCE(p_name, '')) = '' THEN RETURN; END IF;
    v_norm := normalize_artist_name(p_name);
    IF v_norm = '' THEN RETURN; END IF;
    -- Insert if not exists (skip on conflict)
    INSERT INTO artists (name, name_normalized)
    VALUES (TRIM(p_name), v_norm)
    ON CONFLICT (name_normalized) DO NOTHING;
END;
$$;
