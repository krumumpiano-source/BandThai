-- ─────────────────────────────────────────────────────────────────
-- migrate-notifications.sql
-- Push Notification System — Band Management By SoulCiety
-- วิธีใช้: รันใน Supabase Dashboard → SQL Editor (ทีเดียว)
-- ─────────────────────────────────────────────────────────────────

-- ── 1. Extensions ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ── 2. push_subscriptions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id     text        NOT NULL,
  endpoint    text        NOT NULL,
  p256dh      text        NOT NULL,
  auth_key    text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- users เห็นเฉพาะ row ของตัวเอง
CREATE POLICY "user sees own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user inserts own subscription"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user deletes own subscription"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- service_role bypass RLS (default Supabase behaviour)

-- ── 3. notification_log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id            text        NOT NULL,
  notification_type  text        NOT NULL,  -- external_1day | regular_1hr | break_5min
  reference_key      text        NOT NULL,  -- ext_{id} | reg1hr_{bandId}_{date} | brk5m_{bandId}_{date}_{slotId}
  sent_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (band_id, notification_type, reference_key)
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- service_role only (Edge Function เท่านั้นที่เขียน)
-- ไม่มี select policy → anon/authenticated ไม่เห็น (ปลอดภัย)

-- ── 4. Cron Job — เรียก Edge Function ทุก 1 นาที ─────────────────
-- หมายเหตุ: ต้องมี pg_cron extension ก่อน (ขั้น 1)
-- และต้อง deploy Edge Function ก่อน (sb-deploy-functions.ps1)

SELECT cron.schedule(
  'soulciety-send-notifications',   -- ชื่อ job (unique)
  '* * * * *',                      -- ทุก 1 นาที
  $$
  SELECT net.http_post(
    url     := 'https://wsorngsyowgxikiepice.supabase.co/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
        LIMIT 1
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ── 5. Cleanup function (optional manual run) ─────────────────────
-- ลบ notification_log เก่ากว่า 7 วัน
-- DELETE FROM notification_log WHERE sent_at < now() - interval '7 days';

-- ลบ live_guest_tokens หมดอายุ
-- DELETE FROM live_guest_tokens WHERE expires_at < now();
