-- ── Notification Admin: RLS policy + RPC for manager/admin access ──────────
-- Run this migration once via Supabase SQL Editor

-- 1. Allow admin/manager to SELECT push_subscriptions of their band
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_subscriptions' AND policyname = 'ps_admin_sel'
  ) THEN
    CREATE POLICY ps_admin_sel ON push_subscriptions FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id      = auth.uid()
          AND profiles.band_id = push_subscriptions.band_id
          AND profiles.role   IN ('admin', 'manager')
      )
    );
  END IF;
END $$;

-- 2. RPC: returns subscriber summary for admin/manager
CREATE OR REPLACE FUNCTION get_band_subscribers(p_band_id text)
RETURNS TABLE(
  user_id    uuid,
  full_name  text,
  email      text,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
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
    SELECT ps.user_id, p.full_name, p.email, ps.created_at
    FROM push_subscriptions ps
    LEFT JOIN profiles p ON p.id = ps.user_id
    WHERE ps.band_id = p_band_id
    ORDER BY ps.created_at DESC;
END;
$$;
