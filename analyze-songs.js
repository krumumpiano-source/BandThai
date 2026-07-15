// Step 1: Get existing songs from DB and save as clean JSON
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
        try { resolve(JSON.parse(data)); } catch(e) { reject(data); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Fetching existing songs from DB...');
  const existing = await query("SELECT id, name, artist, bpm, key, singer, mood, era, tags FROM band_songs WHERE source='global' ORDER BY name");
  console.log(`Found ${existing.length} existing songs`);
  
  // Save full data
  fs.writeFileSync('existing-songs.json', JSON.stringify(existing, null, 2), 'utf8');
  console.log('Saved to existing-songs.json');
  
  // Print just names for quick scan
  const names = existing.map(r => r.name);
  fs.writeFileSync('existing-song-names.txt', names.join('\n'), 'utf8');
  console.log('Saved names to existing-song-names.txt');
}

main().catch(console.error);
