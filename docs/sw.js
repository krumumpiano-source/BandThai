/**
 * sw.js — Service Worker สำหรับ Band Management By SoulCiety
 * Handle: Web Push Notifications + notification click
 * ไม่ทำ offline cache ในเฟสนี้
 */

'use strict';

var APP_BASE = '/Band-Management-By-SoulCiety/docs/';

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
    data = { title: 'SoulCiety', body: event.data ? event.data.text() : '' };
  }

  var title   = data.title || 'Band Management By SoulCiety';
  var options = {
    body:    data.body    || '',
    icon:    APP_BASE + 'icons/icon-192.png',
    badge:   APP_BASE + 'icons/badge-72.png',
    tag:     data.tag     || 'soulciety-notification',
    renotify: true,
    data: {
      url:  data.url  || APP_BASE + 'dashboard.html',
      type: data.type || ''
    }
  };

  // vibration pattern สำหรับ Android
  if (data.type === 'external_1day' || data.type === 'regular_1hr') {
    options.vibrate = [200, 100, 200];
  } else {
    options.vibrate = [200];
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification Click ────────────────────────────────────────────
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var notifData = event.notification.data || {};
  var targetUrl = notifData.url || (APP_BASE + 'dashboard.html');
  var notifType = notifData.type || '';

  // เปิดหน้าที่เหมาะสมตาม type
  if (notifType === 'external_1day' || notifType === 'ext_5min') {
    targetUrl = APP_BASE + 'schedule.html';
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
