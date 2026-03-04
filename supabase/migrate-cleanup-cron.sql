-- ─────────────────────────────────────────────────────────────────
-- migrate-cleanup-cron.sql
-- เพิ่ม pg_cron jobs สำหรับ cleanup ข้อมูลเก่า
-- วิธีใช้: รันใน Supabase Dashboard → SQL Editor (ทีเดียว)
-- ─────────────────────────────────────────────────────────────────

-- ต้องการ pg_cron extension (ถูก enable แล้วใน migrate-notifications.sql)
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ── 1. Cleanup notification_log เก่ากว่า 7 วัน ────────────────────
-- รันทุกวัน เวลา 03:00 UTC (10:00 น. เวลาไทย)
SELECT cron.schedule(
  'soulciety-clean-notif-log',   -- ชื่อ job (unique)
  '0 3 * * *',                   -- ทุกวัน 03:00 UTC
  $$
  DELETE FROM notification_log
  WHERE sent_at < now() - interval '7 days';
  $$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'soulciety-clean-notif-log'
);

-- ── 2. Cleanup live_guest_tokens ที่หมดอายุ ───────────────────────
-- รันทุกวัน เวลา 04:00 UTC (11:00 น. เวลาไทย)
SELECT cron.schedule(
  'soulciety-clean-live-tokens', -- ชื่อ job (unique)
  '0 4 * * *',                   -- ทุกวัน 04:00 UTC
  $$
  DELETE FROM live_guest_tokens
  WHERE expires_at < now();
  $$
) WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'soulciety-clean-live-tokens'
);

-- ── ตรวจสอบ jobs ที่สร้าง ────────────────────────────────────────
-- SELECT jobname, schedule, active FROM cron.job
-- WHERE jobname LIKE 'soulciety-%'
-- ORDER BY jobname;
