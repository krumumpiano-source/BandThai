# Plan: Push Notification System — แจ้งเตือนงาน/เบรค

> สถานะ: **รอ Implement** | วันที่ร่าง: 1 มี.ค. 2026

## TL;DR

เพิ่มระบบ Web Push Notification ผ่าน PWA (Service Worker) + Supabase Edge Function ที่รันทุก 1 นาทีผ่าน pg_cron เพื่อแจ้งเตือนสมาชิก:

1. **งานนอก**: แจ้ง **1 วันล่วงหน้า** → เฉพาะสมาชิกใน `schedule.members[]`
2. **ร้าน เบรคแรก**: แจ้ง **1 ชม. ก่อนเริ่มเบรคแรก** → เฉพาะสมาชิกใน `band_settings.schedule[day][0].members[]`
3. **ทุกเบรค**: แจ้ง **5 นาทีก่อนเริ่มทุกเบรค** → เฉพาะสมาชิกในเบรคนั้น

ทำงานได้แม้ไม่เปิดเบราว์เซอร์ (push ส่งถึงระบบปฏิบัติการโดยตรง) ฟรี 100% ไม่จำกัดข้อความ

**ข้อจำกัด iOS**: ผู้ใช้ iPhone ต้อง Add to Home Screen (ติดตั้ง PWA) ก่อนจึงจะรับ push ได้ (ต้อง iOS 16.4+)

---

## Technical Context

### แหล่งข้อมูล 2 แหล่งที่ต้อง query

| ประเภทงาน | แหล่งข้อมูล | Members format |
|-----------|------------|----------------|
| งานนอก (external) | `schedule` table, `type = 'external'` | `members: ["uuid1", "uuid2"]` (flat UUID array) |
| ร้าน (regular) | `band_settings.settings.schedule[dayOfWeek]` | `members: [{memberId, rate, rateType}]` |

### Timezone
- App ไม่มี timezone handling → Edge Function จะ hardcode **UTC+7** (Thailand)
- เวลาใน slot เก็บเป็น `"HH:mm"` string (24-hour format)

### โครงสร้างปัจจุบันที่เกี่ยวข้อง
- **Supabase URL**: `https://wsorngsyowgxikiepice.supabase.co`
- **ไม่มี PWA infrastructure** (ไม่มี manifest.json, sw.js, service worker)
- **ไม่มี Edge Functions** (ไม่มี `supabase/functions/` directory)
- **ไม่มี pg_cron/pg_net** (มีแค่ `uuid-ossp` extension)
- **Auth**: Supabase Auth (email+password), `profiles.band_id` + `profiles.status='active'` สำหรับ target

---

## Steps

### Phase 1 — Database Migration

1. **สร้าง `supabase/migrate-notifications.sql`** — สร้าง 2 ตาราง:

   **`push_subscriptions`**:
   - `id` uuid PK default `uuid_generate_v4()`
   - `user_id` uuid REFERENCES `auth.users` NOT NULL
   - `band_id` text NOT NULL
   - `endpoint` text NOT NULL
   - `p256dh` text NOT NULL
   - `auth_key` text NOT NULL
   - `created_at` timestamptz DEFAULT `now()`
   - UNIQUE(`user_id`, `endpoint`)
   - RLS: users เห็นเฉพาะ row ของตัวเอง (`user_id = auth.uid()`), service_role bypass

   **`notification_log`**:
   - `id` uuid PK default `uuid_generate_v4()`
   - `band_id` text NOT NULL
   - `notification_type` text NOT NULL — ค่า: `external_1day` | `regular_1hr` | `break_5min`
   - `reference_key` text NOT NULL — เช่น `ext_{scheduleId}`, `reg1hr_{bandId}_{date}`, `brk5m_{bandId}_{date}_{slotId}`
   - `sent_at` timestamptz DEFAULT `now()`
   - UNIQUE(`band_id`, `notification_type`, `reference_key`)
   - RLS: service_role only (Edge Function เท่านั้นที่เขียน)

