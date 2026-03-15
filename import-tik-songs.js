// import-tik-songs.js — เพิ่มเพลงพี่ติ๊กเข้า global library + คลังวง SoulCiety
// ใช้ Supabase REST API เหมือนที่แอพใช้จริง — ไม่มี raw SQL
const https = require('https');
const fs    = require('fs');

const SUPABASE_URL = 'https://wsorngsyowgxikiepice.supabase.co';
const SERVICE_KEY  = (() => {
  const env = fs.readFileSync('.env.local', 'utf8');
  const line = env.split('\n').find(l => l.startsWith('SUPABASE_SERVICE_ROLE='));
  return line ? line.split('=')[1].trim() : '';
})();

if (!SERVICE_KEY) { console.error('❌ ไม่พบ SUPABASE_SERVICE_ROLE ใน .env.local'); process.exit(1); }

// ── REST Helper ────────────────────────────────────────────────
function rest(method, table, params, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    let qs = '';
    if (params) {
      qs = '?' + Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    }
    const headers = {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request({
      hostname: 'wsorngsyowgxikiepice.supabase.co',
      path: '/rest/v1/' + table + qs,
      method, headers
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d || '[]')); } catch { resolve(d); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}
const dbGet  = (t, p)    => rest('GET',  t, p, null);
const dbPost = (t, body) => rest('POST', t, null, body);

// ── Normalization: ชื่อผิด/ซ้ำ → ชื่อที่ถูกต้อง (null = ตัดออก) ──
const NORMALIZE = {
  'to much so much':  null,
  'งัดทั้งงัด':       'งัดถั่งงัด',
  'สตอเบอรี่แหล':    null,
  'สตอเบอรี่':        null,
  'สตอ':              null,
  'รักควายควาย':      null,
};
// เพลงที่ CSV มีซ้ำ — เก็บแค่ครั้งแรก
const KEEP_ONE = new Set(['คบไม่ได้', 'เจ็บกระดองใจ', 'ทิ้งรักลงแม่น้ำ']);

// ── อ่านและ clean CSV ──────────────────────────────────────────
const CSV_PATH = 'C:\\Users\\krumu\\Downloads\\เพลงพี่ติ๊กมือกลอง - ชีต1.csv';
const rawLines = fs.readFileSync(CSV_PATH, 'utf8')
  .split('\n')
  .map(l => l.trim().replace(/\r/g, '').replace(/^"|"$/g, ''))
  .filter(l => l && l !== '2-1 = 0');

const seenOnce = {};
const SONGS = [];
for (const line of rawLines) {
  const lookup = line.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(NORMALIZE, lookup)) {
    if (NORMALIZE[lookup] === null) continue;
  }
  const name = NORMALIZE[lookup] || line.trim();
  const normKey = name.toLowerCase().trim();
  if (KEEP_ONE.has(name) && seenOnce[normKey]) continue;
  seenOnce[normKey] = true;
  SONGS.push(name);
}
const uniqueSongs = [...new Set(SONGS)];
console.log(`📄 CSV สุทธิ: ${uniqueSongs.length} เพลง (จาก ${rawLines.length} บรรทัด)\n`);

