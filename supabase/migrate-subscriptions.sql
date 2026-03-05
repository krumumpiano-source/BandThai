-- ── migrate-subscriptions.sql ────────────────────────────────────────────
-- ตาราง subscriptions: เก็บประวัติการชำระเงิน

CREATE TABLE IF NOT EXISTS subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id          UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan             TEXT NOT NULL CHECK (plan IN ('lite', 'pro')),
  amount           INTEGER NOT NULL,   -- satang (99฿ = 9900)
  currency         TEXT NOT NULL DEFAULT 'thb',
  omise_charge_id  TEXT,               -- charge_xxx จาก Omise
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_band_id ON subscriptions (band_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions (expires_at);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- สมาชิกวงดูของวงตัวเองได้
CREATE POLICY "band members view own subscriptions"
  ON subscriptions FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Edge Function (service_role) เขียนได้เท่านั้น
-- (INSERT/UPDATE ผ่าน service_role ไม่ถูก RLS บล็อก)
