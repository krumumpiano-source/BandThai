/**
 * Band Management By SoulCiety — Core App (GitHub Pages + Supabase)
 *
 * Load order:
 *   1. i18n.js
 *   2. app.js  ← ไฟล์นี้ (inject config.js + Supabase SDK + supabase-api.js อัตโนมัติ)
 *   3. nav.js
 */

// ── Auto-inject Supabase SDK + config + supabase-api.js ─────────────
(function () {
  if (document.getElementById('_sb_sdk')) return;

  // 1) Load config.js ก่อน
  function loadScript(src, id, onload) {
    var s = document.createElement('script');
    if (id) s.id = id;
    s.src = src;
    if (onload) s.onload = onload;
    document.head.appendChild(s);
  }

  loadScript('js/config.js', '_sb_cfg', function () {
    // 2) Load Supabase SDK
    loadScript(
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
      '_sb_sdk',
      function () {
        // 3) Load supabase-api.js
        loadScript('js/supabase-api.js', '_sb_api', null);
      }
    );
  });
})();

(function(global){
  'use strict';

  // ======================================================
  // Auth
  // ======================================================
  function requireAuth() {
    if (!localStorage.getItem('auth_token')) {
      window.location.replace('index.html');
    }
  }
  global.requireAuth = requireAuth;

  // ── Ad Gate ─────────────────────────────────────────────────────────
  function checkAdGate() {
    var cfg = global._AD_CONFIG || {};
    if (cfg.enabled === false) return;                 // ปิดระบบโฆษณาแบบ explicit เท่านั้น
    var plan = localStorage.getItem('band_plan') || 'free';
    if (plan !== 'free') return;                       // Lite/Pro ข้ามได้เลย
    var ts    = parseInt(localStorage.getItem('ad_gate_ts') || '0');
    var limit = (cfg.sessionMin || 75) * 60 * 1000;   // default 75 นาที
    if (!ts || (Date.now() - ts) >= limit) {
      window.location.replace('ad-gate.html');
    }
  }
  global.checkAdGate = checkAdGate;

  function getAdTimeRemaining() {
    var cfg  = global._AD_CONFIG || {};
    var plan = localStorage.getItem('band_plan') || 'free';
    if (plan !== 'free') return -1;                    // -1 = ไม่ใช่ free
    var ts    = parseInt(localStorage.getItem('ad_gate_ts') || '0');
    if (!ts) return 0;
    var limit = (cfg.sessionMin || 75) * 60 * 1000;
    return Math.max(0, limit - (Date.now() - ts));
  }
  global.getAdTimeRemaining = getAdTimeRemaining;

  function ensureDemoSession() {
    if (localStorage.getItem('auth_token')) return;
    localStorage.setItem('auth_token', 'demo_' + Date.now());
    localStorage.setItem('userName', 'ผู้ใช้');
    localStorage.setItem('bandName', 'วงของคุณ');
  }
  global.ensureDemoSession = ensureDemoSession;

  function getAuthToken() { return localStorage.getItem('auth_token') || ''; }
  global.getAuthToken = getAuthToken;

  // ======================================================
  // apiCall — placeholder จนกว่า supabase-api.js จะโหลดเสร็จ
  // ======================================================
  function apiCall(action, data, callback) {
    var tries = 0;
    var wait = setInterval(function () {
      tries++;
      if (typeof window.sbRun === 'function') {
        clearInterval(wait);
        window.sbRun(action, data, callback);
      } else if (tries > 100) {
        clearInterval(wait);
        if (callback) callback({ success: false, message: 'ไม่สามารถโหลด Supabase API ได้ กรุณารีเฟรชหน้า' });
      }
    }, 100);
  }
  global.apiCall = apiCall;

  // ======================================================
  // Translations
  // ======================================================
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(function(node) {
      var key = node.getAttribute('data-i18n');
      if (key && typeof t === 'function') node.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(node) {
      var key = node.getAttribute('data-i18n-placeholder');
      if (key && typeof t === 'function') node.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function(node) {
      var key = node.getAttribute('data-i18n-title');
      if (key && typeof t === 'function') node.title = t(key);
    });
  }
  global.applyTranslations = applyTranslations;

  // ======================================================
  // Toast
  // ======================================================
  function showToast(message, type) {
    type = type || 'success';
    var el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = message;
    el.className = type;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(function() { el.classList.remove('show'); }, 3000);
  }
  global.showToast = showToast;

  // ======================================================
  // Confirm Dialog
  // ======================================================
  function showConfirm(title, message) {
    if (typeof title === 'object') { var o = title; title = o.title; message = o.message; }
    return new Promise(function(resolve) {
      title   = title   || (typeof t === 'function' ? t('confirmDeleteTitle') : 'ยืนยัน');
      message = message || (typeof t === 'function' ? t('confirmDeleteMsg')   : 'ต้องการดำเนินการใช่หรือไม่?');
      var overlay = document.createElement('div');
      overlay.className = 'confirm-overlay active';
      overlay.innerHTML =
        '<div class="confirm-box">' +
          '<h3>' + escapeHtml(title) + '</h3>' +
          '<p>' + escapeHtml(message) + '</p>' +
          '<div class="confirm-actions">' +
            '<button class="btn btn-secondary" id="_confirmCancel">' + (typeof t === 'function' ? t('cancel') : 'ยกเลิก') + '</button>' +
            '<button class="btn btn-danger" id="_confirmOk">' + (typeof t === 'function' ? t('delete') : 'ยืนยัน') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);
      function cleanup(r) { document.body.removeChild(overlay); resolve(r); }
      overlay.querySelector('#_confirmOk').addEventListener('click', function() { cleanup(true); });
      overlay.querySelector('#_confirmCancel').addEventListener('click', function() { cleanup(false); });
      overlay.addEventListener('click', function(e) { if (e.target === overlay) cleanup(false); });
    });
  }
  global.showConfirm = showConfirm;

  // ======================================================
  // Lang Toggle (auth pages)
  // ======================================================
  function renderLangToggle(containerId) {
    var el = document.getElementById(containerId || 'langToggle');
    if (!el) return;
    var lang = typeof getLang === 'function' ? getLang() : 'th';
    el.innerHTML =
      '<div class="lang-switcher">' +
        '<button type="button" class="lang-btn' + (lang==='th'?' active':'') + '" data-lang="th">TH</button>' +
        '<button type="button" class="lang-btn' + (lang==='en'?' active':'') + '" data-lang="en">EN</button>' +
      '</div>';
    el.querySelectorAll('[data-lang]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (typeof setLang === 'function') setLang(btn.dataset.lang);
        renderLangToggle(containerId);
        if (typeof applyTranslations === 'function') applyTranslations();
      });
    });
  }
  global.renderLangToggle = renderLangToggle;

  // ======================================================
  // Helpers
  // ======================================================
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }
  global.escapeHtml = escapeHtml;
  if (!global._escHtml) global._escHtml = escapeHtml;

  function formatCurrency(num) {
    num = parseFloat(num) || 0;
    return num.toLocaleString(typeof getLang === 'function' && getLang() === 'en' ? 'en-US' : 'th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  global.formatCurrency = formatCurrency;

  // ── Thai month names ──
  var THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var THAI_MONTHS_LONG  = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  global.THAI_MONTHS_SHORT = THAI_MONTHS_SHORT;
  global.THAI_MONTHS_LONG  = THAI_MONTHS_LONG;

  /**
   * formatThaiDateFull(date|string, opts)
   *  opts.day    : boolean (default true)
   *  opts.month  : 'short'|'long' (default 'long')
   *  opts.year   : boolean (default true)
   *  opts.time   : boolean (default false)
   * Returns: "27 กุมภาพันธ์ 2569" or variants
   */
  function formatThaiDateFull(dateInput, opts) {
    if (!dateInput) return '-';
    opts = opts || {};
    var d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    var parts = [];
    if (opts.day !== false) parts.push(d.getDate());
    var monthArr = opts.month === 'short' ? THAI_MONTHS_SHORT : THAI_MONTHS_LONG;
    parts.push(monthArr[d.getMonth()]);
    if (opts.year !== false) parts.push(d.getFullYear() + 543);
    var result = parts.join(' ');
    if (opts.time) {
      result += ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    }
    return result;
  }
  global.formatThaiDateFull = formatThaiDateFull;

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      return formatThaiDateFull(dateStr, { month: 'short' });
    } catch(e) { return dateStr; }
  }
  global.formatDate = formatDate;

})(window);

