// Generate SQL: BPM/key updates for existing songs + New song inserts
const fs = require('fs');
const https = require('https');

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

// Key conversion
const KEY_MAP = {
  'C': 'C', 'Am': 'C', 'c': 'C',
  'G': '1#', 'Em': '1#',
  'D': '2#', 'Bm': '2#',
  'A': '3#', 'F#m': '3#',
  'E': '4#', 'C#m': '4#',
  'B': '5#', 'G#m': '5#',
  'F#': '6#', 'D#m': '6#',
  'C#': '7#',
  'F': '1b', 'Dm': '1b',
  'Bb': '2b', 'Gm': '2b',
  'Eb': '3b', 'Cm': '3b',
  'Ab': '4b', 'Fm': '4b',
  'Db': '5b', 'Bbm': '5b',
  'Gb': '6b', 'Ebm': '6b',
};

function convertKey(k) {
  if (!k) return null;
  k = k.trim();
  if (/^[1-7][#b]$/.test(k)) return k;
  if (k === 'C' || k === 'c') return 'C';
  if (KEY_MAP[k]) return KEY_MAP[k];
  return null;
}

function esc(s) { return s ? s.replace(/'/g, "''") : ''; }

async function main() {
  const existing = JSON.parse(fs.readFileSync('existing-songs.json', 'utf8'));
  const existMap = {};
  for (const s of existing) {
    existMap[s.name.toLowerCase().trim()] = s;
  }

  const sql = [];
  
  // ============================================
  // PART 1: BPM/KEY UPDATES FOR EXISTING SONGS
  // ============================================
  sql.push('-- ============================================');
  sql.push('-- PART 1: BPM/KEY UPDATES FOR EXISTING SONGS');
  sql.push('-- ============================================');
  
  // From โทน.csv - these have the most reliable BPM/key data
  const tonUpdates = [
    // [DB song name (exact), field updates {bpm, key}]
    ['ฉันไม่มี', { bpm: 62 }],
    ['มือลั่น', { bpm: 65 }],
    ['ทางผ่าน', { bpm: 68 }],
    ['ขัดใจ', { bpm: 70 }],
    ['ตัดพ้อ', { bpm: 70 }],
    ['ดินแดนแห่งความรัก', { bpm: 72, key: '2b' }],
    ['ปวดใจ', { bpm: 73 }],
    ['บอกตัวเอง', { bpm: 75 }],
    ['ลืมไป', { bpm: 75 }],
    ['ห้องนอน', { bpm: 76, key: '2b' }],
    ['อิจฉา', { bpm: 76, key: 'C' }],
    ['หนังสือเล่มเก่า', { bpm: 76 }],
    ['ฉันมาบอกว่า', { bpm: 78, key: 'C' }],
    ['ถ้าฉันเป็นเขา', { bpm: 78 }],
    ['ไกลแค่ไหนคือใกล้', { bpm: 80 }],
    ['เข้ากันไม่ได้', { bpm: 80 }],
    ['ภาพจำ', { bpm: 82 }],
    ['รถของเล่น', { bpm: 85 }],
    ['พบกันใหม่', { bpm: 90 }],
    ['อยู่ต่อเลยได้ไหม', { bpm: 90 }],
    ['แพ้ทาง', { bpm: 98 }],
    ['รักมือสอง', { bpm: 100 }],
    ['ผิงไฟ', { bpm: 115 }],
    ['เจ้าสาวไฉไล', { bpm: 120 }],
    ['ถ้าเธอต้องเลือก', { bpm: 120, key: 'C' }],
    ['คำตอบ', { bpm: 128, key: '4#' }],
    ['บันไดสีแดง', { bpm: 135 }],
    ['ถ้าพระอาทิตย์', { bpm: 140 }],
    ['ช่วงเวลา', { bpm: 170 }],
    ['ถอย', { bpm: 68 }],
    ['แค่คุณ', { bpm: 72 }],
    ['รักติดไซเรน', { bpm: 100 }],
    // From โทน สากล
    ['I Feel It Coming', { bpm: 95 }],
    ['Day 1', { bpm: 103 }],
    ['Rolling in the Deep', { bpm: 105, key: '3#' }],
    ['Man in the Mirror', { bpm: 105 }],
    ['24K Magic', { bpm: 110 }],
    ['Last Train to London', { bpm: 110 }],
    ['Smooth', { bpm: 115, key: 'C' }],
    ['Get Lucky', { bpm: 116 }],
    ['Happy', { bpm: 162, key: '4b' }],
    // From ลิสวง
    ['ฉันไม่ใช่นางเอก', { bpm: 68, key: '1b' }],
    ['คนไม่มีแฟน', { bpm: 80 }],
    ['ใครคนนั้น', { key: 'C' }],
    ['จันทร์', { bpm: 100 }],
    ['คิดถึงนะ', { bpm: 135, key: '1b' }],
    ['ตื่นจากฝัน', { key: '1#' }],
    ['ดวงดาวแห่งรัก', { key: 'C' }],
    ['ต้องโทษดาว', { key: '3#' }],
    ['ทะเลสีดำ', { key: '1#' }],
    ['ที่รักเธอ', { key: 'C' }],
    ['พัง', { key: 'C' }],
    ['นึกเสียว่าสงสาร', { key: '2b' }],
    ['หลอกฝัน', { key: '2#' }],
    ['อสงไขย', { key: '4b' }],
    ['นอกสายตา', { key: '2#' }],
    ['คนนิสัยเสีย', { key: '2#' }],
  ];
  
  for (const [name, updates] of tonUpdates) {
    const dbSong = existMap[name.toLowerCase()];
    if (!dbSong) {
      sql.push(`-- SKIPPED (not found): ${name}`);
      continue;
    }
    const sets = [];
    if (updates.bpm) sets.push(`bpm = ${updates.bpm}`);
    if (updates.key) sets.push(`key = '${esc(updates.key)}'`);
    sets.push(`updated_at = now()`);
    sql.push(`UPDATE band_songs SET ${sets.join(', ')} WHERE id = '${dbSong.id}'; -- ${name}`);
  }
  
  // ============================================
  // PART 2: NEW SONGS FROM โทน.csv (Thai)
  // ============================================
  sql.push('');
  sql.push('-- ============================================');
  sql.push('-- PART 2: NEW SONGS FROM โทน.csv (Thai songs)');
  sql.push('-- ============================================');
  
  // Songs from โทน that are genuinely new (not in DB)
  // Format: [name, artist, key(converted), bpm, singer, era]
  const tonNewSongs = [
    ['2-1=0', 'Bowkylion', '2#', 71, 'หญิง', '2020s'],
    ['กลับตัวกลับใจ', 'Potato', '5#', 65, 'ชาย', '2010s'],
    ['กลับมา', 'Bodyslam', '2#', 80, 'ชาย', '2000s'],
    ['กลับไม่ได้ไปไม่ถึง', 'Cocktail', null, 72, 'ชาย', '2010s'],
    ['กล้าพอไหม', 'Paradox', 'C', 78, 'ชาย', '2000s'], // fixed typo กลัาพอไหม
    ['กล้าขอกล้าให้', 'Klear', '4#', 76, 'คู่', '2010s'],
    ['กลุ้มใจ', 'วงชาตรี', null, 135, 'ชาย', '80s'],
    ['เก็บคำว่ารัก', 'Season Five', 'C', 125, 'ชาย', '2010s'],
    ['เกลียด', 'Num Kala', null, 80, 'ชาย', '2010s'],
    ['เข้ากันดี', 'Palmy', '1#', 126, 'หญิง', '2000s'],
    ['เจ็บจนพอ', 'Season Five', null, 85, 'ชาย', '2010s'],
    ['เจ็บจนไม่เข้าใจ', 'Sweet Mullet', null, 87, 'ชาย', '2010s'],
    ['เจ้าหญิง', 'Silly Fools', 'C', 72, 'ชาย', '2000s'],
    ['คนของเธอ', 'Bodyslam', null, 65, 'ชาย', '2000s'],
    ['คนบ้า', 'Potato', null, 72, 'ชาย', '2010s'],
    ['คนมีเสน่ห์', 'Paradox', '6#', 105, 'ชาย', '2000s'], // คนมีสเน่ห์ in report→ DB has "คนมีเสน่ห์"
    ['คนไม่เอาถ่าน', 'Potato', null, 80, 'ชาย', '2010s'],
    ['คนละชั้น', 'Jeff Satur', null, 72, 'ชาย', '2020s'],
    ['คำถามโง่ๆ', 'Bodyslam', null, 68, 'ชาย', '2000s'],
    ['คำถามซึ่งไร้คนตอบ', 'Paradox', null, 75, 'ชาย', '2000s'],
    ['คืนที่ดาวเต็มฟ้า', 'Getsunova', '2#', 74, 'ชาย', '2010s'],
    ['คืนนี้', 'Crescendo', '5#', 100, 'ชาย', '90s'],
    ['คุกกี้เสี่ยงทาย', 'BNK48', null, 122, 'หญิง', '2010s'],
    ['จงเรียกเธอว่านางพญา', 'คาราบาว', null, 128, 'ชาย', '80s'],
    ['ซินเดอเรลล่า', 'Bodyslam', '1#', 120, 'ชาย', '2000s'], // ซินนเดอเรล่า → ซินเดอเรลล่า
    ['ทนไว้', 'Potato', null, 65, 'ชาย', '2010s'],
    ['ทุกคนเคยร้องไห้', 'Big Ass', null, 65, 'ชาย', '2000s'],
    ['ที่เดิมในหัวใจ', 'Retrospect', null, 70, 'ชาย', '2000s'],
    ['เธอเป็นแฟนฉันแล้ว', 'Lipta', null, 72, 'คู่', '2010s'],
    ['เธอเปลี่ยนไป', 'Big Ass', null, 66, 'ชาย', '2000s'],
    ['เธอหมุนรอบตัวฉัน', 'ETC', '4#', 114, 'ชาย', '2010s'],
    ['ธิดาประจำอำเภอ', 'พิทักษ์ จักรวาล', null, 73, 'ชาย', '80s'],
    ['นอนจับมือกันครั้งแรก', 'Pause', '1b', 87, 'ชาย', '2000s'],
    ['นาฬิกา', 'Cocktail', 'C', 89, 'ชาย', '2010s'],
    ['เนย', 'Urboy TJ', null, 127, 'ชาย', '2020s'],
    ['บทสุดท้าย', 'Potato', null, 90, 'ชาย', '2010s'],
    ['บอกฉัน', null, null, null, null, null], // เพลงวง
    ['บุญผลา', 'อิสานโปรเจกต์', null, 72, 'ชาย', '2020s'],
    ['บุษบา', 'Bodyslam', '2#', 104, 'ชาย', '2000s'],
    ['ปล่อย', 'Atom ชนกันต์', '1#', 90, 'ชาย', '2010s'],
    ['ปิดที่ปวด', 'Tilly Birds', null, 65, 'ชาย', '2020s'],
    ['ปีก', 'Bodyslam', null, 110, 'ชาย', '2000s'],
    ['ผ่าน', 'Atom ชนกันต์', null, null, 'ชาย', '2010s'], // already in DB? let me check
    ['เผลอ', 'Palmy', '3#', 105, 'หญิง', '2000s'],
    ['ฝืนตัวเองไม่เป็น', 'Season Five', null, 68, 'ชาย', '2010s'],
    ['พูดทำไม', 'Bodyslam', null, 115, 'ชาย', '2000s'],
    ['พื้นที่ทับซ้อน', 'Slot Machine', '2b', 190, 'ชาย', '2000s'],
    ['ฟ้า', 'Labanoon', '3#', 200, 'ชาย', '2000s'],
    ['ฟ้าเป็นใจ', 'Three Man Down', null, 142, 'ชาย', '2020s'],
    ['ภาวนา', 'Zeal', null, 91, 'ชาย', '2000s'],
    ['มุม', 'Potato', null, 78, 'ชาย', '2010s'],
    ['เมื่อรักฉันเกิด', null, null, 90, null, null],
    ['ไม่เดียงสา', 'Palmy', '7#', 66, 'หญิง', '2000s'],
    ['ไม่รู้จักฉัน', 'Lipta', null, 68, 'คู่', '2010s'], // from ลิสวง singer=หญิง, but the full song name is "ไม่รู้จักฉัน ไม่รู้จักเธอ" which IS in DB
    ['ยอมรับคนเดียว', 'Musketeers', null, 70, 'ชาย', '2020s'],
    ['ยังไงก็ไม่ยัก', 'Paradox', null, 80, 'ชาย', '2000s'],
    ['ยังเหมือนเดิม', 'Bodyslam', null, 110, 'ชาย', '2000s'],
    ['โยนหินถามทาง', 'Scrubb', null, 114, 'ชาย', '2000s'],
    ['ร้อยเหตุผล', 'Klear', null, 65, 'คู่', '2010s'],
    ['รักกินไม่ได้', 'Three Man Down', null, 74, 'ชาย', '2020s'],
    ['รักโกรธ', 'OG-ANIC', null, 103, 'ชาย', '2020s'],
    ['รักที่เพิ่งผ่านพ้นไป', 'Instinct', '1b', 73, 'ชาย', '2000s'],
    ['รักคือ', 'Bodyslam', '3b', 70, 'ชาย', '2000s'],
    ['รักควายๆ', 'วงพัทลุง', null, 110, 'ชาย', '2020s'],
    ['รักเติมโปร', 'ก้อง ห้วยไร่', null, 140, 'ชาย', '2020s'],
    ['รักสนุก', 'Palmy', 'C', 140, 'หญิง', '2000s'],
    ['ราชสีห์กับหนู', 'Bodyslam', '2#', 110, 'ชาย', '2000s'],
    ['ร้ายๆ', 'Three Man Down', null, 105, 'ชาย', '2020s'],
    ['รู้ดีว่าไม่ดี', 'Tilly Birds', null, 100, 'ชาย', '2020s'],
    ['เร็ว', 'Bodyslam', null, 65, 'ชาย', '2000s'],
    ['โลกที่ไม่มีเธอ', 'Season Five', null, 90, 'ชาย', '2010s'],
    ['วิญญาณ', 'Bodyslam', '3b', 150, 'ชาย', '2000s'],
    ['เวทย์มนต์', 'Bodyslam', '2#', 105, 'ชาย', '2000s'],
    ['สถานีต่อไป', 'Bodyslam', null, 115, 'ชาย', '2000s'],
    ['สบายดีหรือ', 'Pause', null, 67, 'ชาย', '2000s'],
    ['สมดั่งใจ', null, null, 79, null, null],
    ['สีดา', 'Labanoon', 'C', 85, 'ชาย', '2000s'],
    ['สีเทา', 'Num Kala', null, 80, 'ชาย', '2010s'],
    ['เล็กน้อยมหาศาล', 'Klear', null, 100, 'คู่', '2010s'],
    ['หมายความว่าอะไร', 'Big Ass', null, 83, 'ชาย', '2000s'],
    ['หลอกให้รัก', 'Season Five', null, 80, 'ชาย', '2010s'],
    ['หล่อเลย', 'Getsunova', null, 85, 'ชาย', '2010s'],
    ['หัวร้อน', 'OG-ANIC', null, 100, 'ชาย', '2020s'],
    ['หากฉันตาย', '60 Miles', '2#', 83, 'ชาย', '2010s'],
    ['เหงาเท่าอวกาศ', 'Getsunova', '1#', 110, 'ชาย', '2010s'],
    ['อาย', 'Getsunova', null, 95, 'ชาย', '2010s'],
    ['อ้าว', 'Three Man Down', '2#', 105, 'ชาย', '2020s'],
    ['อย่าใกล้กันเลย', 'Instinct', null, 93, 'ชาย', '2000s'],
    ['อุบัติเหตุ', 'Mild', null, 82, 'ชาย', '2010s'],
    ['อยากรู้เสมอมา', 'Instinct', '4#', 102, 'ชาย', '2000s'],
    ['ร้อยแก้ว', 'Cocktail', '1b', 66, 'ชาย', '2010s'],
    ['เฉยเมย', 'Instinct', null, 95, 'ชาย', '2000s'],
    ['ซ่า สั่นๆ', 'Palmy', 'C', 135, 'หญิง', '2000s'],
    ['ช่วงนี้', 'Three Man Down', null, 102, 'ชาย', '2020s'],
    ['แค่เป็นเธอ', 'Three Man Down', null, 95, 'ชาย', '2020s'],
    ['รักตัวเอง', 'Three Man Down', null, 95, 'ชาย', '2020s'],
    ['คิดถึงจัง มาหาหน่อย', 'Three Man Down', null, 95, 'ชาย', '2020s'],
    ['รถคันเก่า', 'Slot Machine', null, 105, 'ชาย', '2000s'],
    ['ฤดูฝน', 'Calories Blah Blah', null, 105, 'หญิง', '2000s'],
    ['บินเข้ากองไฟ', 'ETC', null, 105, 'ชาย', '2010s'],
    ['ขี้หึง', 'Palmy', '4#', 116, 'หญิง', '2000s'],
    ['ฤดูร้อน', 'Palmy', '3#', 118, 'หญิง', '2000s'],
    ['7 นาที', 'Getsunova', null, 120, 'ชาย', '2010s'],
    ['Galaxy', 'Three Man Down', null, 72, 'ชาย', '2020s'],
    ['กอดจูบลูบคลำ', 'Three Man Down', null, 120, 'ชาย', '2020s'], // already in DB? check
    ['เจ้าช่อมาลี', 'คาราบาว', 'C', 121, 'ชาย', '80s'],
    ['ฮอร์โมน', 'Big Ass', '1#', 125, 'ชาย', '2000s'],
    ['Amplify Love', 'Three Man Down', null, 125, 'ชาย', '2020s'],
    ['ใกล้', 'Getsunova', '3#', 130, 'ชาย', '2010s'], // already in DB
    ['เกาะร้างห่างรัก', 'Bodyslam', '1b', 135, 'ชาย', '2000s'], // already in DB
    ['อกหักมารักกับผม', 'มาริโอ้', '1b', 137, 'ชาย', '2010s'],
    ['Unfriend', 'Getsunova', 'C', 80, 'ชาย', '2010s'],
    ['ขีดเส้นใต้', 'Getsunova', 'C', 82, 'ชาย', '2010s'], // already in DB
    ['ใจนักเลง', 'พงษ์สิทธิ์ คำภีร์', null, 85, 'ชาย', '90s'],
    ['ข้อความ', 'Bodyslam', '2#', 90, 'ชาย', '2000s'],
    ['ความจริงในใจ', 'Slot Machine', '2#', 90, 'ชาย', '2000s'],
    ['ความลับ', 'Bodyslam', 'C', 90, 'ชาย', '2000s'],
    ['คนไม่จำเป็น', 'Getsunova', '1#', 97, 'ชาย', '2010s'],
    ['แพ้ทาง', 'Labanoon', '3#', 98, 'ชาย', '2000s'],
    ['อยากให้เธอลอง', 'Klear', '2b', 98, 'คู่', '2010s'],
    ['Good Morning Teacher', null, null, 98, null, null],
    ['พูดไม่คิด', 'Potato', '2b', 100, 'ชาย', '2010s'],
    ['แรงโน้มถ่วง', 'Atom ชนกันต์', '1b', 100, 'ชาย', '2010s'],
    ['วีนัส', 'Slot Machine', '1b', 100, 'ชาย', '2000s'],
    ['แก้มน้องนางนั้นแดงกว่าใคร', null, null, 100, null, '80s'],
    ['เช็ค R U OK', 'Tilly Birds', null, 100, 'ชาย', '2020s'],
    ['ไม่บอกเธอ', 'Bedroom Audio', '2#', 110, 'ชาย', '2010s'], // already in DB
    ['ทุกอย่าง', 'Bodyslam', '3#', 109, 'ชาย', '2000s'],
    ['Superstar', 'Three Man Down', null, 115, 'ชาย', '2020s'],
    ['Spotlight', 'Fourth feat. Gemini', null, 120, 'ชาย', '2020s'],
    ['Event', 'Slot Machine', '4#', 105, 'ชาย', '2000s'], // already in DB
    ['อยากเจอ', 'Three Man Down', '3#', 105, 'ชาย', '2020s'],
    ['ฉันหรือเธอที่เปลี่ยนไป', 'Season Five', '3#', 110, 'ชาย', '2010s'],
    ['เพียงรัก', 'Instinct', '4#', 170, 'ชาย', '2000s'],
    ['ทางของฝุ่น', 'Cocktail', 'C', 196, 'ชาย', '2010s'],
    ['Hello Mama', 'Three Man Down', null, 95, 'ชาย', '2020s'],
    ['Live and Learn', 'Slot Machine', 'C', 95, 'ชาย', '2000s'], // corrected from "Lean"
    ['เป็นทุกอย่าง', 'Polycat', null, 95, 'ชาย', '2010s'],
    ['ความลับในฝูงปลา', 'Bodyslam', null, 93, 'ชาย', '2000s'],
    ['วันหนึ่งฉันเดินเข้าป่า', 'Bodyslam', null, 92, 'ชาย', '2000s'],
    ['ไวน์', 'Slot Machine', null, 92, 'ชาย', '2000s'],
    ['ก่อน', 'Atom ชนกันต์', '3#', 95, 'ชาย', '2010s'], // already in DB
    ['แอบเหงา', 'Getsunova', '3#', 95, 'ชาย', '2010s'],
    ['ฉันก็คง', 'Big Ass', null, 82, 'ชาย', '2000s'],
    ['ใจหมา', 'Labanoon', '4#', 73, 'ชาย', '2000s'],
    ['ที่ว่าง', 'Potato', null, 73, 'ชาย', '2010s'],
    ['ยิ่งใกล้ยิ่งเจ็บ', 'Instinct', null, 73, 'ชาย', '2000s'],
    ['กรรม', 'Potato', null, 73, 'ชาย', '2010s'],
    ['ตัวร้ายที่รักเธอ', 'Getsunova', '4#', 75, 'ชาย', '2010s'],
    ['ไม่เคย', '25 Hours', '5#', 75, 'ชาย', '2000s'],
    ['อยากให้รู้ว่าเหงา', 'Palmy', '1#', 75, 'หญิง', '2000s'],
    ['ก้อนหินละเมอ', 'Bodyslam', null, 90, 'ชาย', '2000s'],
    ['คำแพง', 'เขียนไขและวานิช', null, 68, 'ชาย', '2020s'],
    ['สิทธิ์ของเธอ', 'Season Five', null, 68, 'ชาย', '2010s'],
    ['18 ฝน', null, null, 70, null, null], // already in DB
  ];
  
  // Filter: only insert songs NOT already in DB
  const toInsert = [];
  const skippedExisting = [];
  
  for (const [name, artist, key, bpm, singer, era] of tonNewSongs) {
    const norm = name.toLowerCase().trim();
    if (existMap[norm]) {
      skippedExisting.push(name);
      continue;
    }
    toInsert.push({ name, artist, key, bpm, singer, era });
  }
  
  sql.push(`-- Skipped (already in DB): ${skippedExisting.join(', ')}`);
  sql.push('');
  
  for (const s of toInsert) {
    const cols = ["name", "source"];
    const vals = [`'${esc(s.name)}'`, "'global'"];
    if (s.artist) { cols.push("artist"); vals.push(`'${esc(s.artist)}'`); }
    if (s.key) { cols.push('"key"'); vals.push(`'${esc(s.key)}'`); }
    if (s.bpm) { cols.push("bpm"); vals.push(s.bpm); }
    if (s.singer) { cols.push("singer"); vals.push(`'${esc(s.singer)}'`); }
    if (s.era) { cols.push("era"); vals.push(`'${esc(s.era)}'`); }
    sql.push(`INSERT INTO band_songs (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
  }
  
  // ============================================
  // PART 3: NEW SONGS FROM โทน สากล.csv
  // ============================================
  sql.push('');
  sql.push('-- ============================================');
  sql.push('-- PART 3: NEW SONGS FROM โทน สากล (International)');
  sql.push('-- ============================================');
  
  const intlNewSongs = [
    ['After the Love Has Gone', 'Earth, Wind & Fire', null, 67, 'ชาย', '80s'],
    ['Radioactive', 'Imagine Dragons', null, 68, 'ชาย', '2010s'],
    ['Young Dumb and Broke', 'Khalid', null, 68, 'ชาย', '2010s'],
    ['Hey Jude', 'The Beatles', null, 77, 'ชาย', '80s'],
    ['Come Together', 'The Beatles', null, 80, 'ชาย', '80s'],
    ['99 Problems', 'Jay-Z', null, 80, 'ชาย', '2000s'],
    ['Drunk In The Morning', 'Lukas Graham', '2#', 95, 'ชาย', '2010s'],
    ['Californication', 'Red Hot Chili Peppers', null, 96, 'ชาย', '90s'], // fixed typo
    ['Linger', 'The Cranberries', null, 98, 'หญิง', '90s'],
    ['Hysteria', 'Muse', null, 98, 'ชาย', '2000s'],
    ['Seasons in the Sun', 'Terry Jacks', null, 99, 'ชาย', '80s'],
    ['Superstition', 'Stevie Wonder', '1#', 100, 'ชาย', '80s'], // fixed Superstitions
    ['Kung Fu Fighting', 'Carl Douglas', null, 102, 'ชาย', '80s'],
    ['Feels', 'Calvin Harris', null, 102, 'คู่', '2010s'],
    ['That\'s The Way', 'KC and the Sunshine Band', '3b', 110, 'ชาย', '80s'],
    ['Ladies Night', 'Kool & The Gang', null, 110, 'ชาย', '80s'],
    ['Everybody', 'Backstreet Boys', null, 110, 'ชาย', '90s'], // fixed "everybody lyrics"
    ['Shake Shake Shake', 'KC and the Sunshine Band', null, 112, 'ชาย', '80s'],
    ['Getaway', 'Earth, Wind & Fire', null, 112, 'ชาย', '80s'],
    ['Lover Boy', 'Phum Viphurit', null, 113, 'ชาย', '2010s'],
    ['Smoke On The Water', 'Deep Purple', null, 114, 'ชาย', '80s'],
    ['Billie Jean', 'Michael Jackson', null, 117, 'ชาย', '80s'], // fixed Billy jean
    ['Love Never Felt So Good', 'Michael Jackson', '1b', 118, 'ชาย', '2010s'],
    ['Uptown Funk', 'Bruno Mars', '1b', 118, 'ชาย', '2010s'],
    ['Sexbomb', 'Tom Jones', null, 121, 'ชาย', '2000s'],
    ['Celebration', 'Kool & The Gang', null, 122, 'ชาย', '80s'], // fixed Celebreation
    ['D.I.S.C.O.', 'Ottawan', null, 123, 'คู่', '80s'],
    ['Let\'s Groove', 'Earth, Wind & Fire', null, 125, 'ชาย', '80s'],
    ['Sweet Child O\' Mine', 'Guns N\' Roses', null, 126, 'ชาย', '80s'], // fixed O'clock
    ['Love Potion No. 9', 'The Searchers', null, 126, 'ชาย', '80s'], // fixed numder
    ['Mercy', 'Duffy', null, 130, 'หญิง', '2000s'],
    ['Linda Linda', 'The Blue Hearts', null, 130, 'ชาย', '80s'],
    ['I Feel Good', 'James Brown', null, 144, 'ชาย', '80s'],
    ['One Day', 'Matisyahu', null, 145, 'ชาย', '2000s'],
    ['Let\'s Twist Again', 'Chubby Checker', null, 160, 'ชาย', '80s'], // fixed Let'
    ['Blue Suede Shoes', 'Elvis Presley', null, 185, 'ชาย', '80s'], // fixed blus
    ['Still Got the Blues', 'Gary Moore', null, 160, 'ชาย', '80s'],
    ['Boogie Wonderland', 'Earth, Wind & Fire', '1b', 129, 'ชาย', '80s'],
    ['Creep', 'Radiohead', null, null, 'ชาย', '90s'],
    ['Don\'t Look Back in Anger', 'Oasis', null, null, 'ชาย', '90s'], // fixed angel → anger. already in DB
  ];
  
  for (const [name, artist, key, bpm, singer, era] of intlNewSongs) {
    const norm = name.toLowerCase().trim();
    if (existMap[norm]) {
      sql.push(`-- SKIP (in DB): ${name}`);
      continue;
    }
    const cols = ["name", "source"];
    const vals = [`'${esc(name)}'`, "'global'"];
    if (artist) { cols.push("artist"); vals.push(`'${esc(artist)}'`); }
    if (key) { cols.push('"key"'); vals.push(`'${esc(key)}'`); }
    if (bpm) { cols.push("bpm"); vals.push(bpm); }
    if (singer) { cols.push("singer"); vals.push(`'${esc(singer)}'`); }
    if (era) { cols.push("era"); vals.push(`'${esc(era)}'`); }
    sql.push(`INSERT INTO band_songs (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
  }
  
  const output = sql.join('\n');
  fs.writeFileSync('song-updates.sql', output, 'utf8');
  console.log(`Generated ${sql.filter(l => l.startsWith('UPDATE') || l.startsWith('INSERT')).length} SQL statements`);
  console.log('Saved to song-updates.sql');
  
  // Also execute the updates
  const updates = sql.filter(l => l.startsWith('UPDATE'));
  const inserts = sql.filter(l => l.startsWith('INSERT'));
  
  console.log(`\nUpdates: ${updates.length}`);
  console.log(`Inserts: ${inserts.length}`);
  
  // Execute updates
  if (updates.length > 0) {
    console.log('\nExecuting BPM/key updates...');
    const updateSql = updates.join('\n');
    try {
      const result = await query(updateSql);
      console.log('Updates result:', JSON.stringify(result).substring(0, 200));
    } catch(e) {
      console.error('Error executing updates:', e);
    }
  }
  
  // Execute inserts in batches of 30
  if (inserts.length > 0) {
    console.log('\nExecuting inserts...');
    const batchSize = 30;
    for (let i = 0; i < inserts.length; i += batchSize) {
      const batch = inserts.slice(i, i + batchSize).join('\n');
      try {
        const result = await query(batch);
        console.log(`Batch ${Math.floor(i/batchSize)+1}: ${JSON.stringify(result).substring(0, 100)}`);
      } catch(e) {
        console.error(`Batch ${Math.floor(i/batchSize)+1} error:`, e);
      }
    }
  }
  
  // Count final total
  const countResult = await query("SELECT COUNT(*) as cnt FROM band_songs WHERE source='global'");
  console.log(`\nFinal total global songs: ${countResult[0].cnt}`);
}

main().catch(console.error);
