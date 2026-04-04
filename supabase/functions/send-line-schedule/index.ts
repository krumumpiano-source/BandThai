// Supabase Edge Function — send-line-schedule
// Deno runtime. Called by pg_cron at 23:30 (daily) and Monday 08:00 (weekly).
// Sends LINE group message with break schedule from member_check_ins + band_settings.
//
// Modes:
//   daily   — รายงานประจำวัน (23:30 ทุกวัน)
//   weekly  — สรุปประจำสัปดาห์ (08:00 ทุกวันจันทร์)
//   test    — ทดสอบส่ง (ไม่กรอง quota)
//   preview — ดูตัวอย่างข้อความโดยไม่ส่งจริง

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const LINE_API = 'https://api.line.me/v2/bot/message/push';
const QUOTA_LIMIT = 200;
const QUOTA_WARN  = 190; // หยุดส่งอัตโนมัติเมื่อเหลือ 10

// ── Thai time helpers ──────────────────────────────────────────────────────
function thaiNow(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 420); // UTC+7
  return d;
}

function toThaiDateStr(d: Date): string {
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

const THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
];
const THAI_DAYS_FULL  = ['วันอาทิตย์','วันจันทร์','วันอังคาร','วันพุธ','วันพฤหัสบดี','วันศุกร์','วันเสาร์'];
const THAI_DAYS_SHORT = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];

function formatThaiDate(dateStr: string): string {
  // dateStr = "YYYY-MM-DD"
  const [y, m, d] = dateStr.split('-').map(Number);
  const be = y + 543;
  const dow = new Date(dateStr + 'T12:00:00Z').getDay();
  return `${THAI_DAYS_FULL[dow]} ที่ ${d} ${THAI_MONTHS[m - 1]} ${be}`;
}

function formatThaiDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(dateStr + 'T12:00:00Z').getDay();
  return `${THAI_DAYS_SHORT[dow]} ${d}/${m}`;
}

function formatThaiDateRange(startStr: string, endStr: string): string {
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [, em, ed] = endStr.split('-').map(Number);
  const be = sy + 543;
  if (sm === em) {
    return `${sd}–${ed} ${THAI_MONTHS[sm - 1]} ${be}`;
  }
  return `${sd} ${THAI_MONTHS[sm - 1]} – ${ed} ${THAI_MONTHS[em - 1]} ${be}`;
}

function formatTime(t: string): string {
  // "18:00" → "18.00"
  return t.replace(':', '.');
}

function formatThaiDateBE(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const be = (y + 543) % 100;
  const dow = new Date(dateStr + 'T12:00:00Z').getDay();
  return `${THAI_DAYS_FULL[dow]} ที่ ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${String(be).padStart(2,'0')}`;
}

// ── Quota check ────────────────────────────────────────────────────────────
async function getMonthlyCount(configId: string): Promise<number> {
  const now = thaiNow();
  const monthStart = now.toISOString().slice(0, 7) + '-01'; // YYYY-MM-01
  const { count } = await sb
    .from('line_message_log')
    .select('*', { count: 'exact', head: true })
    .eq('venue_line_config_id', configId)
    .eq('success', true)
    .gte('sent_at', monthStart);
  return count ?? 0;
}

// ── Log message ────────────────────────────────────────────────────────────
async function logMessage(configId: string, type: string, text: string, code: number, ok: boolean, errMsg?: string) {
  await sb.from('line_message_log').insert({
    venue_line_config_id: configId,
    message_type: type,
    message_text: text.slice(0, 4000),
    line_response_code: code,
    success: ok,
    error_message: errMsg ?? null,
  });
}

// ── Send to LINE ───────────────────────────────────────────────────────────
async function sendLineMessage(token: string, groupId: string, text: string): Promise<{ code: number; ok: boolean; error?: string }> {
  try {
    const res = await fetch(LINE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: groupId,
        messages: [{ type: 'text', text }],
      }),
    });
    if (res.ok) return { code: res.status, ok: true };
    const body = await res.text();
    return { code: res.status, ok: false, error: body.slice(0, 200) };
  } catch (e) {
    return { code: 0, ok: false, error: String(e) };
  }
}

