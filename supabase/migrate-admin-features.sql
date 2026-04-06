-- ============================================================
-- Admin Features Migration: App Config, Activity Log, Notification Templates
-- ============================================================

-- ── 1. app_config ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed default config keys
INSERT INTO app_config (key, value, description) VALUES
  ('maintenance_mode', 'false',  'ปิดแอปชั่วคราว (true/false)'),
  ('announce_banner',  '',       'ข้อความแถบประกาศ (ว่าง = ไม่แสดง)'),
  ('announce_type',    'info',   'ประเภทแถบประกาศ: info / warning / error'),
  ('registration_open','true',   'เปิด/ปิดการสมัครใหม่ (true/false)'),
  ('max_bands',        '0',      'จำนวนวงสูงสุดที่อนุญาต (0 = ไม่จำกัด)'),
  ('contact_email',    '',       'อีเมลติดต่อสำหรับแสดงในแอป')
ON CONFLICT (key) DO NOTHING;

-- RLS: อ่านได้ทุกคน, เขียนได้เฉพาะ admin
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_read" ON app_config;
CREATE POLICY "app_config_read" ON app_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "app_config_admin_write" ON app_config;
CREATE POLICY "app_config_admin_write" ON app_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 2. activity_log ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id          SERIAL PRIMARY KEY,
  admin_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_email TEXT DEFAULT '',
  action      TEXT NOT NULL,
  target_type TEXT DEFAULT '',
  target_id   TEXT DEFAULT '',
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_action_idx      ON activity_log (action);

-- RLS: อ่านได้เฉพาะ admin, แทรกได้เฉพาะ admin
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_log_admin_read" ON activity_log;
CREATE POLICY "activity_log_admin_read" ON activity_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "activity_log_admin_insert" ON activity_log;
CREATE POLICY "activity_log_admin_insert" ON activity_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 3. notification_templates ──────────────────────────────
CREATE TABLE IF NOT EXISTS notification_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  subject     TEXT DEFAULT '',
  body        TEXT DEFAULT '',
  variables   TEXT[] DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed default templates
INSERT INTO notification_templates (id, name, subject, body, variables) VALUES
  ('welcome',       'ยินดีต้อนรับ',              'ยินดีต้อนรับสู่ BandThai!',
   E'สวัสดี {{name}}!\n\nยินดีต้อนรับสู่ BandThai แอปจัดการวงดนตรีของคุณ\n\nเริ่มต้นใช้งานได้เลย!',
   ARRAY['name']),
  ('expire_soon',   'แพ็กเกจใกล้หมดอายุ',         'แพ็กเกจของคุณจะหมดอายุใน {{days}} วัน',
   E'สวัสดี {{name}}!\n\nแพ็กเกจ {{plan}} ของวง {{band_name}} จะหมดอายุใน {{days}} วัน\n\nต่ออายุได้ที่: {{upgrade_url}}',
   ARRAY['name','plan','band_name','days','upgrade_url']),
  ('payment_ok',    'ชำระเงินสำเร็จ',              'ขอบคุณสำหรับการต่ออายุแพ็กเกจ',
   E'สวัสดี {{name}}!\n\nการชำระเงินสำหรับแพ็กเกจ {{plan}} จำนวน {{amount}} บาท สำเร็จแล้ว\n\nหมดอายุ: {{expires_at}}',
   ARRAY['name','plan','amount','expires_at']),
  ('schedule_new',  'มีตารางงานใหม่',              'ตารางงานใหม่: {{event_name}}',
   E'สวัสดี {{name}}!\n\nมีตารางงานใหม่: {{event_name}}\nวันที่: {{event_date}}\nสถานที่: {{venue}}\n\nเช็คอินได้ที่แอป',
   ARRAY['name','event_name','event_date','venue']),
  ('general',       'ประกาศทั่วไป',                '{{subject}}',
   E'{{body}}',
   ARRAY['subject','body'])
ON CONFLICT (id) DO NOTHING;

-- RLS: อ่านได้ทุกคน, เขียนได้เฉพาะ admin
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_templates_read" ON notification_templates;
CREATE POLICY "notif_templates_read" ON notification_templates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "notif_templates_admin_write" ON notification_templates;
CREATE POLICY "notif_templates_admin_write" ON notification_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