2. **เปิด Extensions** ผ่าน Supabase Dashboard (Database → Extensions):
   - `pg_cron` — สำหรับ cron job
   - `pg_net` — สำหรับ HTTP call ไปยัง Edge Function

### Phase 2 — PWA Setup (Frontend)

3. **สร้าง `docs/manifest.json`** — PWA manifest:
   - `name`: "Band Management by SoulCiety"
   - `short_name`: "SoulCiety"
   - `start_url`: "/Band-Management-By-SoulCiety/docs/dashboard.html"
   - `display`: "standalone"
   - `theme_color`: "#1a1a1a" (`--premium-black`)
   - `background_color`: "#1a1a1a"
   - `icons`: placeholder icons (192x192, 512x512)

4. **สร้าง `docs/sw.js`** — Service Worker:
   - `push` event handler: รับ payload → `self.registration.showNotification(title, {body, icon, badge, data: {url}})`
   - `notificationclick` event handler: คลิก notification → `clients.openWindow(data.url)`
     - งานนอก → เปิด schedule.html
     - ร้าน/เบรค → เปิด dashboard.html
   - ไม่ต้องทำ offline cache ในเฟสนี้

5. **แก้ `docs/js/app.js`** — เพิ่ม Service Worker registration:
   - หลัง DOM ready / หลัง `requireAuth()` สำเร็จ
   - `navigator.serviceWorker.register('/Band-Management-By-SoulCiety/docs/sw.js')`
   - เก็บ registration object ไว้ใน `window._swReg` สำหรับ push subscription

6. **เพิ่ม meta tags ในทุกหน้า HTML** ใน `docs/`:
   - `<link rel="manifest" href="manifest.json">`
   - `<meta name="apple-mobile-web-app-capable" content="yes">`
   - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
   - `<meta name="theme-color" content="#1a1a1a">`

### Phase 3 — Client-Side Push Subscription

7. **สร้าง `docs/js/notification.js`** — จัดการ push subscription:
   - `initNotifications()`: เช็ค `'Notification' in window` + `'serviceWorker' in navigator`
   - `requestPermission()`: ขอ permission `Notification.requestPermission()`
   - `subscribePush()`: ใช้ `swRegistration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY})` → ได้ subscription object
   - `savePushSubscription(subscription)`: เรียก `apiCall('savePushSubscription', {endpoint, p256dh, authKey})` เก็บลง DB
   - `unsubscribePush()`: ลบ subscription ออกจาก DB + `subscription.unsubscribe()`
   - **VAPID public key** เก็บใน `docs/js/config.js` ข้างๆ Supabase config

8. **แก้ `docs/dashboard.html`** — เพิ่ม notification prompt:
   - หลัง login ครั้งแรก → แสดง banner/toast: "🔔 เปิดการแจ้งเตือน?" พร้อมปุ่ม "เปิด" / "ไว้ทีหลัง"
   - ถ้า `Notification.permission === 'granted'` → ไม่แสดงอีก
   - **iOS**: แสดง banner "📲 ติดตั้งแอปเพื่อรับแจ้งเตือน" + วิธี Add to Home Screen (ถ้ายังไม่เป็น standalone mode)

9. **แก้ `docs/my-profile.html`** — เพิ่ม notification settings:
   - Toggle switch เปิด/ปิดการแจ้งเตือน
   - สถานะ: "เปิดอยู่ ✅" / "ปิดอยู่" / "ไม่รองรับ" / "ต้อง Add to Home Screen (iOS)"
   - ปุ่ม **"ส่ง notification ทดสอบ"**

### Phase 4 — Supabase API Layer