// ── Reply to LINE (uses replyToken — FREE, no quota) ───────────────────────
async function replyLineMessage(token: string, replyToken: string, text: string): Promise<void> {
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
    });
  } catch (e) {
    console.error('[LINE-REPLY] Error:', e);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ── Schedule Entry System (venue_schedule_entries) ──────────────────────
// ══════════════════════════════════════════════════════════════════════════

interface ScheduleEntry {
  date: string;
  break_number: number;
  break_start: string;
  break_end: string;
  band_name: string;
  member_count: number;
}

// ── Parse LINE message → ScheduleEntry[] ────────────────────────────────
// Parses: วันXXX ที่ DD/MM/YY  →  * เบรค N (HH.MM-HH.MM)  →  =band count คน
function parseScheduleMessage(text: string): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const lines = text.split('\n');
  let currentDate = '';
  let pendingBreak: { number: number; start: string; end: string } | null = null;

  for (const line of lines) {
    const t = line.trim();

    // Date: วันXXX ที่ DD/MM/YY
    const dateM = t.match(/วัน\S+\s+ที่\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (dateM) {
      // Flush pending
      if (pendingBreak && currentDate) {
        entries.push({ date: currentDate, break_number: pendingBreak.number, break_start: pendingBreak.start, break_end: pendingBreak.end, band_name: '', member_count: 0 });
        pendingBreak = null;
      }
      const day = parseInt(dateM[1]);
      const month = parseInt(dateM[2]);
      let year = parseInt(dateM[3]);
      if (year < 100) year += 1957;        // 69 → 2026
      else if (year > 2500) year -= 543;   // 2569 → 2026
      currentDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      continue;
    }

    // Break: * เบรค N (HH.MM-HH.MM)
    const brM = t.match(/\*\s*เบรค\s*(\d)\s*\(\s*(\d{1,2}[\.:]\d{2})\s*-\s*(\d{1,2}[\.:]\d{2})\s*\)/);
    if (brM) {
      // Flush previous pending break
      if (pendingBreak && currentDate) {
        entries.push({ date: currentDate, break_number: pendingBreak.number, break_start: pendingBreak.start, break_end: pendingBreak.end, band_name: '', member_count: 0 });
      }
      pendingBreak = {
        number: parseInt(brM[1]),
        start: brM[2].replace('.', ':'),
        end: brM[3].replace('.', ':'),
      };
      continue;
    }

    // Assignment: = [band] [count] [คน[ครับ]]
    if (t.startsWith('=') && currentDate && pendingBreak) {
      const assign = t.substring(1).trim();
      let bandName = '';
      let memberCount = 0;
      if (assign && !/^อ๊อฟ$|^off$/i.test(assign)) {
        const cm = assign.match(/^(.+?)[\s]*(\d+)\s*(?:คน.*)?$/);
        if (cm) {
          bandName = cm[1].trim();
          memberCount = parseInt(cm[2]);
        } else {
          bandName = assign;
        }
      }
      entries.push({
        date: currentDate,
        break_number: pendingBreak.number,
        break_start: pendingBreak.start,
        break_end: pendingBreak.end,
        band_name: bandName,
        member_count: memberCount,
      });
      pendingBreak = null;
      continue;
    }
  }
  // Flush last pending
  if (pendingBreak && currentDate) {
    entries.push({ date: currentDate, break_number: pendingBreak.number, break_start: pendingBreak.start, break_end: pendingBreak.end, band_name: '', member_count: 0 });
  }
  return entries;
}

// ── UPSERT entries → venue_schedule_entries ─────────────────────────────
async function upsertScheduleEntries(entries: ScheduleEntry[], source: string, updatedBy: string): Promise<void> {
  for (const e of entries) {
    await sb.from('venue_schedule_entries').upsert({
      venue_name: 'ร้านนิยมสุข',
      date: e.date,
      break_number: e.break_number,
      break_start: e.break_start,
      break_end: e.break_end,
      band_name: e.band_name,
      member_count: e.member_count,
      source,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'venue_name,date,break_number' });
  }
}

// ── Sync SoulCiety check-ins → venue_schedule_entries ───────────────────
async function syncSoulCietyCheckins(dateStr: string, bandIds: string[]): Promise<void> {
  const { data: bands } = await sb.from('bands').select('id, band_name').in('id', bandIds);
  const scBand = (bands || []).find((b: { id: string; band_name: string }) => /soulciety/i.test(b.band_name));
  if (!scBand) return;

  const { data: checkIns } = await sb
    .from('member_check_ins')
    .select('member_id, slots')
    .eq('date', dateStr)
    .eq('band_id', scBand.id)
    .neq('status', 'leave');

  if (!checkIns?.length) return;

  const dow = new Date(dateStr + 'T12:00:00Z').getDay();
  const { data: bs } = await sb.from('band_settings').select('settings').eq('band_id', scBand.id).maybeSingle();
  const sched = bs?.settings?.schedule || {};
  const daySlots = ((sched[dow] ?? sched[String(dow)] ?? []) as Array<{ startTime?: string; endTime?: string }>)
    .filter(sl => sl.startTime && sl.endTime)
    .sort((a, b) => (a.startTime! > b.startTime! ? 1 : -1));

  for (let i = 0; i < daySlots.length; i++) {
    const sl = daySlots[i];
    const range = `${sl.startTime}-${sl.endTime}`;
    const count = checkIns.filter((ci: { member_id: string; slots: string[] }) => {
      const s = Array.isArray(ci.slots) ? ci.slots : [];
      return s.includes(range);
    }).length;

    if (count > 0) {
      await sb.from('venue_schedule_entries').upsert({
        venue_name: 'ร้านนิยมสุข',
        date: dateStr,
        break_number: i + 1,
        break_start: sl.startTime,
        break_end: sl.endTime,
        band_name: scBand.band_name || 'SoulCiety',
        member_count: count,
        source: 'checkin',
        updated_by: 'system',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'venue_name,date,break_number' });
    }
  }
}

// ── Get current week Mon→Sun dates ─────────────────────────────────────
function getWeekDates(thai: Date): string[] {
  const today = new Date(thai);
  const dayOfWeek = today.getDay(); // 0=Sun … 6=Sat
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(toThaiDateStr(d));
  }
  return dates;
}

