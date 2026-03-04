-- ============================================================
-- MIGRATE: external_jobs — งานนอก (ขั้นตอนสุดท้ายหลัง contract)
-- วิธีใช้: วาง SQL นี้ใน Supabase → SQL Editor → Run
-- ============================================================

-- ── 1. สร้างตาราง external_jobs ────────────────────────────
create table if not exists public.external_jobs (
  id                uuid    primary key default uuid_generate_v4(),
  band_id           text    not null,

  -- เชื่อมกับระบบ quotation / contract
  quotation_id      text    default '',
  source_contract_id text   default '',

  -- ข้อมูลงาน
  job_name          text    default '',
  client_name       text    default '',
  client_phone      text    default '',
  venue             text    default '',
  venue_address     text    default '',
  event_date        text    default '',   -- YYYY-MM-DD
  start_time        text    default '',   -- HH:MM
  end_time          text    default '',   -- HH:MM
  show_duration     text    default '',   -- "3 ชั่วโมง 2 รอบ"

  -- การเดินทาง
  travel_info       jsonb   default '{}'::jsonb,
  -- { origin, destination, distanceKm, vehicles:[{type,fuel,seats}], travelCost }

  -- ที่พัก
  accommodation     jsonb   default '{}'::jsonb,
  -- { hasAccom, hotel, rooms, nights, accomCost }

  -- ค่าใช้จ่ายอาหาร
  food_info         jsonb   default '{}'::jsonb,
  -- { hasFood, people, meals, days, foodCost }

  -- การเงิน
  total_fee         numeric default 0,    -- ราคาที่ได้รับจากลูกค้า
  band_fund_cut     numeric default 0,    -- หักกองกลาง
  other_expenses    numeric default 0,    -- ค่าใช้จ่ายอื่น (travel+accom+food)

  -- ค่าตัวสมาชิก (JSONB array)
  member_fees       jsonb   default '[]'::jsonb,
  -- [{memberId, name, instrument, fee, paid, paidDate, paymentMethod}]

  -- สถานะ
  status            text    default 'confirmed',  -- confirmed | completed | cancelled
  payout_status     text    default 'pending',    -- pending | partial | paid

  payout_date       text    default '',
  notes             text    default '',

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table public.external_jobs enable row level security;

create policy "external_jobs: เห็นเฉพาะวงตัวเอง"
  on public.external_jobs for all
  using (band_id = public.get_my_band_id());

-- ── 2. Index สำหรับ query เร็ว ───────────────────────────────
create index if not exists idx_ext_jobs_band_date
  on public.external_jobs (band_id, event_date);

-- ── DONE ────────────────────────────────────────────────────
