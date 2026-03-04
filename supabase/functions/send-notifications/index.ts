// Supabase Edge Function — send-notifications
// Deno runtime. Called every minute by pg_cron.
// Sends Web Push for: upcoming external jobs (1-day notice), upcoming schedules (1-hr check-in reminder)

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC     = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE    = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT    = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@soulciety.app';

// ── Native Web Push (RFC 8291) + VAPID (RFC 8292) — no external deps ────────
function b64url(buf: Uint8Array | ArrayBuffer): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function unb64url(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const b = atob(s);
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}
async function hmac256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
// HKDF-Extract  = HMAC-SHA-256(salt, ikm)
// HKDF-Expand   = HMAC-SHA-256(prk, info || 0x01)  [L≤32]
const hkdfExtract = (salt: Uint8Array, ikm: Uint8Array) => hmac256(salt, ikm);
const hkdfExpand  = (prk: Uint8Array, info: Uint8Array, len: number) =>
  hmac256(prk, concat(info, new Uint8Array([1]))).then(t => t.slice(0, len));

/** VAPID JWT signed with ECDSA P-256 (RFC 8292) */
async function makeVapidAuth(endpoint: string): Promise<string> {
  const origin = new URL(endpoint).origin;
  const now    = Math.floor(Date.now() / 1000);
  const enc    = (o: object) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const hdr    = enc({ typ: 'JWT', alg: 'ES256' });
  const pld    = enc({ aud: origin, exp: now + 43200, sub: VAPID_SUBJECT });
  const msg    = `${hdr}.${pld}`;

  // Build JWK from raw VAPID keys (65-byte uncompressed public key)
  const pub = unb64url(VAPID_PUBLIC);
  const jwk = {
    kty: 'EC', crv: 'P-256',
    d: VAPID_PRIVATE,
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
  };
  const key = await crypto.subtle.importKey('jwk', jwk,
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig  = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(msg));
  return `vapid t=${msg}.${b64url(sig)},k=${VAPID_PUBLIC}`;
}

/** Encrypt payload per RFC 8291 (Content-Encoding: aes128gcm) */
async function encryptPayload(
  plaintext: string, p256dh: string, auth: string
): Promise<Uint8Array> {
  const salt    = crypto.getRandomValues(new Uint8Array(16));
  const rcvPub  = unb64url(p256dh);  // 65-byte uncompressed

  // Ephemeral sender EC key pair
  const sndKP  = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const sndPub = new Uint8Array(await crypto.subtle.exportKey('raw', sndKP.publicKey));  // 65 bytes

  // ECDH shared secret
  const rcvKey = await crypto.subtle.importKey('raw', rcvPub,
    { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: rcvKey }, sndKP.privateKey, 256));

  // RFC 8291 key derivation
  const authSecret   = unb64url(auth);
  const prk1         = await hkdfExtract(authSecret, shared);
  const webpushInfo  = concat(new TextEncoder().encode('WebPush: info\0'), rcvPub, sndPub);
  const ikm          = await hkdfExpand(prk1, webpushInfo, 32);
  const prk2         = await hkdfExtract(salt, ikm);
  const cek          = await hkdfExpand(prk2, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce        = await hkdfExpand(prk2, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

  // AES-128-GCM encrypt  (append 0x02 = record delimiter, no padding)
  const plain  = concat(new TextEncoder().encode(plaintext), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct     = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plain));

  // aes128gcm content: salt(16) | rs(4 BE) | idlen(1) | keyid(65) | ciphertext
  const rs  = 4096;
  const out = new Uint8Array(16 + 4 + 1 + 65 + ct.length);
  let off   = 0;
  out.set(salt, off);                                          off += 16;
  new DataView(out.buffer).setUint32(off, rs, false);          off += 4;
  out[off++] = 65;
  out.set(sndPub, off);                                        off += 65;
  out.set(ct, off);
  return out;
}

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
    const body  = await encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth_key);
    const auth  = await makeVapidAuth(sub.endpoint);
    const res   = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':     'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization':    auth,
        'TTL':              '3600',
        'Urgency':          'normal',
      },
      body,
    });
    if (res.status === 410 || res.status === 404) {
      await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      return false;
    }
    return res.status >= 200 && res.status < 300;
  } catch (e) {
    console.error('[push] failed:', sub.endpoint.slice(-20), (e as Error)?.message);
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
    .from('schedule')
    .select('id, band_id, date, venue_name, time_slots, notes')
    .eq('date', targetDate)
    .eq('type', 'external')
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

    const slotLabel = Array.isArray(job.time_slots)
      ? job.time_slots.map((s: Record<string, string>) => s.name || s.label || '').filter(Boolean).join(', ')
      : '';
    const label = [job.venue_name, slotLabel].filter(Boolean).join(' · ') || 'งานพรุ่งนี้';
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
    .from('schedule')
    .select('id, band_id, date, venue_name, time_slots, start_time')
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

    const slotLabel = Array.isArray(slot.time_slots)
      ? slot.time_slots.map((s: Record<string, string>) => s.name || s.label || '').filter(Boolean).join(', ')
      : '';
    const label = [slot.venue_name, slotLabel].filter(Boolean).join(' · ') || 'รอบถัดไป';
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
