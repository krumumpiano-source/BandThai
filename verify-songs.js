// verify-songs.js - Deep verification of song names and artists
const fs = require('fs');

const songs = JSON.parse(fs.readFileSync('existing-songs-audit.json', 'utf8'));

// === 1. Songs with artist embedded in name (parentheses or dash) ===
const artistInName = [];
songs.forEach((s, i) => {
  if (!s.name) return;
  // Pattern: "song name (artist name)" 
  const parenMatch = s.name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    artistInName.push({ idx: i, song: s, extractedArtist: parenMatch[2].trim(), cleanName: parenMatch[1].trim(), type: 'parens' });
    return;
  }
  // Pattern: "song name - artist name"
  const dashMatch = s.name.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) {
    artistInName.push({ idx: i, song: s, extractedArtist: dashMatch[2].trim(), cleanName: dashMatch[1].trim(), type: 'dash' });
  }
});

// === 2. Duplicate song names ===
const nameMap = {};
songs.forEach((s, i) => {
  if (!s.name) return;
  const key = s.name.trim();
  if (!nameMap[key]) nameMap[key] = [];
  nameMap[key].push({ idx: i, song: s });
});
const duplicates = Object.entries(nameMap).filter(([k, v]) => v.length > 1);

// === 3. Songs with no artist ===
const noArtist = songs.filter(s => !s.artist || s.artist.trim() === '');

// === 4. Songs with suspicious characters (encoding issues remaining) ===
const suspicious = songs.filter(s => {
  const check = t => t && typeof t === 'string' && (/â€™/.test(t) || /â€/.test(t) || /Ã/.test(t) || /├/.test(t) || /Γ/.test(t));
  return check(s.name) || check(s.artist) || check(s.singer);
});

// === 5. Unique artists sorted ===
const artistCount = {};
songs.forEach(s => {
  if (s.artist && s.artist.trim()) {
    const a = s.artist.trim();
    if (!artistCount[a]) artistCount[a] = 0;
    artistCount[a]++;
  }
});

// === WRITE REPORT ===
const lines = [];
lines.push('# Song Verification Report');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Total songs: ${songs.length}`);
lines.push('');

lines.push('## Summary');
lines.push(`- Total songs: ${songs.length}`);
lines.push(`- Songs with artist: ${songs.length - noArtist.length}`);
lines.push(`- Songs without artist: ${noArtist.length}`);
lines.push(`- Songs with artist embedded in name: ${artistInName.length}`);
lines.push(`- Duplicate song names: ${duplicates.length} groups`);
lines.push(`- Songs with remaining encoding issues: ${suspicious.length}`);
lines.push(`- Unique artists: ${Object.keys(artistCount).length}`);
lines.push('');

lines.push('## 1. Songs with Artist Embedded in Name (Need Extraction)');
lines.push('These songs have artist info inside the song name that should be moved to the artist field:');
lines.push('');
lines.push('| # | Current Name | Extracted Artist | Clean Song Name | Current Artist |');
lines.push('|---|-------------|-----------------|-----------------|----------------|');
artistInName.forEach((item, i) => {
  lines.push(`| ${i+1} | ${item.song.name} | ${item.extractedArtist} | ${item.cleanName} | ${item.song.artist || '(empty)'} |`);
});
lines.push('');

lines.push('## 2. Songs with Remaining Encoding Issues');
lines.push('These still have garbled characters:');
lines.push('');
suspicious.forEach((s, i) => {
  lines.push(`${i+1}. **${s.name}** | Artist: ${s.artist || '(empty)'} | ID: ${s.id}`);
});
lines.push('');

lines.push('## 3. Duplicate Song Names');
lines.push('');
duplicates.forEach(([name, items]) => {
  lines.push(`### "${items[0].song.name}" (${items.length} copies)`);
  items.forEach(item => {
    lines.push(`- Artist: ${item.song.artist || '(empty)'} | Singer: ${item.song.singer || '(empty)'} | ID: ${item.song.id}`);
  });
  lines.push('');
});

lines.push('## 4. All Unique Artists');
lines.push('');
lines.push('| # | Artist | Songs |');
lines.push('|---|--------|-------|');
Object.entries(artistCount).sort((a,b) => b[1]-a[1]).forEach(([artist, count], i) => {
  lines.push(`| ${i+1} | ${artist} | ${count} |`);
});
lines.push('');

lines.push('## 5. Songs Without Artist');
lines.push('');
lines.push('| # | Song Name | Singer | ID |');
lines.push('|---|-----------|--------|-----|');
noArtist.forEach((s, i) => {
  lines.push(`| ${i+1} | ${s.name || '(empty)'} | ${s.singer || '(empty)'} | ${s.id} |`);
});

fs.writeFileSync('SONG-VERIFICATION-REPORT.md', lines.join('\n'), 'utf8');
console.log('Report written to SONG-VERIFICATION-REPORT.md');
console.log(`Summary: ${songs.length} songs, ${noArtist.length} without artist, ${artistInName.length} with artist in name, ${suspicious.length} encoding issues, ${duplicates.length} duplicate groups`);