// ── Fetch week schedule from venue_schedule_entries ─────────────────────
interface DayBreakData {
  date: string;
  breaks: Array<{ number: number; start: string; end: string; band_name: string; member_count: number }>;
}

async function fetchWeekSchedule(weekDates: string[], bandIds: string[]): Promise<DayBreakData[]> {
  const { data: entries } = await sb
    .from('venue_schedule_entries')
    .select('*')
    .eq('venue_name', 'ร้านนิยมสุข')
    .in('date', weekDates)
    .order('break_number');

  // Get default break times from band_settings
  let defaultBreaks: Array<{ number: number; start: string; end: string }> = [];
  if (bandIds.length > 0) {
    const { data: bsList } = await sb.from('band_settings').select('settings').in('band_id', bandIds).limit(1);
    if (bsList?.[0]?.settings?.schedule) {
      const sched = bsList[0].settings.schedule;
      for (let dow = 0; dow < 7; dow++) {
        const slots = sched[dow] || sched[String(dow)] || [];
        if (slots.length > 0) {
          defaultBreaks = slots
            .filter((sl: { startTime?: string; endTime?: string }) => sl.startTime && sl.endTime)
            .sort((a: { startTime: string }, b: { startTime: string }) => a.startTime > b.startTime ? 1 : -1)
            .map((sl: { startTime: string; endTime: string }, i: number) => ({ number: i + 1, start: sl.startTime, end: sl.endTime }));
          break;
        }
      }
    }
  }
  if (defaultBreaks.length === 0) {
    defaultBreaks = [
      { number: 1, start: '18:00', end: '19:00' },
      { number: 2, start: '19:30', end: '20:30' },
      { number: 3, start: '21:00', end: '22:00' },
      { number: 4, start: '22:30', end: '23:30' },
    ];
  }

  const entryMap: Record<string, Record<number, { break_start: string; break_end: string; band_name: string; member_count: number }>> = {};
  for (const e of entries || []) {
    if (!entryMap[e.date]) entryMap[e.date] = {};
    entryMap[e.date][e.break_number] = e;
  }

  return weekDates.map(dateStr => {
    const dayEntries = entryMap[dateStr] || {};
    return {
      date: dateStr,
      breaks: defaultBreaks.map(db => {
        const entry = dayEntries[db.number];
        return {
          number: db.number,
          start: entry?.break_start || db.start,
          end: entry?.break_end || db.end,
          band_name: entry?.band_name || '',
          member_count: entry?.member_count || 0,
        };
      }),
    };
  });
}

// ── Format weekly overview (ส่งทุกวัน แสดงทั้งสัปดาห์ จ.-อา.) ──────────
function formatWeeklyOverview(data: DayBreakData[], footer: string): string {
  const sep = '━━━━━━━━━━━━━━━━━━━━━━';
  const lines: string[] = [];

  lines.push(sep);
  lines.push('📋 รายงานประจำวัน');
  lines.push('ร้านนิยมสุข');
  lines.push(sep);

  for (const day of data) {
    lines.push('');
    lines.push(formatThaiDateBE(day.date));
    lines.push('');
    for (const br of day.breaks) {
      lines.push(`* เบรค ${br.number} (${formatTime(br.start)}-${formatTime(br.end)})`);
      if (br.band_name && br.member_count > 0) {
        lines.push(`=${br.band_name} ${br.member_count} คนครับ`);
      } else {
        lines.push('=');
      }
    }
  }

  lines.push('');
  lines.push(sep);
  lines.push(footer || 'ส่งโดยระบบอัตโนมัติจากโปรแกรม BandThai');
  lines.push(sep);
  return lines.join('\n');
}

