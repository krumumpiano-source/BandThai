-- แก้ไข get_band_subscribers ให้ใช้ nickname/first_name/last_name
-- และเพิ่ม endpoint แทน user_agent ที่ไม่มีอยู่

CREATE OR REPLACE FUNCTION get_band_subscribers(p_band_id text)
RETURNS TABLE(
  user_id    uuid,
  full_name  text,
  email      text,
  endpoint   text,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $func$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND band_id = p_band_id
      AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
    SELECT
      ps.user_id,
      COALESCE(
        NULLIF(TRIM(
          COALESCE(p.nickname,'') || ' ' ||
          COALESCE(p.first_name,'') || ' ' ||
          COALESCE(p.last_name,'')
        ), ''),
        p.email,
        ps.user_id::text
      ) AS full_name,
      p.email,
      ps.endpoint,
      ps.created_at
    FROM push_subscriptions ps
    LEFT JOIN profiles p ON p.id = ps.user_id
    WHERE ps.band_id = p_band_id
    ORDER BY ps.created_at DESC;
END;
$func$;
