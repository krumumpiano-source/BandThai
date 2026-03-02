/**
 * generate-vapid.js
 * รันครั้งเดียวเพื่อสร้าง VAPID key pair สำหรับ Web Push
 * Usage: node generate-vapid.js
 *
 * Output จะแสดง:
 *   - VAPID_PUBLIC_KEY  → ใส่ใน docs/js/config.js
 *   - VAPID_PRIVATE_KEY → ใส่เป็น Supabase secret (ไม่ commit)
 *   - VAPID_SUBJECT     → ใส่เป็น Supabase secret
 */

const { webcrypto } = require('crypto');
const { subtle } = webcrypto;

async function generateVapidKeys() {
  // Generate P-256 key pair สำหรับ VAPID (RFC 8292)
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  // Export public key เป็น raw bytes (65 bytes uncompressed point)
  const publicKeyRaw = await subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBase64 = Buffer.from(publicKeyRaw).toString('base64url');

  // Export private key เป็น pkcs8
  const privateKeyPkcs8 = await subtle.exportKey('pkcs8', keyPair.privateKey);
  // เอาเฉพาะ 32 bytes private scalar (bytes 36-67 ของ pkcs8 structure for P-256)
  const privateKeyBytes = Buffer.from(privateKeyPkcs8).slice(36, 68);
  const privateKeyBase64 = privateKeyBytes.toString('base64url');

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  VAPID Keys Generated Successfully!');
  console.log('══════════════════════════════════════════════════════');
  console.log('\n[1] ใส่ใน docs/js/config.js (VAPID_PUBLIC_KEY):');
  console.log('\n  vapidPublicKey: \'' + publicKeyBase64 + '\'');
  console.log('\n[2] ใส่เป็น Supabase Secrets (อย่า commit!):');
  console.log('\n  VAPID_PUBLIC_KEY  = ' + publicKeyBase64);
  console.log('  VAPID_PRIVATE_KEY = ' + privateKeyBase64);
  console.log('  VAPID_SUBJECT     = mailto:admin@soulciety.app');
  console.log('\n══════════════════════════════════════════════════════\n');
}

generateVapidKeys().catch(console.error);
