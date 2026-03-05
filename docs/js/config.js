/**
 * Band Management By SoulCiety — Supabase Config
 * ────────────────────────────────────────────────
 * วิธีดูค่าเหล่านี้:
 *   1. เข้า https://app.supabase.com → เลือก project
 *   2. ไป Settings → API
 *   3. คัดลอก "Project URL" และ "anon public" key
 *
 * ⚠️ ไฟล์นี้ public — ใส่เฉพาะ anon key เท่านั้น (ไม่ใส่ service_role)
 */
window._SB_CONFIG = {
  url:  'https://wsorngsyowgxikiepice.supabase.co',
  anon: 'sb_publishable_k2zvxeE9SJEEJkw3SVolqg_pkgZQPnm',
  vapidPublicKey: 'BLTV9C7RV2nVM9R-yQXtbfy_SfX7QmNSsA4XPZ_d3Q68ELssl0SioBz8RHjp1FxuAA_Zm2_ZcJ_tjEaRonDHEzA'
};

// ── AdSense Configuration ───────────────────────────────
window._AD_CONFIG = {
  client:     'ca-pub-6824376916256036',   // Publisher ID
  slot:       '',                           // Rewarded Ad Slot ID — ใส่หลัง AdSense approve แล้วสร้าง Ad Unit
  sessionMin: 75,                           // นาที — free tier ดูโฆษณาทุกกี่นาที
  enabled:    true,                         // toggle ปิด/เปิดระบบโฆษณา
  placeholder: true                         // true = countdown 30 วิ, false = AdSense จริง
};
