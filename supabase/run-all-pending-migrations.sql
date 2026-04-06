-- ============================================================
-- RUN ALL PENDING MIGRATIONS (one-time)
-- วาง SQL นี้ทั้งหมดใน Supabase → SQL Editor → Run
-- รันได้ซ้ำปลอดภัย (ใช้ IF NOT EXISTS ทุกที่)
-- ============================================================

-- ── 0. Helper: is_admin() ────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false)
$$;

-- ════════════════════════════════════════════════════════════
-- PART A: ADD MISSING COLUMNS TO EXISTING TABLES
-- ════════════════════════════════════════════════════════════

-- ── A1. profiles: plan_override ──────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_override TEXT DEFAULT NULL;
-- CHECK constraint (safe add)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_override_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_override_check
      CHECK (plan_override IN ('free','lite','pro'));
  END IF;
END $$;

-- ── A2. bands: band_plan ────────────────────────────────────
ALTER TABLE public.bands
  ADD COLUMN IF NOT EXISTS band_plan TEXT NOT NULL DEFAULT 'free';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bands_band_plan_check'
  ) THEN
    ALTER TABLE public.bands ADD CONSTRAINT bands_band_plan_check
      CHECK (band_plan IN ('free','lite','pro'));
  END IF;
END $$;
UPDATE public.bands SET band_plan = 'free' WHERE band_plan IS NULL;
CREATE INDEX IF NOT EXISTS idx_bands_band_plan ON public.bands (band_plan);

-- ── A3. fund_transactions: approval columns ─────────────────
ALTER TABLE public.fund_transactions
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_by  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_by   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_at   timestamptz,
  ADD COLUMN IF NOT EXISTS reject_reason text DEFAULT '';
UPDATE public.fund_transactions SET status = 'approved' WHERE status IS NULL OR status = '';
CREATE INDEX IF NOT EXISTS idx_fund_tx_status ON public.fund_transactions (band_id, status);

-- ── A4. equipment: v2 columns ───────────────────────────────
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS purchase_source text,
  ADD COLUMN IF NOT EXISTS fund_source     text,
  ADD COLUMN IF NOT EXISTS image_url       text;

-- ── A5. setlists: date + fix unique constraint ──────────────
ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS date TEXT DEFAULT '';
ALTER TABLE public.setlists DROP CONSTRAINT IF EXISTS setlists_band_id_key;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'setlists_band_date_key'
  ) THEN
    ALTER TABLE public.setlists ADD CONSTRAINT setlists_band_date_key UNIQUE (band_id, date);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- PART B: CREATE MISSING TABLES
-- ════════════════════════════════════════════════════════════

-- ── B1. subscriptions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id          uuid NOT NULL,
  user_id          uuid NOT NULL,
  plan             text NOT NULL CHECK (plan IN ('lite','pro')),
  amount           integer NOT NULL,
  currency         text NOT NULL DEFAULT 'thb',
  omise_charge_id  text,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  started_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_band_id ON public.subscriptions (band_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON public.subscriptions (expires_at);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='sub_band_read') THEN
    CREATE POLICY sub_band_read ON public.subscriptions FOR SELECT
      USING (band_id::text = public.get_my_band_id());
  END IF;
END $$;

-- ── B2. song_suggestions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.song_suggestions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  song_id        uuid NOT NULL,
  suggested_by   uuid,
  suggested_name text,
  suggested_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  note           text,
  status         text NOT NULL DEFAULT 'pending',
  admin_note     text,
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_song_suggestions_status ON public.song_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_song_suggestions_song ON public.song_suggestions(song_id);
ALTER TABLE public.song_suggestions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='song_suggestions' AND policyname='ss_auth_read') THEN
    CREATE POLICY ss_auth_read ON public.song_suggestions FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='song_suggestions' AND policyname='ss_auth_insert') THEN
    CREATE POLICY ss_auth_insert ON public.song_suggestions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='song_suggestions' AND policyname='ss_auth_update') THEN
    CREATE POLICY ss_auth_update ON public.song_suggestions FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- RLS: admin แก้เพลงคลังกลาง (band_id IS NULL)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='band_songs' AND policyname='songs: admin edit global') THEN
    CREATE POLICY "songs: admin edit global" ON public.band_songs FOR UPDATE
      USING (band_id IS NULL AND public.get_my_role() = 'admin');
  END IF;
END $$;

