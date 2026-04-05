#!/usr/bin/env node
const https = require('https');
const fs = require('fs');

// Read .env.local
const env = {};
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([^=]+)=(.+)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});

const URL = env.SUPABASE_URL;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzb3JuZ3N5b3dneGlraWVwaWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzM1NTIsImV4cCI6MjA4NzY0OTU1Mn0.XD4ou147WquQu6JBn7RGKCFdPg740Mg_oeJ0VJ3zm8g';
const SRK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzb3JuZ3N5b3dneGlraWVwaWNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA3MzU1MiwiZXhwIjoyMDg3NjQ5NTUyfQ.Zx7_GTsI8_aqH5tZNLPCXHAdxpZILSfF9hPtfNq2W8Q';

function mgmtQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve(d); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function restGet(path, method, body) {
  return new Promise((resolve, reject) => {
    const u = new (require('url').URL)(URL + path);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: method || 'GET',
      headers: {
        'apikey': ANON,
        'Authorization': `Bearer ${SRK}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve(d); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function callEdgeFunction(bodyObj) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const u = new (require('url').URL)(URL + '/functions/v1/send-line-schedule');
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON,
        'Authorization': `Bearer ${SRK}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Step 1: ตรวจสอบ constraint ใหม่ในตาราง
  console.log('=== ตรวจ venue_schedule_entries ===\n');
  
  // ดึง entries วันนี้ หรือล่าสุด
  const entriesResult = await restGet('/rest/v1/venue_schedule_entries?select=id,venue_name,date,break_number,band_name,member_count,break_start,break_end&order=date.desc,break_start.asc&limit=20');
  if (Array.isArray(entriesResult) && entriesResult.length) {
    console.log(`พบ ${entriesResult.length} entries (ล่าสุด):`);
    entriesResult.forEach(e => {
      console.log(`  ${e.date} | เบรค ${e.break_number} | ${e.band_name || '(ว่าง)'} | ${e.member_count || 0} คน | ${e.break_start || '-'}-${e.break_end || '-'}`);
    });
  } else {
    console.log('ไม่พบ entries:', entriesResult);
  }

  // Step 2: ตรวจ constraint
  console.log('\n=== ตรวจ constraints ===\n');
  const constraints = await restGet('/rest/v1/rpc/get_constraints', 'POST', { p_table: 'venue_schedule_entries' });
  if (constraints && constraints.error) {
    // Fallback: query information_schema
    console.log('(ใช้ REST query ดู entries แทน — constraint ตรวจจาก Supabase Dashboard)');
  }

  // Step 3: ตรวจ configId
  console.log('\n=== venue_line_config ===\n');
  const cfgs = await restGet('/rest/v1/venue_line_config?select=id,venue_name,band_ids');
  if (Array.isArray(cfgs)) {
    cfgs.forEach(c => console.log(`  ${c.venue_name} → configId: ${c.id} | bands: ${JSON.stringify(c.band_ids)}`));
  }

  console.log('\n✅ ตรวจข้อมูลเสร็จ — รอ cron 23:30 ดูรายงานจริง');
  console.log('   หรือเปิด Admin UI กด previewLineMessage ดูตัวอย่าง');
}

main().catch(console.error);
