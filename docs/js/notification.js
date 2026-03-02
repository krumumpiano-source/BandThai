/**
 * notification.js — Web Push Notification Manager
 * Band Management By SoulCiety
 *
 * ต้อง load หลัง supabase-api.js
 * ใช้งาน: initNotifications() เรียกจาก dashboard หลัง login
 */
'use strict';

(function (global) {

  var _VAPID_PUBLIC_KEY = (global._SB_CONFIG && global._SB_CONFIG.vapidPublicKey) || '';
  var _swReg = null;

  // ── Utility ────────────────────────────────────────────────────
  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // ── ความสามารถของ browser ─────────────────────────────────────
  function isSupported() {
    return ('Notification' in window) &&
           ('serviceWorker' in navigator) &&
           ('PushManager' in window);
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function isStandalone() {
    return window.navigator.standalone === true ||
           window.matchMedia('(display-mode: standalone)').matches;
  }

  // ── รอ SW พร้อม ────────────────────────────────────────────────
  function waitForSW(cb) {
    if (global._swReg) { cb(global._swReg); return; }
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (global._swReg) { clearInterval(timer); cb(global._swReg); }
      else if (tries > 60) { clearInterval(timer); cb(null); } // timeout 3 วินาที
    }, 50);
  }

  // ── getPermissionStatus ───────────────────────────────────────
  function getPermissionStatus() {
    if (!isSupported()) {
      if (isIOS() && !isStandalone()) return 'ios-not-installed';
      return 'unsupported';
    }
    return Notification.permission; // 'default' | 'granted' | 'denied'
  }
  global.getNotificationPermissionStatus = getPermissionStatus;

  // ── ขอ permission + subscribe ─────────────────────────────────
  function requestAndSubscribe(callback) {
    if (!isSupported()) {
      callback && callback({ success: false, status: getPermissionStatus() });
      return;
    }
    Notification.requestPermission(function (perm) {
      if (perm !== 'granted') {
        callback && callback({ success: false, status: perm });
        return;
      }
      subscribePush(callback);
    });
  }
  global.requestAndSubscribePush = requestAndSubscribe;

  // ── subscribe push ────────────────────────────────────────────
  function subscribePush(callback) {
    waitForSW(function (reg) {
      if (!reg) { callback && callback({ success: false, error: 'Service Worker ไม่พร้อม' }); return; }
      _swReg = reg;
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(_VAPID_PUBLIC_KEY)
      }).then(function (sub) {
        var key    = sub.getKey ? sub.getKey('p256dh') : null;
        var authKey = sub.getKey ? sub.getKey('auth') : null;
        var p256dh = key    ? btoa(String.fromCharCode.apply(null, new Uint8Array(key))) : '';
        var auth   = authKey ? btoa(String.fromCharCode.apply(null, new Uint8Array(authKey))) : '';
        apiCall('savePushSubscription', {
          endpoint: sub.endpoint,
          p256dh:   p256dh,
          authKey:  auth
        }, function (r) {
          callback && callback({ success: !!(r && r.success), subscription: sub });
        });
      }).catch(function (err) {
        console.warn('[Push] subscribe error', err);
        callback && callback({ success: false, error: String(err) });
      });
    });
  }
  global.subscribePush = subscribePush;

  // ── unsubscribe ───────────────────────────────────────────────
  function unsubscribePush(callback) {
    waitForSW(function (reg) {
      if (!reg) { callback && callback({ success: false }); return; }
      reg.pushManager.getSubscription().then(function (sub) {
        if (!sub) { callback && callback({ success: true }); return; }
        apiCall('deletePushSubscription', { endpoint: sub.endpoint }, function () {
          sub.unsubscribe().then(function () {
            callback && callback({ success: true });
          }).catch(function () {
            callback && callback({ success: false });
          });
        });
      });
    });
  }
  global.unsubscribePush = unsubscribePush;

  // ── resubscribe (เรียกจาก SW เมื่อ subscription เปลี่ยน) ─────
  global.resubscribePush = function () {
    if (Notification.permission === 'granted') subscribePush(null);
  };

  // ── checkCurrentSubscription ──────────────────────────────────
  function checkCurrentSubscription(callback) {
    if (!isSupported()) { callback && callback(null); return; }
    waitForSW(function (reg) {
      if (!reg) { callback && callback(null); return; }
      reg.pushManager.getSubscription().then(function (sub) {
        callback && callback(sub);
      }).catch(function () { callback && callback(null); });
    });
  }
  global.checkCurrentSubscription = checkCurrentSubscription;

  // ── initNotifications — เรียกหลัง login ─────────────────────
  function initNotifications() {
    if (!isSupported()) return;
    var status = getPermissionStatus();
    // ถ้า iOS ยังไม่ได้ add to home screen → จัดการใน showNotificationPrompt
    if (status === 'granted') {
      // ตรวจว่า subscription ยังใช้ได้
      checkCurrentSubscription(function (sub) {
        if (!sub) subscribePush(null); // re-subscribe ถ้าหายไป
      });
    }
  }
  global.initNotifications = initNotifications;

  // ── showNotificationPrompt — banner ใน dashboard ──────────────
  // เรียกจาก dashboard หลัง render เสร็จ
  function showNotificationPrompt(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var status = getPermissionStatus();
    if (status === 'granted') return; // มีอยู่แล้ว ไม่แสดง

    // บันทึกว่า user เคยกด "ไว้ทีหลัง"
    if (localStorage.getItem('notif_dismissed') === '1') return;

    var banner = document.createElement('div');
    banner.id = 'notifPromptBanner';
    banner.style.cssText = [
      'background:linear-gradient(135deg,#1e3a8a,#2563eb)',
      'color:#fff','border-radius:12px','padding:14px 16px',
      'margin-bottom:16px','display:flex','align-items:center',
      'gap:12px','flex-wrap:wrap'
    ].join(';');

    var msg = '';
    if (status === 'ios-not-installed') {
      msg = '<div style="flex:1;min-width:200px">' +
        '<div style="font-weight:700;font-size:14px">📲 ติดตั้งแอปเพื่อรับแจ้งเตือน</div>' +
        '<div style="font-size:12px;opacity:.85;margin-top:3px">' +
        'แตะ <strong>Share</strong> →  <strong>Add to Home Screen</strong> บน Safari</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'notifPromptBanner\').style.display=\'none\';localStorage.setItem(\'notif_dismissed\',\'1\')" ' +
        'style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer;white-space:nowrap">ตกลง</button>';
    } else {
      msg = '<div style="flex:1;min-width:200px">' +
        '<div style="font-weight:700;font-size:14px">🔔 เปิดการแจ้งเตือน?</div>' +
        '<div style="font-size:12px;opacity:.85;margin-top:3px">รับแจ้งเตือนก่อนถึงงาน แม้ปิดแอปแล้ว</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-shrink:0">' +
        '<button onclick="handleEnableNotif(this)" style="background:#fff;color:#1e3a8a;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer">เปิด</button>' +
        '<button onclick="document.getElementById(\'notifPromptBanner\').style.display=\'none\';localStorage.setItem(\'notif_dismissed\',\'1\')" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:8px;padding:6px 14px;font-size:12px;cursor:pointer">ไว้ทีหลัง</button>' +
        '</div>';
    }
    banner.innerHTML = msg;
    container.insertBefore(banner, container.firstChild);
  }
  global.showNotificationPrompt = showNotificationPrompt;

  // ── handleEnableNotif ──────────────────────────────────────────
  global.handleEnableNotif = function (btn) {
    btn.textContent = '⏳';
    btn.disabled = true;
    requestAndSubscribe(function (r) {
      var banner = document.getElementById('notifPromptBanner');
      if (r && r.success) {
        if (banner) banner.style.display = 'none';
        if (typeof global.showToast === 'function') global.showToast('✅ เปิดการแจ้งเตือนแล้ว');
      } else {
        if (banner) banner.style.display = 'none';
        localStorage.setItem('notif_dismissed', '1');
        if (typeof global.showToast === 'function') global.showToast('ไม่สามารถเปิดการแจ้งเตือนได้');
      }
    });
  };

  // Auto-init เมื่อ DOM พร้อม (สำหรับหน้าที่ไม่เรียก initNotifications เอง)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(initNotifications, 1500); // รอ SW register ก่อน
    });
  } else {
    setTimeout(initNotifications, 1500);
  }

})(window);
