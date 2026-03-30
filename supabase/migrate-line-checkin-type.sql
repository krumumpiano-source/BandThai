-- =============================================================
-- Migration: เพิ่ม message_type 'checkin' ใน line_message_log
-- รันใน Supabase SQL Editor
-- =============================================================

-- ลบ constraint เดิม แล้วสร้างใหม่ที่รองรับ 'checkin'
ALTER TABLE line_message_log DROP CONSTRAINT IF EXISTS line_message_log_message_type_check;
ALTER TABLE line_message_log ADD CONSTRAINT line_message_log_message_type_check
  CHECK (message_type IN ('daily','weekly','test','preview','checkin'));
