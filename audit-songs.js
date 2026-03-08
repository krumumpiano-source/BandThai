// audit-songs.js - Fix double-encoding and verify song name + artist correctness
const fs = require('fs');

// Read the file, strip BOM
let raw = fs.readFileSync('existing-songs.json', 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const songs = JSON.parse(raw);

// Fix double-encoded UTF-8 (UTF-8 interpreted as CP1252, then re-encoded as UTF-8)
// We need to: take the string's codepoints as CP1252 bytes, then decode those bytes as UTF-8
function fixDoubleEncoding(str) {
  if (!str || typeof str !== 'string') return str;
  // Check if already proper Thai (has Thai Unicode range)
  if (/[\u0E00-\u0E7F]/.test(str)) return str;
  // Check if it looks like mojibake (has typical Latin extended chars)
  if (!/[àâãäåæçèéêëìíîïðñòóôõöøùúûü¹²³ƒˆ‰Š‹ŒŽ''""•–—˜™š›œžŸ]/i.test(str)) return str;
  
  try {
    // Map Unicode codepoints back to CP1252 bytes
    const cp1252Map = new Map();
    // Standard Latin-1 range (0x80-0x9F have special CP1252 mappings)
    const cp1252Special = {
      0x20AC: 0x80, // €
      0x201A: 0x82, // ‚
      0x0192: 0x83, // ƒ
      0x201E: 0x84, // „
      0x2026: 0x85, // …
      0x2020: 0x86, // †
      0x2021: 0x87, // ‡
      0x02C6: 0x88, // ˆ
      0x2030: 0x89, // ‰
      0x0160: 0x8A, // Š
      0x2039: 0x8B, // ‹
      0x0152: 0x8C, // Œ
      0x017D: 0x8E, // Ž
      0x2018: 0x91, // '
      0x2019: 0x92, // '
      0x201C: 0x93, // "
      0x201D: 0x94, // "
      0x2022: 0x95, // •
      0x2013: 0x96, // –
      0x2014: 0x97, // —
      0x02DC: 0x98, // ˜
      0x2122: 0x99, // ™
      0x0161: 0x9A, // š
      0x203A: 0x9B, // ›
      0x0153: 0x9C, // œ
      0x017E: 0x9E, // ž
      0x0178: 0x9F, // Ÿ
    };
    
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      const cp = str.codePointAt(i);
      if (cp <= 0xFF) {
        bytes.push(cp);
      } else if (cp1252Special[cp] !== undefined) {
        bytes.push(cp1252Special[cp]);
      } else {
        // Not a CP1252 character - return original string
        return str;
      }
    }
    
    // Decode the bytes as UTF-8
    const buf = Buffer.from(bytes);
    const decoded = buf.toString('utf8');
    
    // Verify the result has Thai characters
    if (/[\u0E00-\u0E7F]/.test(decoded)) {
      return decoded;
    }
    return str;
  } catch (e) {
    return str;
  }
}

console.log(`Total songs: ${songs.length}\n`);

// Track statistics
let stats = {
  total: songs.length,
  nameFixed: 0,
  artistFixed: 0,
  singerFixed: 0,
  nameEmpty: 0,
  artistEmpty: 0,
  singerEmpty: 0,
  alreadyThai: 0,
  issues: []
};

// Process and fix all songs
const fixedSongs = songs.map((song, idx) => {
  const origName = song.name;
  const origArtist = song.artist;
  const origSinger = song.singer;
  
  const fixedName = fixDoubleEncoding(song.name);
  const fixedArtist = fixDoubleEncoding(song.artist);
  const fixedSinger = fixDoubleEncoding(song.singer);
  
  if (fixedName !== origName) stats.nameFixed++;
  if (fixedArtist !== origArtist) stats.artistFixed++;
  if (fixedSinger !== origSinger) stats.singerFixed++;
  
  if (!fixedName || fixedName.trim() === '') stats.nameEmpty++;
  if (!fixedArtist || fixedArtist.trim() === '') stats.artistEmpty++;
  if (!fixedSinger || fixedSinger.trim() === '') stats.singerEmpty++;
  
  return {
    ...song,
    name: fixedName,
    artist: fixedArtist,
    singer: fixedSinger,
    mood: fixDoubleEncoding(song.mood),
    era: fixDoubleEncoding(song.era),
  };
});

// Print summary
console.log('=== ENCODING FIX SUMMARY ===');
console.log(`Names fixed: ${stats.nameFixed}`);
console.log(`Artists fixed: ${stats.artistFixed}`);
console.log(`Singers fixed: ${stats.singerFixed}`);
console.log(`Names empty/null: ${stats.nameEmpty}`);
console.log(`Artists empty/null: ${stats.artistEmpty}`);
console.log(`Singers empty/null: ${stats.singerEmpty}`);

// Print all songs with decoded names
console.log('\n=== ALL SONGS (Decoded) ===');
console.log('No. | Song Name | Artist | Singer');
console.log('----|-----------|--------|-------');
fixedSongs.forEach((s, i) => {
  const name = s.name || '(empty)';
  const artist = s.artist || '(empty)';
  const singer = s.singer || '(empty)';
  console.log(`${(i+1).toString().padStart(4)} | ${name} | ${artist} | ${singer}`);
});

