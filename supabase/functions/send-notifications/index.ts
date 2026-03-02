// Supabase Edge Function — send-notifications
// Deno runtime. Called every minute by pg_cron.
// Sends Web Push for: upcoming external jobs (1-day notice), upcoming schedules (1-hr check-in reminder)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { webPush } from 'https://esm.sh/web-push@3.6.7';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC     = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE    = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT    = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@soulciety.app';

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Thai time = UTC+7
function thaiNow(): Date {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 420);            // +7h in minutes
  return now;
}

function thaiDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function sendPush(sub: { endpoint: string; p256dh: string; auth_key: string }, payload: object): Promise<boolean> {
  try {
    webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    await webPush.sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth_key }
    }, JSON.stringify(payload), { TTL: 60 * 60 });   // TTL 1hr
    return true;
  } catch (e) {
    console.error('[push] failed:', sub.endpoint.slice(-20), e?.statusCode ?? e?.message);
    // remove stale subscriptions (410 Gone / 404)
    if (e?.statusCode === 410 || e?.statusCode === 404) {
      await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    }
    return false;
  }
}

async function logNotification(bandId: string, type: string, key: string): Promise<boolean> {
  const { error } = await sb.from('notification_log').insert({ band_id: bandId, notification_type: type, reference_key: key });
  return !error;   // false = already logged (unique constraint violation)
}

// ── Notification Type 1: External job 1-day notice ──────────────────────────
async function notifyExternalJobs(thai: Date) {
  // Target date = tomorrow Thai time
  const tomorrow = new Date(thai);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDate = thaiDateStr(tomorrow);

  // Fetch external-type schedule items for tomorrow
  const { data: jobs, error } = await sb
    .from('schedules')
    .select('id, band_id, date, venue, time_slot, notes')
    .eq('date', targetDate)
    .eq('job_type', 'external')
    .not('band_id', 'is', null);

  if (error || !jobs || jobs.length === 0) return;

  for (const job of jobs) {
    const refKey = `external_job_1d:${job.id}:${targetDate}`;
    const logged = await logNotification(job.band_id, 'external_job_1d', refKey);
    if (!logged) continue;   // already sent

    // Get all subscriptions in this band (all members)
    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .eq('band_id', job.band_id);

    if (!subs || subs.length === 0) continue;

    const label = [job.venue, job.time_slot].filter(Boolean).join(' · ') || 'งานพรุ่งนี้';
    const payload = {
      title: '🎵 งานพรุ่งนี้ — ' + label,
      body:  job.notes ? job.notes.slice(0, 100) : 'อย่าลืมเตรียมตัวสำหรับงานพรุ่งนี้!',
      type:  'external_job',
      url:   '/Band-Management-By-SoulCiety/docs/schedule.html'
    };

    for (const sub of subs) {
      await sendPush(sub, payload);
    }
  }
}

// ── Notification Type 2: Check-in reminder 1 hour before schedule ────────────
async function notifyCheckinReminder(thai: Date) {
  // Find schedules starting between now+55min and now+65min (Thai time)
  const lo = new Date(thai); lo.setMinutes(lo.getMinutes() + 55);
  const hi = new Date(thai); hi.setMinutes(hi.getMinutes() + 65);

  const todayDate = thaiDateStr(thai);
  const loTime = lo.toISOString().substring(11, 16);   // HH:MM
  const hiTime = hi.toISOString().substring(11, 16);

  const { data: slots, error } = await sb
    .from('schedules')
    .select('id, band_id, date, venue, time_slot, start_time')
    .eq('date', todayDate)
    .gte('start_time', loTime)
    .lte('start_time', hiTime)
    .not('band_id', 'is', null);

  if (error || !slots || slots.length === 0) return;

  for (const slot of slots) {
    const refKey = `checkin_reminder:${slot.id}:${todayDate}`;
    const logged = await logNotification(slot.band_id, 'checkin_reminder', refKey);
    if (!logged) continue;

    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .eq('band_id', slot.band_id);

    if (!subs || subs.length === 0) continue;

    const label = [slot.venue, slot.time_slot].filter(Boolean).join(' · ') || 'รอบถัดไป';
    const payload = {
      title: '⏰ เตือนเช็คอิน — อีก 1 ชั่วโมง',
      body:  label + ' · เวลา ' + (slot.start_time || ''),
      type:  'checkin_reminder',
      url:   '/Band-Management-By-SoulCiety/docs/check-in.html'
    };

    for (const sub of subs) {
      await sendPush(sub, payload);
    }
  }
}

// ── Admin: Test push to all band subscribers ────────────────────────────────
async function handleTestPush(bandId: string, jwt: string, title: string, body: string): Promise<{ sent: number; error?: string }> {
  if (!jwt) return { sent: 0, error: 'Unauthorized — ต้อง login ก่อน' };

  // Verify JWT using service role (getUser works with service role)
  const { data: { user }, error: ue } = await sb.auth.admin.getUserById(
    (() => { try { return JSON.parse(atob(jwt.split('.')[1])).sub ?? ''; } catch { return ''; } })()
  );
  if (ue || !user) return { sent: 0, error: 'Unauthorized' };

  const { data: profile } = await sb.from('profiles').select('role, band_id').eq('id', user.id).maybeSingle();
  if (!profile || !['admin', 'manager'].includes(profile.role ?? '')) {
    return { sent: 0, error: 'เฉพาะแอดมิน/ผู้จัดการเท่านั้น' };
  }
  if (profile.band_id !== bandId) {
    return { sent: 0, error: 'ไม่ใช่วงของคุณ' };
  }

  // Fetch all subscriptions for band
  const { data: subs } = await sb.from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('band_id', bandId);

  if (!subs || subs.length === 0) return { sent: 0 };

  const payload = {
    title: title || '🔔 การแจ้งเตือนทดสอบ',
    body:  body  || 'ระบบการแจ้งเตือนของวงทำงานปกติ ✅',
    type:  'test',
    url:   '/Band-Management-By-SoulCiety/docs/dashboard.html'
  };

  let sent = 0;
  for (const sub of subs) {
    const ok = await sendPush(sub, payload);
    if (ok) sent++;
  }
  return { sent };
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  try {
    // If called via HTTP POST with action payload (admin panel)
    if (req.method === 'POST') {
      const authHeader = req.headers.get('Authorization') ?? '';
      const jwt = authHeader.replace('Bearer ', '');
      let body: Record<string, string> = {};
      try { body = await req.json(); } catch { /* ignore */ }

      if (body.action === 'test_push') {
        const result = await handleTestPush(
          body.band_id ?? '',
          jwt,
          body.title ?? '',
          body.body   ?? ''
        );
        return new Response(JSON.stringify({ ok: !result.error, ...result }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        }
      });
    }

    // Default: pg_cron scheduled run
    const thai = thaiNow();
    console.log('[send-notifications] Thai time:', thai.toISOString());

    await Promise.all([
      notifyExternalJobs(thai),
      notifyCheckinReminder(thai)
    ]);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[send-notifications] ERROR:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
