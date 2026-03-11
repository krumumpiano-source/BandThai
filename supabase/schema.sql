-- ============================================================
-- Band Management By SoulCiety — Supabase Schema
-- วิธีใช้: วาง SQL นี้ใน Supabase → SQL Editor → Run
-- ============================================================

-- ── Extensions ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES (ต่อจาก auth.users ของ Supabase)
--    เก็บ bandId, bandName, role, status
-- ============================================================
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  user_name       text,
  band_id         text,
  band_name       text,
  role            text default 'manager',   -- manager | member | admin | pending
  status          text default 'active',    -- active | inactive | pending_band | rejected_band
  title           text default '',
  first_name      text default '',
  last_name       text default '',
  nickname        text default '',
  instrument      text default '',
  phone           text default '',
  province        text default '',
  id_card_number  text default '',
  birth_date      date,
  id_card_address jsonb default '{}'::jsonb,
  current_address jsonb default '{}'::jsonb,
  payment_method  text default '',
  payment_account text default '',
  plan_override   text default null check (plan_override in ('free','lite','pro')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.profiles enable row level security;

-- ── Helper functions (security definer = bypass RLS เพื่อป้องกัน infinite recursion) ──
create or replace function public.get_my_band_id()
returns text language sql security definer stable set search_path = public as $$
  select band_id from public.profiles where id = auth.uid()
$$;

create or replace function public.get_my_role()
returns text language sql security definer stable set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ── is_admin() helper ──────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false)
$$;

create policy "profiles: ดูของตัวเอง"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: แก้ไขของตัวเอง"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles: admin ดูทั้งหมด"
  on public.profiles for select
  using (public.get_my_role() = 'admin');

create policy admin_update_all
  on public.profiles for update
  using (public.get_my_role() = 'admin');

create policy admin_delete_all
  on public.profiles for delete
  using (public.get_my_role() = 'admin');