/* ══════════════════════════════════════════════════════
   Thai Date Picker Overlay
   แปลง <input type="date"> / <input type="month">
   ให้แสดงวันที่ไทย เช่น "23 ก.พ. 2569" แทน "02/23/2026"
   ═══════════════════════════════════════════════════ */
(function() {
  var MS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var ML = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  function fmtThaiDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length < 3) return '';
    return parseInt(p[2],10) + ' ' + MS[parseInt(p[1],10)-1] + ' ' + (parseInt(p[0],10)+543);
  }
  function fmtThaiMonth(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length < 2) return '';
    return ML[parseInt(p[1],10)-1] + ' ' + (parseInt(p[0],10)+543);
  }

  function updateOverlay(input) {
    var ov = input._thaiOverlay; if (!ov) return;
    var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    var v = desc.get.call(input);
    ov.textContent = (input.getAttribute('type') === 'month') ? fmtThaiMonth(v) : fmtThaiDate(v);
  }

  function wrapInput(input) {
    if (input._thaiWrapped) return;
    input._thaiWrapped = true;
    // Wrap in container
    var wrap = document.createElement('div');
    wrap.className = 'thai-date-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    // Overlay span
    var ov = document.createElement('span');
    ov.className = 'thai-date-overlay';
    wrap.appendChild(ov);
    input._thaiOverlay = ov;
    // Listen for user interaction
    input.addEventListener('change', function() { updateOverlay(input); });
    input.addEventListener('input',  function() { updateOverlay(input); });
    // Intercept programmatic .value = xxx
    var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    Object.defineProperty(input, 'value', {
      get: function() { return desc.get.call(this); },
      set: function(v) { desc.set.call(this, v); updateOverlay(this); },
      configurable: true
    });
    updateOverlay(input);
  }

  function initThaiDates() {
    var inputs = document.querySelectorAll('input[type="date"], input[type="month"]');
    for (var i = 0; i < inputs.length; i++) wrapInput(inputs[i]);
  }
  window.initThaiDates = initThaiDates;

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThaiDates);
  } else {
    initThaiDates();
  }
})();

// ── Service Worker Registration ───────────────────────────────────────
(function () {
  if (!('serviceWorker' in navigator)) return;
  // ไม่ register บนหน้า index/register/create-band (ไม่ต้องการ push)
  var path = location.pathname;
  if (/\/(index|register|create-band|terms|forgot)/.test(path)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/Band-Management-By-SoulCiety/docs/sw.js')
      .then(function (reg) {
        window._swReg = reg;
        // รับฟัง subscription changed จาก SW
        navigator.serviceWorker.addEventListener('message', function (e) {
          if (e.data && e.data.type === 'SUBSCRIPTION_CHANGED') {
            if (typeof window.resubscribePush === 'function') window.resubscribePush();
          }
        });
      })
      .catch(function (err) {
        console.warn('[SW] registration failed', err);
      });
  });
})();