10. **แก้ `docs/js/supabase-api.js`** — เพิ่ม dispatch cases:
    - `savePushSubscription`: upsert ลง `push_subscriptions` (match on `user_id` + `endpoint`)
    - `deletePushSubscription`: ลบ row by `user_id` + `endpoint`
    - `getPushSubscription`: ดึง subscription ของ user ปัจจุบัน (เช็คว่า subscribed อยู่มั้ย)

### Phase 5 — Edge Function (Notification Sender)

11. **สร้าง `supabase/functions/send-notifications/index.ts`** — Deno Edge Function:
    - ใช้ Supabase `service_role` key (เก็บเป็น secret) เพื่อ bypass RLS
    - ใช้ Web Push protocol RFC 8291 (VAPID + ECDH encryption)
    - Library: `web-push` ผ่าน npm: specifier ใน Deno

12. **Logic ของ Edge Function** (ทำงานทุก 1 นาที):

    **A. คำนวณเวลาไทย (UTC+7)**
    ```
    nowTH = new Date(Date.now() + 7*60*60*1000)
    todayStr = YYYY-MM-DD (วันนี้ไทย)
    tomorrowStr = YYYY-MM-DD (พรุ่งนี้ไทย)
    dayOfWeek = 0-6
    nowMinutes = hours * 60 + minutes
    ```

    **B. งานนอก 1 วันล่วงหน้า (`external_1day`)**
    - Query: `schedule` WHERE `type = 'external'` AND `date = tomorrowStr` AND `status = 'confirmed'`
    - เช็ค `notification_log` ว่าส่งแล้วหรือยัง (`reference_key = 'ext_{id}'`)
    - ดึง `push_subscriptions` ของ members ใน `schedule.members[]` (flat UUID array)
    - Push: title **"🎵 งานนอกพรุ่งนี้"**, body **"{venue} — {start_time}-{end_time}"**
    - บันทึก `notification_log`

    **C. ร้าน เบรคแรก 1 ชม. ล่วงหน้า (`regular_1hr`)**
    - Query: ทุก `band_settings` → parse `settings.schedule[dayOfWeek]`
    - เอา slot แรก (index 0) → parse `startTime` เป็น minutes
    - ถ้า `slotStartMinutes - nowMinutes` อยู่ในช่วง **55-65 นาที** (tolerance ±5 นาที เพราะ cron อาจคลาดเล็กน้อย)
    - `reference_key = 'reg1hr_{bandId}_{todayStr}'` → เช็คซ้ำ
    - Target: เฉพาะ `members[].memberId` ของ slot แรก
    - Push: title **"🎤 อีก 1 ชม. ถึงเบรคแรก"**, body **"{venue_name} เบรค {startTime}"**

    **D. ทุกเบรค 5 นาทีก่อน (`break_5min`) — ร้าน**
    - วนทุก slot ของวันนี้ (ทุกเบรค ไม่ใช่แค่เบรคแรก)
    - ถ้า `slotStartMinutes - nowMinutes` อยู่ในช่วง **3-7 นาที** (tolerance)
    - `reference_key = 'brk5m_{bandId}_{todayStr}_{slotId}'` → เช็คซ้ำ
    - Target: เฉพาะ `members[].memberId` ของ slot นั้น
    - Push: title **"⏰ อีก 5 นาทีถึงเวลาเล่น"**, body **"เบรค {startTime}-{endTime} @ {venue_name}"**

    **E. งานนอกวันนี้ 5 นาทีก่อน start_time (`break_5min` สำหรับ external)**
    - Query `schedule` WHERE `type = 'external'` AND `date = todayStr`
    - parse `start_time` → minutes → เช็คว่าอยู่ในช่วง 3-7 นาทีก่อน
    - `reference_key = 'ext5m_{id}'`
    - Target: `schedule.members[]`
    - Push: title **"⏰ อีก 5 นาทีถึงเวลางานนอก"**, body **"{venue} — {start_time}"**

