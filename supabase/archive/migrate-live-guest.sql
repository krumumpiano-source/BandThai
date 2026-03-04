-- ─────────────────────────────────────────────────────────────────
-- migrate-live-guest.sql
-- สร้าง live_guest_tokens table สำหรับ Guest Access บน Live Mode
-- วิธีใช้: รันใน Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── live_guest_tokens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_guest_tokens (
  token        text        PRIMARY KEY,
  band_id      text        NOT NULL,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  date         text        NOT NULL,  -- YYYY-MM-DD — ใช้ได้เฉพาะวันนี้
  venue        text        NOT NULL DEFAULT '',
  time_slot    text        NOT NULL DEFAULT '',
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Index สำหรับเช็ค expiry + band
CREATE INDEX IF NOT EXISTS live_guest_tokens_band_date
  ON live_guest_tokens (band_id, date);

CREATE INDEX IF NOT EXISTS live_guest_tokens_expires
  ON live_guest_tokens (expires_at);

-- ─── RLS ──────────────────────────────────────────────────────────
ALTER TABLE live_guest_tokens ENABLE ROW LEVEL SECURITY;

-- สมาชิกที่ login แล้วสร้าง token ของตัวเองได้
CREATE POLICY "members can insert own tokens"
  ON live_guest_tokens FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ทุกคน (รวม anon) เช็ค token ที่ยังไม่หมดอายุได้
CREATE POLICY "anyone can read valid tokens"
  ON live_guest_tokens FOR SELECT
  USING (expires_at > now());

-- เจ้าของ token ลบได้
CREATE POLICY "owner can delete own tokens"
  ON live_guest_tokens FOR DELETE
  USING (auth.uid() = created_by);

-- ─── Auto-cleanup: ลบ token หมดอายุ (รัน manual หรือเพิ่มใน Edge Function) ──
-- DELETE FROM live_guest_tokens WHERE expires_at < now();
