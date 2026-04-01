-- line_chat_entries: เก็บข้อมูลที่ได้จากการ parse template ใน LINE group
create table if not exists public.line_chat_entries (
  id                    uuid primary key default gen_random_uuid(),
  venue_line_config_id  uuid not null references public.venue_line_config(id) on delete cascade,
  date                  date not null,
  break_num             smallint not null check (break_num between 1 and 4),
  entry_text            text not null,
  sender_name           text,
  created_at            timestamptz not null default now()
);

-- index สำหรับ query รายวัน
create index if not exists line_chat_entries_date_idx
  on public.line_chat_entries (venue_line_config_id, date);

-- RLS
alter table public.line_chat_entries enable row level security;

-- service role (Edge Function) write
create policy "service role can insert line_chat_entries"
  on public.line_chat_entries for insert
  with check (true);

-- admin read
create policy "admin can read line_chat_entries"
  on public.line_chat_entries for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
