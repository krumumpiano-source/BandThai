-- =============================================================
-- Migration: รองรับหลายวงต่อวัน (คนละเบรค) ใน venue_schedule_entries
--
-- ปัญหาเดิม: UNIQUE(venue_name, date, break_number) ทำให้
--   SoulCiety เบรค 1 (21:00) ชนกับ โดดน้ำกว๊าน เบรค 1 (18:00)
--   → ข้อมูลวงหนึ่งหาย (last write wins)
--
-- แก้ไข: เพิ่ม band_name เข้า UNIQUE constraint
--   → UNIQUE(venue_name, date, break_number, band_name)
--   → SoulCiety เบรค 1 + โดดน้ำกว๊าน เบรค 1 อยู่ได้พร้อมกัน
--
-- Deploy Strategy (3 ขั้นตอน):
--   Step A: รัน migration นี้ (ADD new constraint — old ยังอยู่)
--   Step B: Deploy Edge Function ใหม่ (ใช้ onConflict ใหม่)
--   Step C: รัน DROP old constraint (ด้านล่าง — หลังยืนยัน function ทำงาน)
-- =============================================================

-- 0) Backup ก่อน
CREATE TABLE IF NOT EXISTS public.venue_schedule_entries_backup AS
  SELECT * FROM public.venue_schedule_entries;

-- 1) ทำให้ band_name ไม่เป็น null (แก้ค่าว่าง → '')
UPDATE public.venue_schedule_entries
  SET band_name = ''
  WHERE band_name IS NULL;

-- 2) ลบ rows ที่ duplicate (venue_name, date, break_number, band_name)
--    เก็บแค่ row ล่าสุด (updated_at ใหม่สุด)
DELETE FROM public.venue_schedule_entries a
  USING public.venue_schedule_entries b
  WHERE a.venue_name = b.venue_name
    AND a.date = b.date
    AND a.break_number = b.break_number
    AND a.band_name = b.band_name
    AND a.id < b.id;  -- เก็บ id ใหญ่กว่า (ใหม่กว่า)

-- 3) เพิ่ม UNIQUE ใหม่ (ยังไม่ DROP ตัวเก่า — ให้ function เก่ายังทำงานได้)
ALTER TABLE public.venue_schedule_entries
  ADD CONSTRAINT uq_venue_schedule_band
  UNIQUE (venue_name, date, break_number, band_name);

-- =============================================================
-- Step C: รันหลังจากยืนยัน Edge Function ใหม่ทำงาน
-- (คอมเมนต์ไว้ก่อน — uncomment แล้วรันทีหลัง)
-- =============================================================
-- ALTER TABLE public.venue_schedule_entries
--   DROP CONSTRAINT IF EXISTS venue_schedule_entries_venue_name_date_break_number_key;

SELECT 'Migration: multi_band_schedule applied' AS status;
