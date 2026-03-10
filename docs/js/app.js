/**
 * BandThai — Core App (GitHub Pages + Supabase)
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

  // ── Sync Band Plan on every page load ───────────────────────────
  // ดึง band_plan ล่าสุดจาก DB เมื่อเปิดหน้าใดก็ตาม
  // เพื่อให้สมาชิกทุกคนได้แพ็กเกจเดียวกับวงทันที เมื่อผู้จัดการอัปเกรด
  function syncBandPlan() {
    if (!localStorage.getItem('auth_token') || !localStorage.getItem('bandId')) return;
    if (typeof global.apiCall === 'function') {
      global.apiCall('syncBandPlan', {}, function(r) {
        if (r && r.success && r.changed) {
          // plan changed — update UI elements that depend on plan
          if (typeof global.checkAdGate === 'function') global.checkAdGate();
        }
      });
    }
  }
  // Run after DOM ready so supabase-api.js has time to load
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(syncBandPlan, 1500);
  });
  global.syncBandPlan = syncBandPlan;

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
  function showConfirm(title, message, opts) {
    if (typeof title === 'object') { var o = title; title = o.title; message = o.message; opts = o; }
    opts = opts || {};
    return new Promise(function(resolve) {
      title   = title   || (typeof t === 'function' ? t('confirmDeleteTitle') : 'ยืนยัน');
      message = message || (typeof t === 'function' ? t('confirmDeleteMsg')   : 'ต้องการดำเนินการใช่หรือไม่?');
      var btnText  = opts.confirmText  || (typeof t === 'function' ? t('confirm') : 'ยืนยัน');
      var btnClass = opts.danger ? 'btn btn-danger' : 'btn btn-primary';
      var overlay = document.createElement('div');
      overlay.className = 'confirm-overlay active';
      overlay.innerHTML =
        '<div class="confirm-box">' +
          '<h3>' + escapeHtml(title) + '</h3>' +
          '<p>' + escapeHtml(message) + '</p>' +
          '<div class="confirm-actions">' +
            '<button class="btn btn-secondary" id="_confirmCancel">' + (typeof t === 'function' ? t('cancel') : 'ยกเลิก') + '</button>' +
            '<button class="' + btnClass + '" id="_confirmOk">' + escapeHtml(btnText) + '</button>' +
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

  // ======================================================
  // App Config — maintenance banner & registration gate
  // ======================================================
  function loadAppConfig(callback) {
    // Wait for apiCall/sbRun to be ready then fetch app_config
    var tries = 0;
    var wait = setInterval(function() {
      tries++;
      if (typeof window.sbRun === 'function') {
        clearInterval(wait);
        window.sbRun('getAppConfig', {}, function(r) {
          if (!r || !r.map) { if (callback) callback({}); return; }
          var cfg = r.map;
          global._APP_CONFIG = cfg;
          applyAppConfig(cfg);
          if (callback) callback(cfg);
        });
      } else if (tries > 80) {
        clearInterval(wait);
        if (callback) callback({});
      }
    }, 100);
  }
  global.loadAppConfig = loadAppConfig;

  function applyAppConfig(cfg) {
    if (!cfg) return;

    // Maintenance mode redirect
    var isAdmin = (localStorage.getItem('userRole') || '') === 'admin';
    var path = (global.location && global.location.pathname) || '';
    var isAdminPage = /admin\.html/.test(path);
    if (cfg.maintenance_mode === 'true' && !isAdmin && !isAdminPage) {
      // Show overlay instead of hard redirect so user sees message
      var overlay = document.getElementById('maintenanceOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'maintenanceOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;color:#fff;text-align:center;padding:24px';
        overlay.innerHTML = '<div style="font-size:3rem">🔧</div><h2 style="font-size:1.4rem;margin:0">ระบบปิดปรับปรุงชั่วคราว</h2><p style="color:rgba(255,255,255,.7);margin:0">กรุณากลับมาใหม่ในภายหลัง</p>';
        document.body.appendChild(overlay);
      }
      return;
    }

    // Announce banner
    var banner = cfg.announce_banner || '';
    if (banner) {
      var existing = document.getElementById('announceBanner');
      if (!existing) {
        var typeColors = { info: '#2563eb', warning: '#d97706', error: '#c53030' };
        var typeColor = typeColors[cfg.announce_type || 'info'] || typeColors.info;
        var bar = document.createElement('div');
        bar.id = 'announceBanner';
        bar.style.cssText = 'position:sticky;top:0;z-index:9999;background:' + typeColor + ';color:#fff;text-align:center;padding:8px 16px;font-size:.85rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px';
        bar.innerHTML = escapeHtml(banner)
          + '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:rgba(255,255,255,.8);cursor:pointer;font-size:1rem;padding:0 4px;line-height:1">✕</button>';
        document.body.insertBefore(bar, document.body.firstChild);
      }
    }
  }
  global.applyAppConfig = applyAppConfig;

  // Auto-load app config on pages that have a logged-in user
  // (skip public/auth pages: index, register, terms, forgot, create-band)
  (function() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _autoLoadCfg);
    } else {
      setTimeout(_autoLoadCfg, 0);
    }
    function _autoLoadCfg() {
      var path = (global.location && global.location.pathname) || '';
      var isPublicPage = /\/(index|register|terms|forgot|create-band)/.test(path);
      if (isPublicPage) return;
      var token = localStorage.getItem('auth_token');
      if (!token) return;
      loadAppConfig();
    }
  })();

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

// ── Global Band Presence Tracker ─────────────────────────────────────
// Broadcasts current user + page to 'presence-band-{bandId}' realtime channel.
// Admin dashboard subscribes to this to see who is online.
(function() {
  var PAGE_LABELS = {
    'dashboard':          '🏠 หน้าหลัก',
    'admin-songs':        '🎵 จัดการเพลง',
    'songs':              '🎵 คลังเพลง',
    'schedule':           '📅 ตารางงาน',
    'attendance-payroll': '💳 เบิกเงิน',
    'statistics':         '📊 สถิติ',
    'band-info':          '🎸 ข้อมูลวง',
    'equipment':          '🎸 อุปกรณ์',
    'external-payout':    '💼 งานนอก',
    'song-insights':      '📈 วิเคราะห์เพลง',
    'quotation':          '📃 ใบเสนอราคา',
    'setlist':            '📋 เซ็ตลิสต์',
    'members':            '👥 สมาชิก'
  };

  function _getPageLabel() {
    var path = (window.location.pathname || '').replace(/.*\//, '').replace(/\.html.*$/, '');
    return PAGE_LABELS[path] || ('📄 ' + path);
  }

  var _globalPresenceCh = null;
  var _gpActivity = _getPageLabel();

  function initGlobalPresence() {
    if (!window._sb) return;
    var bandId = localStorage.getItem('bandId') || '';
    if (!bandId) return;
    var userId = localStorage.getItem('userId') || '';
    if (!userId) return;
    var userName = localStorage.getItem('userName') || localStorage.getItem('userNickname') || 'ไม่ทราบชื่อ';
    var userRole = localStorage.getItem('userRole') || 'member';
    var channelName = 'presence-band-' + bandId;

    _globalPresenceCh = window._sb.channel(channelName, {
      config: { presence: { key: userId } }
    });
    _globalPresenceCh
      .on('presence', { event: 'sync' }, function() { if (window._onGlobalPresenceSync) window._onGlobalPresenceSync(); })
      .on('presence', { event: 'join' }, function() { if (window._onGlobalPresenceSync) window._onGlobalPresenceSync(); })
      .on('presence', { event: 'leave' }, function() { if (window._onGlobalPresenceSync) window._onGlobalPresenceSync(); })
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') {
          _globalPresenceCh.track({
            userId: userId, name: userName, role: userRole,
            page: _getPageLabel(), activity: _gpActivity,
            joinedAt: new Date().toISOString()
          });
        }
      });

    window.addEventListener('beforeunload', function() {
      if (_globalPresenceCh) _globalPresenceCh.untrack();
    });
    window._globalPresenceCh = _globalPresenceCh;
  }

  // Update activity text (called by individual pages)
  function updateGlobalActivity(activity) {
    _gpActivity = activity;
    if (_globalPresenceCh) {
      _globalPresenceCh.track({
        userId: localStorage.getItem('userId') || '',
        name: localStorage.getItem('userName') || localStorage.getItem('userNickname') || 'ไม่ทราบชื่อ',
        role: localStorage.getItem('userRole') || 'member',
        page: _getPageLabel(), activity: activity,
        joinedAt: new Date().toISOString()
      });
    }
  }
  window.updateGlobalActivity = updateGlobalActivity;

  // Auto-init after supabase-api loads (poll up to 5 sec)
  var _gpTries = 0;
  function _tryInitGP() {
    var bandId = localStorage.getItem('bandId') || '';
    var userId = localStorage.getItem('userId') || '';
    if (window._sb && bandId && userId) { initGlobalPresence(); return; }
    if (++_gpTries < 50) setTimeout(_tryInitGP, 100);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(_tryInitGP, 500); });
  } else {
    setTimeout(_tryInitGP, 500);
  }
})();

// ── PWA Install Prompt ────────────────────────────────────────────
(function () {
  var _deferredInstallPrompt = null;

  // รับ event beforeinstallprompt จาก Chrome/Android
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    _deferredInstallPrompt = e;
  });

  function isMobileOrTablet() {
    // Touch device ที่ไม่ใช่เดสก์ท็อป
    return /Android|iPhone|iPad|iPod|Tablet|Mobile/i.test(navigator.userAgent) ||
           (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1280);
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function showPwaBanner() {
    // แสดงแบนเนอร์แนะนำการติดตั้ง
    var banner = document.createElement('div');
    banner.id = 'pwaBanner';
    banner.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:99999',
      'background:linear-gradient(135deg,#1a1a2e,#16213e)',
      'color:#fff', 'padding:14px 16px',
      'display:flex', 'align-items:flex-start', 'gap:12px',
      'box-shadow:0 -4px 24px rgba(0,0,0,.5)',
      'font-family:Kanit,Sarabun,sans-serif',
      'font-size:14px', 'line-height:1.5'
    ].join(';');

    var ios = isIOS();
    var icon = '📲';
    var title = 'ติดตั้งแอปบนอุปกรณ์ของคุณ';
    var hint = ios
      ? 'กด <strong>Share</strong> (อีคอนแชร์) แล้วเลือก <strong>"เพิ่มลงที่หน้าจอหลัก"</strong> เพื่อเปิดแอปได้สะดวกขึ้นในครั้งต่อไป'
      : 'ติดตั้งแอปลงบนอุปกรณ์เพื่อเปิดได้เร็ว ใช้งานได้สะดวกโดยไม่ต้องเปิดเบราว์เซอร์ทุกครั้ง';

    var installBtnHtml = (!ios && _deferredInstallPrompt)
      ? '<button id="pwaBannerInstallBtn" style="background:#c9a227;color:#1a1a1a;border:none;border-radius:8px;padding:6px 14px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;font-family:Kanit,sans-serif">ติดตั้งเลย</button>'
      : '';

    banner.innerHTML =
      '<div style="font-size:28px;flex-shrink:0;line-height:1">' + icon + '</div>' +
      '<div style="flex:1">' +
        '<div style="font-weight:700;font-size:15px;margin-bottom:4px">' + title + '</div>' +
        '<div style="color:#c9b88a;font-size:12px">' + hint + '</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0">' +
        installBtnHtml +
        '<button id="pwaBannerDismissBtn" style="background:rgba(255,255,255,.12);color:#ccc;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;white-space:nowrap;font-family:Kanit,sans-serif">ปิด ไม่ถามอีก</button>' +
      '</div>';

    document.body.appendChild(banner);

    // ปุ่มติดตั้ง (Android/Chrome)
    var installBtn = document.getElementById('pwaBannerInstallBtn');
    if (installBtn) {
      installBtn.addEventListener('click', function () {
        if (_deferredInstallPrompt) {
          _deferredInstallPrompt.prompt();
          _deferredInstallPrompt.userChoice.then(function (r) {
            if (r.outcome === 'accepted') {
              try { localStorage.setItem('pwa_installed', '1'); } catch(e) {}
            }
            _deferredInstallPrompt = null;
          });
        }
        banner.remove();
        try { localStorage.setItem('pwa_prompt_dismissed', Date.now()); } catch(e) {}
      });
    }

    // ปุ่มปิด
    var dismissBtn = document.getElementById('pwaBannerDismissBtn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function () {
        banner.remove();
        try { localStorage.setItem('pwa_prompt_dismissed', Date.now()); } catch(e) {}
      });
    }
  }

  // ตรวจว่าควรแสดงหรือไม่
  function maybeShowBanner() {
    if (!isMobileOrTablet()) return;
    if (isStandalone()) return; // ติดตั้งแล้ว
    try {
      if (localStorage.getItem('pwa_installed') === '1') return;
      var dismissed = parseInt(localStorage.getItem('pwa_prompt_dismissed') || '0', 10);
      // ถ้าปิดไปมากกว่า 30 วันแล้ว ให้ถามใหม่
      if (dismissed && (Date.now() - dismissed) < 30 * 24 * 60 * 60 * 1000) return;
    } catch(e) {}

    // รอให้ requireAuth โหลดเสร็จก่อน (2.5 วินาที) แล้วค่อยแสดง
    setTimeout(function () {
      // ไม่แสดงบนหน้า login/register/terms
      var path = location.pathname;
      if (/\/(index|register|create-band|terms|forgot|reset)/.test(path)) return;
      // ต้อง login อยู่ถึงจะแสดง
      if (!localStorage.getItem('userId')) return;
      if (document.getElementById('pwaBanner')) return; // มีแล้ว
      showPwaBanner();
    }, 2500);
  }

  window.addEventListener('load', maybeShowBanner);

  // ถ้า PWA ถูกติดตั้งสำเร็จจาก prompt
  window.addEventListener('appinstalled', function () {
    try { localStorage.setItem('pwa_installed', '1'); } catch(e) {}
    var b = document.getElementById('pwaBanner');
    if (b) b.remove();
  });
})();
  if (!('serviceWorker' in navigator)) return;
  // ไม่ register บนหน้า index/register/create-band (ไม่ต้องการ push)
  var path = location.pathname;
  if (/\/(index|register|create-band|terms|forgot)/.test(path)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/BandThai/sw.js')
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
