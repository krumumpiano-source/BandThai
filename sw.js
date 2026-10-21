/**
 * sw.js — Service Worker สำหรับ BandThai
 * Handle: Web Push Notifications + notification click
 * ไม่ทำ offline cache ในเฟสนี้
 */

'use strict';

// Works at both /BandThai/ (GitHub Pages) and / (Cloudflare Pages)
var APP_BASE = new URL(self.registration.scope).pathname;
function fixUrl(u) { return (u && u.indexOf('/BandThai/') === 0) ? APP_BASE + u.slice(10) : u; }

// ── Install & Activate (skip waiting → ใช้ทันที) ──────────────────
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

// ── Push Event ────────────────────────────────────────────────────
self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'BandThai', body: event.data ? event.data.text() : '' };
  }

  var title   = data.title || 'BandThai';
  var options = {
    body:    data.body    || '',
    icon:    APP_BASE + 'icons/icon-192.png',
    badge:   APP_BASE + 'icons/badge-72.png',
    tag:     data.tag     || 'bandthai-notification',
    renotify: true,
    data: {
      url:  fixUrl(data.url)  || APP_BASE + 'dashboard.html',
      type: data.type || ''
    }
  };

  // vibration pattern สำหรับ Android — เตือนแรงสำหรับเรื่องเร่งด่วน
  if (data.type === 'checkin_5min') {
    options.vibrate = [200, 100, 200, 100, 200];  // urgent
  } else if (data.type === 'external_1day' || data.type === 'regular_1hr') {
    options.vibrate = [200, 100, 200];
  } else {
    options.vibrate = [200];
  }

  // ใช้ tag แยกตาม type เพื่อไม่ให้แจ้งเตือนทับกัน
  options.tag = data.tag || ('bandthai-' + (data.type || 'notif'));

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification Click ────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var notifData = event.notification.data || {};
  var targetUrl = fixUrl(notifData.url) || (APP_BASE + 'dashboard.html');
  var notifType = notifData.type || '';

  // เปิดหน้าที่เหมาะสมตาม type
  if (notifType === 'external_1day' || notifType === 'regular_1hr') {
    targetUrl = APP_BASE + 'schedule.html';
  } else if (notifType === 'checkin_5min') {
    targetUrl = APP_BASE + 'check-in.html';
  } else {
    targetUrl = APP_BASE + 'dashboard.html';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // ถ้ามีหน้าเปิดอยู่แล้ว focus แทน
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(targetUrl.split('?')[0]) > -1 && 'focus' in client) {
          return client.focus();
        }
      }
      // เปิดหน้าใหม่
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Push Subscription Change ──────────────────────────────────────
// เมื่อ browser ต่ออายุ subscription อัตโนมัติ
self.addEventListener('pushsubscriptionchange', function (event) {
  event.waitUntil(
    self.clients.matchAll().then(function (clients) {
      clients.forEach(function (client) {
        client.postMessage({ type: 'SUBSCRIPTION_CHANGED' });
      });
    })
  );
});
