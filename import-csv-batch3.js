// Import songs from 4 CSV files (เพื่อชีวิต, ร็อค, ป๊อป, ลูกทุ่ง/อีสาน)
const https = require('https');
const fs = require('fs');

let _pat; try { _pat = fs.readFileSync('.env.local', 'utf8').match(/SUPABASE_PAT=(.+)/)[1].trim(); } catch(e) { _pat = process.env.SUPABASE_PAT; }
const PAT = _pat;
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
      res.on('end', () => {
        if (res.statusCode >= 400) { reject(new Error(`API Error: ${res.statusCode} - ${data}`)); return; }
        try { resolve(JSON.parse(data)); } catch(e) { reject(data); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function esc(s) { return s ? s.replace(/'/g, "''") : ''; }

// CSV file → genre mapping
const FILES = [
  { path: 'c:\\Users\\krumu\\Downloads\\คลังเพลงกลาง - เพื่อชีวิต.csv', genre: 'เพื่อชีวิต' },
  { path: 'c:\\Users\\krumu\\Downloads\\คลังเพลงกลาง - ร้อค.csv', genre: 'ร็อค' },
  { path: 'c:\\Users\\krumu\\Downloads\\คลังเพลงกลาง - ป๊อบ.csv', genre: 'ป๊อป' },
  { path: 'c:\\Users\\krumu\\Downloads\\คลังเพลงกลาง - ลูกทุ่ง_อีสาน.csv', genre: 'ลูกทุ่ง / อีสาน' },
];

// Standardize artist names (English → Thai for consistency)
const ARTIST_MAP = {
  'silly fools': 'ซิลลี่ ฟูลส์',
  'blackhead': 'แบล็คเฮด',
  // Keep English names that are commonly written in English:
  // Bodyslam, Big Ass, Potato, Clash, Slot Machine, Flure, Instinct, Zeal, AB Normal, Modern Dog, Scrubb, Synkornize
};

function cleanArtist(raw) {
  if (!raw) return '';
  let a = raw.trim();
  // Remove parenthetical notes like (อัลบั้มพฤษภา), (ต้นฉบับ ...)
  // But keep feat. info
  a = a.replace(/\s*\(อัลบั้ม[^)]*\)/g, '');
  a = a.replace(/\s*\(ต้นฉบับ[^)]*\)/g, '');
  a = a.replace(/\s*\(รวมเพลง[^)]*\)/g, '');
  a = a.replace(/\s*\(จังหวะ[^)]*\)/g, '');
  a = a.replace(/\s*\(Cover\)/gi, '');
  a = a.replace(/\s*\(Remake[^)]*\)/gi, '');
  a = a.replace(/\s*\(หมอลำ[^)]*\)/g, '');
  
  // Standardize English → Thai names
  let lower = a.toLowerCase().trim();
  if (ARTIST_MAP[lower]) return ARTIST_MAP[lower];
  
  return a.trim();
}

function cleanName(raw) {
  if (!raw) return '';
  let n = raw.trim();
  // Strip leading numbers like "1. ", "29. ", "15."
  n = n.replace(/^\d+\.\s*/, '');
  // Remove quotes
  n = n.replace(/^[""]|[""]$/g, '');
  return n.trim();
}

function parseCSV(content) {
  const lines = content.split('\n');
  const songs = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Split by comma (handle quoted fields)
    const parts = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { parts.push(current); current = ''; continue; }
      current += ch;
    }
    parts.push(current);
    
    const name = (parts[0] || '').trim();
    const artist = (parts[1] || '').trim();
    
    // Skip empty rows
    if (!name) continue;
    // Skip header rows
    if (name === 'ชื่อเพลง' || name === 'ชื่อเพลง') continue;
    // Skip if name looks like a header
    if (name.includes('ศิลปิน') || name.includes('ปีที่ออก')) continue;
    
    songs.push({ name: cleanName(name), artist: cleanArtist(artist) });
  }
  return songs;
}

