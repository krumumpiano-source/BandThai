// fix-songs-final.js - Fix encoding + extract artist from names + verify data
const fs = require('fs');

// Read original file (with BOM handling)
let raw = fs.readFileSync('existing-songs.json', 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const songs = JSON.parse(raw);

// === CP1252 double-encoding fix ===
const cp1252Special = {
  0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
  0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
  0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
  0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
  0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
  0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
};

function fixDoubleEncoding(str) {
  if (!str || typeof str !== 'string') return str;
  if (/[\u0E00-\u0E7F]/.test(str)) return str;  // Already Thai
  if (!/[àâãäåæçèéêëìíîïðñòóôõöøùúûü¹²³ƒˆ‰Š‹ŒŽ''""•–—˜™š›œžŸ]/i.test(str)) return str;
  
  try {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      const cp = str.codePointAt(i);
      if (cp <= 0xFF) { bytes.push(cp); }
      else if (cp1252Special[cp] !== undefined) { bytes.push(cp1252Special[cp]); }
      else { return str; }
    }
    const decoded = Buffer.from(bytes).toString('utf8');
    if (/[\u0E00-\u0E7F]/.test(decoded)) return decoded;
    return str;
  } catch (e) { return str; }
}

// === Fix smart quotes / apostrophe mojibake ===
function fixApostrophe(str) {
  if (!str) return str;
  return str
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€\u009D/g, '"')
    .replace(/â€"/g, '—')
    .replace(/â€"/g, '–')
    .replace(/├│ΓÇ¬ΓÇ£/g, "'")
    .replace(/Γé¼ΓÇ£/g, "'")
    .replace(/├óΓé¼Γäó/g, "'");
}

// === Extract artist from song name ===
function extractArtistFromName(name) {
  if (!name) return null;
  
  // Pattern: "song name (artist name)" - but not number patterns like "(2)"
  const parenMatch = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const cleanName = parenMatch[1].trim();
    const extracted = parenMatch[2].trim();
    // Skip if the extracted part looks like a number or subtitle
    if (/^\d+$/.test(extracted)) return null;
    // Skip common non-artist patterns
    if (/^(feat|ft|remix|live|version|ver|cover|acoustic|official|mv|ost|part|ep)\b/i.test(extracted)) return null;
    return { cleanName, artist: extracted };
  }
  
  // Pattern: "song name - artist name" 
  const dashMatch = name.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) {
    return { cleanName: dashMatch[1].trim(), artist: dashMatch[2].trim() };
  }
  
  return null;
}

// === APPLY FIXES ===
const changes = [];
let encodingFixes = 0;
let apostropheFixes = 0;
let artistExtracted = 0;

songs.forEach((song, idx) => {
  const origName = song.name;
  const origArtist = song.artist;
  const origSinger = song.singer;
  const origMood = song.mood;
  const origEra = song.era;
  
  // Step 1: Fix double-encoding for all text fields
  song.name = fixDoubleEncoding(song.name);
  song.artist = fixDoubleEncoding(song.artist);
  song.singer = fixDoubleEncoding(song.singer);
  song.mood = fixDoubleEncoding(song.mood);
  song.era = fixDoubleEncoding(song.era);
  
  // Step 2: Fix apostrophe mojibake
  const nameAfterApostrophe = fixApostrophe(song.name);
  const artistAfterApostrophe = fixApostrophe(song.artist);
  if (nameAfterApostrophe !== song.name || artistAfterApostrophe !== song.artist) {
    apostropheFixes++;
  }
  song.name = nameAfterApostrophe;
  song.artist = artistAfterApostrophe;
  
  // Step 3: Extract artist from song name (only if no artist currently exists)
  if (!song.artist || song.artist.trim() === '') {
    const extracted = extractArtistFromName(song.name);
    if (extracted) {
      song.name = extracted.cleanName;
      song.artist = extracted.artist;
      artistExtracted++;
      changes.push({
        id: song.id,
        action: 'extract_artist',
        oldName: fixDoubleEncoding(origName),
        newName: extracted.cleanName,
        newArtist: extracted.artist
      });
    }
  }
  
  // Track encoding changes
  if (song.name !== origName || song.artist !== origArtist || song.singer !== origSinger) {
    if (fixDoubleEncoding(origName) !== origName || fixDoubleEncoding(origArtist) !== origArtist || fixDoubleEncoding(origSinger) !== origSinger) {
      encodingFixes++;
    }
  }
});

