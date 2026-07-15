var _allTx      = [];
  var _isManager  = false;
  var _rejectTarget = null;
  var _venues     = [];

  document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
      checkAdGate();
    renderMainNav('mainNav');
    applyTranslations();

    var role = localStorage.getItem('userRole') || 'member';
    _isManager = (role === 'admin' || role === 'manager');

    if (_isManager) {
      document.getElementById('submitInfoBox').className = 'submit-info manager-info';
      document.getElementById('submitInfoBox').textContent = '✅ ในฐานะผู้จัดการวง รายการที่คุณบันทึกจะเข้าบัญชีทันทีโดยไม่ต้องรออนุมัติ';
      document.getElementById('saveTxBtn').textContent = '💾 บันทึก';
    }

    document.getElementById('txDate').value = (function(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })(new Date());
    apiCall('getBandSettings', {}, function(r) {
      if (r && r.success && r.data && r.data.venues) {
        _venues = r.data.venues;
      }
      populateVenueSelect();
    });

    loadFund();

    // Auto-refresh when user comes back from another page
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) loadFund();
    });
  });

  /* ── Load ── */
  var _loadFundInProgress = false;
  function loadFund() {
    if (_loadFundInProgress) return;
    _loadFundInProgress = true;
    apiCall('getFundTransactions', {}, function(r) {
      _loadFundInProgress = false;
      if (!(r && r.success)) { showToast('โหลดข้อมูลไม่สำเร็จ', 'error'); return; }
      _allTx = r.data.transactions || [];

      document.getElementById('sBalance').textContent  = formatCurrency(r.data.balance || 0);
      document.getElementById('sIncome').textContent   = formatCurrency(r.data.totalIncome || 0);
      document.getElementById('sExpense').textContent  = formatCurrency(r.data.totalExpense || 0);

      var pendingCount = _allTx.filter(function(t){ return t.status === 'pending'; }).length;
      var badge = document.getElementById('pendingBadge');
      if (pendingCount > 0) { badge.style.display = ''; badge.textContent = pendingCount; }
      else { badge.style.display = 'none'; }

      populateMonthFilter();
      renderLedger();
      renderPending();
    });
  }

  /* ── Month filter ── */
  function populateMonthFilter() {
    var approved = _allTx.filter(function(t){ return t.status === 'approved'; });
    var months = {};
    approved.forEach(function(t) {
      var m = (t.date || '').substring(0, 7);
      if (m) months[m] = true;
    });
    var sel = document.getElementById('ledgerMonthFilter');
    var cur = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    Object.keys(months).sort().reverse().forEach(function(m) {
      var parts = m.split('-');
      var label = 'เดือน ' + parseInt(parts[1]) + '/' + (parseInt(parts[0]) + 543);
      var opt = document.createElement('option');
      opt.value = m; opt.textContent = label;
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  }

  /* ── Ledger Tab ── */
  function renderLedger() {
    var typeFilter  = document.getElementById('ledgerTypeFilter').value;
    var monthFilter = document.getElementById('ledgerMonthFilter').value;

    var rows = _allTx.filter(function(t) {
      if (t.status !== 'approved' && t.status) return false;
      if (typeFilter && t.type !== typeFilter) return false;
      if (monthFilter && !(t.date || '').startsWith(monthFilter)) return false;
      return true;
    });
    rows.sort(function(a, b){ return (a.date||'').localeCompare(b.date||''); });

    var running = 0;
    var tbody = document.getElementById('ledgerBody');
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:24px;color:var(--premium-text-muted)">ยังไม่มีรายการ</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function(tx) {
      var isIncome = tx.type === 'income';
      running += isIncome ? (tx.amount || 0) : -(tx.amount || 0);
      var sign   = isIncome ? '+' : '-';
      var amtCls = isIncome ? 'amount-income' : 'amount-expense';
      var runCls = running >= 0 ? 'amount-income' : 'amount-expense';
      var delBtn = _isManager
        ? '<button class="btn btn-ghost btn-sm" onclick="deleteTx(\'' + escapeHtml(tx.id||'') + '\')" title="ลบ">🗑️</button>'
        : '';
      return '<tr>'
        + '<td style="white-space:nowrap">' + escapeHtml(formatDate(tx.date||'')) + '</td>'
        + '<td><span class="type-' + tx.type + '">' + (isIncome ? '💚 รายรับ' : '❤️ รายจ่าย') + '</span></td>'
        + '<td>' + escapeHtml(tx.category||'-') + '</td>'
        + '<td>' + escapeHtml(tx.description||'') + '</td>'
        + '<td style="color:var(--premium-text-muted);font-size:11px">' + escapeHtml(tx.submittedBy||'-') + '</td>'
        + '<td class="' + amtCls + '" style="text-align:right;white-space:nowrap">' + sign + formatCurrency(tx.amount||0) + '</td>'
        + '<td class="' + runCls + '" style="text-align:right;white-space:nowrap;font-weight:700">' + formatCurrency(running) + '</td>'
        + '<td>' + delBtn + '</td>'
        + '</tr>';
    }).join('');
  }

  /* ── Pending Tab ── */
  function renderPending() {
    var pending  = _allTx.filter(function(t){ return t.status === 'pending'; });
    var rejected = _allTx.filter(function(t){ return t.status === 'rejected'; });
    var container = document.getElementById('pendingList');

    if (!pending.length && !rejected.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--premium-text-muted)">ไม่มีรายการรออนุมัติ ✅</div>';
      return;
    }

    var html = '';

    if (pending.length) {
      html += '<h4 style="margin-bottom:var(--spacing-md)">⏳ รอการอนุมัติ (' + pending.length + ' รายการ)</h4>';
      html += pending.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); }).map(function(tx) {
        var isIncome = tx.type === 'income';
        var approveBtn = _isManager
          ? '<button class="btn btn-success btn-sm" onclick="approveTx(\'' + escapeHtml(tx.id||'') + '\')">✅ อนุมัติ</button>'
            + '<button class="btn btn-danger btn-sm" onclick="openRejectModal(\'' + escapeHtml(tx.id||'') + '\')">❌ ปฏิเสธ</button>'
          : '';
        return '<div class="pending-card">'
          + '<div class="pending-card-header">'
            + '<div>'
              + '<span class="type-' + tx.type + '">' + (isIncome ? '💚 รายรับ' : '❤️ รายจ่าย') + '</span>'
              + ' &nbsp;<strong>' + formatCurrency(tx.amount||0) + '</strong>'
              + ' &nbsp;<span class="status-badge status-pending">⏳ รออนุมัติ</span>'
            + '</div>'
            + '<div class="pending-card-actions">' + approveBtn + '</div>'
          + '</div>'
          + '<div class="pending-card-meta">'
            + '<span>📅 ' + escapeHtml(formatDate(tx.date||'')) + '</span>'
            + '<span>🗂️ ' + escapeHtml(tx.category||'-') + '</span>'
            + '<span>👤 ' + escapeHtml(tx.submittedBy||'-') + '</span>'
          + '</div>'
          + (tx.description ? '<div style="margin-top:6px;font-size:var(--text-sm)">' + escapeHtml(tx.description) + '</div>' : '')
          + '</div>';
      }).join('');
    }

    if (rejected.length) {
      html += '<h4 style="margin:var(--spacing-xl) 0 var(--spacing-md)">❌ ปฏิเสธแล้ว (' + rejected.length + ' รายการ)</h4>';
      html += rejected.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); }).map(function(tx) {
        var isIncome = tx.type === 'income';
        var delBtn = _isManager
          ? '<button class="btn btn-ghost btn-sm" onclick="deleteTx(\'' + escapeHtml(tx.id||'') + '\')">🗑️</button>'
          : '';
        return '<div class="pending-card" style="opacity:.75">'
          + '<div class="pending-card-header">'
            + '<div>'
              + '<span class="type-' + tx.type + '">' + (isIncome ? '💚 รายรับ' : '❤️ รายจ่าย') + '</span>'
              + ' &nbsp;<strong>' + formatCurrency(tx.amount||0) + '</strong>'
              + ' &nbsp;<span class="status-badge status-rejected">❌ ปฏิเสธ</span>'
            + '</div>'
            + '<div class="pending-card-actions">' + delBtn + '</div>'
          + '</div>'
          + '<div class="pending-card-meta">'
            + '<span>📅 ' + escapeHtml(formatDate(tx.date||'')) + '</span>'
            + '<span>👤 ' + escapeHtml(tx.submittedBy||'-') + '</span>'
            + (tx.rejectReason ? '<span>เหตุผล: ' + escapeHtml(tx.rejectReason) + '</span>' : '')
          + '</div>'
          + (tx.description ? '<div style="margin-top:6px;font-size:var(--text-sm)">' + escapeHtml(tx.description) + '</div>' : '')
          + '</div>';
      }).join('');
    }

    container.innerHTML = html;
  }

  /* ── Tab switch ── */
  function switchTab(name, btn) {
    document.querySelectorAll('.tab-pane').forEach(function(p){ p.classList.remove('active'); });
    document.querySelectorAll('.fund-tab').forEach(function(b){ b.classList.remove('active'); });
    document.getElementById('tab' + name.charAt(0).toUpperCase() + name.slice(1)).classList.add('active');
    btn.classList.add('active');
  }

  /* ── Venue select ── */
  function populateVenueSelect() {
    var sel = document.getElementById('txVenueSelect');
    // ลบ options เก่า (เก็บ option แรก)
    while (sel.options.length > 1) sel.remove(1);
    _venues.forEach(function(v) {
      var opt = document.createElement('option');
      opt.value = v.name || v.id || '';
      opt.textContent = '🏪 ' + (v.name || '');
      sel.appendChild(opt);
    });
  }

  function onVenueSelect() {
    var sel = document.getElementById('txVenueSelect');
    var nameInput = document.getElementById('txVenueName');
    if (sel.value) nameInput.value = sel.value;
  }

  /* ── Type toggle ── */
  function onTypeChange() {
    var type = document.getElementById('txType').value;
    document.getElementById('incomeFields').style.display  = type === 'income'  ? '' : 'none';
    document.getElementById('expenseFields').style.display = type === 'expense' ? '' : 'none';
    // ล้างค่า
    document.getElementById('txVenueName').value   = '';
    document.getElementById('txVenueSelect').value = '';
    if (document.getElementById('txExpenseWhat')) document.getElementById('txExpenseWhat').value = '';
  }

  /* ── Submit form ── */
  document.getElementById('fundForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var type = document.getElementById('txType').value;

    // validate
    if (type === 'income') {
      var vname = document.getElementById('txVenueName').value.trim();
      if (!vname) {
        showToast('กรุณาระบุชื่อร้าน / แหล่งที่มาของ Tip', 'error');
        document.getElementById('txVenueName').focus();
        return;
      }
    } else {
      var what = document.getElementById('txExpenseWhat').value.trim();
      if (!what) {
        showToast('กรุณาระบุว่าจ่ายอะไร', 'error');
        document.getElementById('txExpenseWhat').focus();
        return;
      }
    }

    var btn = document.getElementById('saveTxBtn');
    btn.disabled = true; btn.textContent = 'กำลังส่ง...';

    var amount = parseFloat(document.getElementById('txAmount').value);
    if (isNaN(amount) || amount <= 0) {
      btn.disabled = false; btn.textContent = _isManager ? '💾 บันทึก' : '📤 ส่งคำขอ';
      showToast('กรุณาใส่จำนวนเงินที่ถูกต้อง', 'error');
      return;
    }
    var userName = localStorage.getItem('userNickname') || localStorage.getItem('userFirstName') || localStorage.getItem('userName') || '';

    var category, description;
    if (type === 'income') {
      var venueName = document.getElementById('txVenueName').value.trim();
      var incomeNote = document.getElementById('txIncomeNote').value.trim();
      category    = 'Tip';
      description = 'Tip จากร้าน ' + venueName + (incomeNote ? ' — ' + incomeNote : '');
    } else {
      category    = document.getElementById('txCategory').value;
      var expWhat = document.getElementById('txExpenseWhat').value.trim();
      description = expWhat;
    }

    apiCall('addFundTransaction', {
      type:        type,
      amount:      amount,
      date:        document.getElementById('txDate').value,
      category:    category,
      description: description,
      submittedBy: userName
    }, function(r) {
      btn.disabled = false;
      btn.textContent = _isManager ? '💾 บันทึก' : '📤 ส่งคำขอ';
      if (r && r.success) {
        var msg = r.autoApproved ? 'บันทึกแล้ว ✅' : 'ส่งคำขอแล้ว ⏳ รอผู้จัดการอนุมัติ';
        showToast(msg, 'success');
        document.getElementById('fundForm').reset();
        document.getElementById('txDate').value = (function(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })(new Date());
        onTypeChange(); // reset dynamic fields
        loadFund();
        if (!r.autoApproved) {
          var pendingBtn = document.querySelectorAll('.fund-tab')[1];
          switchTab('pending', pendingBtn);
        }
      } else {
        showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
      }
    });
  });

  /* ── Approve ── */
  function approveTx(id) {
    apiCall('approveFundTransaction', { txId: id }, function(r) {
      if (r && r.success) { showToast('อนุมัติแล้ว ✅', 'success'); loadFund(); }
      else showToast((r && r.message)||'เกิดข้อผิดพลาด', 'error');
    });
  }

  /* ── Reject Modal ── */
  function openRejectModal(id) {
    _rejectTarget = id;
    document.getElementById('rejectReason').value = '';
    document.getElementById('rejectModal').style.display = 'flex';
  }
  function closeRejectModal() {
    _rejectTarget = null;
    document.getElementById('rejectModal').style.display = 'none';
  }
  function confirmReject() {
    if (!_rejectTarget) return;
    var reason = document.getElementById('rejectReason').value.trim();
    apiCall('rejectFundTransaction', { txId: _rejectTarget, reason: reason }, function(r) {
      if (r && r.success) { showToast('ปฏิเสธรายการแล้ว', 'warning'); loadFund(); closeRejectModal(); }
      else showToast((r && r.message)||'เกิดข้อผิดพลาด', 'error');
    });
  }

  /* ── Delete (manager only) ── */
  function deleteTx(id) {
    showConfirm('ยืนยันการลบ', 'ต้องการลบรายการนี้?', {danger:true, confirmText:'ลบ'}).then(function(ok) {
      if (!ok) return;
      apiCall('deleteFundTransaction', { txId: id }, function(r) {
        if (r && r.success) { showToast('ลบแล้ว', 'success'); loadFund(); }
        else showToast((r && r.message)||'เกิดข้อผิดพลาด', 'error');
      });
    });
  }