async function main() {
  console.log('=== Step 1: Parse CSV files ===\n');
  
  const allFromCSV = []; // { name, artist, genre }
  
  for (const f of FILES) {
    const raw = fs.readFileSync(f.path, 'utf-8');
    const songs = parseCSV(raw);
    console.log(`${f.genre}: ${songs.length} songs parsed`);
    for (const s of songs) {
      allFromCSV.push({ name: s.name, artist: s.artist, genre: f.genre });
    }
  }
  console.log(`\nTotal parsed: ${allFromCSV.length}`);
  
  // === Step 2: Deduplicate within/across CSVs ===
  console.log('\n=== Step 2: Deduplicate ===\n');
  
  const seen = new Map(); // key → { name, artist, genre }
  const dupeCount = { within: 0, cross: 0 };
  
  for (const s of allFromCSV) {
    const key = s.name.toLowerCase().trim();
    if (!key) continue;
    
    if (seen.has(key)) {
      const existing = seen.get(key);
      // Keep the one with more complete artist info
      if (!existing.artist && s.artist) {
        seen.set(key, s);
      }
      if (existing.genre === s.genre) dupeCount.within++;
      else dupeCount.cross++;
    } else {
      seen.set(key, s);
    }
  }
  
  const uniqueSongs = [...seen.values()];
  console.log(`Duplicates removed: ${dupeCount.within} within-file, ${dupeCount.cross} cross-file`);
  console.log(`Unique songs: ${uniqueSongs.length}`);
  
  // Show cross-file duplicates for audit
  const crossDupes = [];
  const seenForCross = new Map();
  for (const s of allFromCSV) {
    const key = s.name.toLowerCase().trim();
    if (!key) continue;
    if (seenForCross.has(key)) {
      const prev = seenForCross.get(key);
      if (prev.genre !== s.genre) {
        crossDupes.push({ name: s.name, genre1: prev.genre, genre2: s.genre });
      }
    } else {
      seenForCross.set(key, s);
    }
  }
  if (crossDupes.length > 0) {
    console.log('\nCross-file duplicates (kept first genre):');
    const shown = new Set();
    for (const d of crossDupes) {
      if (shown.has(d.name.toLowerCase())) continue;
      shown.add(d.name.toLowerCase());
      console.log(`  "${d.name}" → kept ${d.genre1}, skipped ${d.genre2}`);
    }
  }
  
  // === Step 3: Get existing songs from DB ===
  console.log('\n=== Step 3: Check existing DB songs ===\n');
  
  const existRes = await query("SELECT lower(trim(name)) as lname, name, artist, tags FROM band_songs WHERE band_id IS NULL");
  if (!Array.isArray(existRes)) {
    console.error('Failed to get existing songs:', existRes);
    return;
  }
  
  const existingMap = new Map();
  for (const row of existRes) {
    existingMap.set(row.lname, row);
  }
  console.log(`Existing global songs in DB: ${existingMap.size}`);
  
  // === Step 4: Find new songs ===
  const newSongs = [];
  const alreadyExist = [];
  const updateGenre = []; // songs that exist but have no genre
  
  for (const s of uniqueSongs) {
    const key = s.name.toLowerCase().trim();
    if (existingMap.has(key)) {
      const existing = existingMap.get(key);
      alreadyExist.push(s.name);
      // Check if existing song has no genre but CSV provides one
      if (!existing.tags && s.genre) {
        updateGenre.push({ name: s.name, key, genre: s.genre });
      }
    } else {
      newSongs.push(s);
    }
  }
  
  console.log(`Already in DB: ${alreadyExist.length}`);
  console.log(`Need genre update: ${updateGenre.length}`);
  console.log(`NEW songs to insert: ${newSongs.length}`);
  
  // Breakdown by genre
  const byGenre = {};
  for (const s of newSongs) {
    byGenre[s.genre] = (byGenre[s.genre] || 0) + 1;
  }
  console.log('\nNew songs by genre:');
  for (const [g, c] of Object.entries(byGenre)) {
    console.log(`  ${g}: ${c}`);
  }
  
  // List all new songs
  console.log('\n=== New songs to insert ===');
  for (const s of newSongs) {
    console.log(`  [${s.genre}] ${s.name} — ${s.artist || '(no artist)'}`);
  }
  
  // === Step 5: Insert new songs ===
  if (newSongs.length === 0 && updateGenre.length === 0) {
    console.log('\nNothing to insert or update!');
    return;
  }
  
  // Insert in batches of 50
  const BATCH = 50;
  let inserted = 0;
  
  for (let i = 0; i < newSongs.length; i += BATCH) {
    const batch = newSongs.slice(i, i + BATCH);
    const values = batch.map(s => 
      `('${esc(s.name)}', '${esc(s.artist)}', '${esc(s.genre)}', 'global')`
    ).join(',\n  ');
    
    const sql = `INSERT INTO band_songs (name, artist, tags, source) VALUES\n  ${values}\nON CONFLICT DO NOTHING;`;
    
    const res = await query(sql);
    if (Array.isArray(res) || (res && !res.error)) {
      inserted += batch.length;
      console.log(`Batch ${Math.floor(i/BATCH)+1}: inserted ${batch.length} songs (total: ${inserted})`);
    } else {
      console.error(`Batch ${Math.floor(i/BATCH)+1} FAILED:`, JSON.stringify(res).slice(0, 200));
    }
  }
  
  // Update genre for existing songs that have no genre
  if (updateGenre.length > 0) {
    console.log(`\nUpdating genre for ${updateGenre.length} existing songs...`);
    for (const u of updateGenre) {
      const sql = `UPDATE band_songs SET tags = '${esc(u.genre)}' WHERE lower(trim(name)) = '${esc(u.key)}' AND band_id IS NULL AND (tags IS NULL OR tags = '');`;
      await query(sql);
    }
    console.log('Genre updates done.');
  }
  
  // Final count
  const countRes = await query("SELECT count(*) as cnt FROM band_songs WHERE band_id IS NULL");
  console.log(`\nFinal total global songs: ${countRes[0]?.cnt || '?'}`);
}

main().catch(console.error);
