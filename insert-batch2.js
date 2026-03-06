// Batch 2: Insert remaining songs from ลิสวง, เพลงเก่าร้าน, and other CSVs
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

function esc(s) { return s ? s.replace(/'/g, "''") : ''; }

async function main() {
  // Get fresh existing songs
  console.log('Fetching current song list...');
  const existing = await query("SELECT name FROM band_songs WHERE source='global'");
  console.log(`Current total: ${existing.length}`);
  
  const existSet = new Set(existing.map(r => r.name.toLowerCase().trim()));
  
  function isNew(name) {
    return !existSet.has(name.toLowerCase().trim());
  }
  
  function buildInsert(name, artist, key, bpm, singer, era, mood) {
    if (!isNew(name)) return null;
    const cols = ['name', 'source'];
    const vals = [`'${esc(name)}'`, "'global'"];
    if (artist) { cols.push('artist'); vals.push(`'${esc(artist)}'`); }
    if (key) { cols.push('"key"'); vals.push(`'${esc(key)}'`); }
    if (bpm) { cols.push('bpm'); vals.push(bpm); }
    if (singer) { cols.push('singer'); vals.push(`'${esc(singer)}'`); }
    if (era) { cols.push('era'); vals.push(`'${esc(era)}'`); }
    if (mood) { cols.push('mood'); vals.push(`'${esc(mood)}'`); }
    existSet.add(name.toLowerCase().trim()); // prevent duplicates
    return `INSERT INTO band_songs (${cols.join(', ')}) VALUES (${vals.join(', ')});`;
  }
  
  const inserts = [];
  
  // =====================================================
  // BATCH 2A: Songs from ลิสวง that have singer/BPM/key
  // These are quality songs with metadata from band members
  // =====================================================
  
  const lisSongs = [
    // [name, artist, key, bpm, singer, era]
    // เก่า section
    ['นาทีที่ยิ่งใหญ่', 'Grand Ex\'', '3#', 59, 'หญิง', '90s'],
    ['สงสารกันหน่อย', 'นิตยา บุญสูงเนิน', '3b', 60, 'หญิง', '80s'],
    ['ไม่ใช่ผู้วิเศษ', 'เบิร์ด ธงไชย', '2#', 66, 'ชาย', '90s'],
    ['รักเกินร้อย', 'ใหม่ เจริญปุระ', '3#', 70, 'หญิง', '90s'],
    ['หมากเกมนี้', 'จรัล มโนเพ็ชร', '1#', 75, 'ชาย', '80s'],
    ['ยากยิ่งนัก', 'เบิร์ด ธงไชย', 'C', 85, 'ชาย', '90s'],
    ['ฝันลำเอียง', 'ดอน สอนระเบียบ', null, 87, 'ชาย', '90s'],
    ['แหวนแลกใจ', 'เสียงเพราะ', 'C', 89, 'หญิง', '80s'],
    ['ฝน', 'เบิร์ด ธงไชย', '1b', 90, 'ชาย', '90s'], // ฝน เบิร์ดฮาร์ท
    ['นางพญากับคนป่า', 'สุรชัย สมบัติเจริญ', '2#', 94, 'ชาย', '80s'],
    ['เขียนไว้ข้างเตียง', 'นันทิดา แก้วบัวสาย', '2#', 95, 'หญิง', '80s'],
    ['ดั่งนกเจ็บ', 'วิรัช อยู่ถาวร', '2#', 97, 'ชาย', '80s'],
    ['น้ำผึ้งหรือยาพิษ', 'นันทิดา แก้วบัวสาย', '2b', 100, 'หญิง', '80s'],
    ['ที่สุดของหัวใจ', 'เบิร์ด ธงไชย', '1#', null, 'ชาย', '90s'],
    ['นิดนึงพอ', 'เบิร์ด ธงไชย', null, null, 'ชาย', '90s'],
    ['จงรัก', 'แอม เสาวลักษณ์', '1b', null, 'หญิง', '90s'],
    ['รักใน C Major', 'Palmy', 'C', null, 'ชาย', '2000s'],
    ['สบายดีรึเปล่า', 'Potato', 'C', 100, 'หญิง', '2010s'],
    ['รางวัลแด่คนช่างฝัน', 'ดิ อิมพอสซิเบิ้ล', '1b', 102, 'ชาย', '80s'],
    ['รักฉันนั้นเพื่อเธอ', 'ชาย เมืองสิงห์', '1b', 107, 'ชาย', '80s'],
    ['ช้ำคือเรา', 'แอม เสาวลักษณ์', '3b', 110, 'หญิง', '90s'],
    ['รักครั้งแรก', 'ชาตรี', '2b', 112, 'ชาย', '80s'], // ชาตรี version
    ['ไม้ขีดไฟกับดอกทานตะวัน', 'จรัล มโนเพ็ชร', 'C', 113, 'หญิง', '80s'],
    ['สายเกินไป', null, 'C', 113, 'หญิง', '80s'],
    ['ขอมือเธอหน่อย', 'สุนทราภรณ์', '1#', 115, 'หญิง', '80s'],
    ['งานวัด', 'แอน ธิติมา', '1b', 120, 'ชาย', '80s'],
    ['เชื่อฉัน', 'อัสนี วสันต์', '2#', 125, 'ชาย', '90s'],
    ['เพียงสบตา', 'เบิร์ด ธงไชย', 'C', 130, 'ชาย', '90s'],
    ['เจ้าสาวที่กลัวฝน', 'สุเทพ วงศ์กำแหง', '4#', 114, 'ชาย', '80s'],
    ['แฟนฉัน', 'Grand Ex\'', 'C', 160, 'หญิง', '90s'],
    ['รักคือฝันไป', 'คัฑลียา มารศรี', '2#', 160, 'หญิง', '80s'],
    ['หมอกหรือควัน', 'เท่ห์ อุเทน', 'C', 110, 'หญิง', '80s'],
    ['เพียงแค่ใจเรารักกัน', 'อัสนี วสันต์', '2#', 100, 'หญิง', '90s'],
    ['พบรัก', 'ชาตรี', 'C', 84, 'ชาย', '80s'],
    ['หลับตา', 'อัสนี วสันต์', 'C', 82, 'หญิง', '90s'],
    
    // กลาง section (new ones only)
    ['จากคนอื่นคนไกล', 'Potato', 'C', 63, 'ชาย', '2010s'],
    ['เกินใจจะอดทน', 'Crescendo', '1#', 66, 'ชาย', '2000s'],
    ['แค่คนอีกคน', 'Atom ชนกันต์', '2#', 72, 'ชาย', '2010s'],
    ['คนเดินถนน', 'Am Fine', null, 74, 'ชาย', '2010s'],
    ['คิดถึงฉันไหมเวลาที่เธอ', 'Three Man Down', '3#', 74, 'หญิง', '2010s'],
    ['ก็เลิกกันแล้ว', 'Jeff Satur', null, 75, 'ชาย', '2020s'],
    ['คำยินดี', 'Palmy', null, 86, 'หญิง', '2000s'],
    ['คำถาม', 'Toffie', '4#', 90, 'หญิง', '2010s'], // คำถาม E -> key 4#
    ['ประวัติศาสตร์', 'Bodyslam', '2b', 125, 'หญิง', '2000s'],
    ['ฝากเลี้ยง', 'ลิปตา', 'C', 125, 'ชาย', '2010s'],
    ['ครั้งหนึ่งเราเคยรักกัน', 'Grand Ex\'', null, 126, 'หญิง', '90s'],
    ['เหลวไหล', 'Bodyslam', '3#', 127, 'ชาย', '2000s'],
    ['คิดมาก', 'นุ๊ก สุทธิดา', null, 129, 'หญิง', '2000s'],
    ['ควักหัวใจ', 'Palmy', null, 130, 'หญิง', '2000s'],
    ['ถอยดีกว่า', 'Palmy', '1b', 133, 'หญิง', '2000s'],
    ['ตัวปลอม', 'Whal & Dolph', null, 134, 'หญิง', '2020s'],
    ['ผ้าเช็ดหน้า', 'Labanoon', null, 135, 'หญิง', '2000s'],
    ['พูดอีกที', 'Genie Records', null, 135, 'หญิง', '2000s'],
    ['191', 'DAX Rock Rider', 'C', 136, 'หญิง', '2000s'], // 191 D → key C, song 191
    ['ไม่อ้วนเอาเท่าไหร่', 'Silly Fools', null, 136, 'หญิง', '2000s'],
    ['กลับดึก', 'Getsunova', null, 149, 'หญิง', '2010s'],
    ['คิดถึง', 'Palmy', null, null, 'หญิง', '2000s'],
    ['คืนใจ', 'Crescendo', null, null, 'ชาย', '2000s'],
    ['ใครสักคน', 'Season Five', null, null, 'ชาย', '2010s'],
    ['เงียบๆ คนเดียว', 'Slot Machine', null, null, 'ชาย', '2000s'],
    ['เจ้าสาวไฉไล', 'คาราบาว', null, null, 'หญิง', '80s'],
    ['ใจเหลือๆ', 'Crescendo', 'C', null, 'หญิง', '2000s'],
    ['ฉันขอโทษ', 'Klear', null, null, 'ชาย', '2010s'],
    ['ชั่วคราวหรือค้างคืน', 'Season Five', null, null, 'หญิง', '2010s'],
    ['ชั่วฟ้าดินสลาย', 'วงชาตรี', null, null, 'ชาย', '80s'],
    ['ชาวนากับงูเห่า', 'ชรินทร์ นันทนาคร', '3#', null, 'หญิง', '80s'], // fixed งู่เห่า
    ['ซมซาน', 'แอน ธิติมา', null, null, 'หญิง', '80s'],
    ['ดอกไม้กับหัวใจ', 'สุรชัย สมบัติเจริญ', null, null, 'ชาย', '80s'],
    ['ดอกไม้กับแจกัน', 'เดอะสตาร์', null, null, 'หญิง', '2000s'],
    ['ดาว', 'พอส Playground', null, null, 'คู่', '2010s'],
    ['ดูโง่ๆ', 'Bodyslam', null, null, 'ชาย', '2000s'],
    ['ดูแลเขาให้ดีๆ', 'ฟักกลิ้ง ฮีโร่', null, null, 'หญิง', '2020s'],
    ['ไดอารี่สีแดง', 'Instinct', null, null, 'ชาย', '2000s'],
    ['ตุ๊กตาหน้ารถ', 'จินตหรา พูนลาภ', null, null, 'หญิง', '80s'],
    ['ถ่านไฟเก่า', 'Silly Fools', '2b', null, 'ชาย', '2000s'],
    ['ถามจันทร์', 'Am Fine', null, null, 'หญิง', '2010s'],
    ['ทำไมต้องรักเธอ', 'Peck Palitchoke', null, null, 'หญิง', '2000s'],
    ['เท่าเดิม', 'Cocktail', 'C', null, 'หญิง', '2010s'],
    ['เธอที่รัก', 'Cocktail', 'C', null, 'หญิง', '2010s'],
    ['เธอปันใจ', 'สุนทราภรณ์', null, null, 'ชาย', '80s'],
    ['น้ำซึมบ่อทราย', 'สุเทพ วงศ์กำแหง', null, null, 'ชาย', '80s'],
    ['น้ำเต็มแก้ว', 'Bodyslam', null, null, 'หญิง', '2000s'],
    ['นึกเสียว่าสงสาร', 'สุนทราภรณ์', '2b', null, 'หญิง', '80s'],
    ['ผู้หญิงลืมยาก', 'Crescendo', null, 74, 'หญิง', '2000s'],
    ['ผู้ชายห่วยๆ', 'Whal & Dolph', null, null, 'หญิง', '2020s'],
    ['แผลในใจ', 'Clash', null, null, 'ชาย', '2000s'],
    ['พรหมลิขิต', 'Paradox', '3#', null, 'หญิง', '2000s'],
    ['พระจันทร์ยิ้ม', 'นันทิดา แก้วบัวสาย', null, null, 'ชาย', '80s'],
    ['พลิกล็อก', 'Palmy', null, 116, 'หญิง', '2000s'], // fixed พลิ้กล้อค
    ['เพิ่งรู้ว่ารัก', 'Paradox', null, null, 'หญิง', '2000s'],
    ['เพื่อนสนิท', 'August', null, null, 'หญิง', '2000s'],
    ['แพ้ใจ', 'Am Fine', 'C', null, 'หญิง', '2010s'],
    ['ฟั่นเฟือน', 'Palmy', '2b', null, 'หญิง', '2000s'],
    ['ภาพลวงตา', 'Labanoon', null, null, 'หญิง', '2000s'],
    ['ภูมิแพ้กรุงเทพ', 'ตั๊กแตน ชลดา', null, null, 'หญิง', '2010s'],
    ['เมาทุกขวด', 'Cocktail', '2#', null, 'หญิง', '2010s'],
    ['เมื่อเขามาฉันจะไป', 'มาลีฮวนน่า', null, null, 'หญิง', '90s'],
    ['แม้ว่า', 'Tattoo Colour', null, null, 'หญิง', '2000s'],
    ['ไม่ใช่ผู้ชาย', 'Am Fine', null, null, 'หญิง', '2010s'],
    ['ไม่มีเธอจะบอกรักใคร', 'Crescendo', null, null, 'หญิง', '2000s'],
    ['ไม่รักดี', 'Fahrenheit', null, null, 'หญิง', '2000s'],
    ['ยอมจำนนฟ้าดิน', 'พงษ์สิทธิ์ คำภีร์', null, null, 'ชาย', '90s'],
    ['ยังคงคอย', 'HER', null, null, 'หญิง', '2020s'],
    ['ยังโสด', 'รัศมี', null, null, 'หญิง', '2000s'],
    ['ยาม', 'Bodyslam', null, null, 'ชาย', '2000s'],
    ['ยิ่งรู้จักยิ่งรักเธอ', 'Potato', null, null, 'หญิง', '2010s'],
    ['ยินยอม', 'Crescendo', null, null, 'ชาย', '2000s'],
    ['ยื้อ', 'เบน ชลาทิศ', null, null, 'ชาย', '2010s'],
    ['เยาวราช', 'Tattoo Colour', null, null, 'หญิง', '2000s'],
    ['รถของเล่น', 'Am Fine', null, null, 'หญิง', '2010s'],
    ['รออยู่ตรงนี้', 'Crescendo', null, null, 'ชาย', '2000s'],
    ['รักคงยังไม่พอ', 'Bodyslam', null, null, 'ชาย', '2000s'],
    ['รักเดียว', 'วงชาตรี', null, null, 'หญิง', '80s'],
    ['รักเดียวใจเดียว', 'เบิร์ด ธงไชย', null, null, 'ชาย', '90s'],
    ['รักแท้มีแค่ครั้งเดียว', 'สุเทพ วงศ์กำแหง', null, null, 'ชาย', '80s'],
    ['รักเธอไม่มีวันหยุด', 'คริสติน่า อากีล่าร์', null, null, 'หญิง', '90s'],
    ['รักสามเศร้า', 'จรัล มโนเพ็ชร', '1#', null, 'หญิง', '80s'],
    ['รัก', 'ปุ๊ อัญชลี', 'C', null, 'หญิง', '80s'],
    ['รับได้ไหมถ้ามีใครอีกคน', 'Paradox', null, null, 'หญิง', '2000s'],
    ['รู้เห็นเป็นใจ', 'Crescendo', null, null, 'หญิง', '2000s'],
    ['ไร้ตัวตน', 'Slot Machine', null, null, 'ชาย', '2000s'],
    ['ฤดูที่แตกต่าง', 'Clash', null, null, 'ชาย', '2000s'],
    ['ลึกสุดใจ', 'Slot Machine', '4#', null, 'ชาย', '2000s'],
    ['ลืมไปไม่รักกัน', 'Atom ชนกันต์', null, null, 'ชาย', '2010s'],
    ['เลือกได้ไหม', 'Labanoon', '4#', null, 'หญิง', '2000s'],
    ['วอน', 'Crescendo', '1b', null, 'หญิง', '2000s'],
    ['ไว้ใจ', 'Instinct', null, null, 'ชาย', '2000s'],
    ['ไว้ใจได้ก๋า', 'จรัล มโนเพ็ชร', null, null, 'หญิง', '80s'],
    ['สักวันหนึ่ง', 'Potato', null, null, 'หญิง', '2010s'],
    ['สัมพันธ์', 'Bodyslam', null, null, 'ชาย', '2000s'],
    ['เสมอ', 'Am Fine', 'C', null, 'หญิง', '2010s'],
    ['หนึ่งในไม่กี่คน', 'Getsunova', null, null, 'หญิง', '2010s'],
    ['หยุด', 'Slot Machine', '1#', null, 'หญิง', '2000s'],
    ['หยุดตรงนี้ที่เธอ', 'Bodyslam', null, null, 'ชาย', '2000s'],
    ['ห่างไกลเหลือเกิน', 'เบิร์ด ธงไชย', null, null, 'ชาย', '90s'],
    ['อยากเก็บเธอไว้ทั้งสองคน', 'Instinct', null, null, 'หญิง', '2000s'],
    ['อยากได้ยินว่ารักกัน', 'สุนทราภรณ์', null, null, 'ชาย', '80s'],
    ['อย่างน้อย', 'Bodyslam', '4#', null, 'หญิง', '2000s'],
    ['อย่าทำให้ฟ้าผิดหวัง', 'Palmy', null, null, 'หญิง', '2000s'],
    ['อสงไขย', 'LifeTime', '4b', null, 'หญิง', '2000s'],
    ['อาจจะเป็นคนนี้', 'Am Fine', null, null, 'หญิง', '2010s'],
    ['อีกสักกี่ครั้ง', 'Getsunova', null, null, 'หญิง', '2010s'],
    ['แอบเจ็บ', 'เท่ห์ อุเทน', '1b', null, 'หญิง', '80s'],
    ['แอบเหงา', 'Getsunova', '3#', null, 'ชาย', '2010s'],
    ['โอ้ใจเอ๋ย', 'วงชาตรี', 'C', null, 'หญิง', '80s'],
    ['ร้องไห้กับฉัน', 'Clash', null, null, 'ชาย', '2000s'],
    ['พรุ่งนี้ไม่สาย', null, null, null, 'หญิง', null],
    ['รบกวนมารักกัน', 'Getsunova', null, 102, 'หญิง', '2010s'],
    ['แม่มด', 'Cocktail', null, 130, 'หญิง', '2010s'],
    ['ปอดๆ', 'Getsunova', null, 130, 'ชาย', '2010s'],
    
    // ใหม่ section (new ones)
    ['พิจารณา', 'Musketeers', '2b', 71, 'คู่', '2020s'],
    ['เลือดกรุ๊ป B', 'Cocktail', '3#', 82, 'คู่', '2010s'],
    ['I Just Wanna Pen Fan You Dai Bor', 'Three Man Down', '4#', 90, 'ชาย', '2020s'],
    ['ผู้ถูกเลือกให้ผิดหวัง', 'Silly Fools', '1#', 90, 'ชาย', '2000s'],
    ['เฮอไมโอน้อง', 'Getsunova', '1b', 98, 'หญิง', '2010s'],
    ['สัญญาเดือนหก', 'OG-ANIC', '1#', 104, 'ชาย', '2020s'],
    ['ชวนน้องล่องใต้', 'คาราบาว', 'C', 136, 'คู่', '80s'],
    ['เก็บซ่อน', 'Bodyslam', null, null, 'หญิง', '2000s'],
    ['ขยี้ทำไม', 'Palmy', null, null, 'ชาย', '2000s'],
    ['ขวัญเอยขวัญมา', 'Palmy', null, null, 'หญิง', '2000s'],
    ['ขวานบิ่น', 'หิน เหล็ก ไฟ', null, null, 'ชาย', '80s'],
    ['คนข้างล่าง', 'Slot Machine', null, null, 'ชาย', '2000s'],
    ['คนแพ้ที่ไม่มีน้ำตา', 'Potato', null, null, 'ชาย', '2010s'],
    ['คิดแต่ไม่ถึง', 'Instinct', null, null, 'หญิง', '2000s'],
    ['คิดถึงแต่', 'โบกี้', null, 92, 'หญิง', '2020s'],
    ['เจ็บและชินไปเอง', 'Num Kala', null, null, 'ชาย', '2010s'],
    ['เจ้าชายนิทรา', 'Getsunova', '2#', null, 'ชาย', '2010s'],
    ['ใจบางบาง', 'Num Kala', null, null, 'ชาย', '2010s'],
    ['ฉลามชอบงับคุณ', 'OG-ANIC', null, null, 'ชาย', '2020s'],
    ['เฉพาะคืนนี้', 'Getsunova', null, null, 'หญิง', '2010s'],
    ['ช่วงที่ดีที่สุด', 'Bodyslam', null, null, 'ชาย', '2000s'],
    ['ชอบตัวเองเวลาอยู่กับเธอ', 'Getsunova', null, 66, 'ชาย', '2010s'],
    ['เชือกวิเศษ', 'Scrubb', '1#', null, 'หญิง', '2000s'],
    ['ซ่อนกลิ่น', 'Three Man Down', null, 96, 'หญิง', '2020s'],
    ['ซูลูปาก้า ตาปาเฮ้', 'Slot Machine', '2#', null, 'หญิง', '2000s'],
    ['ณ หน้าทอง', 'Three Man Down', null, 65, 'ชาย', '2020s'],
    ['ดวงใจ', 'Palmy', null, null, 'หญิง', '2000s'],
    ['ดีใจด้วยนะ', 'Three Man Down', null, null, 'หญิง', '2020s'],
    ['ดึงดัน', 'Cocktail', null, null, 'หญิง', '2010s'],
    ['ได้แต่นึกถึงอดีต', 'ดิ อิมพอสซิเบิ้ล', null, 156, 'ชาย', '80s'],
    ['ตราบธุลีดิน', 'Potato', '4#', null, 'หญิง', '2010s'],
    ['ต่อจากนี้เพลงรักทุกเพลงจะเป็นของเธอ', 'Klear', null, null, 'ชาย', '2010s'],
    ['ถ้าเธอรักใครคนหนึ่ง', 'ETC', null, null, 'หญิง', '2010s'],
    ['ถ้าปล่อยให้เธอเดินผ่าน', 'Sweet Mullet', null, null, 'ชาย', '2010s'],
    ['ท้องฟ้า', 'Bodyslam', null, null, 'คู่', '2000s'],
    ['ธรรมดาที่แสนพิเศษ', 'Getsunova', null, null, 'ชาย', '2010s'],
    ['เธอเก่ง', 'Three Man Down', '3#', null, 'หญิง', '2020s'],
    ['เธอคือใคร', 'Big Ass', null, null, 'ชาย', '2000s'],
    ['เธอทั้งนั้น', 'Bodyslam', null, null, 'ชาย', '2000s'],
    ['เธอมีฉัน ฉันมีใคร', 'Instinct', null, null, 'หญิง', '2000s'],
    ['เธอยัง', 'Tilly Birds', null, null, 'หญิง', '2020s'],
    ['นอกจากชื่อฉัน', 'ActArt', null, null, 'คู่', '2010s'],
    ['ให้นานกว่าที่เคย', 'Mild', null, null, 'หญิง', '2010s'],
    ['น้ำลาย', 'TXRBO', null, null, 'ชาย', '2020s'],
    ['นิทาน', 'Palmy', '1b', null, 'หญิง', '2000s'],
    ['บานปลาย', 'Sweet Mullet', null, 90, 'หญิง', '2010s'],
    ['เบาๆ', 'Lipta', '2#', null, 'หญิง', '2010s'],
    ['ปลิว', 'Palmy', null, null, 'หญิง', '2000s'],
    ['เป็นได้ทุกอย่าง', 'Urboy TJ', null, null, 'ชาย', '2020s'],
    ['เปลี่ยน', 'Three Man Down', null, null, 'ชาย', '2020s'],
    ['โปรดส่งใครมารักฉันที', 'Getsunova', '1#', null, 'หญิง', '2010s'],
    ['ฝนตกไหม', 'Three Man Down', 'C', null, 'หญิง', '2020s'],
    ['พบกันใหม่', 'Bodyslam', '4#', null, 'หญิง', '2000s'],
    ['พิง', 'Bodyslam', '2b', null, 'ชาย', '2000s'],
    ['พูดตรงๆ', 'Season Five', null, null, 'ชาย', '2010s'],
    ['เพื่อนรัก', 'Zeal', null, null, 'หญิง', '2000s'],
    ['แพ้คำว่ารัก', 'Potato', null, null, 'ชาย', '2010s'],
    ['ในวันที่เราต้องไกลห่าง', 'Season Five', null, null, 'หญิง', '2010s'],
    ['มะงึกอุ๋งๆ', 'Three Man Down', null, null, 'หญิง', '2020s'],
    ['มันเป็นใคร', 'Getsunova', '2b', null, 'หญิง', '2010s'],
    ['เมารัก', 'Klear', null, null, 'หญิง', '2010s'],
    ['ไม่เคย', '25 Hours', null, null, 'ชาย', '2000s'], // muzu version or 25hours
    ['ไม่นานก็ชิน', 'Three Man Down', null, null, 'ชาย', '2020s'],
    ['ยังคงคอย', 'Three Man Down', '1b', null, 'ชาย', '2020s'],
    ['ย้ำ', 'Bodyslam', null, null, 'ชาย', '2000s'],
    ['ร่มสีเทา', 'Cocktail', '1#', null, 'หญิง', '2010s'],
    ['รอจนพอ', 'แมว จิรศักดิ์', null, null, 'ชาย', '2010s'],
    ['รักเก่าๆ', 'Three Man Down', null, null, 'ชาย', '2020s'],
    ['รักมือสอง', 'Season Five', '2#', null, 'หญิง', '2010s'],
    ['รักไม่ได้', 'Season Five', null, null, 'ชาย', '2010s'],
    ['รักไม่ต้องการเวลา', 'Potato', null, null, 'หญิง', '2010s'],
    ['เรื่องจริง', 'Scrubb', null, null, 'ชาย', '2000s'],
    ['เรื่องที่ขอ', 'Cocktail', null, null, 'หญิง', '2010s'],
    ['แรงโน้มถ่วง', 'Atom ชนกันต์', null, null, 'หญิง', '2010s'],
    ['ลงใจ', 'Jeff Satur', null, null, 'หญิง', '2020s'],
    ['ลม', 'Bodyslam', 'C', null, 'หญิง', '2000s'],
    ['ลืมไป', 'Bodyslam', 'C', null, 'หญิง', '2000s'],
    ['ลูกอม', 'Palmy', '1#', null, 'หญิง', '2000s'],
    ['วันเกิดฉันปีนี้', 'Paradox', null, null, 'ชาย', '2000s'],
    ['วาดไว้', 'Paradox', '1b', 73, 'หญิง', '2000s'],
    ['วาฬเกยตื้น', 'Slot Machine', '4#', null, 'หญิง', '2000s'],
    ['วีนัส', 'Slot Machine', '1b', null, 'ชาย', '2000s'],
    ['ไว้ใจ', 'เคลียร์', null, null, 'หญิง', '2010s'],
    ['สลักจิต', 'Paradox', null, 81, 'หญิง', '2000s'],
    ['สาริกา', 'Klear', null, 72, 'ชาย', '2010s'],
    ['สิ่งของ', 'Getsunova', null, null, 'หญิง', '2010s'],
    ['สิ่งมีชีวิตที่เรียกว่าหัวใจ', 'Bodyslam', null, null, 'ชาย', '2000s'],
    ['สิ่งสำคัญ', 'Getsunova', null, 76, 'หญิง', '2010s'],
    ['เสียใจได้ยินไหม', 'Potato', null, null, 'หญิง', '2010s'],
    ['แสงสุดท้าย', 'Bodyslam', null, null, 'หญิง', '2000s'],
    ['หนังสือเล่มเก่า', 'Bodyslam', null, null, 'หญิง', '2000s'],
    ['หนีห่าง', 'Cocktail', '2#', null, 'หญิง', '2010s'],
    ['หมดชีวิตฉันให้เธอ', 'Paradox', null, null, 'ชาย', '2000s'],
    ['หมอก', 'Bodyslam', 'C', null, 'หญิง', '2000s'],
    ['ห้องนอน', 'Three Man Down', null, null, 'ชาย', '2020s'],
    ['เหงาๆ', 'ใหม่ เจริญปุระ', null, null, 'หญิง', '90s'],
    ['เหตุเกิดจากความเหงา', 'Crescendo', null, null, 'ชาย', '2000s'],
    ['ให้ฉันดูแลเธอ', 'Atom ชนกันต์', null, null, 'คู่', '2010s'],
    ['อยากมีแฟนแล้ว', 'ส้มมารี', null, null, 'หญิง', '2020s'],
    ['อย่าให้ฉันคิด', 'Paradox', null, null, 'หญิง', '2000s'],
    ['อยู่ต่อเลยได้ไหม', 'Three Man Down', '1#', null, 'หญิง', '2020s'],
    ['อาจเป็นเธอ', 'Three Man Down', null, null, 'หญิง', '2020s'],
    ['อาวรณ์', 'Bodyslam', null, null, 'หญิง', '2000s'],
    ['แอบดี', 'Three Man Down', '1b', null, 'หญิง', '2020s'],
    ['MOVE ON', 'Tilly Birds', '2#', null, 'คู่', '2020s'],
    ['ทดลองใช้', 'Three Man Down', null, null, 'ชาย', '2020s'],
    ['พะวง', 'Bodyslam', null, null, 'คู่', '2000s'],
    
    // ลูกทุ่ง section (from ลิสวง)
    ['กรุณาฟังให้จบ', 'ลำยอง หนองหินห่าว', 'C', null, 'ชาย', '2020s'],
    ['กลับมาทำไม', 'ก้อง ห้วยไร่', null, null, 'ชาย', '2020s'],
    ['กอดเสาเถียง', 'พงษ์สิทธิ์ คำภีร์', '1b', null, 'ชาย', '90s'],
    ['กอดจูบลูบคลำ', null, null, null, 'ชาย', null],
    ['ขอจองในใจ', 'ก้อง ห้วยไร่', null, null, 'ชาย', '2020s'],
    ['ขอใจแลกเบอร์โทร', 'ไอ้มุ้ย', null, null, 'ชาย', '2020s'],
    ['ขอเป็นพระเอกในหัวใจเธอ', 'ก้อง ห้วยไร่', null, null, 'ชาย', '2010s'],
    ['ข้ามันลูกทุ่ง', 'ไมค์ ภิรมย์พร', null, null, 'ชาย', '2000s'],
    ['คอแห้ง', 'สนธิ สมมาตร', null, null, 'ชาย', '80s'],
    ['คิดอะไรอยู่', 'Three Man Down', null, null, 'ชาย', '2020s'],
    ['คู่คอง', 'ก้อง ห้วยไร่', null, null, 'ชาย', '2010s'],
    ['แค่คนคุย', 'ลิลลี่ ได้หมดถ้าสดชื่น', null, null, 'หญิง', '2020s'],
    ['จดหมายฉบับสุดท้าย', 'ชาย เมืองสิงห์', null, null, 'ชาย', '80s'],
    ['เจ็บละเนาะ', 'มนต์แคน แก่นคูน', 'C', null, 'หญิง', '2010s'],
    ['ใจสิเพ', 'สนธิ สมมาตร', null, null, 'หญิง', '90s'],
    ['ฉันยังรักเธอ', 'เต้ย อภิวัฒน์', null, null, 'หญิง', '2020s'],
    ['ชอบแบบนี้', 'Palmy', '2#', null, 'หญิง', '2000s'],
    ['ชู้', 'Palmy', '2#', null, 'หญิง', '2000s'],
    ['เด๋อเดี่ยงด่าง', 'ก้อง ห้วยไร่', null, null, 'หญิง', '2010s'],
    ['บ่ต้องการเศษใจ', 'หนูนา หนึ่งธิดา', null, 110, 'หญิง', '2020s'],
    ['บ่เป็นหยังเค้าเข้าใจ', 'มนต์แคน แก่นคูน', null, null, 'หญิง', '2020s'],
    ['ปี้จนป่น', 'ลำไย ไหทองคำ', null, null, 'หญิง', '2020s'],
    ['ปู้หนีบ', 'ลำไย ไหทองคำ', null, null, 'หญิง', '2020s'],
    ['ผู้ชายในฝัน', 'Palmy', null, null, 'หญิง', '2000s'],
    ['ผีตายโหง', 'คาราบาว', '4#', null, 'หญิง', '80s'],
    ['ผู้สาวขี้เหล้า', 'มนต์แคน แก่นคูน', null, null, 'หญิง', '2010s'],
    ['มนต์รักลูกทุ่ง', 'ชาย เมืองสิงห์', null, null, 'ชาย', '80s'],
    ['มีเมียเด็ก', 'ยิ่งยง ยอดบัวงาม', null, null, 'ชาย', '80s'],
    ['เมียน้อย', 'ตั๊กแตน ชลดา', null, null, 'หญิง', '2010s'],
    ['ไม่อยากเป็นเสือ', 'Big Ass', 'C', null, 'หญิง', '2000s'],
    ['ร่องเรือหารัก', 'สายัณห์ สัญญา', null, null, 'ชาย', '80s'],
    ['ระเบิดเวลา', 'Cocktail', null, null, 'หญิง', '2010s'],
    ['ไร่อ้อยคอยรัก', 'สายัณห์ สัญญา', null, null, 'ชาย', '80s'],
    ['เลิกคุยทั้งอำเภอ', 'ลำไย ไหทองคำ', null, null, 'หญิง', '2020s'],
    ['วอนลม', 'จรัล มโนเพ็ชร', null, null, 'หญิง', '80s'],
    ['ส่งซิ้ก', 'ก้อง ห้วยไร่', '2b', null, 'หญิง', '2010s'],
    ['สวนทาง', 'เอิร์น เดอะสตาร์', 'C', null, 'หญิง', '2010s'],
    ['สหายสุรา', 'พงษ์สิทธิ์ คำภีร์', null, 107, 'ชาย', '90s'],
    ['สังหารหมู่', 'มนต์สิทธิ์ คำสร้อย', null, null, 'หญิง', '2000s'],
    ['สันดานเก่า', 'ลำไย ไหทองคำ', null, null, 'หญิง', '2020s'],
    ['สาวอีสาน', 'ตั๊กแตน ชลดา', null, null, 'หญิง', '2010s'],
    ['โสดผัวทิ้ง', 'จินตหรา พูนลาภ', null, null, 'หญิง', '90s'],
    ['ใส่ใจได้แค่มอง', 'มนต์แคน แก่นคูน', 'C', null, 'หญิง', '2010s'],
    ['ไสว่าสิบ่ถิ่มกัน', 'มนต์แคน แก่นคูน', null, null, 'ชาย', '2010s'],
    ['หนอนผีเสื้อ', 'คาราบาว', null, null, 'ชาย', '80s'],
    ['หนูไม่รู้', 'เบนซ์ พริกไทย', null, null, 'หญิง', '2010s'],
    ['ให้เคอรี่มาส่ง', 'มนต์แคน แก่นคูน', null, null, 'หญิง', '2010s'],
    ['ไอควาย', 'กะท้อน', null, null, 'หญิง', '2020s'],
    ['ฮักควรมีสองคน', 'ก้อง ห้วยไร่', null, null, 'หญิง', '2010s'],
    ['Music Lover', 'ปราง ปรางทิพย์', null, null, 'หญิง', '2010s'],
    ['เปิดใจขี้เหล้าแหน่', null, null, 104, 'หญิง', null],
    ['หังใจ๋ฮอมปอย', 'จรัล มโนเพ็ชร', null, null, 'หญิง', '80s'],
  ];
  
  // =====================================================
  // สากล section from ลิสวง (international songs)
  // =====================================================
  const lisIntl = [
    ['Easy', 'Commodores', null, 69, 'ชาย', '80s'],
    ['I Don\'t Want to Talk About It', 'Rod Stewart', null, 71, 'ชาย', '80s'],
    ['Right Here Waiting', 'Richard Marx', null, 90, 'ชาย', '80s'],
    ['Dance Monkey', 'Tones and I', null, 96, 'หญิง', '2020s'],
    ['My Heart Will Go On', 'Celine Dion', null, 99, 'หญิง', '90s'],
    ['Set Fire to the Rain', 'Adele', null, 108, 'หญิง', '2010s'],
    ['I Will Survive', 'Gloria Gaynor', null, 120, 'หญิง', '80s'],
    ['Go', 'Koto', null, 123, 'หญิง', '2010s'],
    ['Hands Up', 'Ottawan', null, 124, 'คู่', '80s'],
    ['Y.M.C.A.', 'Village People', null, 126, 'ชาย', '80s'],
    ['September', 'Earth, Wind & Fire', null, 126, 'ชาย', '80s'],
    ['Can\'t Take My Eyes Off You', 'Frankie Valli', null, 128, 'ชาย', '80s'],
    ['Casablanca', 'Bertie Higgins', null, 128, 'ชาย', '80s'],
    ['Linda', 'Buddy Clark', null, 130, 'ชาย', '80s'],
    ['Sha La La', 'Vengaboys', null, 133, 'หญิง', '90s'],
    ['The Young Ones', 'Cliff Richard', null, 137, 'ชาย', '80s'],
    ['Jailhouse Rock', 'Elvis Presley', null, 173, 'ชาย', '80s'],
    ['7 Years', 'Lukas Graham', null, 120, 'ชาย', '2010s'],
    ['All of Me', 'John Legend', null, null, 'ชาย', '2010s'],
    ['At All', 'TXRBO', null, null, 'ชาย', '2020s'],
    ['A Thousand Years', 'Christina Perri', null, 47, 'หญิง', '2010s'],
    ['At My Worst', 'Pink Sweat$', null, null, 'ชาย', '2020s'],
    ['Beautiful in White', 'Shane Filan', null, null, 'ชาย', '2010s'],
    ['Better Man', 'Robbie Williams', null, null, 'ชาย', '2000s'],
    ['Closer', 'The Chainsmokers', null, 95, 'คู่', '2010s'],
    ['Don\'t Look Back in Anger', 'Oasis', null, null, 'ชาย', '90s'],
    ['Flash Light', 'Parliament', null, null, 'ชาย', '80s'],
    ['Fly Me to the Moon', 'Frank Sinatra', null, null, 'ชาย', '80s'],
    ['Get Lucky', 'Daft Punk', null, null, 'ชาย', '2010s'],
    ['Good Time', 'Owl City', null, null, 'คู่', '2010s'],
    ['Handyman', 'James Taylor', null, null, 'ชาย', '80s'],
    ['Havana', 'Camila Cabello', null, null, 'หญิง', '2010s'],
    ['Have I Told You Lately', 'Rod Stewart', null, null, 'ชาย', '90s'],
    ['Hero', 'Mariah Carey', null, null, 'หญิง', '90s'],
    ['How Deep Is Your Love', 'Bee Gees', null, null, 'ชาย', '80s'],
    ['I Don\'t Wanna Miss a Thing', 'Aerosmith', null, null, 'ชาย', '90s'],
    ['I\'m Not the Only One', 'Sam Smith', null, null, 'ชาย', '2010s'],
    ['Just the Way You Are', 'Bruno Mars', null, null, 'ชาย', '2010s'],
    ['Last Train to London', 'Electric Light Orchestra', null, null, 'ชาย', '80s'],
    ['Leave the Door Open', 'Bruno Mars', null, null, 'ชาย', '2020s'],
    ['Love Me Like You Do', 'Ellie Goulding', null, null, 'หญิง', '2010s'],
    ['Lucky', 'Jason Mraz', null, null, 'คู่', '2000s'],
    ['More Than I Can Say', 'Leo Sayer', null, null, 'ชาย', '80s'],
    ['Moves Like Jagger', 'Maroon 5', null, null, 'ชาย', '2010s'],
    ['One Call Away', 'Charlie Puth', null, null, 'ชาย', '2010s'],
    ['Price Tag', 'Jessie J', null, null, 'หญิง', '2010s'],
    ['Rude', 'Magic!', null, null, 'ชาย', '2010s'],
    ['The Day You Went Away', 'M2M', null, null, 'หญิง', '2000s'],
    ['She Will Be Loved', 'Maroon 5', null, null, 'ชาย', '2000s'],
    ['Sky & Sea', 'Per Li', null, null, 'หญิง', '2010s'],
    ['Stay with Me', 'Sam Smith', null, null, 'ชาย', '2010s'],
    ['Stupid Cupid', 'Connie Francis', null, null, 'หญิง', '80s'],
    ['Sunday Morning', 'Maroon 5', null, null, 'ชาย', '2000s'],
    ['Superman', 'Five for Fighting', null, null, 'ชาย', '2000s'],
    ['Thinking Out Loud', 'Ed Sheeran', null, null, 'ชาย', '2010s'],
    ['This Love', 'Maroon 5', null, null, 'ชาย', '2000s'],
    ['Treasure', 'Bruno Mars', null, null, 'ชาย', '2010s'],
    ['Trouble Is a Friend', 'Lenka', null, null, 'หญิง', '2000s'],
    ['When I Was Your Man', 'Bruno Mars', null, null, 'ชาย', '2010s'],
    ['When You Say Nothing at All', 'Ronan Keating', null, null, 'ชาย', '90s'],
    ['Without You', 'David Guetta', null, null, 'ชาย', '2010s'],
    ['Wonderwall', 'Oasis', null, null, 'ชาย', '90s'],
    ['Yellow', 'Coldplay', null, null, 'ชาย', '2000s'],
    ['Yesterday', 'The Beatles', null, null, 'ชาย', '80s'],
    ['Yesterday Once More', 'Carpenters', null, null, 'หญิง', '80s'],
    ['2002', 'Anne-Marie', null, 96, 'หญิง', '2010s'],
    ['Saving All My Love for You', 'Whitney Houston', null, null, 'หญิง', '80s'],
    ['I Will Always Love You', 'Whitney Houston', null, null, 'หญิง', '90s'],
    ['Don\'t Let Me Down', 'The Chainsmokers', null, null, 'ชาย', '2010s'],
    ['My Love', 'Westlife', null, null, 'ชาย', '2000s'],
    ['Have You Ever Seen the Rain', 'Creedence Clearwater Revival', null, null, 'ชาย', '80s'],
    ['Eternal Flame', 'Bangles', null, 80, 'หญิง', '80s'],
    ['Like I\'m Gonna Lose You', 'Meghan Trainor', null, 72, 'คู่', '2010s'],
    ['Before I Fall in Love', 'CoCo Lee', null, null, 'หญิง', '90s'],
  ];
  
  // Build and execute inserts
  let count = 0;
  for (const [name, artist, key, bpm, singer, era] of [...lisSongs, ...lisIntl]) {
    const ins = buildInsert(name, artist, key, bpm, singer, era, null);
    if (ins) { inserts.push(ins); count++; }
  }
  
  console.log(`Generated ${count} new song inserts from ลิสวง data`);
  
  // Execute in batches
  const batchSize = 25;
  for (let i = 0; i < inserts.length; i += batchSize) {
    const batch = inserts.slice(i, i + batchSize).join('\n');
    try {
      const result = await query(batch);
      console.log(`Batch ${Math.floor(i/batchSize)+1} (${Math.min(batchSize, inserts.length-i)} songs): OK`);
    } catch(e) {
      console.error(`Batch ${Math.floor(i/batchSize)+1} error:`, typeof e === 'string' ? e.substring(0, 200) : e);
    }
  }
  
  // Count
  const countResult = await query("SELECT COUNT(*) as cnt FROM band_songs WHERE source='global'");
  console.log(`\nFinal total global songs: ${countResult[0].cnt}`);
}

main().catch(console.error);
