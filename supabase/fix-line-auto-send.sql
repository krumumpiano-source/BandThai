-- =============================================================
-- FIX: ระบบส่ง LINE อัตโนมัติไม่ทำงาน
-- รันใน Supabase SQL Editor
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) Backfill band_ids — ใส่ band_id ทั้งหมดจากตาราง bands
--    เข้าไปใน venue_line_config ที่ band_ids ยังว่าง
-- ─────────────────────────────────────────────────────────────
UPDATE venue_line_config
SET band_ids = (SELECT array_agg(id::text) FROM bands),
    updated_at = now()
WHERE band_ids = '{}' OR band_ids IS NULL;

-- ตรวจสอบผลลัพธ์
SELECT id, venue_name, enabled, band_ids, line_channel_token IS NOT NULL AS has_token, line_group_id
FROM venue_line_config;

-- ─────────────────────────────────────────────────────────────
-- 2) Fix pg_cron jobs — ลบ cron เดิมที่ใช้ current_setting()
--    แล้วสร้างใหม่ด้วย URL/key ตรง
-- ─────────────────────────────────────────────────────────────

-- ลบ cron jobs เดิม (ถ้ามี)
DO $$
BEGIN
  PERFORM cron.unschedule('line-daily-schedule');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('line-weekly-summary');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-line-message-log');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- สร้าง cron ใหม่ — ใช้ anon key (daily/weekly ไม่ต้องการ admin auth)

-- Daily: 23:30 Thai time = 16:30 UTC
SELECT cron.schedule(
  'line-daily-schedule',
  '30 16 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://wsorngsyowgxikiepice.supabase.co/functions/v1/send-line-schedule',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_k2zvxeE9SJEEJkw3SVolqg_pkgZQPnm","Authorization":"Bearer sb_publishable_k2zvxeE9SJEEJkw3SVolqg_pkgZQPnm"}'::jsonb,
    body    := '{"mode":"daily"}'::jsonb
  );
  $$
);

-- Weekly: Monday 08:00 Thai time = 01:00 UTC
SELECT cron.schedule(
  'line-weekly-summary',
  '0 1 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://wsorngsyowgxikiepice.supabase.co/functions/v1/send-line-schedule',
    headers := '{"Content-Type":"application/json","apikey":"sb_publishable_k2zvxeE9SJEEJkw3SVolqg_pkgZQPnm","Authorization":"Bearer sb_publishable_k2zvxeE9SJEEJkw3SVolqg_pkgZQPnm"}'::jsonb,
    body    := '{"mode":"weekly"}'::jsonb
  );
  $$
);

-- Cleanup logs เก่ากว่า 6 เดือน (ทุกวันตี 2 Thai = 19:00 UTC วันก่อน)
SELECT cron.schedule(
  'cleanup-line-message-log',
  '0 19 * * *',
  $$DELETE FROM line_message_log WHERE sent_at < now() - interval '6 months';$$
);

-- ─────────────────────────────────────────────────────────────
-- 3) ตรวจสอบ cron jobs ที่สร้างแล้ว
-- ─────────────────────────────────────────────────────────────
SELECT jobid, jobname, schedule, command
FROM cron.job
ORDER BY jobid;

-- ─────────────────────────────────────────────────────────────
-- 4) ตรวจสอบ log ข้อความที่เคยส่ง (ถ้ามี)
-- ─────────────────────────────────────────────────────────────
SELECT id, message_type, success, line_response_code, error_message, sent_at
FROM line_message_log
ORDER BY sent_at DESC
LIMIT 10;