// ── Fetch schedule slots for a specific date across multiple bands ─────────
// Returns sorted break slots with check-in members
async function fetchDayData(dateStr: string, bandIds: string[]): Promise<BreakSlot[]> {
  if (!bandIds.length) return [];

  // Day of week (0=Sun … 6=Sat) from date string
  const dow = new Date(dateStr + 'T12:00:00Z').getDay();

  // Get all band settings for the involved bands
  const { data: bandSettings } = await sb
    .from('band_settings')
    .select('band_id, settings')
    .in('band_id', bandIds);

  if (!bandSettings?.length) return [];

  // Collect all schedule slots across bands, tagged with band info
  const allSlotsByBand: Array<{
    bandId: string;
    bandName: string;
    venues: Array<{ id: string; name: string }>;
    slots: Array<{ id: string; venueId: string; startTime: string; endTime: string; memberIds: string[] }>;
  }> = [];

  for (const bs of bandSettings) {
    const s = bs.settings || {};
    const schedTemplate: Record<string, unknown[]> = s.schedule || {};
    const daySlots = (schedTemplate[dow] ?? schedTemplate[String(dow)] ?? []) as Array<{
      id?: string; venueId?: string; startTime?: string; endTime?: string;
      members?: Array<{ memberId: string }>;
    }>;

    if (!daySlots.length) continue;

    // Get band name
    const { data: bandRow } = await sb.from('bands').select('band_name').eq('id', bs.band_id).maybeSingle();
    const bandName = bandRow?.band_name || 'ไม่ทราบชื่อวง';
    const rawVenues = Array.isArray(s.venues) ? s.venues : [];
    const venues: Array<{ id: string; name: string }> = rawVenues.map(
      (v: Record<string, string>) => ({ id: v.id || '', name: v.name || v.venueName || '' })
    );

    allSlotsByBand.push({
      bandId: bs.band_id,
      bandName,
      venues,
      slots: daySlots.map(sl => ({
        id: sl.id || `${bs.band_id}_${sl.startTime}`,
        venueId: sl.venueId || '',
        startTime: sl.startTime || '',
        endTime: sl.endTime || '',
        memberIds: (sl.members || []).map((m: { memberId: string }) => m.memberId),
      })),
    });
  }

  // Fetch actual check-ins for this date across all bands
  const { data: checkIns } = await sb
    .from('member_check_ins')
    .select('member_id, band_id, slots, status')
    .eq('date', dateStr)
    .in('band_id', bandIds)
    .neq('status', 'leave');

  // Build a map: memberKey → { memberId, bandId }
  // checkIn.slots is array of strings like "18:00-19:00"
  const checkedInBySlotKey: Record<string, string[]> = {}; // "18:00-19:00_bandId" → [memberId,...]
  for (const ci of checkIns || []) {
    const slots: string[] = Array.isArray(ci.slots) ? ci.slots : [];
    for (const slotStr of slots) {
      const key = `${slotStr}_${ci.band_id}`;
      if (!checkedInBySlotKey[key]) checkedInBySlotKey[key] = [];
      checkedInBySlotKey[key].push(ci.member_id);
    }
  }

  // Fetch all member nicknames + instruments for all band members
  const allMemberIds = new Set<string>();
  for (const b of allSlotsByBand) {
    for (const sl of b.slots) {
      sl.memberIds.forEach(id => allMemberIds.add(id));
    }
  }
  // Also add checked-in members
  for (const ids of Object.values(checkedInBySlotKey)) {
    ids.forEach(id => allMemberIds.add(id));
  }

  const memberIdArr = [...allMemberIds];
  const memberMap: Record<string, { name: string; instrument: string }> = {};
  if (memberIdArr.length > 0) {
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, nickname, first_name, instrument')
      .in('id', memberIdArr);
    for (const p of profiles || []) {
      memberMap[p.id] = {
        name: p.nickname || p.first_name || 'ไม่ทราบชื่อ',
        instrument: p.instrument || '',
      };
    }
  }

  // Now build the unified BreakSlot list: one entry per (startTime, endTime) pair
  // Merge across bands that share the same time slot
  const slotMap: Record<string, BreakSlot> = {}; // key: "startTime_endTime"

  for (const b of allSlotsByBand) {
    for (const sl of b.slots) {
      if (!sl.startTime || !sl.endTime) continue;
      const key = `${sl.startTime}_${sl.endTime}`;
      if (!slotMap[key]) {
        slotMap[key] = { startTime: sl.startTime, endTime: sl.endTime, bands: [] };
      }

      // Look up actual check-ins for this slot
      const slotRangeStr = `${sl.startTime}-${sl.endTime}`;
      const checkedInIds = checkedInBySlotKey[`${slotRangeStr}_${b.bandId}`] || [];

      // Use checked-in members if any, else fall back to scheduled members
      const memberIds = checkedInIds.length > 0 ? checkedInIds : sl.memberIds;

      if (memberIds.length > 0) {
        const members = memberIds.map(id => ({
          name: memberMap[id]?.name || 'ไม่ทราบชื่อ',
          instrument: memberMap[id]?.instrument || '',
        }));
        slotMap[key].bands.push({ bandName: b.bandName, members });
      } else {
        // No members at all for this slot from this band — add empty
        slotMap[key].bands.push({ bandName: b.bandName, members: [] });
      }
    }
  }

  // Sort by start time
  return Object.values(slotMap).sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
}

