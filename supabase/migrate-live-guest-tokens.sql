-- live_guest_tokens: short-lived tokens for guest access to Live Mode
-- Run this once via Supabase SQL Editor

CREATE TABLE IF NOT EXISTS live_guest_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text        NOT NULL UNIQUE,
  band_id     text        NOT NULL,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  date        text        NOT NULL DEFAULT '',
  venue       text        NOT NULL DEFAULT '',
  time_slot   text        NOT NULL DEFAULT '',
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE live_guest_tokens ENABLE ROW LEVEL SECURITY;

-- Anyone can verify a token (needed for unauthenticated guests)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='live_guest_tokens' AND policyname='lgt_select_all'
  ) THEN
    CREATE POLICY lgt_select_all ON live_guest_tokens FOR SELECT USING (true);
  END IF;
END $$;

-- Only the creator can insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='live_guest_tokens' AND policyname='lgt_insert'
  ) THEN
    CREATE POLICY lgt_insert ON live_guest_tokens FOR INSERT
      WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;

-- Creator can delete their own tokens
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='live_guest_tokens' AND policyname='lgt_delete'
  ) THEN
    CREATE POLICY lgt_delete ON live_guest_tokens FOR DELETE
      USING (auth.uid() = created_by);
  END IF;
END $$;

-- Auto-clean expired tokens (optional, run periodically)
-- SELECT cron.schedule('clean-live-tokens', '0 4 * * *',
--   'DELETE FROM live_guest_tokens WHERE expires_at < now()');