-- trigger: สร้าง profile อัตโนมัติหลัง sign up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, user_name, band_id, band_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'user_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'band_id', ''),
    coalesce(new.raw_user_meta_data->>'band_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'manager'),
    'active'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. BANDS
-- ============================================================
create table if not exists public.bands (
  id            uuid primary key default uuid_generate_v4(),
  band_name     text not null,
  province      text default '',
  manager_id    uuid,
  manager_email text,
  description   text,
  status        text default 'active',
  band_plan     text not null default 'free' check (band_plan in ('free','lite','pro')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table public.bands enable row level security;
create index if not exists idx_bands_band_plan on public.bands (band_plan);

create policy "bands: ดูได้ถ้า login"
  on public.bands for select using (auth.uid() is not null);

create policy "bands: แก้ไขได้เฉพาะ manager"
  on public.bands for update
  using (manager_id = auth.uid());

create policy "bands: สร้างได้ถ้า login"
  on public.bands for insert with check (auth.uid() is not null);

-- ============================================================
-- 3. BAND_MEMBERS
-- ============================================================
create table if not exists public.band_members (
  id                  uuid primary key default uuid_generate_v4(),
  band_id             text not null,
  name                text not null,
  position            text,
  phone               text,
  email               text,
  default_hourly_rate numeric default 0,
  status              text default 'active',
  joined_at           text,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
alter table public.band_members enable row level security;

create policy bm_select on public.band_members for select using (band_id = get_my_band_id());
create policy bm_insert on public.band_members for insert with check (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy bm_update on public.band_members for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy bm_delete on public.band_members for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 4. VENUES
-- ============================================================
create table if not exists public.venues (
  id              uuid primary key default uuid_generate_v4(),
  band_id         text not null,
  venue_name      text not null,
  address         text,
  phone           text,
  contact_person  text,
  default_pay     numeric default 0,
  notes           text,
  status          text default 'active',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.venues enable row level security;

create policy vn_select on public.venues for select using (band_id = get_my_band_id());
create policy vn_insert on public.venues for insert with check (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy vn_update on public.venues for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy vn_delete on public.venues for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 5. SCHEDULE
-- ============================================================
create table if not exists public.schedule (
  id          uuid primary key default uuid_generate_v4(),
  band_id     text not null,
  type        text default 'external',   -- regular | external
  venue_name  text,
  venue_id    text,
  venue       text default '',           -- display name from schedule page
  date        text,
  day_of_week integer,
  time_slots  jsonb default '[]',
  start_time  text,                      -- external gig start
  end_time    text,                      -- external gig end
  price       numeric default 0,         -- external gig price
  description text,
  status      text default 'confirmed',
  total_pay   numeric default 0,
  address     text default '',
  contact     text default '',
  members     jsonb default '[]'::jsonb, -- member UUIDs for external gigs
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.schedule enable row level security;

create policy sch_select on public.schedule for select using (band_id = get_my_band_id());
create policy sch_insert on public.schedule for insert with check (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy sch_update on public.schedule for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy sch_delete on public.schedule for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 6. ATTENDANCE_PAYROLL
-- ============================================================
create table if not exists public.attendance_payroll (
  id                uuid primary key default uuid_generate_v4(),
  band_id           text not null,
  date              text not null,
  venue             text,
  time_slots        jsonb default '[]',
  attendance        jsonb default '{}',
  substitutes       jsonb default '[]',
  price_adjustments jsonb default '[]',
  total_amount      numeric default 0,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
alter table public.attendance_payroll enable row level security;

create policy ap_select on public.attendance_payroll for select using (band_id = get_my_band_id());
create policy ap_insert on public.attendance_payroll for insert with check (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy ap_update on public.attendance_payroll for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy ap_delete on public.attendance_payroll for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 7. BAND_SONGS
-- ============================================================
create table if not exists public.band_songs (
  id          uuid primary key default uuid_generate_v4(),
  band_id     text,
  name        text not null,
  artist      text,
  key         text,
  bpm         text,
  singer      text,
  mood        text,
  era         text,
  tags        text,
  notes       text,
  source      text default 'global',   -- global | band
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.band_songs enable row level security;

create policy "songs: ดูได้ถ้า login"
  on public.band_songs for select using (auth.uid() is not null);

create policy "songs: แก้ไข/ลบเฉพาะวงตัวเอง"
  on public.band_songs for all
  using (band_id = public.get_my_band_id());

-- ============================================================
-- 8. HOURLY_RATES
-- ============================================================
create table if not exists public.hourly_rates (
  id              uuid primary key default uuid_generate_v4(),
  band_id         text not null,
  member_id       text,
  venue_id        text,
  start_time      text,
  end_time        text,
  hourly_rate     numeric default 0,
  effective_from  text,
  effective_to    text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.hourly_rates enable row level security;

create policy hr_select on public.hourly_rates for select using (band_id = get_my_band_id());
create policy hr_insert on public.hourly_rates for insert with check (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy hr_update on public.hourly_rates for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy hr_delete on public.hourly_rates for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 9. EQUIPMENT
-- ============================================================
create table if not exists public.equipment (
  id              uuid primary key default uuid_generate_v4(),
  band_id         text not null,
  name            text not null,
  type            text,
  owner           text,
  serial_no       text,
  purchase_date   text,
  price           numeric default 0,
  status          text default 'active',
  notes           text,
  purchase_source text,
  fund_source     text,
  image_url       text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.equipment enable row level security;

create policy "equipment: เห็นเฉพาะวงตัวเอง"
  on public.equipment for all
  using (band_id = public.get_my_band_id());

-- ============================================================
-- 10. CLIENTS
-- ============================================================
create table if not exists public.clients (
  id              uuid primary key default uuid_generate_v4(),
  band_id         text not null,
  name            text not null,
  company         text,
  contact_person  text,
  phone           text,
  email           text,
  line_id         text,
  address         text,
  notes           text,
  total_gigs      integer default 0,
  total_revenue   numeric default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.clients enable row level security;

create policy cl_select on public.clients for select using (band_id = get_my_band_id());
create policy cl_insert on public.clients for insert with check (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy cl_update on public.clients for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy cl_delete on public.clients for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 11. QUOTATIONS
-- ============================================================
create table if not exists public.quotations (
  id          uuid primary key default uuid_generate_v4(),
  band_id     text not null,
  client_id   text,
  client_name text,
  date        text,
  event_date  text,
  event_type  text,
  venue       text,
  items       jsonb default '[]',
  subtotal    numeric default 0,
  vat         numeric default 0,
  vat_amount  numeric default 0,
  total       numeric default 0,
  status      text default 'draft',
  notes       text,
  doc_url     text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.quotations enable row level security;

create policy qt_select on public.quotations for select using (band_id = get_my_band_id());
create policy qt_insert on public.quotations for insert with check (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy qt_update on public.quotations for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy qt_delete on public.quotations for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 12. INVITE_CODES
-- ============================================================
create table if not exists public.invite_codes (
  id          uuid primary key default uuid_generate_v4(),
  code        text not null unique,
  band_id     text not null,
  band_name   text,
  province    text default '',
  expires_at  timestamptz,
  status      text default 'active',    -- active | permanent | expired
  used_by     text,
  created_by  uuid,
  created_at  timestamptz default now()
);
alter table public.invite_codes enable row level security;

create policy "invite_codes: ดูได้ถ้า login"
  on public.invite_codes for select using (auth.uid() is not null);

create policy "invite_codes: สร้าง/แก้ไขเฉพาะ manager"
  on public.invite_codes for all
  using (
    band_id = public.get_my_band_id()
    and public.get_my_role() in ('manager','admin')
  );

-- ============================================================
-- 13. LEAVE_REQUESTS
-- ============================================================
create table if not exists public.leave_requests (
  id                  uuid primary key default uuid_generate_v4(),
  band_id             text not null,
  member_id           text not null,
  member_name         text,
  date                text not null,
  venue               text,
  slots               text,           -- JSON array e.g. '["19:30-20:30"]'
  reason              text,
  status              text default 'pending',   -- pending | approved | rejected
  substitute_id       text,
  substitute_name     text,
  substitute_contact  text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
alter table public.leave_requests enable row level security;

create policy leave_select on public.leave_requests for select using (band_id = get_my_band_id());
create policy leave_insert on public.leave_requests for insert with check (band_id = get_my_band_id());
create policy leave_update on public.leave_requests for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy leave_delete on public.leave_requests for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 14. MEMBER_CHECK_INS
-- ============================================================
create table if not exists public.member_check_ins (
  id          uuid primary key default uuid_generate_v4(),
  band_id     text not null,
  member_id   text not null,
  member_name text,
  date        text not null,
  venue       text default '',
  slots       jsonb default '[]'::jsonb,
  check_in_at timestamptz,
  status      text default 'present',
  notes       text default '',
  substitute  jsonb,
  created_at  timestamptz default now()
);
alter table public.member_check_ins enable row level security;

create policy "check_ins: เห็นเฉพาะวงตัวเอง"
  on public.member_check_ins for all
  using (band_id = public.get_my_band_id());

-- ============================================================
-- 15. BAND_SETTINGS
-- ============================================================
create table if not exists public.band_settings (
  id        uuid primary key default uuid_generate_v4(),
  band_id   text not null unique,
  settings  jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.band_settings enable row level security;

create policy bs_select on public.band_settings for select using (band_id = get_my_band_id());
create policy bs_insert on public.band_settings for insert with check (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy bs_update on public.band_settings for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy bs_delete on public.band_settings for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 16. PLAYLIST_HISTORY
-- ============================================================
create table if not exists public.playlist_history (
  id          uuid primary key default uuid_generate_v4(),
  band_id     text not null,
  band_name   text,
  date        text,
  venue       text,
  time_slot   text,
  created_by  text,
  playlist    jsonb default '[]',
  created_at  timestamptz default now()
);
alter table public.playlist_history enable row level security;

create policy "playlist_history: เห็นเฉพาะวงตัวเอง"
  on public.playlist_history for all
  using (band_id = public.get_my_band_id());

-- ============================================================
-- 17. SETLISTS
-- ============================================================
create table if not exists public.setlists (
  id          uuid primary key default uuid_generate_v4(),
  band_id     text not null,
  date        text default '',
  sets_data   jsonb default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  constraint setlists_band_date_key unique (band_id, date)
);
alter table public.setlists enable row level security;
create policy "setlists: เห็นเฉพาะวงตัวเอง"
  on public.setlists for all
  using (band_id = public.get_my_band_id());

-- ============================================================
-- 18. FUND_TRANSACTIONS
-- ============================================================
create table if not exists public.fund_transactions (
  id            uuid primary key default uuid_generate_v4(),
  band_id       text not null,
  type          text not null default 'income',
  amount        numeric default 0,
  date          text not null,
  category      text default '',
  description   text default '',
  status        text not null default 'approved',
  submitted_by  text default '',
  approved_by   text default '',
  approved_at   timestamptz,
  reject_reason text default '',
  created_at    timestamptz default now()
);
alter table public.fund_transactions enable row level security;
create index if not exists idx_fund_tx_status on public.fund_transactions (band_id, status);
create policy fund_tx_select on public.fund_transactions for select using (band_id = get_my_band_id());
create policy fund_tx_insert on public.fund_transactions for insert with check (band_id = get_my_band_id());
create policy fund_tx_update on public.fund_transactions for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy fund_tx_delete on public.fund_transactions for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 19. EXTERNAL_PAYOUTS
-- ============================================================
create table if not exists public.external_payouts (
  id          uuid primary key default uuid_generate_v4(),
  band_id     text not null,
  payee_name  text default '',
  payee_type  text default '',
  amount      numeric default 0,
  date        text default '',
  job_id      text default '',
  notes       text default '',
  created_at  timestamptz default now()
);
alter table public.external_payouts enable row level security;
create policy ep_select on public.external_payouts for select using (band_id = get_my_band_id());
create policy ep_insert on public.external_payouts for insert with check (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy ep_update on public.external_payouts for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy ep_delete on public.external_payouts for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 20. SUBSCRIPTIONS (ประวัติการชำระเงิน)
-- ============================================================
create table if not exists public.subscriptions (
  id               uuid primary key default uuid_generate_v4(),
  band_id          uuid not null,
  user_id          uuid not null,
  plan             text not null check (plan in ('lite','pro')),
  amount           integer not null,
  currency         text not null default 'thb',
  omise_charge_id  text,
  status           text not null default 'active' check (status in ('active','expired','cancelled')),
  started_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  created_at       timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create index if not exists idx_subscriptions_band_id on public.subscriptions (band_id);
create index if not exists idx_subscriptions_expires_at on public.subscriptions (expires_at);
create policy "subscriptions: สมาชิกวงดูของวงตัวเอง"
  on public.subscriptions for select
  using (band_id::text = public.get_my_band_id());

-- ============================================================
-- 21. SONG_SUGGESTIONS (แนะนำการแก้ไขเพลง)
-- ============================================================
create table if not exists public.song_suggestions (
  id             uuid primary key default uuid_generate_v4(),
  song_id        uuid not null,
  suggested_by   uuid,
  suggested_name text,
  suggested_data jsonb not null default '{}'::jsonb,
  note           text,
  status         text not null default 'pending',
  admin_note     text,
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  created_at     timestamptz default now()
);
alter table public.song_suggestions enable row level security;
create index if not exists idx_song_suggestions_status on public.song_suggestions(status);
create index if not exists idx_song_suggestions_song on public.song_suggestions(song_id);
create policy "song_suggestions: authenticated read"
  on public.song_suggestions for select using (auth.uid() is not null);
create policy "song_suggestions: authenticated insert"
  on public.song_suggestions for insert with check (auth.uid() is not null);
create policy "song_suggestions: authenticated update"
  on public.song_suggestions for update using (auth.uid() is not null);

-- ============================================================
-- 22. PROMO_CODES
-- ============================================================
create table if not exists public.promo_codes (
  id               serial primary key,
  code             text unique not null,
  plan             text not null default 'lite' check (plan in ('lite','pro')),
  months           int not null default 1 check (months > 0),
  discount_percent int not null default 0 check (discount_percent between 0 and 100),
  max_uses         int default null,
  used_count       int not null default 0,
  expires_at       timestamptz default null,
  active           bool not null default true,
  note             text default '',
  created_at       timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
create policy "promo_codes: public read"
  on public.promo_codes for select using (true);
create policy "promo_codes: admin write"
  on public.promo_codes for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- 23. PUSH_SUBSCRIPTIONS
-- ============================================================
create table if not exists public.push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null,
  band_id     text not null,
  endpoint    text not null,
  p256dh      text not null,
  auth_key    text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
create policy "push_sub: user sees own"
  on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_sub: user inserts own"
  on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_sub: user deletes own"
  on public.push_subscriptions for delete using (auth.uid() = user_id);
create policy "push_sub: user updates own"
  on public.push_subscriptions for update using (auth.uid() = user_id);

-- ============================================================
-- 24. NOTIFICATION_LOG
-- ============================================================
create table if not exists public.notification_log (
  id                 uuid primary key default uuid_generate_v4(),
  band_id            text not null,
  notification_type  text not null,
  reference_key      text not null,
  sent_at            timestamptz not null default now(),
  unique (band_id, notification_type, reference_key)
);
alter table public.notification_log enable row level security;

-- ============================================================
-- 25. LIVE_GUEST_TOKENS
-- ============================================================
create table if not exists public.live_guest_tokens (
  id          uuid primary key default uuid_generate_v4(),
  token       text not null unique,
  band_id     text not null,
  created_by  uuid,
  date        text not null default '',
  venue       text not null default '',
  time_slot   text not null default '',
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table public.live_guest_tokens enable row level security;
create policy "lgt: select all"
  on public.live_guest_tokens for select using (true);
create policy "lgt: insert own"
  on public.live_guest_tokens for insert with check (auth.uid() = created_by);
create policy "lgt: delete own"
  on public.live_guest_tokens for delete using (auth.uid() = created_by);

-- ============================================================
-- 26. EXTERNAL_JOBS (งานนอก)
-- ============================================================
create table if not exists public.external_jobs (
  id                uuid primary key default uuid_generate_v4(),
  band_id           text not null,
  quotation_id      text default '',
  source_contract_id text default '',
  job_name          text default '',
  client_name       text default '',
  client_phone      text default '',
  venue             text default '',
  venue_address     text default '',
  event_date        text default '',
  start_time        text default '',
  end_time          text default '',
  show_duration     text default '',
  travel_info       jsonb default '{}'::jsonb,
  accommodation     jsonb default '{}'::jsonb,
  food_info         jsonb default '{}'::jsonb,
  total_fee         numeric default 0,
  band_fund_cut     numeric default 0,
  other_expenses    numeric default 0,
  member_fees       jsonb default '[]'::jsonb,
  status            text default 'confirmed',
  payout_status     text default 'pending',
  payout_date       text default '',
  notes             text default '',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
alter table public.external_jobs enable row level security;
create index if not exists idx_ext_jobs_band_date on public.external_jobs (band_id, event_date);
create policy ej_select on public.external_jobs for select using (band_id = get_my_band_id());
create policy ej_insert on public.external_jobs for insert with check (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy ej_update on public.external_jobs for update using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));
create policy ej_delete on public.external_jobs for delete using (band_id = get_my_band_id() and get_my_role() in ('manager','admin'));

-- ============================================================
-- 27. BAND_SONG_REFS (junction table)
-- ============================================================
create table if not exists public.band_song_refs (
  id       uuid primary key default uuid_generate_v4(),
  band_id  text not null,
  song_id  uuid not null references band_songs(id) on delete cascade,
  added_at timestamptz default now(),
  unique (band_id, song_id)
);
alter table public.band_song_refs enable row level security;
create index if not exists idx_bsr_band on public.band_song_refs(band_id);
create policy "bsr: read own band"
  on public.band_song_refs for select using (band_id = public.get_my_band_id());
create policy "bsr: insert own band"
  on public.band_song_refs for insert with check (band_id = public.get_my_band_id());
create policy "bsr: delete own band"
  on public.band_song_refs for delete using (band_id = public.get_my_band_id());

-- ============================================================
-- 28. BAND_REQUESTS (ขอสร้างวงใหม่)
-- ============================================================
create table if not exists public.band_requests (
  id              uuid primary key default uuid_generate_v4(),
  band_name       text not null,
  province        text not null default '',
  member_count    int not null default 1,
  requester_id    uuid,
  requester_name  text not null default '',
  requester_email text not null default '',
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_notes     text default '',
  band_id         uuid,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.band_requests enable row level security;
create policy "band_requests: insert"
  on public.band_requests for insert with check (true);
create policy "band_requests: admin select"
  on public.band_requests for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "band_requests: self select"
  on public.band_requests for select using (requester_id = auth.uid());
create policy "band_requests: admin update"
  on public.band_requests for update
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- 29. ARTISTS (ศิลปินระดับระบบ)
-- ============================================================
create table if not exists public.artists (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  name_normalized text not null,
  created_at      timestamptz default now(),
  constraint artists_name_normalized_unique unique (name_normalized)
);
alter table public.artists enable row level security;
create policy "artists: select"
  on public.artists for select using (auth.uid() is not null);
create policy "artists: admin insert"
  on public.artists for insert with check (public.is_admin());
create policy "artists: admin update"
  on public.artists for update using (public.is_admin());
create policy "artists: admin delete"
  on public.artists for delete using (public.is_admin());

-- ============================================================
-- 30. APP_CONFIG
-- ============================================================
create table if not exists public.app_config (
  key         text primary key,
  value       text not null default '',
  description text default '',
  updated_at  timestamptz default now()
);
alter table public.app_config enable row level security;
create policy "app_config: read"
  on public.app_config for select using (true);
create policy "app_config: admin write"
  on public.app_config for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- 31. ACTIVITY_LOG
-- ============================================================
create table if not exists public.activity_log (
  id          serial primary key,
  admin_id    uuid,
  admin_email text default '',
  action      text not null,
  target_type text default '',
  target_id   text default '',
  details     jsonb default '{}',
  created_at  timestamptz default now()
);
alter table public.activity_log enable row level security;
create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);
create index if not exists activity_log_action_idx on public.activity_log (action);
create policy "activity_log: admin read"
  on public.activity_log for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "activity_log: admin insert"
  on public.activity_log for insert
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- 32. NOTIFICATION_TEMPLATES
-- ============================================================
create table if not exists public.notification_templates (
  id         text primary key,
  name       text not null,
  subject    text default '',
  body       text default '',
  variables  text[] default '{}',
  updated_at timestamptz default now()
);
alter table public.notification_templates enable row level security;
create policy "notif_templates: read"
  on public.notification_templates for select using (true);
create policy "notif_templates: admin write"
  on public.notification_templates for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ============================================================
-- FUNCTIONS — custom RPC สำหรับ invite code
-- ============================================================

-- redeem_invite_code(code, user_id)
create or replace function public.redeem_invite_code(p_code text, p_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_invite public.invite_codes%rowtype;
  v_used   text;
begin
  -- ค้นหา code
  select * into v_invite
  from public.invite_codes
  where upper(code) = upper(p_code) and status = 'active'
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'ไม่พบรหัสเชิญหรือหมดอายุแล้ว');
  end if;

  if v_invite.expires_at < now() then
    update public.invite_codes set status = 'expired' where id = v_invite.id;
    return jsonb_build_object('success', false, 'message', 'รหัสเชิญหมดอายุแล้ว');
  end if;

  -- อัปเดต profile ของ user
  update public.profiles
  set band_id   = v_invite.band_id,
      band_name = v_invite.band_name,
      role      = 'member'
  where id = p_user_id;

  -- บันทึกการใช้ code
  v_used := coalesce(v_invite.used_by, '') || case when v_invite.used_by is not null then ',' else '' end || p_user_id::text;
  update public.invite_codes set used_by = v_used where id = v_invite.id;

  return jsonb_build_object(
    'success',   true,
    'band_id',   v_invite.band_id,
    'band_name', v_invite.band_name,
    'message',   'เข้าร่วมวงสำเร็จ!'
  );
end;
$$;

-- generate_invite_code(band_id, band_name)
create or replace function public.generate_invite_code(p_band_id text, p_band_name text)
returns jsonb language plpgsql security definer as $$
declare
  v_code    text := '';
  v_chars   text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_expires timestamptz := now() + interval '7 days';
  i         integer;
begin
  -- สร้าง random code 6 ตัว
  for i in 1..6 loop
    v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
  end loop;

  insert into public.invite_codes (code, band_id, band_name, expires_at, status)
  values (v_code, p_band_id, p_band_name, v_expires, 'active');

  return jsonb_build_object(
    'success',    true,
    'code',       v_code,
    'band_id',    p_band_id,
    'band_name',  p_band_name,
    'expires_at', v_expires
  );
end;
$$;

-- ============================================================
-- DONE — schema พร้อมใช้งาน
-- ============================================================

-- ============================================================
-- ARTIST FUNCTIONS
-- ============================================================

-- normalize_artist_name
create or replace function public.normalize_artist_name(raw text)
returns text language plpgsql immutable as $$
begin
  return lower(regexp_replace(coalesce(raw, ''), '[\s\-\.\_\,]+', '', 'g'));
end;
$$;

-- trigger: auto-normalize artist name
create or replace function public.trg_normalize_artist()
returns trigger language plpgsql as $$
begin
  new.name_normalized := normalize_artist_name(new.name);
  return new;
end;
$$;

drop trigger if exists trg_artists_normalize on artists;
create trigger trg_artists_normalize
  before insert or update on artists
  for each row execute function trg_normalize_artist();

-- add_artist RPC
create or replace function public.add_artist(p_name text)
returns jsonb language plpgsql security definer as $$
declare
  v_norm text;
  v_existing record;
  v_new record;
begin
  if not is_admin() then
    return jsonb_build_object('success', false, 'message', 'ต้องเป็น admin เท่านั้น');
  end if;
  v_norm := normalize_artist_name(p_name);
  if v_norm = '' then
    return jsonb_build_object('success', false, 'message', 'ชื่อศิลปินว่าง');
  end if;
  select * into v_existing from artists where name_normalized = v_norm limit 1;
  if found then
    return jsonb_build_object('success', false, 'duplicate', true,
      'message', 'ศิลปินซ้ำกับ "' || v_existing.name || '"',
      'existing', jsonb_build_object('id', v_existing.id, 'name', v_existing.name));
  end if;
  insert into artists (name, name_normalized) values (trim(p_name), v_norm) returning * into v_new;
  return jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_new.id, 'name', v_new.name));
end;
$$;

-- search_artists RPC
create or replace function public.search_artists(p_query text, p_limit int default 20)
returns jsonb language plpgsql security definer as $$
declare
  v_norm text;
  v_results jsonb;
begin
  v_norm := normalize_artist_name(p_query);
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) order by a.name), '[]'::jsonb)
  into v_results
  from artists a
  where a.name_normalized like '%' || v_norm || '%'
     or a.name ilike '%' || trim(p_query) || '%'
  limit p_limit;
  return jsonb_build_object('success', true, 'data', v_results);
end;
$$;

-- ============================================================
-- BAND REQUEST FUNCTIONS
-- ============================================================

-- submit_band_request
create or replace function public.submit_band_request(
  p_user_id uuid, p_band_name text, p_province text, p_member_count int, p_name text, p_email text
) returns jsonb language plpgsql security definer as $$
declare v_req_id uuid;
begin
  insert into band_requests (band_name, province, member_count, requester_id, requester_name, requester_email)
  values (p_band_name, p_province, p_member_count, p_user_id, p_name, p_email)
  returning id into v_req_id;
  update profiles set status = 'pending_band', role = 'manager', band_name = p_band_name where id = p_user_id;
  return jsonb_build_object('success', true, 'request_id', v_req_id, 'message', 'ส่งคำขอสร้างวงเรียบร้อย! กรุณารอแอดมินอนุมัติ');
end;
$$;

-- approve_band_request
create or replace function public.approve_band_request(p_request_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_req   band_requests%rowtype;
  v_band  bands%rowtype;
  v_code  text;
begin
  select * into v_req from band_requests where id = p_request_id;
  if not found then return jsonb_build_object('success', false, 'message', 'ไม่พบคำขอ'); end if;
  if v_req.status != 'pending' then return jsonb_build_object('success', false, 'message', 'คำขอนี้ถูกดำเนินการแล้ว'); end if;
  insert into bands (band_name, province, manager_id, manager_email, status)
  values (v_req.band_name, v_req.province, v_req.requester_id, v_req.requester_email, 'active')
  returning * into v_band;
  v_code := upper(substr(md5(random()::text), 1, 6));
  insert into invite_codes (band_id, band_name, province, code, status, created_by)
  values (v_band.id, v_band.band_name, v_band.province, v_code, 'permanent', v_req.requester_id);
  update profiles set band_id = v_band.id, band_name = v_band.band_name, province = v_band.province, role = 'manager', status = 'active'
  where id = v_req.requester_id;
  update band_requests set status = 'approved', band_id = v_band.id, updated_at = now() where id = p_request_id;
  return jsonb_build_object('success', true, 'band_id', v_band.id, 'band_code', v_code, 'message', 'อนุมัติวง "' || v_band.band_name || '" เรียบร้อย');
end;
$$;

-- reject_band_request
create or replace function public.reject_band_request(p_request_id uuid, p_notes text default '')
returns jsonb language plpgsql security definer as $$
declare v_req band_requests%rowtype;
begin
  select * into v_req from band_requests where id = p_request_id;
  if not found then return jsonb_build_object('success', false, 'message', 'ไม่พบคำขอ'); end if;
  if v_req.status != 'pending' then return jsonb_build_object('success', false, 'message', 'คำขอนี้ถูกดำเนินการแล้ว'); end if;
  update band_requests set status = 'rejected', admin_notes = p_notes, updated_at = now() where id = p_request_id;
  update profiles set status = 'rejected_band' where id = v_req.requester_id;
  return jsonb_build_object('success', true, 'message', 'ปฏิเสธคำขอเรียบร้อย');
end;
$$;

-- get_pending_band_requests
create or replace function public.get_pending_band_requests()
returns setof band_requests language plpgsql security definer as $$
begin
  return query select * from band_requests where status = 'pending' order by created_at asc;
end;
$$;