interface BreakSlot {
  startTime: string;
  endTime: string;
  bands: Array<{ bandName: string; members: Array<{ name: string; instrument: string }> }>;
}

// ── Format daily message ───────────────────────────────────────────────────
function formatDailyMessage(dateStr: string, slots: BreakSlot[], footer: string): string {
  const sep = '━━━━━━━━━━━━━━━━━━━━━━';
  const lines: string[] = [];

  lines.push(sep);
  lines.push('📋 รายงานประจำวัน');
  lines.push('ร้านนิยมสุข');
  lines.push(formatThaiDate(dateStr));
  lines.push(sep);
  lines.push('');

  if (slots.length === 0) {
    lines.push('— ไม่มีข้อมูลตารางงานวันนี้');
  } else {
    slots.forEach((slot, idx) => {
      lines.push(`▸ เบรค ${idx + 1} ⏐ ${formatTime(slot.startTime)}–${formatTime(slot.endTime)}`);

      // Collect all members across bands with content
      const activeBands = slot.bands.filter(b => b.members.length > 0);

      if (activeBands.length === 0) {
        lines.push('  — ไม่มีข้อมูล');
      } else {
        for (const b of activeBands) {
          // If multiple bands share same slot, show band name as header
          if (activeBands.length > 1 || b.bandName) {
            lines.push(`  ${b.bandName} (${b.members.length} คน)`);
          } else {
            lines.push(`  (${b.members.length} คน)`);
          }
          for (const m of b.members) {
            if (m.instrument) {
              lines.push(`  • ${m.name} — ${m.instrument}`);
            } else {
              lines.push(`  • ${m.name}`);
            }
          }
        }
      }
      lines.push('');
    });
  }

  // Footer
  const footerText = footer || defaultFooter();
  lines.push(sep);
  lines.push(footerText);
  lines.push(sep);

  return lines.join('\n');
}

// ── Format weekly summary message ─────────────────────────────────────────
function formatWeeklyMessage(
  startDateStr: string,
  endDateStr: string,
  dayData: Array<{ dateStr: string; slots: BreakSlot[] }>,
  footer: string
): string {
  const sep  = '━━━━━━━━━━━━━━━━━━━━━━';
  const sep2 = '─────────────────────';
  const lines: string[] = [];

  lines.push(sep);
  lines.push('📊 สรุปประจำสัปดาห์');
  lines.push('ร้านนิยมสุข');
  lines.push(formatThaiDateRange(startDateStr, endDateStr));
  lines.push(sep);
  lines.push('');

  // Per-day rows
  for (const day of dayData) {
    lines.push(`▸ ${formatThaiDateShort(day.dateStr)}`);
    if (day.slots.length === 0) {
      lines.push('  — ไม่มีข้อมูล');
    } else {
      day.slots.forEach((slot, idx) => {
        const activeBands = slot.bands.filter(b => b.members.length > 0);
        if (activeBands.length === 0) {
          lines.push(`  เบรค${idx + 1}: —`);
        } else {
          const summary = activeBands.map(b => {
            const names = b.members.map(m => m.name).join(', ');
            return `${b.bandName} (${b.members.length}) — ${names}`;
          }).join('; ');
          lines.push(`  เบรค${idx + 1}: ${summary}`);
        }
      });
    }
    lines.push('');
  }

  // Stats
  lines.push(sep2);
  lines.push('👥 สถิติรายบุคคล');
  lines.push('');

  // Collect per-person break count + instrument
  const personStats: Record<string, { name: string; instrument: string; count: number }> = {};
  // Also per-band
  const bandStats: Record<string, number> = {};

  for (const day of dayData) {
    for (const slot of day.slots) {
      for (const b of slot.bands) {
        bandStats[b.bandName] = (bandStats[b.bandName] || 0) + (b.members.length > 0 ? 1 : 0);
        for (const m of b.members) {
          if (!personStats[m.name]) personStats[m.name] = { name: m.name, instrument: m.instrument, count: 0 };
          personStats[m.name].count++;
        }
      }
    }
  }

  const persons = Object.values(personStats).sort((a, b) => b.count - a.count);
  if (persons.length === 0) {
    lines.push('ไม่มีข้อมูลการลงเวลา');
  } else {
    const nameColW = Math.max(...persons.map(p => p.name.length), 4);
    const instrColW = Math.max(...persons.map(p => p.instrument.length), 4);
    lines.push(`${'ชื่อ'.padEnd(nameColW + 2)}${'ตำแหน่ง'.padEnd(instrColW + 2)}เบรค`);
    for (const p of persons) {
      lines.push(`${p.name.padEnd(nameColW + 2)}${(p.instrument || '—').padEnd(instrColW + 2)}${p.count}`);
    }
  }

  lines.push('');
  lines.push('🎸 สถิติรายวง');
  const bands = Object.entries(bandStats).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  if (bands.length === 0) {
    lines.push('ไม่มีข้อมูล');
  } else {
    for (const [name, count] of bands) {
      lines.push(`${name.padEnd(20)}${count} เบรค`);
    }
  }

  const totalBreaks = Object.values(bandStats).reduce((s, c) => s + c, 0);
  lines.push('');
  lines.push(`รวมทั้งสัปดาห์      ${totalBreaks} เบรค`);

  // Footer
  const footerText = footer || defaultFooter();
  lines.push(sep);
  lines.push(footerText);
  lines.push(sep);

  return lines.join('\n');
}

