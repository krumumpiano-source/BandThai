var allJobs = [];

  document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
      checkAdGate();
    renderMainNav('mainNav');
    applyTranslations();
    loadHistory();

    // Auto-refresh when user comes back from another page
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) loadHistory();
    });
  });

  function loadHistory() {
    apiCall('getExternalJobs', {}, function(r) {
      allJobs = (r && r.success && r.data) ? r.data : [];
      buildYearFilter();
      updateStats();
      applyFilter();
    });
  }

  function buildYearFilter() {
    var years = {};
    allJobs.forEach(function(j) {
      var y = (j.eventDate || '').slice(0, 4);
      if (y) years[y] = 1;
    });
    var sel = document.getElementById('filterYear');
    Object.keys(years).sort().reverse().forEach(function(y) {
      var opt = document.createElement('option');
      opt.value = y; opt.textContent = 'พ.ศ. ' + (parseInt(y, 10) + 543);
      sel.appendChild(opt);
    });
  }

  function updateStats() {
    var total = allJobs.length;
    var paid = 0, partial = 0, pending = 0;
    allJobs.forEach(function(j) {
      var ps = j.payoutStatus || j.payout_status || 'pending';
      if (ps === 'paid') paid++;
      else if (ps === 'partial') partial++;
      else pending++;
    });
    document.getElementById('statTotal').textContent   = total;
    document.getElementById('statPaid').textContent    = paid;
    document.getElementById('statPartial').textContent = partial;
    document.getElementById('statPending').textContent = pending;
  }

  function applyFilter() {
    var q   = (document.getElementById('searchInput').value || '').toLowerCase();
    var st  = document.getElementById('filterStatus').value;
    var yr  = document.getElementById('filterYear').value;
    var mo  = document.getElementById('filterMonth').value;

    var filtered = allJobs.filter(function(j) {
      var ps = j.payoutStatus || j.payout_status || 'pending';
      var dt = j.eventDate || '';
      if (st && ps !== st) return false;
      if (yr && !dt.startsWith(yr)) return false;
      if (mo && dt.slice(5, 7) !== mo) return false;
      if (q) {
        var hay = [j.jobName, j.venue, j.clientName, j.venueAddress].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    renderList(filtered);
  }

  var THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  function renderList(jobs) {
    var el = document.getElementById('jobHistList');
    if (!jobs.length) {
      el.innerHTML = '<div class="history-empty"><div class="big-icon">📭</div><p>ไม่พบงานนอกในเงื่อนไขนี้</p></div>';
      return;
    }
    el.innerHTML = jobs.map(function(job) { return buildCard(job); }).join('');
  }

  function buildCard(job) {
    var id  = job.id || job.jobId || '';
    var ds  = job.eventDate || '';
    var d   = ds ? new Date(ds + 'T00:00:00') : null;
    var dd  = d ? String(d.getDate()).padStart(2, '0') : '--';
    var mm  = d ? THAI_MONTHS[d.getMonth()] : '--';
    var yy  = d ? d.getFullYear() + 543 : '';
    var ps  = job.payoutStatus || job.payout_status || 'pending';
    var badgeMap = { paid: '<span class="payout-badge badge-paid">✅ จ่ายครบ</span>', partial: '<span class="payout-badge badge-partial">⏳ จ่ายบางส่วน</span>', pending: '<span class="payout-badge badge-pending">⏸ รอเบิกจ่าย</span>', cancelled: '<span class="payout-badge badge-cancelled">❌ ยกเลิก</span>' };
    var badge = badgeMap[ps] || badgeMap['pending'];

    var fees = Array.isArray(job.memberFees) ? job.memberFees : [];
    var paidCount = fees.filter(function(f) { return f.paid; }).length;
    var totalFee = parseFloat(job.totalFee || 0);
    var travel  = (job.travelInfo  && typeof job.travelInfo  === 'object') ? job.travelInfo  : {};
    var accom   = (job.accommodation && typeof job.accommodation === 'object') ? job.accommodation : {};
    var food    = (job.foodInfo && typeof job.foodInfo === 'object') ? job.foodInfo : {};

    /* Member fee rows */
    var memberRows = fees.length
      ? fees.map(function(mf) {
          var paidTag = mf.paid
            ? '<span class="fee-paid">✅ จ่ายแล้ว ' + (mf.paidDate ? '(' + mf.paidDate + ')' : '') + '</span>'
            : '<span class="fee-pending">⏸ รอ</span>';
          return '<tr>'
            + '<td>' + escapeHtml(mf.name || '-') + '</td>'
            + '<td>' + escapeHtml(mf.instrument || '-') + '</td>'
            + '<td style="text-align:right;font-weight:700">' + (mf.fee || 0).toLocaleString('th-TH') + ' ฿</td>'
            + '<td>' + paidTag + '</td>'
            + '<td>' + escapeHtml(mf.paymentMethod || '-') + '</td>'
            + '</tr>';
        }).join('')
      : '<tr><td colspan="5" style="text-align:center;color:var(--premium-text-muted)">ไม่มีข้อมูลค่าตัวสมาชิก</td></tr>';

    /* Travel section */
    var travelHtml = (travel.destination || travel.origin)
      ? '<div class="detail-section">'
          + '<h4>🚗 การเดินทาง</h4>'
          + (travel.origin ? '<p>ต้นทาง: ' + escapeHtml(travel.origin) + '</p>' : '')
          + (travel.destination ? '<p>ปลายทาง: ' + escapeHtml(travel.destination) + '</p>' : '')
          + (travel.distanceKm ? '<p>ระยะทาง: ' + travel.distanceKm + ' กม.</p>' : '')
          + (travel.travelFee ? '<p>ค่าเดินทาง: ' + Number(travel.travelFee).toLocaleString('th-TH') + ' ฿</p>' : '')
          + (travel.travelMethod ? '<p>พาหนะ: ' + escapeHtml(travel.travelMethod) + '</p>' : '')
        + '</div>'
      : '';

    /* Accommodation section */
    var accomHtml = accom.hasAccom
      ? '<div class="detail-section">'
          + '<h4>🏨 ที่พัก</h4>'
          + (accom.hotel ? '<p>ที่พัก: ' + escapeHtml(accom.hotel) + '</p>' : '')
          + '<p>' + (accom.rooms || 0) + ' ห้อง × ' + (accom.nights || 0) + ' คืน</p>'
          + (accom.accomFee ? '<p>ค่าที่พัก: ' + Number(accom.accomFee).toLocaleString('th-TH') + ' ฿</p>' : '')
        + '</div>'
      : '<div class="detail-section"><h4>🏨 ที่พัก</h4><p style="color:var(--premium-text-muted)">ไป-กลับวันเดียว</p></div>';

    /* Food section */
    var foodHtml = food.hasFood
      ? '<div class="detail-section">'
          + '<h4>🍱 อาหาร</h4>'
          + (food.meals ? '<p>' + escapeHtml(food.meals) + '</p>' : '')
          + (food.foodFee ? '<p>ค่าอาหาร: ' + Number(food.foodFee).toLocaleString('th-TH') + ' ฿</p>' : '')
        + '</div>'
      : '';

    /* Finance section */
    var bandFundCut = parseFloat(job.bandFundCut || 0);
    var otherExp    = parseFloat(job.otherExpenses || 0);
    var memberTotal = fees.reduce(function(s, f) { return s + parseFloat(f.fee || 0); }, 0);
    var financeHtml = '<div class="detail-section">'
      + '<h4>💰 สรุปการเงิน</h4>'
      + '<p>รับจากลูกค้า: <strong>' + totalFee.toLocaleString('th-TH') + ' ฿</strong></p>'
      + (bandFundCut ? '<p>กองกลางหัก: ' + bandFundCut.toLocaleString('th-TH') + ' ฿</p>' : '')
      + (otherExp ? '<p>ค่าใช้จ่ายอื่น: ' + otherExp.toLocaleString('th-TH') + ' ฿</p>' : '')
      + '<p>รวมค่าตัวสมาชิก: <strong>' + memberTotal.toLocaleString('th-TH') + ' ฿</strong></p>'
      + '</div>';

    var statusStyle = job.status === 'cancelled' ? 'opacity:.6' : '';

    return '<div class="job-hist-card" style="' + statusStyle + '">'
      /* Header (clickable) */
      + '<div class="job-hist-header" onclick="toggleDetail(\'' + id + '\')">'
        + '<div class="job-date-col">'
          + '<div class="jdd">' + dd + '</div>'
          + '<div class="jmm">' + mm + '</div>'
          + '<div class="jyy">' + yy + '</div>'
        + '</div>'
        + '<div class="job-head-body">'
          + '<h3>' + escapeHtml(job.jobName || 'งานนอก') + '</h3>'
          + '<div class="job-head-meta">'
            + '📍 ' + escapeHtml(job.venue || 'ไม่ระบุสถานที่')
            + (job.clientName ? '&nbsp;·&nbsp; 👤 ' + escapeHtml(job.clientName) : '')
            + (job.startTime ? '&nbsp;·&nbsp; ⏰ ' + escapeHtml(job.startTime) + (job.endTime ? '–' + escapeHtml(job.endTime) : '') + ' น.' : '')
            + (fees.length ? '&nbsp;·&nbsp; 🎤 สมาชิก ' + paidCount + '/' + fees.length + ' คน' : '')
          + '</div>'
        + '</div>'
        + '<div class="job-head-right">'
          + badge
          + '<div class="job-total-fee">' + totalFee.toLocaleString('th-TH') + ' ฿</div>'
        + '</div>'
      + '</div>'
      /* Detail panel */
      + '<div class="job-hist-detail" id="detail_' + id + '">'
        /* Member fee table */
        + (fees.length
            ? '<div style="overflow-x:auto;padding:var(--spacing-md) var(--spacing-lg) 0">'
                + '<table class="member-fee-table">'
                  + '<thead><tr><th>ชื่อ</th><th>เครื่องดนตรี</th><th>ค่าตัว</th><th>สถานะ</th><th>วิธีโอน</th></tr></thead>'
                  + '<tbody>' + memberRows + '</tbody>'
                + '</table>'
              + '</div>'
            : '')
        /* Detail grid */
        + '<div class="detail-grid">'
          + '<div class="detail-section">'
            + '<h4>📋 รายละเอียดงาน</h4>'
            + '<p>สถานที่: ' + escapeHtml(job.venue || '-') + '</p>'
            + (job.venueAddress ? '<p style="font-size:11px;color:var(--premium-text-muted)">' + escapeHtml(job.venueAddress) + '</p>' : '')
            + (job.clientPhone ? '<p>โทร: ' + escapeHtml(job.clientPhone) + '</p>' : '')
            + (job.showDuration ? '<p>ระยะเวลาแสดง: ' + escapeHtml(job.showDuration) + '</p>' : '')
          + '</div>'
          + travelHtml
          + accomHtml
          + foodHtml
          + financeHtml
        + '</div>'
        /* Actions */
        + '<div class="job-actions">'
          + (ps !== 'paid' ? '<a href="external-payout.html?jobId=' + encodeURIComponent(id) + '" class="btn btn-primary btn-sm">💵 ไปหน้าเบิกจ่าย</a>' : '')
          + '<button class="btn btn-ghost btn-sm" onclick="copyJobSummary(\'' + id + '\')">📋 คัดลอกสรุป</button>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  function toggleDetail(id) {
    var el = document.getElementById('detail_' + id);
    if (!el) return;
    el.classList.toggle('open');
  }

  function copyJobSummary(id) {
    var job = allJobs.find(function(j) { return (j.id || j.jobId) === id; });
    if (!job) return;
    var fees = Array.isArray(job.memberFees) ? job.memberFees : [];
    var lines = [
      '🎤 ' + (job.jobName || 'งานนอก'),
      '📅 ' + (job.eventDate || '-') + (job.startTime ? '  ⏰ ' + job.startTime + (job.endTime ? '–' + job.endTime : '') + ' น.' : ''),
      '📍 ' + (job.venue || '-'),
      '👤 ' + (job.clientName || '-'),
      '─────────────────',
      'สมาชิก:'
    ];
    fees.forEach(function(mf) {
      lines.push('  • ' + (mf.name || '-') + ' (' + (mf.instrument || '-') + ')  ' + (mf.fee || 0).toLocaleString('th-TH') + ' ฿  ' + (mf.paid ? '✅' : '⏸'));
    });
    lines.push('─────────────────');
    lines.push('รวมรับ: ' + Number(job.totalFee || 0).toLocaleString('th-TH') + ' ฿');
    var _copyText = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(_copyText).then(function() {
        showToast('📋 คัดลอกสรุปงานแล้ว', 'success');
      }).catch(function() {
        var ta = document.createElement('textarea'); ta.value = _copyText; ta.setAttribute('readonly','');
        ta.style.position = 'fixed'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.focus(); ta.select();
        try { document.execCommand('copy'); } catch(e) {}
        document.body.removeChild(ta);
        showToast('📋 คัดลอกสรุปงานแล้ว', 'success');
      });
    } else {
      var ta = document.createElement('textarea'); ta.value = _copyText; ta.setAttribute('readonly','');
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
      showToast('📋 คัดลอกสรุปงานแล้ว', 'success');
    }
  }