// Find potential issues
console.log('\n=== POTENTIAL ISSUES ===');

// 1. Songs with no name
const noName = fixedSongs.filter(s => !s.name || s.name.trim() === '');
if (noName.length > 0) {
  console.log(`\n--- Songs with no name (${noName.length}) ---`);
  noName.forEach(s => console.log(`  ID: ${s.id} | Artist: ${s.artist || '(empty)'}`));
}

// 2. Songs with no artist
const noArtist = fixedSongs.filter(s => !s.artist || s.artist.trim() === '');
if (noArtist.length > 0) {
  console.log(`\n--- Songs with no artist (${noArtist.length}) ---`);
  noArtist.forEach(s => console.log(`  ID: ${s.id} | Name: ${s.name || '(empty)'}`));
}

// 3. Check for remaining mojibake (encoding not fully fixed)
const stillMojibake = fixedSongs.filter(s => {
  const check = (t) => t && typeof t === 'string' && /[àâãäåæçèéêëìíîïðñòóôõöøùúûü]/.test(t) && !/[\u0E00-\u0E7F]/.test(t);
  return check(s.name) || check(s.artist) || check(s.singer);
});
if (stillMojibake.length > 0) {
  console.log(`\n--- Songs still with mojibake (${stillMojibake.length}) ---`);
  stillMojibake.forEach(s => console.log(`  ID: ${s.id} | Name: ${s.name} | Artist: ${s.artist}`));
}

// 4. Duplicate song names
const nameCount = {};
fixedSongs.forEach(s => {
  if (s.name) {
    const key = s.name.trim().toLowerCase();
    if (!nameCount[key]) nameCount[key] = [];
    nameCount[key].push(s);
  }
});
const duplicates = Object.entries(nameCount).filter(([k, v]) => v.length > 1);
if (duplicates.length > 0) {
  console.log(`\n--- Duplicate song names (${duplicates.length} groups) ---`);
  duplicates.forEach(([name, songs]) => {
    console.log(`  "${songs[0].name}" (${songs.length} copies):`);
    songs.forEach(s => console.log(`    ID: ${s.id} | Artist: ${s.artist || '(empty)'} | Singer: ${s.singer || '(empty)'}`));
  });
}

// 5. Group songs by artist for verification
console.log('\n=== SONGS GROUPED BY ARTIST ===');
const byArtist = {};
fixedSongs.forEach(s => {
  const a = s.artist || '(ไม่ระบุศิลปิน)';
  if (!byArtist[a]) byArtist[a] = [];
  byArtist[a].push(s);
});
Object.entries(byArtist).sort((a, b) => b[1].length - a[1].length).forEach(([artist, songs]) => {
  console.log(`\n[${artist}] (${songs.length} songs)`);
  songs.forEach(s => console.log(`  - ${s.name || '(empty)'} | Singer: ${s.singer || '(empty)'}`));
});

// Write fixed data
const outputPath = 'existing-songs-audit.json';
fs.writeFileSync(outputPath, JSON.stringify(fixedSongs, null, 2), 'utf8');
console.log(`\n\nFixed data written to: ${outputPath}`);

// Write report
const reportLines = [];
reportLines.push('# Song Audit Report');
reportLines.push(`Generated: ${new Date().toISOString()}`);
reportLines.push(`Total songs: ${fixedSongs.length}`);
reportLines.push('');
reportLines.push('## Encoding Fixes');
reportLines.push(`- Names fixed: ${stats.nameFixed}`);
reportLines.push(`- Artists fixed: ${stats.artistFixed}`);
reportLines.push(`- Singers fixed: ${stats.singerFixed}`);
reportLines.push('');
reportLines.push('## Missing Data');
reportLines.push(`- Songs with no name: ${stats.nameEmpty}`);
reportLines.push(`- Songs with no artist: ${stats.artistEmpty}`);
reportLines.push(`- Songs with no singer: ${stats.singerEmpty}`);
reportLines.push('');

if (noArtist.length > 0) {
  reportLines.push('## Songs Without Artist');
  noArtist.forEach(s => {
    const fn = fixDoubleEncoding(s.name) || '(empty)';
    reportLines.push(`- ${fn} (ID: ${s.id})`);
  });
  reportLines.push('');
}

if (duplicates.length > 0) {
  reportLines.push('## Duplicate Song Names');
  duplicates.forEach(([name, songs]) => {
    reportLines.push(`### ${songs[0].name} (${songs.length} copies)`);
    songs.forEach(s => {
      reportLines.push(`- Artist: ${s.artist || '(empty)'}, Singer: ${s.singer || '(empty)'}, ID: ${s.id}`);
    });
  });
  reportLines.push('');
}

reportLines.push('## All Songs');
reportLines.push('| No. | Song Name | Artist | Singer |');
reportLines.push('|-----|-----------|--------|--------|');
fixedSongs.forEach((s, i) => {
  reportLines.push(`| ${i+1} | ${s.name || ''} | ${s.artist || ''} | ${s.singer || ''} |`);
});

fs.writeFileSync('SONG-AUDIT-REPORT.md', reportLines.join('\n'), 'utf8');
console.log('Report written to: SONG-AUDIT-REPORT.md');
