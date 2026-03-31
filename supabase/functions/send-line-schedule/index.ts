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

  // Fetch actual check-ins for this date across all bands (including leave)
  const { data: checkIns } = await sb
    .from('member_check_ins')
    .select('member_id, band_id, slots, status, substitute')
    .eq('date', dateStr)
    .in('band_id', bandIds);

  // Fetch leave_requests for this date to get substitute names
  const { data: leaveReqs } = await sb
    .from('leave_requests')
    .select('member_id, band_id, slots, substitute_name, substitute_id')
    .eq('date', dateStr)
    .in('band_id', bandIds)
    .in('status', ['approved', 'pending']);

  // Build substitute map: memberId_bandId → substitute info
  const substituteMap: Record<string, { name: string; id: string }> = {};
  for (const lv of leaveReqs || []) {
    if (lv.substitute_name) {
      substituteMap[`${lv.member_id}_${lv.band_id}`] = {
        name: lv.substitute_name,
        id: lv.substitute_id || '',
      };
    }
  }
  // Also check check-in substitute field
  for (const ci of checkIns || []) {
    if (ci.status === 'leave' && ci.substitute) {
      const sub = typeof ci.substitute === 'string' ? JSON.parse(ci.substitute) : ci.substitute;
      if (sub && sub.name) {
        const key = `${ci.member_id}_${ci.band_id}`;
        if (!substituteMap[key]) {
          substituteMap[key] = { name: sub.name, id: '' };
        }
      }
    }
  }

  // Build a map: "18:00-19:00_bandId" → [memberId,...]
  const checkedInBySlotKey: Record<string, string[]> = {};
  for (const ci of checkIns || []) {
    if (ci.status === 'leave') {
      // Leave member with substitute → add their memberId so substitute gets looked up
      const subKey = `${ci.member_id}_${ci.band_id}`;
      if (substituteMap[subKey]) {
        const slots: string[] = Array.isArray(ci.slots) ? ci.slots : [];
        for (const slotStr of slots) {
          const key = `${slotStr}_${ci.band_id}`;
          if (!checkedInBySlotKey[key]) checkedInBySlotKey[key] = [];
          checkedInBySlotKey[key].push(ci.member_id);
        }
      }
      continue;
    }
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
  // Also add substitute member IDs (so their profiles get fetched)
  for (const sub of Object.values(substituteMap)) {
    if (sub.id) allMemberIds.add(sub.id);
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
        const members: Array<{ name: string; instrument: string }> = [];
        for (const id of memberIds) {
          const subKey = `${id}_${b.bandId}`;
          const sub = substituteMap[subKey];
          if (sub) {
            // This member is on leave → use substitute name instead
            const subProfile = sub.id && memberMap[sub.id];
            members.push({
              name: subProfile ? subProfile.name : sub.name,
              instrument: subProfile ? subProfile.instrument : '',
            });
          } else {
            members.push({
              name: memberMap[id]?.name || 'ไม่ทราบชื่อ',
              instrument: memberMap[id]?.instrument || '',
            });
          }
        }
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

interface DisplayOpts {
  showNames?: boolean;
  showInstrument?: boolean;
  showCount?: boolean;
  showBand?: boolean;
  showFooter?: boolean;
}

// ── Map time slot to break number ──────────────────────────────────────────
const BREAK_SCHEDULE = [
  { start: '18:00', end: '19:00' },
  { start: '19:30', end: '20:30' },
  { start: '21:00', end: '22:00' },
  { start: '22:30', end: '23:30' },
];

function getBreakNumber(startTime: string): number {
  const t = startTime.replace('.', ':').substring(0, 5);
  const idx = BREAK_SCHEDULE.findIndex(b => b.start === t);
  return idx >= 0 ? idx + 1 : 0;
}

// ── Format daily message ───────────────────────────────────────────────────
function formatDailyMessage(dateStr: string, slots: BreakSlot[], footer: string, opts?: DisplayOpts): string {
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
    slots.forEach((slot) => {
      const breakNum = getBreakNumber(slot.startTime) || '?';
      lines.push(`▸ เบรค ${breakNum} ⏐ ${formatTime(slot.startTime)}–${formatTime(slot.endTime)}`);

      // Collect all members across bands with content
      const activeBands = slot.bands.filter(b => b.members.length > 0);

      if (activeBands.length === 0) {
        lines.push('  — ไม่มีข้อมูล');
      } else {
        const sN = opts?.showNames !== false;
        const sI = opts?.showInstrument !== false;
        const sC = opts?.showCount !== false;
        const sB = opts?.showBand !== false;
        for (const b of activeBands) {
          // Band name + count header
          const bandLabel = sB ? b.bandName : '';
          const countLabel = sC ? `(${b.members.length} คน)` : '';
          const header = [bandLabel, countLabel].filter(Boolean).join(' ');
          if (header) lines.push(`  ${header}`);

          if (sN) {
            for (const m of b.members) {
              if (sI && m.instrument) {
                lines.push(`  • ${m.name} — ${m.instrument}`);
              } else {
                lines.push(`  • ${m.name}`);
              }
            }
          }
        }
      }
      lines.push('');
    });
  }

  // Footer
  if (opts?.showFooter !== false) {
    const footerText = footer || defaultFooter();
    lines.push(sep);
    lines.push(footerText);
    lines.push(sep);
  }

  return lines.join('\n');
}

// ── Format weekly summary message ─────────────────────────────────────────
function formatWeeklyMessage(
  startDateStr: string,
  endDateStr: string,
  dayData: Array<{ dateStr: string; slots: BreakSlot[] }>,
  footer: string,
  opts?: DisplayOpts
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
      day.slots.forEach((slot) => {
        const breakNum = getBreakNumber(slot.startTime) || '?';
        const activeBands = slot.bands.filter(b => b.members.length > 0);
        if (activeBands.length === 0) {
          lines.push(`  เบรค${breakNum}: —`);
        } else {
            const sN = opts?.showNames !== false;
          const sI = opts?.showInstrument !== false;
          const sC = opts?.showCount !== false;
          const sB = opts?.showBand !== false;
          const summary = activeBands.map(b => {
            const parts: string[] = [];
            if (sB) parts.push(b.bandName);
            if (sC) parts.push(`(${b.members.length})`);
            if (sN) {
              const names = b.members.map(m => sI && m.instrument ? `${m.name}—${m.instrument}` : m.name).join(', ');
              parts.push(`— ${names}`);
            }
            return parts.join(' ');
          }).join('; ');
          lines.push(`  เบรค${breakNum}: ${summary}`);
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
    const sI = opts?.showInstrument !== false;
    const nameColW = Math.max(...persons.map(p => p.name.length), 4);
    if (sI) {
      const instrColW = Math.max(...persons.map(p => p.instrument.length), 4);
      lines.push(`${'ชื่อ'.padEnd(nameColW + 2)}${'ตำแหน่ง'.padEnd(instrColW + 2)}เบรค`);
      for (const p of persons) {
        lines.push(`${p.name.padEnd(nameColW + 2)}${(p.instrument || '—').padEnd(instrColW + 2)}${p.count}`);
      }
    } else {
      lines.push(`${'ชื่อ'.padEnd(nameColW + 2)}เบรค`);
      for (const p of persons) {
        lines.push(`${p.name.padEnd(nameColW + 2)}${p.count}`);
      }
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
  if (opts?.showFooter !== false) {
    const footerText = footer || defaultFooter();
    lines.push(sep);
    lines.push(footerText);
    lines.push(sep);
  }

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

// ── Daily mode ─────────────────────────────────────────────────────────────
async function runDaily(thai: Date): Promise<void> {
  const dateStr = toThaiDateStr(thai);

  const { data: configs } = await sb
    .from('venue_line_config')
    .select('*')
    .eq('enabled', true);

  if (!configs?.length) return;

  for (const cfg of configs) {
    if (!cfg.line_channel_token || !cfg.line_group_id) continue;
    if (cfg.send_daily_enabled === false) continue;

    // ── Dedup: ถ้าส่ง daily สำเร็จไปแล้วใน 20 ชม. ล่าสุด → ข้าม (ป้องกันส่งซ้ำ)
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

    // Validate there are bands configured — fallback to all bands if empty
    let bandIds: string[] = cfg.band_ids || [];
    if (!bandIds.length) {
      const { data: allBands } = await sb.from('bands').select('id');
      bandIds = (allBands || []).map((b: { id: string }) => b.id);
      if (!bandIds.length) continue;
    }

    // Check quota (skip for test)
    const count = await getMonthlyCount(cfg.id);
    if (count >= QUOTA_WARN) {
      console.warn(`[line] quota near limit (${count}/${QUOTA_LIMIT}) for config ${cfg.id} — skipping daily`);
      continue;
    }

    const slots = await fetchDayData(dateStr, bandIds);
    const text  = formatDailyMessage(dateStr, slots, cfg.footer_text || '');

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
async function runPreview(configId: string, mode: 'daily' | 'weekly', dateParam?: string, displayOpts?: DisplayOpts): Promise<{ ok: boolean; text?: string; error?: string }> {
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
      text = formatWeeklyMessage(toThaiDateStr(startDate), toThaiDateStr(endDate), dayData, cfg.footer_text || '', displayOpts);
    } else {
      const ds = dateParam || toThaiDateStr(thai);
      const slots = await fetchDayData(ds, bandIds);
      text = formatDailyMessage(ds, slots, cfg.footer_text || '', displayOpts);
    }
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Manual send (admin-triggered) ─────────────────────────────────────────
async function runManual(configId: string, type: 'daily' | 'weekly', dateStr?: string, displayOpts?: DisplayOpts): Promise<{ ok: boolean; text?: string; error?: string }> {
  const { data: cfg } = await sb
    .from('venue_line_config')
    .select('*')
    .eq('id', configId)
    .maybeSingle();

  if (!cfg) return { ok: false, error: 'ไม่พบ config' };
  if (!cfg.line_channel_token || !cfg.line_group_id) return { ok: false, error: 'กรุณาใส่ LINE Token และ Group ID ก่อน' };

  let bandIds: string[] = cfg.band_ids || [];
  if (!bandIds.length) {
    const { data: allBands } = await sb.from('bands').select('id');
    bandIds = (allBands || []).map((b: { id: string }) => b.id);
  }
  const thai = thaiNow();

  try {
    let text: string;
    const logType = type === 'weekly' ? 'weekly' : 'daily';
    if (type === 'weekly') {
      const endDate = new Date(thai);
      endDate.setDate(endDate.getDate() - 1);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      const dates: string[] = [];
      const d = new Date(startDate);
      for (let i = 0; i < 7; i++) { dates.push(toThaiDateStr(d)); d.setDate(d.getDate() + 1); }
      const dayData: Array<{ dateStr: string; slots: BreakSlot[] }> = [];
      for (const ds of dates) {
        dayData.push({ dateStr: ds, slots: await fetchDayData(ds, bandIds) });
      }
      text = formatWeeklyMessage(toThaiDateStr(startDate), toThaiDateStr(endDate), dayData, cfg.footer_text || '', displayOpts);
    } else {
      const ds = dateStr || toThaiDateStr(thai);
      const slots = await fetchDayData(ds, bandIds);
      text = formatDailyMessage(ds, slots, cfg.footer_text || '', displayOpts);
    }
    const result = await sendLineMessage(cfg.line_channel_token, cfg.line_group_id, text);
    await logMessage(cfg.id, logType, text, result.code, result.ok, result.error);
    return { ok: result.ok, text, error: result.error };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Admin JWT verification (ใช้ Supabase auth แทน manual base64url decode) ──
async function verifyAdmin(req: Request): Promise<{ uid: string; error: string | null }> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '').trim();
  if (!jwt) return { uid: '', error: 'Unauthorized' };
  const { data: { user }, error } = await sb.auth.getUser(jwt);
  if (error || !user) return { uid: '', error: 'Unauthorized' };
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || profile.role !== 'admin') return { uid: '', error: 'เฉพาะ admin เท่านั้น' };
  return { uid: user.id, error: null };
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

    // ── LINE Webhook event — จับ Group ID ──────────────────────────
    if (body.events && Array.isArray(body.events)) {
      for (const ev of body.events) {
        if (ev.source?.groupId) {
          console.log(`[LINE-WEBHOOK] groupId = ${ev.source.groupId}`);
          console.log(`[LINE-WEBHOOK] type = ${ev.type}, userId = ${ev.source?.userId || '-'}`);
        }
      }
      return json({ ok: true, webhook: true });
    }

    const mode = body.mode || 'daily';
    const thai = thaiNow();
    console.log(`[send-line-schedule] mode=${mode} Thai=${thai.toISOString()}`);

    // Test, Preview and Manual require authentication (admin only) + configId
    if (mode === 'test' || mode === 'preview' || mode === 'manual') {
      const { uid, error: authErr } = await verifyAdmin(req);
      if (!uid) return json({ ok: false, error: authErr || 'Unauthorized' }, authErr === 'เฉพาะ admin เท่านั้น' ? 403 : 401);

      const configId = body.config_id;
      if (!configId) return json({ ok: false, error: 'ต้องระบุ config_id' }, 400);

      if (mode === 'test') {
        const result = await runTest(configId);
        return json({ ok: result.ok, ...result });
      } else if (mode === 'manual') {
        const manualType = (body.type === 'weekly' ? 'weekly' : 'daily') as 'daily' | 'weekly';
        const manualDate = typeof body.date === 'string' ? body.date : undefined;
        const dOpts = body.display_opts as DisplayOpts | undefined;
        const result = await runManual(configId, manualType, manualDate, dOpts);
        return json({ ok: result.ok, ...result });
      } else {
        const previewMode = (body.preview_mode === 'weekly' ? 'weekly' : 'daily') as 'daily' | 'weekly';
        const previewDate = typeof body.date === 'string' ? body.date : undefined;
        const dOpts = body.display_opts as DisplayOpts | undefined;
        const result = await runPreview(configId, previewMode, previewDate, dOpts);
        return json({ ok: result.ok, ...result });
      }
    }

    // Quota info — admin endpoint
    if (mode === 'quota') {
      const { uid, error: authErr } = await verifyAdmin(req);
      if (!uid) return json({ ok: false, error: authErr || 'Unauthorized' }, authErr === 'เฉพาะ admin เท่านั้น' ? 403 : 401);

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
