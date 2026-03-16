-- =========================================================
-- migrate-member-activity-log.sql
-- บันทึกประวัติการทำงานของสมาชิกในระบบ (เพลง, ศิลปิน)
-- รัน script นี้ใน Supabase SQL Editor (ครั้งเดียว)
-- =========================================================

-- 1. สร้างตาราง
CREATE TABLE IF NOT EXISTS member_activity_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id      uuid        NOT NULL,
  user_id      uuid        NOT NULL,
  user_name    text        NOT NULL DEFAULT '',
  action       text        NOT NULL,          -- 'add_song','edit_song','delete_song','merge_songs','bulk_add','add_artist','edit_artist','delete_artist'
  action_label text        NOT NULL DEFAULT '',  -- ชื่อภาษาไทย เช่น 'เพิ่มเพลง'
  target_id    text        NOT NULL DEFAULT '',  -- song_id หรือ artist_id
  target_name  text        NOT NULL DEFAULT '',  -- ชื่อเพลง / ชื่อศิลปิน
  score        integer     NOT NULL DEFAULT 1,   -- คะแนนงาน: add=3, edit=1, delete=2, merge=5, bulk=ตามจำนวน*2
  session_id   text        NOT NULL DEFAULT '',  -- UUID ของ browser session (เพื่อคำนวณเวลาทำงาน)
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_mal_band_created      ON member_activity_log (band_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mal_band_user_created ON member_activity_log (band_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mal_session           ON member_activity_log (session_id, created_at);

-- 3. RLS
ALTER TABLE member_activity_log ENABLE ROW LEVEL SECURITY;

-- สมาชิกเพิ่ม log ของตัวเองได้
CREATE POLICY "member_activity_log: insert own"
  ON member_activity_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- สมาชิกอ่านประวัติตัวเองได้
CREATE POLICY "member_activity_log: select own"
  ON member_activity_log FOR SELECT
  USING (auth.uid() = user_id);

-- admin และ manager ของวงอ่านประวัติทั้งวงได้
CREATE POLICY "member_activity_log: admin read band"
  ON member_activity_log FOR SELECT
  USING (
    band_id IN (
      SELECT band_id FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager')
    )
  );