// ── Main ───────────────────────────────────────────────────────
async function main() {
  // 1. หาวง SoulCiety พะเยา
  console.log('🔍 กำลังหาวง SoulCiety พะเยา...');
  const bands  = await dbGet('bands', { select: 'id,band_name,province' });
  if (!Array.isArray(bands)) { console.error('❌ โหลดวงไม่ได้:', bands); return; }
  const target = bands.find(b =>
    b.band_name && (b.band_name.toLowerCase().includes('soul') || b.band_name.includes('พะเยา'))
  );
  if (!target) {
    console.log('วงทั้งหมด:');
    bands.forEach(b => console.log(`  ${b.id} | ${b.band_name} | ${b.province || ''}`));
    console.error('\n❌ ไม่พบวง SoulCiety พะเยา');
    return;
  }
  const BAND_ID = target.id;
  console.log(`✅ วง: "${target.band_name}" | band_id: ${BAND_ID}\n`);

  // 2. โหลด global library
  console.log('📚 โหลด global library...');
  const globalSongs = await dbGet('band_songs', { source: 'eq.global', select: 'id,name' });
  const globalMap   = {};
  (Array.isArray(globalSongs) ? globalSongs : [])
    .forEach(s => { globalMap[s.name.toLowerCase().trim()] = s.id; });
  console.log(`  มีอยู่แล้ว: ${Object.keys(globalMap).length} เพลง\n`);

  // 3. แยก: มีแล้ว vs ต้องเพิ่มใหม่
  const alreadyExist = [];
  const toAdd        = [];
  for (const name of uniqueSongs) {
    const key = name.toLowerCase().trim();
    if (globalMap[key]) alreadyExist.push({ name, id: globalMap[key] });
    else                toAdd.push(name);
  }

  console.log('📊 ผลตรวจซ้ำ:');
  console.log(`  มีในคลังกลางแล้ว: ${alreadyExist.length} เพลง → ใช้ของเดิม`);
  console.log(`  ต้องเพิ่มใหม่:     ${toAdd.length} เพลง`);
  if (toAdd.length) {
    toAdd.forEach(n => console.log('    +', n));
  }
  console.log();

  // 4. เพิ่มเพลงใหม่เข้า global library
  const newlyAdded = [];
  if (toAdd.length > 0) {
    console.log('➕ เพิ่มเพลงใหม่เข้า global library...');
    const BATCH = 50;
    for (let i = 0; i < toAdd.length; i += BATCH) {
      const rows = toAdd.slice(i, i + BATCH).map(name => ({ name, source: 'global' }));
      const res  = await dbPost('band_songs', rows);
      if (!Array.isArray(res)) {
        console.error('  ❌ batch error:', JSON.stringify(res).substring(0, 300));
      } else {
        res.forEach(r => newlyAdded.push({ name: r.name, id: r.id }));
        console.log(`  +${res.length} เพลง`);
      }
    }
    console.log(`  ✅ เพิ่มสำเร็จ ${newlyAdded.length}/${toAdd.length} เพลง\n`);
  }

  // 5. รวม id ทั้งหมด
  const allIds = [
    ...alreadyExist.map(s => s.id),
    ...newlyAdded.map(s => s.id),
  ].filter(Boolean);

  // 6. โหลด refs ที่มีในวงแล้ว
  console.log(`🔗 Link เพลงเข้าคลังวง "${target.band_name}"...`);
  const existRefs = await dbGet('band_song_refs', { band_id: `eq.${BAND_ID}`, select: 'song_id' });
  const refSet    = {};
  (Array.isArray(existRefs) ? existRefs : []).forEach(r => { refSet[r.song_id] = true; });

  const toLink  = allIds.filter(id => !refSet[id]);
  const skipped = allIds.length - toLink.length;
  console.log(`  link อยู่แล้ว:  ${skipped} เพลง`);
  console.log(`  ต้อง link ใหม่: ${toLink.length} เพลง`);

  // 7. Insert refs
  if (toLink.length > 0) {
    const BATCH = 100;
    for (let i = 0; i < toLink.length; i += BATCH) {
      const rows = toLink.slice(i, i + BATCH).map(id => ({ band_id: BAND_ID, song_id: id }));
      const res  = await dbPost('band_song_refs', rows);
      if (!Array.isArray(res)) {
        console.error('  ❌ refs batch error:', JSON.stringify(res).substring(0, 300));
      } else {
        console.log(`  +${res.length} refs`);
      }
    }
  }

  // 8. สรุปผล
  const finalRefs = await dbGet('band_song_refs', { band_id: `eq.${BAND_ID}`, select: 'song_id' });
  console.log(`\n✅ เสร็จสมบูรณ์!`);
  console.log(`  คลังวง "${target.band_name}": ${Array.isArray(finalRefs) ? finalRefs.length : '?'} เพลง`);
}

main().catch(console.error);