-- ── B3. promo_codes ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id               serial PRIMARY KEY,
  code             text UNIQUE NOT NULL,
  plan             text NOT NULL DEFAULT 'lite' CHECK (plan IN ('lite','pro')),
  months           int NOT NULL DEFAULT 1 CHECK (months > 0),
  discount_percent int NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  max_uses         int DEFAULT NULL,
  used_count       int NOT NULL DEFAULT 0,
  expires_at       timestamptz DEFAULT NULL,
  active           bool NOT NULL DEFAULT true,
  note             text DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_codes' AND policyname='promo_public_read') THEN
    CREATE POLICY promo_public_read ON public.promo_codes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='promo_codes' AND policyname='promo_admin_write') THEN
    CREATE POLICY promo_admin_write ON public.promo_codes FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ── B4. push_subscriptions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  band_id     text NOT NULL,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth_key    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='ps_user_select') THEN
    CREATE POLICY ps_user_select ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='ps_user_insert') THEN
    CREATE POLICY ps_user_insert ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='ps_user_delete') THEN
    CREATE POLICY ps_user_delete ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='push_subscriptions' AND policyname='ps_user_update') THEN
    CREATE POLICY ps_user_update ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── B5. notification_log ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_log (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id            text NOT NULL,
  notification_type  text NOT NULL,
  reference_key      text NOT NULL,
  sent_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (band_id, notification_type, reference_key)
);
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- ── B6. live_guest_tokens ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_guest_tokens (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  token       text NOT NULL UNIQUE,
  band_id     text NOT NULL,
  created_by  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date        text NOT NULL DEFAULT '',
  venue       text NOT NULL DEFAULT '',
  time_slot   text NOT NULL DEFAULT '',
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.live_guest_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='live_guest_tokens' AND policyname='lgt_select_all') THEN
    CREATE POLICY lgt_select_all ON public.live_guest_tokens FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='live_guest_tokens' AND policyname='lgt_insert') THEN
    CREATE POLICY lgt_insert ON public.live_guest_tokens FOR INSERT WITH CHECK (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='live_guest_tokens' AND policyname='lgt_delete') THEN
    CREATE POLICY lgt_delete ON public.live_guest_tokens FOR DELETE USING (auth.uid() = created_by);
  END IF;
END $$;

-- ── B7. external_jobs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.external_jobs (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id           text NOT NULL,
  quotation_id      text DEFAULT '',
  source_contract_id text DEFAULT '',
  job_name          text DEFAULT '',
  client_name       text DEFAULT '',
  client_phone      text DEFAULT '',
  venue             text DEFAULT '',
  venue_address     text DEFAULT '',
  event_date        text DEFAULT '',
  start_time        text DEFAULT '',
  end_time          text DEFAULT '',
  show_duration     text DEFAULT '',
  travel_info       jsonb DEFAULT '{}'::jsonb,
  accommodation     jsonb DEFAULT '{}'::jsonb,
  food_info         jsonb DEFAULT '{}'::jsonb,
  total_fee         numeric DEFAULT 0,
  band_fund_cut     numeric DEFAULT 0,
  other_expenses    numeric DEFAULT 0,
  member_fees       jsonb DEFAULT '[]'::jsonb,
  status            text DEFAULT 'confirmed',
  payout_status     text DEFAULT 'pending',
  payout_date       text DEFAULT '',
  notes             text DEFAULT '',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
ALTER TABLE public.external_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ext_jobs_band_date ON public.external_jobs (band_id, event_date);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='external_jobs' AND policyname='ej_band_all') THEN
    CREATE POLICY ej_band_all ON public.external_jobs FOR ALL USING (band_id = public.get_my_band_id());
  END IF;
END $$;

-- ── B8. band_song_refs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.band_song_refs (
  id       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id  text NOT NULL,
  song_id  uuid NOT NULL REFERENCES band_songs(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  UNIQUE (band_id, song_id)
);
CREATE INDEX IF NOT EXISTS idx_bsr_band ON public.band_song_refs(band_id);
ALTER TABLE public.band_song_refs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='band_song_refs' AND policyname='bsr_read') THEN
    CREATE POLICY bsr_read ON public.band_song_refs FOR SELECT USING (band_id = public.get_my_band_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='band_song_refs' AND policyname='bsr_insert') THEN
    CREATE POLICY bsr_insert ON public.band_song_refs FOR INSERT WITH CHECK (band_id = public.get_my_band_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='band_song_refs' AND policyname='bsr_delete') THEN
    CREATE POLICY bsr_delete ON public.band_song_refs FOR DELETE USING (band_id = public.get_my_band_id());
  END IF;
END $$;