function defaultFooter(): string {
  return [
    '📌 ส่งโดยระบบอัตโนมัติจากโปรแกรม BandThai',
    '',
    'โปรแกรมบริหารจัดการสำหรับนักดนตรีและร้านที่มีวงดนตรี',
    'ลงเวลาเบรค · คำนวณค่าแรง · เบิกจ่าย · ตารางงาน',
    '',
    '🔗 bandthai.app',
    '📞 ติดต่อวง SoulCiety เพื่อเริ่มใช้งาน',
  ].join('\n');
}

// ── Daily mode — ส่งภาพรวมสัปดาห์ (จ.-อา.) ทุกวัน 23:30 ────────────────
async function runDaily(thai: Date): Promise<void> {
  const { data: configs } = await sb
    .from('venue_line_config')
    .select('*')
    .eq('enabled', true);

  if (!configs?.length) return;

  for (const cfg of configs) {
    if (!cfg.line_channel_token || !cfg.line_group_id) continue;

    // Dedup: ส่งสำเร็จแล้วใน 20 ชม. → ข้าม
    const dedupSince = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
    const { count: alreadySent } = await sb
      .from('line_message_log')
      .select('*', { count: 'exact', head: true })
      .eq('venue_line_config_id', cfg.id)
      .eq('message_type', 'daily')
      .eq('success', true)
      .gte('sent_at', dedupSince);
    if (alreadySent && alreadySent > 0) {
      console.log(`[line] daily already sent for config ${cfg.id} in last 20h — skipping`);
      continue;
    }

    let bandIds: string[] = cfg.band_ids || [];
    if (!bandIds.length) {
      const { data: allBands } = await sb.from('bands').select('id');
      bandIds = (allBands || []).map((b: { id: string }) => b.id);
      if (!bandIds.length) continue;
    }

    const count = await getMonthlyCount(cfg.id);
    if (count >= QUOTA_WARN) {
      console.warn(`[line] quota near limit — skipping daily`);
      continue;
    }

    // 1) คำนวณสัปดาห์ปัจจุบัน (จ.-อา.)
    const weekDates = getWeekDates(thai);
    const today = toThaiDateStr(thai);

    // 2) Sync SoulCiety check-ins สำหรับวันที่ผ่านมาแล้ว+วันนี้
    for (const dateStr of weekDates) {
      if (dateStr <= today) {
        await syncSoulCietyCheckins(dateStr, bandIds);
      }
    }

    // 3) อ่านข้อมูลจาก venue_schedule_entries → format → ส่ง
    const weekData = await fetchWeekSchedule(weekDates, bandIds);
    const text = formatWeeklyOverview(weekData, cfg.footer_text || '');

    const result = await sendLineMessage(cfg.line_channel_token, cfg.line_group_id, text);
    await logMessage(cfg.id, 'daily', text, result.code, result.ok, result.error);
    console.log(`[line] daily sent to ${cfg.venue_name} — ok=${result.ok} code=${result.code}`);
  }
}

// ── Weekly mode ────────────────────────────────────────────────────────────
async function runWeekly(thai: Date): Promise<void> {
  const { data: configs } = await sb
    .from('venue_line_config')
    .select('*')
    .eq('enabled', true)
    .eq('send_weekly_enabled', true);

  if (!configs?.length) return;

  // Find last Monday (7 days ago) to last Sunday (yesterday)
  // thai is Monday 08:00, so we summarise Mon(7days ago)…Sun(yesterday)
  const endDate = new Date(thai);
  endDate.setDate(endDate.getDate() - 1); // yesterday = Sunday
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6); // 6 days before Sunday = last Monday

  const dates: string[] = [];
  const d = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    dates.push(toThaiDateStr(d));
    d.setDate(d.getDate() + 1);
  }

  for (const cfg of configs) {
    if (!cfg.line_channel_token || !cfg.line_group_id) continue;
    let bandIds: string[] = cfg.band_ids || [];
    if (!bandIds.length) {
      const { data: allBands } = await sb.from('bands').select('id');
      bandIds = (allBands || []).map((b: { id: string }) => b.id);
      if (!bandIds.length) continue;
    }

    // Check quota
    const count = await getMonthlyCount(cfg.id);
    if (count >= QUOTA_WARN) {
      console.warn(`[line] quota near limit (${count}/${QUOTA_LIMIT}) for config ${cfg.id} — skipping weekly`);
      continue;
    }

    // Fetch each day
    const dayData: Array<{ dateStr: string; slots: BreakSlot[] }> = [];
    for (const dateStr of dates) {
      const slots = await fetchDayData(dateStr, bandIds);
      dayData.push({ dateStr, slots });
    }

    const text = formatWeeklyMessage(toThaiDateStr(startDate), toThaiDateStr(endDate), dayData, cfg.footer_text || '');
    const result = await sendLineMessage(cfg.line_channel_token, cfg.line_group_id, text);
    await logMessage(cfg.id, 'weekly', text, result.code, result.ok, result.error);

    console.log(`[line] weekly sent to ${cfg.venue_name} — ok=${result.ok} code=${result.code}`);
  }
}