// === BACKUP AND SAVE ===
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = `existing-songs.backup-before-final-fix-${timestamp}.json`;
fs.copyFileSync('existing-songs.json', backupPath);
console.log(`Backup: ${backupPath}`);

// Write fixed data WITHOUT BOM
fs.writeFileSync('existing-songs.json', JSON.stringify(songs, null, 2), 'utf8');

// === SUMMARY ===
const noArtist = songs.filter(s => !s.artist || s.artist.trim() === '');
const noName = songs.filter(s => !s.name || s.name.trim() === '');
const noSinger = songs.filter(s => !s.singer || s.singer.trim() === '');

console.log('\n=== FIX SUMMARY ===');
console.log(`Total songs: ${songs.length}`);
console.log(`Encoding fixes: ${encodingFixes}`);
console.log(`Apostrophe fixes: ${apostropheFixes}`);
console.log(`Artists extracted from name: ${artistExtracted}`);
console.log(`\nAfter fix:`);
console.log(`  Songs with name: ${songs.length - noName.length}`);
console.log(`  Songs with artist: ${songs.length - noArtist.length}`);
console.log(`  Songs with singer: ${songs.length - noSinger.length}`);
console.log(`  Songs without artist (left empty): ${noArtist.length}`);
console.log(`  Songs without name: ${noName.length}`);

// === WRITE CHANGES LOG ===
if (changes.length > 0) {
  console.log('\n=== ARTIST EXTRACTIONS ===');
  changes.forEach(c => {
    console.log(`  "${c.oldName}" → name="${c.newName}", artist="${c.newArtist}"`);
  });
}

// Verify a few samples
console.log('\n=== SAMPLE VERIFICATION (first 20) ===');
songs.slice(0, 20).forEach((s, i) => {
  console.log(`${(i+1).toString().padStart(3)}. ${s.name || '(empty)'} | ${s.artist || '(empty)'} | ${s.singer || '(empty)'}`);
});

// Write final verification report
const report = [];
report.push('# Final Song Verification Report');
report.push(`Generated: ${new Date().toISOString()}`);
report.push(`Total songs: ${songs.length}`);
report.push('');
report.push('## Fix Summary');
report.push(`- Encoding fixes applied: ${encodingFixes}`);
report.push(`- Apostrophe fixes applied: ${apostropheFixes}`);
report.push(`- Artists extracted from name: ${artistExtracted}`);
report.push(`- Songs with song name: ${songs.length - noName.length}`);
report.push(`- Songs with artist: ${songs.length - noArtist.length}`);
report.push(`- Songs with singer: ${songs.length - noSinger.length}`);
report.push(`- Songs without artist (left empty): ${noArtist.length}`);
report.push('');

if (changes.length > 0) {
  report.push('## Artist Extractions');
  report.push('| Old Name | New Name | Extracted Artist |');
  report.push('|----------|----------|-----------------|');
  changes.forEach(c => {
    report.push(`| ${c.oldName} | ${c.newName} | ${c.newArtist} |`);
  });
  report.push('');
}

report.push('## Songs Without Artist (Left Empty per Request)');
report.push('| # | Song Name | Singer |');
report.push('|---|-----------|--------|');
noArtist.forEach((s, i) => {
  report.push(`| ${i+1} | ${s.name || ''} | ${s.singer || ''} |`);
});
report.push('');

report.push('## All Songs (Final State)');
report.push('| # | Song Name | Artist | Singer |');
report.push('|---|-----------|--------|--------|');
songs.forEach((s, i) => {
  report.push(`| ${i+1} | ${s.name || ''} | ${s.artist || ''} | ${s.singer || ''} |`);
});

fs.writeFileSync('FINAL-SONG-REPORT.md', report.join('\n'), 'utf8');
console.log('\nFinal report: FINAL-SONG-REPORT.md');