-- ── B9. band_requests ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.band_requests (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_name       text NOT NULL,
  province        text NOT NULL DEFAULT '',
  member_count    int NOT NULL DEFAULT 1,
  requester_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name  text NOT NULL DEFAULT '',
  requester_email text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes     text DEFAULT '',
  band_id         uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
ALTER TABLE public.band_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='band_requests' AND policyname='br_insert') THEN
    CREATE POLICY br_insert ON public.band_requests FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='band_requests' AND policyname='br_admin_select') THEN
    CREATE POLICY br_admin_select ON public.band_requests FOR SELECT
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='band_requests' AND policyname='br_self_select') THEN
    CREATE POLICY br_self_select ON public.band_requests FOR SELECT USING (requester_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='band_requests' AND policyname='br_admin_update') THEN
    CREATE POLICY br_admin_update ON public.band_requests FOR UPDATE
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ── B10. artists ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.artists (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  name_normalized text NOT NULL,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT artists_name_normalized_unique UNIQUE (name_normalized)
);
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='artists' AND policyname='art_select') THEN
    CREATE POLICY art_select ON public.artists FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='artists' AND policyname='art_admin_insert') THEN
    CREATE POLICY art_admin_insert ON public.artists FOR INSERT WITH CHECK (public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='artists' AND policyname='art_admin_update') THEN
    CREATE POLICY art_admin_update ON public.artists FOR UPDATE USING (public.is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='artists' AND policyname='art_admin_delete') THEN
    CREATE POLICY art_admin_delete ON public.artists FOR DELETE USING (public.is_admin());
  END IF;
END $$;

-- ── B11. app_config ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  key         text PRIMARY KEY,
  value       text NOT NULL DEFAULT '',
  description text DEFAULT '',
  updated_at  timestamptz DEFAULT now()
);
INSERT INTO public.app_config (key, value, description) VALUES
  ('maintenance_mode', 'false',  'ปิดแอปชั่วคราว (true/false)'),
  ('announce_banner',  '',       'ข้อความแถบประกาศ (ว่าง = ไม่แสดง)'),
  ('announce_type',    'info',   'ประเภทแถบประกาศ: info / warning / error'),
  ('registration_open','true',   'เปิด/ปิดการสมัครใหม่ (true/false)'),
  ('max_bands',        '0',      'จำนวนวงสูงสุดที่อนุญาต (0 = ไม่จำกัด)'),
  ('contact_email',    '',       'อีเมลติดต่อสำหรับแสดงในแอป')
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_config' AND policyname='ac_read') THEN
    CREATE POLICY ac_read ON public.app_config FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_config' AND policyname='ac_admin_write') THEN
    CREATE POLICY ac_admin_write ON public.app_config FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ── B12. activity_log ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log (
  id          serial PRIMARY KEY,
  admin_id    uuid,
  admin_email text DEFAULT '',
  action      text NOT NULL,
  target_type text DEFAULT '',
  target_id   text DEFAULT '',
  details     jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_action_idx ON public.activity_log (action);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_log' AND policyname='al_admin_read') THEN
    CREATE POLICY al_admin_read ON public.activity_log FOR SELECT
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='activity_log' AND policyname='al_admin_insert') THEN
    CREATE POLICY al_admin_insert ON public.activity_log FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ── B13. notification_templates ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  subject    text DEFAULT '',
  body       text DEFAULT '',
  variables  text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);
INSERT INTO public.notification_templates (id, name, subject, body, variables) VALUES
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
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_templates' AND policyname='nt_read') THEN
    CREATE POLICY nt_read ON public.notification_templates FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notification_templates' AND policyname='nt_admin_write') THEN
    CREATE POLICY nt_admin_write ON public.notification_templates FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- PART C: RPC FUNCTIONS
-- ════════════════════════════════════════════════════════════

-- ── normalize_artist_name ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_artist_name(raw TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN lower(regexp_replace(COALESCE(raw, ''), '[\s\-\.\_\,]+', '', 'g'));
END;
$$;

-- ── trigger: auto-normalize artist name ─────────────────────
CREATE OR REPLACE FUNCTION public.trg_normalize_artist()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.name_normalized := normalize_artist_name(NEW.name);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_artists_normalize ON artists;
CREATE TRIGGER trg_artists_normalize
  BEFORE INSERT OR UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION trg_normalize_artist();

-- ── add_artist ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_artist(p_name TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_norm TEXT; v_existing RECORD; v_new RECORD;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'ต้องเป็น admin เท่านั้น');
  END IF;
  v_norm := normalize_artist_name(p_name);
  IF v_norm = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'ชื่อศิลปินว่าง');
  END IF;
  SELECT * INTO v_existing FROM artists WHERE name_normalized = v_norm LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'duplicate', true,
      'message', 'ศิลปินซ้ำกับ "' || v_existing.name || '"',
      'existing', jsonb_build_object('id', v_existing.id, 'name', v_existing.name));
  END IF;
  INSERT INTO artists (name, name_normalized) VALUES (TRIM(p_name), v_norm) RETURNING * INTO v_new;
  RETURN jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_new.id, 'name', v_new.name));
