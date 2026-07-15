(function () {
  'use strict';

  // ── 1. Auth guard ─────────────────────────────────────────────────
  function waitAndCheck(tries) {
    tries = tries || 0;
    if (localStorage.getItem('auth_token')) {
      init();
    } else if (tries > 20) {
      window.location.replace('index.html');
    } else {
      setTimeout(function () { waitAndCheck(tries + 1); }, 100);
    }
  }
  waitAndCheck();

  function init() {
    // ── 2. ถ้าไม่ใช่ free หรือ session ยังไม่หมด → ไป dashboard ──
    var plan  = localStorage.getItem('band_plan') || 'free';
    if (plan !== 'free') {
      window.location.replace('dashboard.html');
      return;
    }
    var ts    = parseInt(localStorage.getItem('ad_gate_ts') || '0');
    var limit = 75 * 60 * 1000;
    if (ts && (Date.now() - ts) < limit) {
      window.location.replace('dashboard.html');
      return;
    }

    // ── 3. Placeholder mode (รอ AdSense approve) ──────────────────
    var startBtn  = document.getElementById('startAdBtn');
    var enterBtn  = document.getElementById('enterBtn');
    var countWrap = document.getElementById('adCountdownWrap');
    var countEl   = document.getElementById('adCountdown');
    var seconds   = 30;
    var timer     = null;

    startBtn.addEventListener('click', function () {
      startBtn.disabled = true;
      startBtn.textContent = '⏳ กำลังดูโฆษณา...';
      countWrap.style.display = 'block';
      updateCountdown();
      timer = setInterval(function () {
        seconds--;
        updateCountdown();
        if (seconds <= 0) {
          clearInterval(timer);
          onAdGranted();
        }
      }, 1000);
    });

    function updateCountdown() {
      var m = Math.floor(seconds / 60);
      var s = seconds % 60;
      countEl.textContent = m + ':' + String(s).padStart(2, '0');
    }

    function onAdGranted() {
      localStorage.setItem('ad_gate_ts', String(Date.now()));
      startBtn.style.display = 'none';
      countWrap.style.display = 'none';
      enterBtn.style.display  = '';
    }

    enterBtn.addEventListener('click', function () {
      window.location.replace('dashboard.html');
    });
  }

})();