// ── Test mode ──────────────────────────────────────────────────────────────
async function runTest(configId: string): Promise<{ ok: boolean; message?: string; text?: string; error?: string }> {
  const { data: cfg } = await sb
    .from('venue_line_config')
    .select('*')
    .eq('id', configId)
    .maybeSingle();

  if (!cfg) return { ok: false, error: 'ไม่พบ config' };
  if (!cfg.line_channel_token || !cfg.line_group_id) return { ok: false, error: 'กรุณาใส่ LINE Token และ Group ID ก่อน' };

  const sep = '━━━━━━━━━━━━━━━━━━━━━━';
  const thai = thaiNow();
  const dateStr = toThaiDateStr(thai);
  const testText = [
    sep,
    '🔔 ข้อความทดสอบ',
    'ร้านนิยมสุข — ระบบ BandThai',
    formatThaiDate(dateStr),
    sep,
    '',
    'ระบบส่ง LINE ตารางเบรคของร้านคุณทำงานปกติ ✅',
    'ข้อความรายงานประจำวันจะส่งให้อัตโนมัติทุกวันเวลา 23:30 น.',
    '',
    defaultFooter(),
    sep,
  ].join('\n');

  const result = await sendLineMessage(cfg.line_channel_token, cfg.line_group_id, testText);
  await logMessage(cfg.id, 'test', testText, result.code, result.ok, result.error);
  return { ok: result.ok, text: testText, error: result.error };
}

