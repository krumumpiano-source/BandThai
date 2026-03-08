/**
 * clear-artists-supabase.js
 * ล้างคอลัมน์ artist ในตาราง band_songs (global) ทั้งหมด
 * ใช้ Supabase REST API (PostgREST)
 *
 * วิธีรัน:  node clear-artists-supabase.js
 */

const SUPABASE_URL  = 'https://wsorngsyowgxikiepice.supabase.co';
const SUPABASE_ANON = 'sb_publishable_k2zvxeE9SJEEJkw3SVolqg_pkgZQPnm';

const HEADERS = {
  'apikey':        SUPABASE_ANON,
  'Authorization': 'Bearer ' + SUPABASE_ANON,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation'
};

async function main() {
  // 1) ดึงเพลงที่มี artist ไม่ว่าง (global songs เท่านั้น: band_id IS NULL)
  console.log('กำลังดึงเพลงที่มีชื่อศิลปิน...');

  const PAGE = 500;
  let allSongs = [];
  let offset = 0;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/band_songs?band_id=is.null&artist=neq.&select=id,name,artist&order=name&offset=${offset}&limit=${PAGE}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const errText = await res.text();
      console.error('ERROR fetching songs:', res.status, errText);
      return;
    }
    const data = await res.json();
    if (!data || data.length === 0) break;
    allSongs = allSongs.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`พบเพลงที่มี artist: ${allSongs.length} เพลง`);
  if (allSongs.length === 0) {
    console.log('ไม่มีเพลงที่ต้องล้าง — เสร็จแล้ว');
    return;
  }

  // แสดงตัวอย่าง 10 เพลงแรก
  console.log('\nตัวอย่างเพลงที่จะล้าง artist:');
  allSongs.slice(0, 10).forEach(function(s) {
    console.log(`  [${s.id}] ${s.name} — artist: "${s.artist}"`);
  });
  if (allSongs.length > 10) console.log(`  ... อีก ${allSongs.length - 10} เพลง`);

  // 2) Bulk PATCH: ล้าง artist ทั้งหมดในครั้งเดียว
  console.log('\nกำลังล้าง artist ทั้งหมด...');
  const patchUrl = `${SUPABASE_URL}/rest/v1/band_songs?band_id=is.null&artist=neq.`;
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ artist: '' })
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    console.error('ERROR bulk patch:', patchRes.status, errText);

    // Fallback: อัปเดตทีละเพลง
    console.log('\nลองอัปเดตทีละเพลง...');
    let ok = 0, fail = 0;
    for (const s of allSongs) {
      const u = `${SUPABASE_URL}/rest/v1/band_songs?id=eq.${s.id}`;
      const r = await fetch(u, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ artist: '' })
      });
      if (r.ok) { ok++; } else { fail++; }
    }
    console.log(`ผลลัพธ์: สำเร็จ ${ok}, ล้มเหลว ${fail}`);
    return;
  }

  console.log(`ล้าง artist สำเร็จทั้งหมด ${allSongs.length} เพลง`);

  // 3) ตรวจสอบ
  console.log('\nตรวจสอบ...');
  const checkUrl = `${SUPABASE_URL}/rest/v1/band_songs?band_id=is.null&artist=neq.&select=id&limit=1`;
  const checkRes = await fetch(checkUrl, { headers: HEADERS });
  const remaining = await checkRes.json();
  if (remaining.length === 0) {
    console.log('✅ ไม่มีเพลงที่มี artist เหลืออยู่ — เรียบร้อย!');
  } else {
    console.log('⚠️ ยังมีเพลงที่มี artist เหลืออยู่ — กรุณาตรวจสอบ');
  }
}

main().catch(function(err) {
  console.error('Fatal error:', err);
});
