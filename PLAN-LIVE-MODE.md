# Plan: Live Mode — ระบบเล่นเพลงสดแบบ Real-time

> สถานะ: **รอ Implement** | วันที่ร่าง: 1 มี.ค. 2026

## TL;DR

เพิ่มหน้า Live Mode สำหรับใช้ขณะแสดงสด — แสดง playlist แบบ fullscreen dark theme, สมาชิกทุกคนในวงควบคุมได้เท่าเทียมกันผ่าน Supabase Realtime (Broadcast channel), มี "จบเพลง" signal พร้อม pulse animation + auto-advance, ระบบ song request พร้อม autocomplete จาก band_songs, swipe gestures, wake lock, battery indicator และ UX features อื่นๆ รวม 10 ฟีเจอร์เสริมที่ approved แล้ว

**แหล่งข้อมูล playlist**: ดึงจาก `playlist_history` table (รายการเพลงที่ save ไว้ล่วงหน้า)  
**Realtime**: ใช้ Supabase Broadcast channel `live-{bandId}-{dateStr}`  
**Entry points**: ปุ่ม "🎤 Live" บน Dashboard + Songs page  
**Guest Access**: คนมาทำงานแทนสแกน QR Code จากสมาชิกในวง → เข้า Live Mode ได้ทันทีโดยไม่ต้องสมัครสมาชิก

---

## Steps

### Phase 1 — API Layer (`docs/js/supabase-api.js`)

1. **เพิ่ม `searchSongs` dispatch case** — query `band_songs` ด้วย `ilike` บน `name`, limit 10, return `{name, key, bpm, singer, artist}` สำหรับ autocomplete ตอนพิมพ์ชื่อเพลงขอ

### Phase 2 — Live Mode Page (`docs/live.html`)

2. **สร้างไฟล์ `docs/live.html`** — หน้า fullscreen dark-theme ใหม่ แบ่ง 3 โซน:
   - **Top Bar**: นาฬิกา real-time, ตัวนับเพลง (เพลงที่ X/ทั้งหมด), ปุ่มปรับ font size (A⁻/A⁺), battery indicator
   - **Now Playing**: ชื่อเพลง/คีย์/BPM ตัวใหญ่, แถบสี singer (ใช้สีเดียวกับระบบ pill), transition animation (pulse), note แสดงถ้ามี
   - **Song List**: scrollable list, เพลงถัดไป highlight, skip/request badges, swipe gestures

3. **"⏭ จบเพลง" button** — กดแล้ว:
   - Broadcast `song_ending` event ไปทุกคน
   - แสดง pulse animation (`song-ending-pulse` keyframes) 3 วินาที
   - Haptic feedback (`navigator.vibrate(200)`)
   - Auto-advance ไปเพลงถัดไปหลัง 3 วินาที
   - ใครกดก็ได้ (ทุกคนเท่าเทียม)

4. **"➕ เพลงขอ" (Song Request)** — กดแล้ว:
   - เปิด modal พิมพ์ชื่อเพลง
   - **Autocomplete** จาก `searchSongs` API (debounce 300ms, ≥2 ตัวอักษร) — เลือกแล้วเติม key/bpm อัตโนมัติ
   - **Free-text fallback**: ถ้าไม่เลือกจาก autocomplete สามารถพิมพ์ชื่อเองได้ + optional key/BPM
   - แทรกเพลงต่อจากเพลงปัจจุบัน (ไม่ใช่ท้ายลิสต์)
   - แสดง badge "ขอ" สีพิเศษบนเพลงที่เป็น request

5. **Skip without delete** — swipe ซ้ายหรือกดปุ่ม skip:
   - ไม่ลบออกจากลิสต์ → แค่ dim + strikethrough
   - สามารถ un-skip ได้ (กดอีกครั้ง)
   - เพลงที่ skip จะถูกข้ามตอน auto-advance

6. **Notes (long press)** — กดค้างที่เพลง:
   - เปิด input เขียนโน้ตสั้นๆ (เช่น "เล่นช้ากว่าปกติ", "คีย์เดิม")
   - Broadcast `note_update` ให้ทุกคนเห็น
   - แสดงเป็น subtitle เล็กๆ ใต้ชื่อเพลง

7. **Encore/Repeat** — ปุ่ม 🔁 ข้างเพลง:
   - กดแล้วเพิ่มเพลงเดิมอีกครั้งต่อจากเพลงปัจจุบัน

8. **Transpose on Live** — กดที่ key ของเพลง:
   - เปิด transpose controls (+/- semitone)
   - Broadcast `transpose` event → ทุกคนเห็น key เปลี่ยนพร้อมกัน
   - ใช้ `MAJOR_KEYS` / `MINOR_KEYS` arrays จาก songs.html