// ── Preview mode ───────────────────────────────────────────────────────────
async function runPreview(configId: string, mode: 'daily' | 'weekly'): Promise<{ ok: boolean; text?: string; error?: string }> {
  const { data: cfg } = await sb
    .from('venue_line_config')
    .select('*')
    .eq('id', configId)
    .maybeSingle();

  if (!cfg) return { ok: false, error: 'ไม่พบ config' };
  let bandIds: string[] = cfg.band_ids || [];
  if (!bandIds.length) {
    const { data: allBands } = await sb.from('bands').select('id');
    bandIds = (allBands || []).map((b: { id: string }) => b.id);
  }
  const thai = thaiNow();

  try {
    let text: string;
    if (mode === 'weekly') {
      const endDate = new Date(thai);
      endDate.setDate(endDate.getDate() - 1);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      const dates: string[] = [];
      const d = new Date(startDate);
      for (let i = 0; i < 7; i++) { dates.push(toThaiDateStr(d)); d.setDate(d.getDate() + 1); }
      const dayData: Array<{ dateStr: string; slots: BreakSlot[] }> = [];
      for (const dateStr of dates) {
        dayData.push({ dateStr, slots: await fetchDayData(dateStr, bandIds) });
      }
      text = formatWeeklyMessage(toThaiDateStr(startDate), toThaiDateStr(endDate), dayData, cfg.footer_text || '');
    } else {
      // Daily preview = weekly overview (จ.-อา.)
      const weekDates = getWeekDates(thai);
      const today = toThaiDateStr(thai);
      for (const dateStr of weekDates) {
        if (dateStr <= today) await syncSoulCietyCheckins(dateStr, bandIds);
      }
      const weekData = await fetchWeekSchedule(weekDates, bandIds);
      text = formatWeeklyOverview(weekData, cfg.footer_text || '');
    }
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Get quota info ─────────────────────────────────────────────────────────
async function getQuotaInfo(configId: string): Promise<{ count: number; limit: number; logs: unknown[] }> {
  const count = await getMonthlyCount(configId);

  // Fetch last 10 log entries
  const { data: logs } = await sb
    .from('line_message_log')
    .select('message_type, success, line_response_code, sent_at, error_message')
    .eq('venue_line_config_id', configId)
    .order('sent_at', { ascending: false })
    .limit(10);

  return { count, limit: QUOTA_LIMIT, logs: logs || [] };
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey',
      }
    });
  }

  try {
    let body: Record<string, any> = {};
    try { body = await req.json(); } catch { /* cron sends empty body */ }

    // ── LINE Webhook event — parse schedule messages ──────────────
    if (body.events && Array.isArray(body.events)) {
      for (const ev of body.events) {
        if (!ev.source?.groupId) continue;
        console.log(`[LINE-WEBHOOK] groupId=${ev.source.groupId} type=${ev.type}`);

        // Process text messages for schedule data
        if (ev.type === 'message' && ev.message?.type === 'text' && ev.message?.text) {
          const msgText: string = ev.message.text;
          const entries = parseScheduleMessage(msgText);

          if (entries.length > 0) {
            console.log(`[LINE-WEBHOOK] Parsed ${entries.length} schedule entries`);

            // Look up venue config for this group
            const { data: cfg } = await sb
              .from('venue_line_config')
              .select('*')
              .eq('line_group_id', ev.source.groupId)
              .eq('enabled', true)
              .maybeSingle();

            if (cfg) {
              // UPSERT all entries → ห้ามซ้ำ (unique constraint)
              await upsertScheduleEntries(entries, 'line', ev.source.userId || 'unknown');

              // Sync SoulCiety check-ins for dates <= today
              let bandIds: string[] = cfg.band_ids || [];
              if (!bandIds.length) {
                const { data: allBands } = await sb.from('bands').select('id');
                bandIds = (allBands || []).map((b: { id: string }) => b.id);
              }

              const today = toThaiDateStr(thaiNow());
              const dates = [...new Set(entries.map(e => e.date))];
              for (const dateStr of dates) {
                if (dateStr <= today) {
                  await syncSoulCietyCheckins(dateStr, bandIds);
                }
              }

              // Reply with updated weekly overview (free — uses replyToken)
              if (ev.replyToken) {
                const weekDates = getWeekDates(thaiNow());
                const weekData = await fetchWeekSchedule(weekDates, bandIds);
                const replyText = formatWeeklyOverview(weekData, cfg.footer_text || '');
                await replyLineMessage(cfg.line_channel_token, ev.replyToken, replyText);
              }
            }
          }
        }
      }
      return json({ ok: true, webhook: true });
    }

    const mode = body.mode || 'daily';
    const thai = thaiNow();
    console.log(`[send-line-schedule] mode=${mode} Thai=${thai.toISOString()}`);

    // Test and Preview require authentication (admin/manager only) + configId
    if (mode === 'test' || mode === 'preview') {
      const authHeader = req.headers.get('Authorization') ?? '';
      const jwt = authHeader.replace('Bearer ', '');

      if (!jwt) {
        return json({ ok: false, error: 'Unauthorized' }, 401);
      }

      // Verify user
      const uid = (() => {
        try { return JSON.parse(atob(jwt.split('.')[1])).sub ?? ''; } catch { return ''; }
      })();
      if (!uid) return json({ ok: false, error: 'Unauthorized' }, 401);
      const { data: { user } } = await sb.auth.admin.getUserById(uid);
      if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!profile || profile.role !== 'admin') {
        return json({ ok: false, error: 'เฉพาะ admin เท่านั้น' }, 403);
      }

      const configId = body.config_id;
      if (!configId) return json({ ok: false, error: 'ต้องระบุ config_id' }, 400);

      if (mode === 'test') {
        const result = await runTest(configId);
        return json({ ok: result.ok, ...result });
      } else {
        const previewMode = (body.preview_mode === 'weekly' ? 'weekly' : 'daily') as 'daily' | 'weekly';
        const result = await runPreview(configId, previewMode);
        return json({ ok: result.ok, ...result });
      }
    }

    // Quota info — admin endpoint
    if (mode === 'quota') {
      const authHeader = req.headers.get('Authorization') ?? '';
      const jwt = authHeader.replace('Bearer ', '');
      if (!jwt) return json({ ok: false, error: 'Unauthorized' }, 401);
      const uid = (() => {
        try { return JSON.parse(atob(jwt.split('.')[1])).sub ?? ''; } catch { return ''; }
      })();
      if (!uid) return json({ ok: false, error: 'Unauthorized' }, 401);
      const { data: { user } } = await sb.auth.admin.getUserById(uid);
      if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!profile || profile.role !== 'admin') return json({ ok: false, error: 'เฉพาะ admin' }, 403);

      const configId = body.config_id;
      if (!configId) return json({ ok: false, error: 'ต้องระบุ config_id' }, 400);
      const info = await getQuotaInfo(configId);
      return json({ ok: true, ...info });
    }

    // Scheduled runs (cron) — ส่งตามเวลาที่กำหนดเท่านั้น
    if (mode === 'weekly') {
      await runWeekly(thai);
    } else if (mode === 'daily') {
      await runDaily(thai);
    } else {
      // ป้องกัน mode ที่ไม่รู้จัก — ไม่ให้ตก default เป็น daily
      console.warn(`[send-line-schedule] unknown mode: ${mode}`);
      return json({ ok: false, error: `Unknown mode: ${mode}` }, 400);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[send-line-schedule] ERROR:', err);
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
