(function () {
  'use strict';

  // ── Auth ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    if (!localStorage.getItem('auth_token')) {
      window.location.replace('index.html');
      return;
    }
    var plan  = localStorage.getItem('band_plan')  || 'free';
    var scope = localStorage.getItem('plan_scope') || 'free';
    var names = { free: 'Free', lite: 'Lite', pro: 'Pro' };
    document.getElementById('currentPlanBadge').textContent =
      'แพ็กเกจปัจจุบัน: ' + (names[plan] || plan) + (scope === 'band' ? ' (วง)' : scope === 'user' ? ' (รายคน)' : '');
    if (plan === 'pro' && scope === 'band') {
      showStatus('วงของคุณใช้แพ็กเกจ Pro อยู่แล้ว — ขอบคุณที่สนับสนุน! 🎉', 'success');
    }
  });

  // ── State ─────────────────────────────────────────────────────────────────
  var selectedScope  = null;     // 'band' | 'user'
  var selectedPlan   = null;
  var selectedMonths = 1;
  var selectedAmount = 0;        // satang
  var basePrices     = { lite: 9900, pro: 19900 };  // satang/month
  var allDurations   = {};       // { lite: [...], pro: [...] }

  // ── โหลดราคา + durations จาก DB ─────────────────────────────────────────
  function loadDynamicPrices() {
    var sb = window._sb;
    if (!sb) { setTimeout(loadDynamicPrices, 300); return; }

    sb.from('plan_config').select('id, price, features, active').then(function(res) {
      if (!res.data) return;
      res.data.forEach(function(p) {
        basePrices[p.id] = p.price;
        var priceEl = document.getElementById('price_display_' + p.id);
        if (priceEl) priceEl.innerHTML = '฿' + Math.round(p.price / 100) + '<span>/เดือน</span>';
        var featsEl = document.getElementById('feats_' + p.id);
        if (featsEl && Array.isArray(p.features)) {
          featsEl.innerHTML = p.features.map(function(f){ var _t = document.createElement('span'); _t.textContent = f; return '<li>' + _t.innerHTML + '</li>'; }).join('');
        }
        if (!p.active) {
          var card = document.getElementById('card' + p.id.charAt(0).toUpperCase() + p.id.slice(1));
          if (card) { card.style.opacity = '.4'; card.style.pointerEvents = 'none'; }
        }
      });
    });

    sb.from('plan_durations').select('plan_id, months, discount_percent, label, active')
      .eq('active', true).order('months').then(function(res) {
      if (!res.data) return;
      res.data.forEach(function(d) {
        if (!allDurations[d.plan_id]) allDurations[d.plan_id] = [];
        allDurations[d.plan_id].push(d);
      });
      if (selectedPlan) renderDurationGrid(selectedPlan);
    });
  }
  setTimeout(loadDynamicPrices, 500);

  // ── Scope Selection ───────────────────────────────────────────────────────
  window.selectScope = function (scope) {
    selectedScope = scope;
    selectedPlan  = null;
    selectedMonths = 1;
    selectedAmount = 0;
    document.getElementById('scopeCardBand').classList.toggle('selected', scope === 'band');
    document.getElementById('scopeCardUser').classList.toggle('selected', scope === 'user');
    document.getElementById('planStep').style.display = '';
    // reset downstream
    document.getElementById('durationSection').style.display = 'none';
    document.getElementById('selectedSummary').style.display = 'none';
    document.getElementById('payBtn').disabled = true;
    document.getElementById('payBtn').textContent = '💳 ชำระเงิน';
    document.getElementById('cardLite').classList.remove('selected');
    document.getElementById('cardPro').classList.remove('selected');
  };

  // ── Plan Selection ────────────────────────────────────────────────────────
  window.selectPlan = function (plan) {
    if (!selectedScope) { showStatus('กรุณาเลือกประเภทก่อน (ทั้งวง หรือ รายคน)', 'error'); return; }
    selectedPlan = plan;
    selectedMonths = 1;
    document.getElementById('cardLite').classList.toggle('selected', plan === 'lite');
    document.getElementById('cardPro').classList.toggle('selected', plan === 'pro');
    document.getElementById('durationSection').style.display = '';
    renderDurationGrid(plan);
  };

  function renderDurationGrid(plan) {
    var grid      = document.getElementById('durationGrid');
    var durs      = allDurations[plan];
    var basePrice = basePrices[plan] || 9900;

    if (!durs || !durs.length) {
      durs = [{ plan_id: plan, months: 1, discount_percent: 0, label: 'รายเดือน', active: true }];
    }

    grid.innerHTML = durs.map(function(d) {
      var orig     = basePrice * d.months;
      var disc     = d.discount_percent || 0;
      var total    = Math.round(orig * (1 - disc / 100));
      var saved    = orig - total;
      var perMonth = Math.round(total / d.months);
      var isBest   = d.months === 12;
      var label    = d.months === 12 ? '12 เดือน (รายปี)' : d.months === 1 ? 'รายเดือน' : d.months + ' เดือน';

      return '<div class="dur-card" onclick="selectDuration(' + d.months + ',' + total + ')">'
        + (isBest ? '<div class="dur-badge">🔥 ประหยัดสุด</div>' : disc > 0 ? '<div class="dur-badge">-' + disc + '%</div>' : '')
        + '<div class="dur-months">' + label + '</div>'
        + '<div class="dur-price-orig">' + (disc > 0 ? '฿' + Math.round(orig / 100) : '') + '</div>'
        + '<div class="dur-price-final">฿' + Math.round(total / 100) + '</div>'
        + '<div class="dur-price-monthly">' + (d.months > 1 ? '≈ ฿' + Math.round(perMonth / 100) + '/เดือน' : '&nbsp;') + '</div>'
        + '<div class="dur-save">' + (saved > 0 ? 'ประหยัด ฿' + Math.round(saved / 100) : '') + '</div>'
        + '</div>';
    }).join('');

    // auto-select first
    if (durs.length) {
      var f     = durs[0];
      var orig  = basePrice * f.months;
      var disc  = f.discount_percent || 0;
      var total = Math.round(orig * (1 - disc / 100));
      selectDuration(f.months, total);
    }
  }

  window.selectDuration = function (months, amountSatang) {
    selectedMonths = months;
    selectedAmount = amountSatang;

    document.querySelectorAll('.dur-card').forEach(function(c) {
      var match = c.getAttribute('onclick') && c.getAttribute('onclick').indexOf('selectDuration(' + months + ',') !== -1;
      c.classList.toggle('selected', !!match);
    });

    var labels     = { lite: '🎵 Lite', pro: '👑 Pro' };
    var scopeLabel = selectedScope === 'band' ? ' (ทั้งวง)' : ' (รายคน)';
    var durLabel   = months === 1 ? 'รายเดือน' : months === 12 ? 'รายปี' : months + ' เดือน';
    document.getElementById('summaryText').textContent = (labels[selectedPlan] || selectedPlan) + scopeLabel + ' — ' + durLabel;
    var amtThb = Math.round(amountSatang / 100);
    document.getElementById('summaryPrice').textContent = '฿' + amtThb.toLocaleString('th-TH');
    document.getElementById('selectedSummary').style.display = '';
    var btn = document.getElementById('payBtn');
    btn.disabled = false;
    btn.textContent = '💳 ชำระ ฿' + amtThb.toLocaleString('th-TH');
  };

  var appliedPromoCode = null;

  function applyPromo() {
    var code  = (document.getElementById('promoInput').value || '').toUpperCase().trim();
    var msgEl = document.getElementById('promoMsg');
    var btn   = document.getElementById('promoBtn');
    if (!code) { msgEl.style.display='none'; return; }
    if (!selectedPlan) { msgEl.textContent='⚠️ กรุณาเลือกแพ็กก่อน'; msgEl.style.display=''; msgEl.style.background='rgba(239,68,68,.12)'; msgEl.style.color='#ef4444'; return; }
    btn.disabled=true; btn.textContent='⏳...';
    apiCall('validatePromoCode', { code: code }, function(r) {
      btn.disabled=false; btn.textContent='ใช้ Code';
      msgEl.style.display='';
      if (!r || !r.success) {
        msgEl.textContent = '❌ ' + ((r&&r.message) || 'Code ไม่ถูกต้อง');
        msgEl.style.background='rgba(239,68,68,.12)'; msgEl.style.color='#ef4444';
        appliedPromoCode=null; return;
      }
      var promo = r.data;
      if (promo.plan !== selectedPlan) {
        msgEl.textContent = '❌ Code นี้ใช้ได้เฉพาะแพ็ก ' + promo.plan.toUpperCase() + ' เท่านั้น';
        msgEl.style.background='rgba(239,68,68,.12)'; msgEl.style.color='#ef4444';
        appliedPromoCode=null; return;
      }
      var disc     = promo.discount_percent || 0;
      var origAmt  = selectedAmount;
      var newAmt   = Math.round(origAmt * (1 - disc/100));
      var saving   = origAmt - newAmt;
      selectedAmount   = newAmt;
      appliedPromoCode = promo.code;
      msgEl.textContent = '✅ Code "' + promo.code + '" ลด ' + disc + '% สำเร็จ';
      msgEl.style.background='rgba(34,197,94,.12)'; msgEl.style.color='#22c55e';
      var row = document.getElementById('promoAppliedRow');
      if (row) row.style.display='flex';
      var lbl = document.getElementById('promoAppliedLabel');
      if (lbl) lbl.textContent = promo.code + ' (-' + disc + '%)';
      var sav = document.getElementById('promoAppliedSaving');
      if (sav) sav.textContent = '-฿' + Math.round(saving/100).toLocaleString('th-TH');
      document.getElementById('summaryPrice').textContent = '฿' + Math.round(newAmt/100).toLocaleString('th-TH');
      document.getElementById('payBtn').textContent = '💳 ชำระ ฿' + Math.round(newAmt/100).toLocaleString('th-TH');
    });
  }

  // ── Payment ───────────────────────────────────────────────────────────────
  var omisePKey = (window._SB_CONFIG && window._SB_CONFIG.omisePKey) || '';

  window.startPayment = function () {
    if (!selectedPlan || !selectedAmount) return;
    var btn = document.getElementById('payBtn');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังโหลด...';

    OmiseCard.configure({ publicKey: omisePKey, locale: 'th', currency: 'THB', frameLabel: 'BandThai' });
    OmiseCard.open({
      amount: selectedAmount,
      currency: 'THB',
      defaultPaymentMethod: 'credit_card',
      onCreateTokenSuccess: function (token) { processPayment(token); },
      onFormClosed: function () {
        btn.disabled = false;
        btn.textContent = '💳 ชำระ ฿' + Math.round(selectedAmount / 100).toLocaleString('th-TH');
      },
    });
  };

  function processPayment(token) {
    var btn = document.getElementById('payBtn');
    btn.textContent = '⏳ กำลังประมวลผล...';
    var sbUrl     = (window._SB_CONFIG && window._SB_CONFIG.url) || '';
    var authToken = localStorage.getItem('auth_token') || '';

    fetch(sbUrl + '/functions/v1/omise-charge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
      body: JSON.stringify({ token: token, plan: selectedPlan, months: selectedMonths, scope: selectedScope }),
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.success) {
        localStorage.setItem('band_plan', data.plan);
        localStorage.setItem('plan_scope', data.scope || (data.plan !== 'free' ? 'user' : 'free'));
        localStorage.removeItem('ad_gate_ts');
        if (appliedPromoCode) apiCall('usePromoCode', { code: appliedPromoCode }, function(){});
        var scopeMsg = data.scope === 'band' ? ' (อัปเกรดทั้งวง)' : ' (อัปเกรดเฉพาะคุณ)';
        showStatus('✅ ' + data.message + scopeMsg + ' กำลังพาไปยัง Dashboard...', 'success');
        setTimeout(function () { window.location.replace('dashboard.html'); }, 2000);
      } else {
        showStatus('❌ ' + data.message, 'error');
        btn.disabled = false;
        btn.textContent = '💳 ชำระ ฿' + Math.round(selectedAmount / 100).toLocaleString('th-TH');
      }
    })
    .catch(function (e) {
      showStatus('❌ เกิดข้อผิดพลาด: ' + e.message, 'error');
      btn.disabled = false;
      btn.textContent = '💳 ชำระ ฿' + Math.round(selectedAmount / 100).toLocaleString('th-TH');
    });
  }

  function showStatus(msg, type) {
    var el = document.getElementById('statusMsg');
    el.textContent = msg;
    el.style.display = '';
    el.style.background = type === 'success' ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)';
    el.style.border     = type === 'success' ? '1px solid rgba(34,197,94,.4)' : '1px solid rgba(239,68,68,.4)';
    el.style.color      = type === 'success' ? '#22c55e' : '#ef4444';
  }
  window.showStatus = showStatus;

  if (typeof requireAuth       === 'function') requireAuth();
  if (typeof renderMainNav     === 'function') renderMainNav('mainNav');
  if (typeof applyTranslations === 'function') applyTranslations();
})();