9. **"จบเบรค" button** — กดแล้ว:
   - ถ้ามีการเปลี่ยนแปลง (`isModified`) → auto-save ไป `playlist_history` via `apiCall('savePlaylistHistory')`
   - Release wake lock
   - ออก Realtime channel
   - Navigate กลับหน้าเดิม (dashboard หรือ songs)

10. **`beforeunload` guard** — ถ้า `isModified` → แสดง confirm dialog ป้องกัน back/refresh ที่ไม่ตั้งใจ

### Phase 3 — Real-time Sync (Supabase Broadcast)

11. **สร้าง Broadcast channel**: `window._sb.channel('live-' + bandId + '-' + dateStr)`
    - Events:
      - `state_sync` — sync เต็มรูปแบบ (currentIndex, playlist, skippedSet, notes) สำหรับคนเข้าใหม่
      - `song_ending` — signal จบเพลง + auto-advance
      - `transpose` — key change
      - `note_update` — เพิ่ม/แก้ note
      - `request_song` — เพลงขอใหม่
      - `skip_song` / `unskip_song` — skip/un-skip

12. **New joiner sync** — คนเข้าห้องทีหลัง:
    - เข้า channel → broadcast `request_state`
    - คนที่อยู่ก่อน respond ด้วย `state_sync` (เฉพาะ 1 คน ใช้ leader election แบบง่าย — คนที่ joinedAt เก่าที่สุด)

### Phase 4 — Entry Points

13. **แก้ `docs/dashboard.html`** — เพิ่มปุ่ม "🎤 Live" ใน `#dashPlaylistCard` header:
    - แสดงเมื่อมี playlist ของวันนี้
    - Navigate ไป `live.html?date=...&venue=...&timeSlot=...`

14. **แก้ `docs/songs.html`** — เพิ่มปุ่ม "🎤 Live" ใน action-buttons:
    - แสดงเมื่อมี playlist ใน `playlistData[]`
    - Navigate ไป `live.html` พร้อม query params

### Phase 4.5 — Guest Access (คนมาทำงานแทน / ตัวแทน)

> กรณีที่มีคนนอกมาเล่นแทนสมาชิก — ไม่ต้องสมัครสมาชิก สแกน QR Code จากใครก็ได้ในวงเพื่อเข้า Live Mode ได้ทันที

15. **QR Code Generator** — สมาชิกในวงสร้าง QR ได้จากหน้า Live Mode:
    - ปุ่ม "📱 แชร์ Live" ใน Top Bar
    - สร้าง URL: `live.html?guest=1&band={bandId}&date={date}&venue={venue}&timeSlot={slot}&token={guestToken}`
    - `guestToken` = short-lived token (เช่น JWT หรือ random hash) เก็บใน `live_guest_tokens` table
      - `token` text PK
      - `band_id` text NOT NULL
      - `created_by` uuid (สมาชิกที่สร้าง)
      - `date` text NOT NULL (ใช้ได้เฉพาะวันนี้)
      - `expires_at` timestamptz (หมดอายุหลัง 12 ชม.)
    - แสดง QR Code popup (ใช้ library เช่น `qrcode.js` หรือ Google Charts QR API)
    - สมาชิกคนไหนในวงก็สร้าง QR ได้

16. **Guest Landing** — เมื่อคนนอกสแกน QR:
    - ตรวจสอบ `guestToken` → เช็คว่ายังไม่หมดอายุ + ตรงวันที่
    - **ไม่ต้อง login / ไม่ต้องสมัครสมาชิก**
    - เข้าหน้า Live Mode ได้ทันทีในโหมด guest
    - ใช้ Supabase **anon key** + Broadcast channel ได้ปกติ (Broadcast ไม่ต้อง auth)
    - เก็บ `guestToken` ใน sessionStorage เพื่อกัน refresh หลุด

17. **Guest Permissions** — คนนอกทำได้:
    - ✅ ดู playlist / Now Playing / notes ทั้งหมด
    - ✅ กด "จบเพลง" (ควบคุมเท่าเทียมเหมือนสมาชิก)
    - ✅ Transpose
    - ✅ ดู singer colors, clock, font size
    - ❌ **ไม่สามารถ** เพิ่ม/ลบ/skip เพลง (ป้องกันคนนอกแก้ลิสต์)
    - ❌ **ไม่สามารถ** กด "จบเบรค" (เฉพาะสมาชิกจริง)
    - ❌ **ไม่เห็น** ปุ่ม "📱 แชร์ Live" (ไม่สร้าง QR ต่อ)

18. **Guest UI Indicator**:
    - Top Bar แสดง badge "👤 Guest" เพื่อให้รู้ว่าเป็นโหมด guest
    - ปุ่มที่ไม่มีสิทธิ์จะซ่อนหรือ disabled

