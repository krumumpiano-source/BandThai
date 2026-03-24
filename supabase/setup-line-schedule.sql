-- =============================================================
-- Setup: ระบบส่ง LINE ตารางเบรคอัตโนมัติ (LINE Break Schedule)
-- Run this in Supabase SQL Editor
-- =============================================================

-- 1) ตาราง venue_line_config — เก็บ LINE credentials ระดับร้าน
CREATE TABLE IF NOT EXISTS venue_line_config (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_name          text NOT NULL,
  line_channel_token  text NOT NULL DEFAULT '',
  line_group_id       text NOT NULL DEFAULT '',
  band_ids            text[] NOT NULL DEFAULT '{}',
  enabled             boolean NOT NULL DEFAULT false,
  send_daily_time     text NOT NULL DEFAULT '23:30',
  send_weekly_enabled boolean NOT NULL DEFAULT true,
  send_weekly_day     int  NOT NULL DEFAULT 1,      -- 0=อาทิตย์ … 6=เสาร์
  send_weekly_time    text NOT NULL DEFAULT '08:00',
  footer_text         text NOT NULL DEFAULT '',
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 2) ตาราง line_message_log — บันทึกทุกข้อความที่ส่ง สำหรับนับโควตา + ดูประวัติ
CREATE TABLE IF NOT EXISTS line_message_log (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venue_line_config_id  uuid REFERENCES venue_line_config(id) ON DELETE CASCADE,
  message_type          text NOT NULL CHECK (message_type IN ('daily','weekly','test','preview')),
  message_text          text,
  line_response_code    int,
  success               boolean NOT NULL DEFAULT false,
  error_message         text,
  sent_at               timestamptz NOT NULL DEFAULT now()
);

-- Index สำหรับนับโควตาเดือนนี้เร็วๆ
CREATE INDEX IF NOT EXISTS idx_line_message_log_config_sent
  ON line_message_log (venue_line_config_id, sent_at);

-- 3) RLS Policies — admin only
ALTER TABLE venue_line_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_message_log  ENABLE ROW LEVEL SECURITY;

-- venue_line_config: admin read/write
CREATE POLICY "admin_manage_venue_line_config"
  ON venue_line_config FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- line_message_log: admin read, service role write (Edge Function)
CREATE POLICY "admin_read_line_message_log"
  ON line_message_log FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "service_role_write_line_message_log"
  ON line_message_log FOR INSERT
  WITH CHECK (true);  -- Edge Function ใช้ service_role bypass RLS อยู่แล้ว

-- 4) Enable pg_cron (ถ้ายังไม่มี)
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT USAGE ON SCHEMA net  TO postgres;

-- 5) Cron job: ส่งสรุปรายวัน 23:30 น. (Thai time = 16:30 UTC)
SELECT cron.schedule(
  'line-daily-schedule',
  '30 16 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/send-line-schedule',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body    := '{"mode":"daily"}'::jsonb
  );
  $$
);

-- 6) Cron job: ส่งสรุปสัปดาห์ทุกวันจันทร์ 08:00 น. (Thai time = 01:00 UTC)
SELECT cron.schedule(
  'line-weekly-summary',
  '0 1 * * 1',
  $$
  SELECT net.http_post(
    url     := current_setting('app.settings.supabase_url') || '/functions/v1/send-line-schedule',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body    := '{"mode":"weekly"}'::jsonb
  );
  $$
);

-- 7) Cleanup logs เก่ากว่า 6 เดือน (ทุกวันตี 2 Thai = 19:00 UTC)
SELECT cron.schedule(
  'cleanup-line-message-log',
  '0 19 * * *',
  $$DELETE FROM line_message_log WHERE sent_at < now() - interval '6 months';$$
);

-- 8) ตรวจสอบ cron jobs
SELECT * FROM cron.job ORDER BY jobid;

-- =============================================================
-- หมายเหตุ: ถ้า current_setting ไม่ทำงาน ให้ใช้ URL + key โดยตรง:
-- url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-line-schedule'
-- headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
-- =============================================================
