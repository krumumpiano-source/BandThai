var _stats   = null;
  var _logData = [];
  var _logLoaded = false;
  var _adminReservedPct = 60; // sync with slider

  // ── Recalculate pcts client-side (two-pool formula) ────────────
  function recalcPcts(reservedPct) {
    if (!_stats || !_stats.members) return;
    reservedPct = Math.max(0, Math.min(95, parseFloat(reservedPct) || 60));
    var activityPoolPct = 100 - reservedPct;
    var grandTotal = _stats.members.reduce(function(s, m) { return s + m.totalScore; }, 0) || 1;
    _stats.members.forEach(function(m) {
      var actShare = activityPoolPct * m.totalScore / grandTotal;
      if (m.isAdmin) {
        m.systemPct   = reservedPct;
        m.activityPct = Math.round(actShare * 10) / 10;
        m.pct         = Math.round((reservedPct + actShare) * 10) / 10;
      } else {
        m.systemPct   = 0;
        m.activityPct = Math.round(actShare * 10) / 10;
        m.pct         = m.activityPct;
      }
    });
    _adminReservedPct = reservedPct;
  }

  function onReservedPctChange(val) {
    val = parseInt(val) || 0;
    document.getElementById('reservedPctDisplay').textContent = val + '%';
    document.getElementById('pool1Display').textContent = val + '%';
    document.getElementById('pool2Display').textContent = (100 - val) + '%';
    // Update slider gradient
    var sl = document.getElementById('reservedPctSlider');
    sl.style.setProperty('--val', val + '%');
    recalcPcts(val);
    renderMemberTable(_stats);
    calcRevenue();
  }

  function saveReservedPct() {
    var val = parseInt(document.getElementById('reservedPctSlider').value) || 60;
    var btn = document.getElementById('saveReservedBtn');
    var msg = document.getElementById('saveReservedMsg');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
    msg.textContent = '';
    apiCall('saveBandSettings', { revenueAdminReservedPct: val }, function(r) {
      btn.disabled = false; btn.textContent = '💾 บันทึกการตั้งค่า';
      if (r && r.success) {
        msg.style.color = '#68d391';
        msg.textContent = '✅ บันทึกแล้ว — ' + val + '% สงวนให้เจ้าของระบบ';
      } else {
        msg.style.color = '#fc8181';
        msg.textContent = '❌ ' + (r && r.message || 'เกิดข้อผิดพลาด');
      }
    });
  }

  function esc(s) { return String(s||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function fmtNum(n) { return Number(n||0).toLocaleString('th-TH'); }
  function fmtBaht(n) { return Number(n||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function fmtDate(dt) {
    if (!dt) return '—';
    return new Date(dt).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});
  }
  function fmtDt(dt) {
    if (!dt) return '—';
    var d = new Date(dt);
    return d.toLocaleDateString('th-TH',{day:'numeric',month:'short'}) + ' ' +
           d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  }

  var ACTION_LABELS = {
    add_song:'เพิ่มเพลง', edit_song:'แก้ไขเพลง', delete_song:'ลบเพลง',
    merge_songs:'รวมเพลงซ้ำ', bulk_add:'เพิ่มเพลงกลุ่ม',
    add_artist:'เพิ่มศิลปิน', edit_artist:'แก้ไขศิลปิน', delete_artist:'ลบศิลปิน'
  };
  var ACTION_CLASS = {
    add_song:'act-add', edit_song:'act-edit', delete_song:'act-delete',
    merge_songs:'act-merge', bulk_add:'act-bulk',
    add_artist:'act-artist', edit_artist:'act-edit', delete_artist:'act-delete'
  };
  var COLORS = ['#f6ad55','#68d391','#63b3ed','#fc8181','#b794f4','#f687b3','#4fd1c5'];

  // ── Revenue calculator ──────────────────────────────────────────
  function calcRevenue() {
    if (!_stats || !_stats.members || !_stats.members.length) return;
    var income = parseFloat(document.getElementById('monthlyIncome').value) || 0;
    document.getElementById('revenueTotal').textContent =
      income > 0 ? 'ยอดรวม ' + fmtBaht(income) + ' บาท' : '';

    var rows = document.querySelectorAll('.baht-cell');
    _stats.members.forEach(function(m, i) {
      if (rows[i]) {
        var share = income * m.pct / 100;
        rows[i].textContent = income > 0 ? fmtBaht(share) + ' ฿' : '—';
      }
    });
  }

  // ── Render member table ─────────────────────────────────────────
  function renderMemberTable(stats) {
    var members = stats.members || [];
    document.getElementById('memberCount').textContent = members.length + ' คน';

    if (!members.length) {
      document.getElementById('memberTableBody').innerHTML =
        '<div style="padding:32px;text-align:center;color:var(--premium-text-muted)">' +
        '⚠️ ยังไม่มีผู้ดูแลเพลง — ให้ Admin ตั้งค่าที่ <a href="admin-songs" style="color:var(--premium-gold)">คลังเพลง</a> → ปุ่ม 👥 จัดการผู้ดูแลเพลง' +
        '</div>';
      return;
    }

    var html = '<table class="mt">' +
      '<thead><tr>' +
      '<th>ชื่อสมาชิก</th>' +
      '<th>คะแนนฐาน</th>' +
      '<th>คะแนนงาน</th>' +
      '<th>สัดส่วน</th>' +
      '<th>แบ่งได้ (บาท)</th>' +
      '</tr></thead><tbody>';

    members.forEach(function(m, i) {
      var color = COLORS[i % COLORS.length];
      var breakdownNote = '';
      if (m.isAdmin && m.systemPct > 0) {
        breakdownNote = '<div class="breakdown-note">🏗️ ระบบ ' + m.systemPct + '% + 📊 งาน ' + m.activityPct + '%</div>';
      } else if (!m.isAdmin) {
        breakdownNote = '<div class="breakdown-note">📊 จากกองงานดูแล</div>';
      }
      html += '<tr>' +
        '<td><div class="mt-name" style="color:' + color + '">● ' + esc(m.userName) + '</div>' +
          '<div class="mt-sub">รวม ' + fmtNum(m.totalScore) + ' คะแนน</div></td>' +
        '<td>' + fmtNum(m.baseScore) + '</td>' +
        '<td>' + fmtNum(m.activityScore) + '</td>' +
        '<td>' +
          '<span class="pct-badge" style="background:' + color + '">' + m.pct + '%</span>' +
          '&nbsp;<span class="bar-wrap"><span class="bar-fill" style="width:' + Math.min(m.pct,100) + '%;background:' + color + '"></span></span>' +
          breakdownNote +
        '</td>' +
        '<td><div class="baht-cell">—</div></td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    document.getElementById('memberTableBody').innerHTML = html;
  }

  // ── Load main stats ─────────────────────────────────────────────
  function loadStats() {
    apiCall('getMemberWorkStats', {}, function(r) {
      if (!r || !r.success) {
        document.getElementById('memberTableBody').innerHTML =
          '<div style="padding:24px;text-align:center;color:#DC2626">⚠️ โหลดข้อมูลไม่ได้: ' + (r && r.message || 'ไม่พบข้อมูล') + '</div>';
        return;
      }
      _stats = r;
      _adminReservedPct = r.adminReservedPct || 60;

      // Stats bar
      document.getElementById('statTotal').textContent      = fmtNum(r.totalSongs);
      document.getElementById('statHistorical').textContent = fmtNum(r.baseScore);
      document.getElementById('statTracked').textContent    = fmtNum(r.totalActivityScore);
      document.getElementById('statSince').textContent      = r.trackStart ? fmtDate(r.trackStart) : 'ยังไม่มี';

      // Info note — explain two-pool model
      document.getElementById('infoNote').style.display = 'flex';
      document.getElementById('infoNoteText').innerHTML =
        '<strong>ระบบแบ่ง 2 กอง:</strong> ' +
        '🏗️ <strong>กองเจ้าของระบบ ' + _adminReservedPct + '%</strong> (สงวนให้ผู้สร้างระบบ — งานออกแบบ ค่า AI ดูแลทั้งหมดที่ไม่ได้บันทึกเป็นคะแนน) ' +
        '+ 📊 <strong>กองงานดูแล ' + r.activityPoolPct + '%</strong> (แบ่งตามคะแนนสะสมของทุกคน)';

      // Admin setting card
      var role = localStorage.getItem('userRole') || '';
      if (role === 'admin') {
        var card = document.getElementById('adminReservedCard');
        card.style.display = 'block';
        var sl = document.getElementById('reservedPctSlider');
        sl.value = _adminReservedPct;
        sl.style.setProperty('--val', _adminReservedPct + '%');
        document.getElementById('reservedPctDisplay').textContent = _adminReservedPct + '%';
        document.getElementById('pool1Display').textContent = _adminReservedPct + '%';
        document.getElementById('pool2Display').textContent = r.activityPoolPct + '%';
      }

      renderMemberTable(r);

      // Populate log user dropdown
      var sel = document.getElementById('logFilterUser');
      (r.members || []).forEach(function(m) {
        if (!sel.querySelector('option[value="' + m.userId + '"]')) {
          var opt = document.createElement('option');
          opt.value = m.userId; opt.textContent = m.userName;
          sel.appendChild(opt);
        }
      });
    });
  }

  // ── Activity log ───────────────────────────────────────────────
  var _logOpened = false;
  function loadLogIfNeeded() {
    if (_logOpened) return;
    _logOpened = true;
    // Set default date range: last 30 days
    var today = new Date();
    var from  = new Date(today); from.setDate(from.getDate() - 30);
    document.getElementById('logTo').value   = today.toISOString().slice(0,10);
    document.getElementById('logFrom').value = from.toISOString().slice(0,10);
    applyLogFilter();
  }

  function applyLogFilter() {
    var area = document.getElementById('logTableArea');
    area.innerHTML = '<div class="log-empty">⏳ กำลังโหลด...</div>';

    apiCall('getMemberActivityLog', {
      userId: document.getElementById('logFilterUser').value  || undefined,
      action: document.getElementById('logFilterAction').value || undefined,
      from:   document.getElementById('logFrom').value         || undefined,
      to:     document.getElementById('logTo').value           || undefined,
      limit: 2000
    }, function(r) {
      if (!r || !r.success) {
        area.innerHTML = '<div class="log-empty">⚠️ โหลดข้อมูลไม่ได้</div>';
        return;
      }
      _logData = r.data || [];
      renderLog(_logData);
    });
  }

  function renderLog(rows) {
    var area = document.getElementById('logTableArea');
    if (!rows.length) {
      area.innerHTML = '<div class="log-empty">📭 ไม่มีบันทึกในช่วงที่เลือก</div>';
      return;
    }
    var html = '<table class="log-tbl"><thead><tr>' +
      '<th>วันเวลา</th><th>สมาชิก</th><th>ประเภทงาน</th><th>เป้าหมาย</th><th>คะแนน</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r) {
      var cls = ACTION_CLASS[r.action] || 'act-edit';
      html += '<tr>' +
        '<td style="white-space:nowrap;color:var(--premium-text-muted)">' + fmtDt(r.createdAt) + '</td>' +
        '<td style="font-weight:600">' + esc(r.userName) + '</td>' +
        '<td><span class="act-badge ' + cls + '">' + esc(r.actionLabel || ACTION_LABELS[r.action] || r.action) + '</span></td>' +
        '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.targetName || '—') + '</td>' +
        '<td><span class="score-pill">' + (r.score || 1) + '</span></td>' +
      '</tr>';
    });
    html += '</tbody></table>';
    area.innerHTML = html;
  }

  function exportCsv() {
    if (!_logData.length) { alert('ไม่มีข้อมูลให้ Export — คลิก กรอง ก่อน'); return; }
    var BOM = '\uFEFF';
    var header = 'วันที่เวลา,สมาชิก,ประเภทงาน,ชื่อเพลง/ศิลปิน,คะแนน';
    var rows = _logData.map(function(r) {
      return [fmtDt(r.createdAt), r.userName||'', r.actionLabel||ACTION_LABELS[r.action]||r.action, r.targetName||'', r.score||1]
        .map(function(v){ return '"' + String(v).replace(/"/g,'""') + '"'; }).join(',');
    });
    var csv    = BOM + header + '\n' + rows.join('\n');
    var blob   = new Blob([csv], {type:'text/csv;charset=utf-8'});
    var url    = URL.createObjectURL(blob);
    var a      = document.createElement('a');
    a.href     = url; a.download = 'worklog-' + new Date().toISOString().slice(0,10) + '.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Init ───────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
    checkAdGate();
    renderMainNav('mainNav');
    applyTranslations();
    loadStats();

    // Auto-refresh when user comes back from another page
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) loadStats();
    });
  });