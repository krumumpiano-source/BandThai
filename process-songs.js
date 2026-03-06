const https = require('https');
const fs = require('fs');

const PAT = 'sbp_8f89f1ff1c856bc2bbd8159a6fa2943d0a9b7222';
const PROJECT = 'wsorngsyowgxikiepice';

function query(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(data); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function readCSV(file) {
  return fs.readFileSync(`c:\\Users\\krumu\\Downloads\\${file}`, 'utf8')
    .split('\n').map(l => l.split(',').map(s => s.trim()));
}

// Key conversion: letter key -> #/b format
const KEY_MAP = {
  'C': 'C', 'Am': 'C',
  'G': '1#', 'Em': '1#',
  'D': '2#', 'Bm': '2#',
  'A': '3#', 'F#m': '3#',
  'E': '4#', 'C#m': '4#', 'Dbm': '4#',
  'B': '5#', 'G#m': '5#', 'Abm': '5#',
  'F#': '6#', 'Gb': '6#', 'D#m': '6#', 'Ebm': '6#',
  'C#': '7#', 'Db': '7#', 'A#m': '7#', 'Bbm': '7#',
  'F': '1b', 'Dm': '1b',
  'Bb': '2b', 'Gm': '2b',
  'Eb': '3b', 'Cm': '3b',
  'Ab': '4b', 'Fm': '4b',
  'Db': '5b', 'Bbm': '5b',
  'Gb': '6b', 'Ebm': '6b',
  'F#m': '3#', // enharmonic
};

function convertKey(raw) {
  if (!raw) return null;
  let k = raw.trim();
  // Already in #/b format
  if (/^[1-7][#b]$/.test(k)) return k;
  if (k === 'C' || k === 'c') return 'C';
  // Try direct map
  if (KEY_MAP[k]) return KEY_MAP[k];
  // Handle C#m, etc
  if (KEY_MAP[k.replace(/\s/g, '')]) return KEY_MAP[k.replace(/\s/g, '')];
  return null;
}

// Clean song name - remove embedded keys/BPM
function cleanName(raw) {
  if (!raw) return null;
  let s = raw.trim();
  if (!s || s.length < 2) return null;
  
  // Remove trailing key annotations like " C", " Dm", " Bb", " A*****"
  s = s.replace(/\s+[ABCDEFG][#b]?m?\**\s*$/i, '');
  // Remove trailing " ขึ้น F" etc
  s = s.replace(/\s+ขึ้น\s+[A-G][#b]?m?/i, '');
  // Remove trailing dots with BPM: ". 114"
  s = s.replace(/\.\s*\d+\s*$/, '');
  // Remove trailing BPM number
  s = s.replace(/\s+\d{2,3}\s*$/, '');
  
  return s.trim() || null;
}

// Extract embedded key from song name
function extractKey(name) {
  if (!name) return null;
  // "กรุณาฟังให้จบ C" -> C
  const m = name.match(/\s+([ABCDEFG][#b]?m?)\s*$/i);
  if (m) return m[1];
  // "ขอโทษ A*****" -> A
  const m2 = name.match(/\s+([ABCDEFG])\*+\s*$/i);
  if (m2) return m2[1];
  return null;
}

async function main() {
  // Load existing songs
  const existing = JSON.parse(fs.readFileSync('existing-songs.json', 'utf8'));
  console.log(`Loaded ${existing.length} existing songs from DB`);
  
  // Build lookup by normalized name
  const existMap = {};
  for (const s of existing) {
    existMap[s.name.toLowerCase().trim()] = s;
  }
  
  // Master collection
  const master = new Map(); // normalized name -> { name, artist, key, bpm, singer, era, mood, sources }
  
  function addSong(name, data = {}) {
    if (!name || name.length < 2) return;
    // Skip headers, keys, numbers
    const skip = ['เก่า','กลาง','ใหม่','เก่ามาก','ล่าสุด','สากล','ชื่อเพลง','เตรียมเพลง','ช้า','เร็ว','นักร้อง','ความเร็ว','คีย์','แนวเพลง','ศิลปิน','Keyboard','Bass','Guitar','Drum','เก่ากลาง-เก่า','เก่าไม่มาก-ใหม่','โจ๊ะลูกทุ่ง','ลูกทุ่ง','เพลงวง'];
    if (skip.includes(name)) return;
    if (/^\d+$/.test(name)) return; // pure number
    if (/^[1-7][#b]/.test(name) && name.length <= 8) return; // key notation like "1#", "2# / 1#"
    if (/^[CDEFGAB][#b]?m?$/i.test(name)) return; // single key
    if (/^\/+$/.test(name)) return;
    if (/^[TN\/]+$/.test(name) && name.length <= 3) return;
    if (name === '*' || name === '**') return;
    
    const embKey = extractKey(name);
    const cleaned = cleanName(name) || name;
    const norm = cleaned.toLowerCase().trim();
    
    if (!master.has(norm)) {
      master.set(norm, { name: cleaned, artist: null, key: null, bpm: null, singer: null, era: null, mood: null, sources: [] });
    }
    const entry = master.get(norm);
    if (data.source && !entry.sources.includes(data.source)) entry.sources.push(data.source);
    if (data.bpm && !entry.bpm) entry.bpm = data.bpm;
    if (data.key && !entry.key) entry.key = convertKey(data.key);
    if (embKey && !entry.key) entry.key = convertKey(embKey);
    if (data.singer && !entry.singer) entry.singer = data.singer;
    if (data.artist && !entry.artist) entry.artist = data.artist;
    if (data.era && !entry.era) entry.era = data.era;
  }
  
  // === Parse โทน.csv (Thai songs) ===
  console.log('\nParsing โทน.csv...');
  const ton = readCSV('รายชื่อเพลงพระราม8.xlsx - โทน.csv');
  for (let i = 1; i < ton.length; i++) {
    const [name, key, bpm] = ton[i];
    if (!name || name === 'ชื่อเพลง') continue;
    const bpmClean = bpm ? bpm.replace(/\s*\(?(6\/8)\)?\s*/g, '').trim() : null;
    addSong(name, { key, bpm: bpmClean && /^\d+$/.test(bpmClean) ? bpmClean : null, source: 'โทน' });
  }
  
  // === Parse โทน สากล.csv (International) ===
  console.log('Parsing โทน สากล.csv...');
  const tonI = readCSV('รายชื่อเพลงพระราม8.xlsx - โทน สากล.csv');
  for (let i = 1; i < tonI.length; i++) {
    const [name, key, bpm] = tonI[i];
    if (!name || name === 'ชื่อเพลง') continue;
    const bpmClean = bpm ? bpm.replace(/\s*\(?(6\/8)\)?\s*/g, '').trim() : null;
    addSong(name, { key, bpm: bpmClean && /^\d+$/.test(bpmClean) ? bpmClean : null, source: 'โทนสากล' });
  }
  
  // === Parse ลิสวง.csv (5 sections: เก่า/กลาง/ใหม่/สากล/ลูกทุ่ง) ===
  console.log('Parsing ลิสวง.csv...');
  const lis = readCSV('พรหมลิขิต - ลิสวง.csv');
  for (let i = 1; i < lis.length; i++) {
    const row = lis[i];
    // 5 sections of 4 cols each (name, singer, bpm, key) separated by empty col
    const sections = [
      { s: 0, era: '80s-90s' }, // เก่า
      { s: 5, era: '90s-2000s' }, // กลาง
      { s: 10, era: '2010s-2020s' }, // ใหม่
      { s: 15, era: null }, // สากล
      { s: 20, era: null }  // ลูกทุ่ง
    ];
    for (const { s, era } of sections) {
      const name = (row[s] || '').trim();
      const singer = (row[s + 1] || '').trim();
      const bpm = (row[s + 2] || '').trim();
      const key = (row[s + 3] || '').trim();
      if (!name || name === 'เก่า' || name === 'กลาง' || name === 'ใหม่' || name === 'สากล' || name === 'ลูกทุ่ง') continue;
      
      let singerType = null;
      if (singer === 'T') singerType = 'ชาย';
      else if (singer === 'N') singerType = 'หญิง';
      else if (singer === 'T/N' || singer === 'TN' || singer === 'N/T') singerType = 'คู่';
      
      addSong(name, { 
        bpm: bpm && /^\d+$/.test(bpm) ? bpm : null,
        key: key && key !== '*' ? key : null,
        singer: singerType,
        source: 'ลิสวง'
      });
    }
  }
  
  // === Parse เพลงเก่าของร้าน.csv ===
  console.log('Parsing เพลงเก่าของร้าน.csv...');
  const old = readCSV('พรหมลิขิต - เพลงเก่าของร้าน.csv');
  for (let i = 1; i < old.length; i++) {
    const [name, artist, key, bpm, gender] = old[i];
    if (!name || name === 'ชื่อเพลง') continue;
    let singerType = null;
    if (gender === 'ชาย') singerType = 'ชาย';
    else if (gender === 'หญิง') singerType = 'หญิง';
    addSong(name, { artist: artist || null, singer: singerType, source: 'เพลงเก่าร้าน' });
  }
  
  // === Parse มิว.csv (same 5-section format) ===
  console.log('Parsing มิว.csv...');
  const miu = readCSV('พรหมลิขิต - มิว.csv');
  for (let i = 1; i < miu.length; i++) {
    const row = miu[i];
    const sections = [
      { s: 0 }, { s: 5 }, { s: 10 }, { s: 15 }, { s: 20 }
    ];
    for (const { s } of sections) {
      const name = (row[s] || '').trim();
      const singer = (row[s + 1] || '').trim();
      const bpm = (row[s + 2] || '').trim();
      const key = (row[s + 3] || '').trim();
      if (!name) continue;
      let singerType = null;
      if (singer === 'T') singerType = 'ชาย';
      else if (singer === 'N') singerType = 'หญิง';
      else if (singer === 'T/N' || singer === 'TN') singerType = 'คู่';
      addSong(name, { 
        bpm: bpm && /^\d+$/.test(bpm) ? bpm : null,
        key: key && key !== '*' ? key : null,
        singer: singerType,
        source: 'มิว'
      });
    }
  }
  
  // === Parse ตอง.csv (5 columns of era, names only) ===
  console.log('Parsing ตอง.csv...');
  const tong = readCSV('พรหมลิขิต - ตอง.csv');
  for (let i = 1; i < tong.length; i++) {
    const row = tong[i];
    for (let c = 0; c < Math.min(row.length, 5); c++) {
      const name = (row[c] || '').trim();
      if (!name) continue;
      addSong(name, { source: 'ตอง' });
    }
  }
  
  // === Parse นิโย.csv (7 columns) ===
  console.log('Parsing นิโย.csv...');
  const niyo = readCSV('พรหมลิขิต - นิโย.csv');
  for (let i = 1; i < niyo.length; i++) {
    const row = niyo[i];
    for (let c = 0; c < Math.min(row.length, 7); c++) {
      const name = (row[c] || '').trim();
      if (!name) continue;
      addSong(name, { source: 'นิโย' });
    }
  }
  
  // === Parse สำรองลูกทุ่ง.csv (columns by artist) ===
  console.log('Parsing สำรองลูกทุ่ง.csv...');
  const luk = readCSV('พรหมลิขิต - สำรองลูกทุ่ง.csv');
  // First row has artist names as headers
  const lukHeaders = luk[0] || [];
  for (let i = 1; i < luk.length; i++) {
    for (let c = 0; c < luk[i].length; c++) {
      const name = (luk[i][c] || '').trim();
      if (!name) continue;
      // Column header might be artist name
      const artist = (lukHeaders[c] || '').trim();
      // Skip if the cell IS an artist name (used as header)
      const isArtist = ['ช้า','เร็ว','ชาย เมืองสิงห์','สายัณห์ สัญญา','ยอดรัก สลักใจ','มนต์สิทธิ์ คำสร้อย','ไมค์ ภิรมย์พร','เอิร์น เดอะสตาร์','หนู มิเตอร์','ต่าย อรทัย','ตั๊กแตน ชลดา','เบนซ์ พริกไทย','ลำไย ไหทองคำ','กุ้ง สุทธิราช','ก้อง ห้วยไร่','มนต์แคน แก่นคูน','เจมส์ จิรายุ','บิว กัลยาณี','ปรีชา ปัดภัย','กระแต อาร์สยาม','หญิงลี ศรีจุมพล','หนูนา หนึ่งธิดา','เต๋า ภูศิลป์','วงพัทลุง','ข้าวทิพย์','อ๊อฟ ปองศักดิ์','จินตหรา พูนลาภ','ศิริพร อำไพพงษ์'].includes(name);
      if (isArtist) continue;
      addSong(name, { source: 'สำรองลูกทุ่ง' });
    }
  }
  
  // === Parse สำรองเก่า+เพื่อชีวิต.csv ===
  console.log('Parsing สำรองเก่า+เพื่อชีวิต.csv...');
  const old2 = readCSV('พรหมลิขิต - สำรองเก่า+เพื่อชีวิต.csv');
  const old2Headers = old2[0] || [];
  for (let i = 1; i < old2.length; i++) {
    for (let c = 0; c < old2[i].length; c++) {
      const name = (old2[i][c] || '').trim();
      if (!name) continue;
      const headerArtists = ['อัศนี วสันต์','เรนโบว์','คีรีบูน','แจ้','ไมโคร','นูโว','คาราบาว','พงษ์สิทธิ์','พงษ์เทพ','มาลีฮวนน่า','ซูซู','ยิว','เด็กเลี้ยงควาย','นภ พรชำนิ','เสถียร ทำมือ','บิลลี่โอแกน','ธีร์ ไชยเดช','ดิมเพ้นท์','ก','-','*','#'];
      if (headerArtists.includes(name)) continue;
      // Skip * and # markers
      if (name === '*' || name === '#') continue;
      addSong(name, { source: 'สำรองเก่า' });
    }
  }
  
  // === Categorize results ===
  const newSongs = [];
  const existingWithUpdates = [];
  const alreadyExists = [];
  
  for (const [norm, data] of master) {
    // Check various name formats against DB
    const found = existMap[norm] 
      || existMap[data.name.toLowerCase()]
      || existMap[data.name.replace(/\s+/g, '').toLowerCase()];
    
    if (found) {
      alreadyExists.push({ ...data, dbName: found.name, dbId: found.id });
      // Check if we can update BPM/key
      if ((data.bpm && !found.bpm) || (data.key && !found.key)) {
        existingWithUpdates.push({
          dbId: found.id,
          dbName: found.name,
          newBpm: data.bpm && !found.bpm ? data.bpm : null,
          newKey: data.key && !found.key ? data.key : null,
          currentBpm: found.bpm,
          currentKey: found.key
        });
      }
    } else {
      newSongs.push(data);
    }
  }
  
  // Sort
  newSongs.sort((a, b) => a.name.localeCompare(b.name, 'th'));
  
  // Output
  const out = [];
  out.push(`=== SONG ANALYSIS ===`);
  out.push(`Total extracted from CSVs: ${master.size}`);
  out.push(`Already in DB: ${alreadyExists.length}`);
  out.push(`New songs to insert: ${newSongs.length}`);
  out.push(`Existing needing BPM/key update: ${existingWithUpdates.length}`);
  out.push('');
  
  out.push(`\n--- NEW SONGS (${newSongs.length}) ---`);
  for (const s of newSongs) {
    const parts = [s.name];
    if (s.key) parts.push(`key=${s.key}`);
    if (s.bpm) parts.push(`bpm=${s.bpm}`);
    if (s.singer) parts.push(`singer=${s.singer}`);
    parts.push(`[${s.sources.join(',')}]`);
    out.push(parts.join(' | '));
  }
  
  out.push(`\n--- BPM/KEY UPDATES (${existingWithUpdates.length}) ---`);
  for (const u of existingWithUpdates) {
    const parts = [`"${u.dbName}"`];
    if (u.newBpm) parts.push(`bpm: null→${u.newBpm}`);
    if (u.newKey) parts.push(`key: null→${u.newKey}`);
    out.push(parts.join(' | '));
  }
  
  out.push(`\n--- ALREADY IN DB (${alreadyExists.length}) ---`);
  for (const s of alreadyExists) {
    out.push(`  ✓ ${s.name} → "${s.dbName}"`);
  }
  
  const report = out.join('\n');
  fs.writeFileSync('song-report.txt', report, 'utf8');
  console.log(report);
}

main().catch(console.error);