END;
$$;

-- ── search_artists ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_artists(p_query TEXT, p_limit INT DEFAULT 20)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_norm TEXT; v_results JSONB;
BEGIN
  v_norm := normalize_artist_name(p_query);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) ORDER BY a.name), '[]'::jsonb)
  INTO v_results FROM artists a
  WHERE a.name_normalized LIKE '%' || v_norm || '%' OR a.name ILIKE '%' || TRIM(p_query) || '%'
  LIMIT p_limit;
  RETURN jsonb_build_object('success', true, 'data', v_results);
END;
$$;

-- ── submit_band_request ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_band_request(
  p_user_id uuid, p_band_name text, p_province text, p_member_count int, p_name text, p_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_req_id uuid;
BEGIN
  INSERT INTO band_requests (band_name, province, member_count, requester_id, requester_name, requester_email)
  VALUES (p_band_name, p_province, p_member_count, p_user_id, p_name, p_email)
  RETURNING id INTO v_req_id;
  UPDATE profiles SET status = 'pending_band', role = 'manager', band_name = p_band_name WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true, 'request_id', v_req_id, 'message', 'ส่งคำขอสร้างวงเรียบร้อย!');
END;
$$;

-- ── approve_band_request ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_band_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req  band_requests%ROWTYPE;
  v_band bands%ROWTYPE;
  v_code text;
BEGIN
  SELECT * INTO v_req FROM band_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'ไม่พบคำขอ'); END IF;
  IF v_req.status != 'pending' THEN RETURN jsonb_build_object('success', false, 'message', 'คำขอนี้ถูกดำเนินการแล้ว'); END IF;
  INSERT INTO bands (band_name, province, manager_id, manager_email, status)
  VALUES (v_req.band_name, v_req.province, v_req.requester_id, v_req.requester_email, 'active')
  RETURNING * INTO v_band;
  v_code := upper(substr(md5(random()::text), 1, 6));
  INSERT INTO invite_codes (band_id, band_name, province, code, status, created_by)
  VALUES (v_band.id, v_band.band_name, v_band.province, v_code, 'permanent', v_req.requester_id);
  UPDATE profiles SET band_id = v_band.id, band_name = v_band.band_name, province = v_band.province, role = 'manager', status = 'active'
  WHERE id = v_req.requester_id;
  UPDATE band_requests SET status = 'approved', band_id = v_band.id, updated_at = now() WHERE id = p_request_id;
  RETURN jsonb_build_object('success', true, 'band_id', v_band.id, 'band_code', v_code, 'message', 'อนุมัติวงเรียบร้อย');
END;
$$;

-- ── reject_band_request ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_band_request(p_request_id uuid, p_notes text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_req band_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM band_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'ไม่พบคำขอ'); END IF;
  IF v_req.status != 'pending' THEN RETURN jsonb_build_object('success', false, 'message', 'คำขอนี้ถูกดำเนินการแล้ว'); END IF;
  UPDATE band_requests SET status = 'rejected', admin_notes = p_notes, updated_at = now() WHERE id = p_request_id;
  UPDATE profiles SET status = 'rejected_band' WHERE id = v_req.requester_id;
  RETURN jsonb_build_object('success', true, 'message', 'ปฏิเสธคำขอเรียบร้อย');
END;
$$;

-- ── get_pending_band_requests ───────────────────────────────
CREATE OR REPLACE FUNCTION public.get_pending_band_requests()
RETURNS SETOF band_requests LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT * FROM band_requests WHERE status = 'pending' ORDER BY created_at ASC;
END;
$$;

-- ── Equipment image storage bucket ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'equipment-images', 'equipment-images', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='equipment-images: public read') THEN
    CREATE POLICY "equipment-images: public read" ON storage.objects FOR SELECT
      USING (bucket_id = 'equipment-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='equipment-images: auth upload') THEN
    CREATE POLICY "equipment-images: auth upload" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'equipment-images' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='equipment-images: auth update') THEN
    CREATE POLICY "equipment-images: auth update" ON storage.objects FOR UPDATE
      USING (bucket_id = 'equipment-images' AND auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='equipment-images: auth delete') THEN
    CREATE POLICY "equipment-images: auth delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'equipment-images' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- DONE — all migrations applied!
-- ════════════════════════════════════════════════════════════