19. **Token Cleanup** — Edge Function หรือ cron:
    - ลบ `live_guest_tokens` ที่ `expires_at < now()` ทุกวัน
    - หรือเพิ่มใน notification Edge Function ที่มีอยู่แล้ว (Phase 8 cleanup)

### Phase 5 — UX Features

20. **Singer color bar** — แถบสีข้างเพลงตามนักร้อง:
    - ใช้สีเดียวกับ singer pill system ที่มีอยู่แล้ว
    - แสดงข้างซ้ายของ Now Playing และ song list items

21. **Swipe gestures**:
    - Swipe ซ้าย → skip เพลง (dim + strikethrough)
    - Swipe ขวา → un-skip
    - ใช้ touch events (`touchstart`, `touchmove`, `touchend`)

22. **Clock real-time** — มุมขวาบน Top Bar:
    - `setInterval` ทุกวินาที แสดงเวลาปัจจุบัน HH:MM:SS
    - Font ขนาดเล็กไม่เกะกะ

23. **Font size control** — ปุ่ม A⁻/A⁺ ใน Top Bar:
    - ปรับ 3 ระดับ (S/M/L)
    - เก็บใน localStorage
    - ปรับเฉพาะ Now Playing zone

24. **Haptic feedback** — `navigator.vibrate()`:
    - 200ms เมื่อ "จบเพลง"
    - 100ms เมื่อ tap เปลี่ยนเพลง
    - 50ms เมื่อ skip

25. **Wake Lock** — `navigator.wakeLock.request('screen')`:
    - เปิดตอนเข้า Live Mode
    - ปิดตอน "จบเบรค" หรือ visibility change
    - Re-acquire เมื่อ tab กลับมา visible

26. **Battery indicator** — `navigator.getBattery()`:
    - แสดงไอคอน + % มุมขวาบน
    - เปลี่ยนสีเป็นแดงเมื่อ < 20%

### Phase 6 — Frontend Template + Polish

27. **สร้าง `frontend/live.html`** — GAS template version ใช้ `<?!= include() ?>` pattern

---

## Verification

- เปิด Live Mode จาก Dashboard → เห็น playlist ของวันนี้ถูกต้อง
- **Guest Access**: สมาชิกกด "📱 แชร์ Live" → ได้ QR Code → คนนอกสแกน → เข้า Live Mode ได้ทันทีโดยไม่ต้อง login
- **Guest Permissions**: คนนอกเห็น playlist + กด "จบเพลง" + transpose ได้ แต่ไม่สามารถเพิ่ม/ลบ/skip เพลง หรือกด "จบเบรค"
- **Token Expiry**: QR ที่สร้างหมดอายุหลัง 12 ชม. → สแกนหลังหมดอายุ → แสดง "ลิงก์หมดอายุ"
- เปิดจาก 2 เครื่องพร้อมกัน → กด "จบเพลง" จากเครื่อง 1 → เครื่อง 2 เห็น pulse + auto-advance
- กด "➕ เพลงขอ" → พิมพ์ชื่อ → autocomplete dropdown ปรากฏ → เลือก → เพลงแทรกถูกตำแหน่ง
- พิมพ์เพลงที่ไม่มีใน library → free-text ใส่ key/bpm เอง → เพลงแทรกได้
- Skip เพลง → dim + strikethrough → auto-advance ข้าม → un-skip ได้
- Transpose → เครื่องทุกคนเห็น key เปลี่ยน
- "จบเบรค" → save to playlist_history + กลับ dashboard
- ปิดจอมือถือ → จอไม่ดับ (wake lock)
- Battery < 20% → แสดงสีแดง
- คนเข้าทีหลัง → ได้ state ล่าสุด (currentIndex, notes, skips)

## Decisions

- **Realtime = Supabase Broadcast** (ไม่ใช้ Presence เพราะไม่ต้อง track ว่าใครออนไลน์)
- **ทุกคนควบคุมเท่าเทียม** — ไม่มี "host" หรือ "leader"
- **จบเบรค = ปุ่มกดเอง** (ไม่ auto-end ตามเวลา)
- **Song request แทรกหลังเพลงปัจจุบัน** (ไม่ใช่ท้ายลิสต์)
- **Skip ไม่ลบ** — dim + strikethrough เพื่อยังเห็นอยู่
- **Autocomplete จาก band_songs** + free-text fallback
- **Dark theme เต็มจอ** — ใช้งานบนเวทีได้ดี
- **Guest access ผ่าน QR Code** — คนมาแทนสแกนเข้า Live ได้ทันที ไม่ต้องสมัครสมาชิก, token หมดอายุ 12 ชม., สิทธิ์จำกัด (ดู+จบเพลง+transpose เท่านั้น)
