-- =============================================================
-- Migration: venue_schedule_entries
-- ตารางเก็บข้อมูลเบรครายวัน ต่อร้าน (ใช้ UPSERT ป้องกันซ้ำ)
-- SoulCiety → auto-populate จาก member_check_ins
-- โดดน้ำกว๊าน → populate จาก LINE message (ข้อความจากผู้จัดการ)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.venue_schedule_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_name    text NOT NULL DEFAULT 'ร้านนิยมสุข',
  date          text NOT NULL,           -- YYYY-MM-DD
  break_number  integer NOT NULL,        -- 1, 2, 3, 4
  break_start   text DEFAULT '',         -- '18:00'
  break_end     text DEFAULT '',         -- '19:00'
  band_name     text DEFAULT '',         -- 'SoulCiety' | 'โดดน้ำกว๊าน' | '' (ว่าง)
  member_count  integer DEFAULT 0,
  source        text DEFAULT 'manual',   -- 'checkin' | 'line' | 'manual'
  updated_by    text DEFAULT '',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(venue_name, date, break_number)
);

-- Index สำหรับ query ตามวัน
CREATE INDEX IF NOT EXISTS idx_venue_schedule_date
  ON venue_schedule_entries (venue_name, date);

-- RLS: service role bypass (Edge Function), admin read
ALTER TABLE venue_schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_venue_schedule"
  ON venue_schedule_entries FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================================
-- ตรวจสอบ
-- =============================================================
SELECT 'venue_schedule_entries created' AS status;
