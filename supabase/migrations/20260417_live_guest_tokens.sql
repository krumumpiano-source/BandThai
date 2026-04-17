-- ============================================================
--  live_guest_tokens
--  ตารางเก็บ token สำหรับ QR Code เข้า Live Mode แบบ Guest
--  - สมาชิกสร้าง token → แชร์ให้คนมาแทน scan QR
--  - token หมดอายุอัตโนมัติใน 12 ชั่วโมง
-- ============================================================

CREATE TABLE IF NOT EXISTS public.live_guest_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE,
  band_id     text NOT NULL,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  date        text NOT NULL DEFAULT '',
  venue       text NOT NULL DEFAULT '',
  time_slot   text NOT NULL DEFAULT '',
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index สำหรับ query ด้วย token + expiry
CREATE INDEX IF NOT EXISTS live_guest_tokens_token_idx
  ON public.live_guest_tokens (token, expires_at);

-- Auto-cleanup: ลบ token หมดอายุเก่ากว่า 1 วัน (optional, ทำ cron ใน pg_cron ได้)
-- ตอนนี้ทำผ่าน query filter ก็พอ

-- ============================================================
--  RLS Policies
-- ============================================================
ALTER TABLE public.live_guest_tokens ENABLE ROW LEVEL SECURITY;

-- สมาชิก (authenticated) อ่านได้เฉพาะ token ของวงตัวเอง
CREATE POLICY "members can read own band tokens"
  ON public.live_guest_tokens
  FOR SELECT
  TO authenticated
  USING (band_id = (
    SELECT band_id FROM public.band_profiles
    WHERE user_id = auth.uid()
    LIMIT 1
  ));

-- Anonymous user (guest) อ่านได้ทุก token (ต้องการสำหรับ verify)
CREATE POLICY "anon can verify token"
  ON public.live_guest_tokens
  FOR SELECT
  TO anon
  USING (expires_at > now());

-- สมาชิก (authenticated) สร้าง token ได้เฉพาะวงตัวเอง
CREATE POLICY "members can create tokens for own band"
  ON public.live_guest_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (band_id = (
    SELECT band_id FROM public.band_profiles
    WHERE user_id = auth.uid()
    LIMIT 1
  ));

-- สมาชิก (authenticated) ลบ token ของวงตัวเองได้
CREATE POLICY "members can delete own band tokens"
  ON public.live_guest_tokens
  FOR DELETE
  TO authenticated
  USING (band_id = (
    SELECT band_id FROM public.band_profiles
    WHERE user_id = auth.uid()
    LIMIT 1
  ));