13. **VAPID Keys** — generate 1 ครั้ง, เก็บเป็น Supabase secrets:
    - `VAPID_PUBLIC_KEY` → ใช้ทั้ง client (`config.js`) + Edge Function
    - `VAPID_PRIVATE_KEY` → ใช้เฉพาะ Edge Function
    - `VAPID_SUBJECT` → `mailto:admin@soulciety.app`
    - Generate ด้วย `npx web-push generate-vapid-keys`

### Phase 6 — Cron Setup

14. **สร้าง SQL migration สำหรับ cron job** (ใน `supabase/migrate-notifications.sql`):
    ```sql
    SELECT cron.schedule(
      'send-notifications',
      '* * * * *',
      $$SELECT net.http_post(
        url := 'https://wsorngsyowgxikiepice.supabase.co/functions/v1/send-notifications',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
      )$$
    );
    ```
    - ทุก 1 นาที → Edge Function ตรวจสอบและส่ง notification ที่ถึงเวลา

### Phase 7 — Frontend Templates & Polish

15. **สร้าง `frontend/js_notification.html`** — GAS template version ของ `notification.js`

16. **อัปเดต `frontend/*.html` ทุกไฟล์** — เพิ่ม manifest link + Apple meta tags

17. **หน้า my-profile.html** — เพิ่ม section:
    - สถานะปัจจุบัน (เปิด/ปิด/ไม่รองรับ)
    - Toggle เปิด/ปิด
    - ปุ่มทดสอบส่ง notification
    - คำแนะนำ iOS พร้อมภาพ step-by-step

### Phase 8 — Cleanup & Log Rotation

18. **เพิ่มใน Edge Function**: ลบ `notification_log` ที่เก่ากว่า 7 วัน:
    ```sql
    DELETE FROM notification_log WHERE sent_at < now() - interval '7 days'
    ```

19. **เพิ่มใน Edge Function**: ลบ `push_subscriptions` ที่ push fail (HTTP 410 Gone):
    - Auto-cleanup subscription ที่หมดอายุ/ถูก revoke

---

## Verification

- ✅ Chrome Android → ได้ notification แม้ปิดเบราว์เซอร์
- ✅ Chrome Desktop → ได้ notification แม้ปิด tab
- ✅ iPhone (iOS 16.4+) → ต้อง Add to Home Screen ก่อน → ได้ notification
- ✅ Duplicate prevention → cron 2 ครั้งในนาทีเดียว → ส่งแค่ครั้งเดียว (notification_log UNIQUE constraint)
- ✅ Targeted member → สมาชิกที่ไม่ได้อยู่ในเบรค/งานนั้น → ไม่ได้ notification
- ✅ "ส่ง notification ทดสอบ" จาก my-profile → ได้ทันที
- ✅ `notification_log` → ไม่มี row ที่เก่ากว่า 7 วัน
- ✅ ลบ/reinstall app → re-subscribe → ได้ notification ปกติ

## Decisions

- **Web Push เท่านั้น** (ไม่ใช้ LINE) — ฟรี ไม่จำกัด, ทำงานได้แม้ปิดเบราว์เซอร์
- **ตั้ง target เฉพาะสมาชิกในงาน/เบรค** — ไม่ส่งแจ้งเตือนรวมทุกคนในวง
- **Cron ทุก 1 นาที** — ใช้ tolerance ±5 นาที + notification_log ป้องกันซ้ำ
- **Timezone hardcode UTC+7** — ใน Edge Function เท่านั้น (Thailand)
- **PWA ไม่ทำ offline cache** ในเฟสนี้ — เฉพาะ push notification
- **Deploy Edge Function ด้วย Supabase CLI** (`supabase functions deploy send-notifications`) — ฟรี
- งานร้าน (regular) ดึงจาก `band_settings.settings.schedule[day]` / งานนอก (external) ดึงจาก `schedule` table
- **pg_cron + pg_net** ฟรีบน Supabase (built-in extensions)
