/**
 * Attendance & Payroll v2
 * เบิกจ่าย (ผู้จัดการวง) — สอดคล้องกับระบบลงเวลาและตารางงาน
 * Profile-based members + schedule slot rates + check-in pre-fill
 * BandThai
 */

/* ── State ─────────────────────────────────────────── */
function apLocalDate(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
var apBandId      = null;
var apBandName    = '';
var apBandManager = '';
var apMembers     = [];
var apVenues      = [];
var apScheduleMap = {};
var apDateRange   = [];
var apRecordType  = 'daily';
var apVenueId     = '';
var apChecked     = {};
var _apInited     = false;
var apWeekStart   = 1;  // default Monday (0=Sun..6=Sat)
var apWeekEnd     = 0;  // default Sunday
var _apUserEditedDates = false; // true once user manually changes startDate
var apIsAdmin     = (function(){ var r=localStorage.getItem('userRole')||'member'; return r==='admin'||r==='manager'; })();

/* ── Helpers ────────────────────────────────────────── */
function apEl(id) { return document.getElementById(id); }
function apEsc(t) {
  if (!t) return '';
  var d = document.createElement('div'); d.textContent = t; return d.innerHTML;
}
function apToast(msg, type) {
  var el = apEl('toast');
  if (!el) { alert(msg); return; }
  var m = el.querySelector('.toast-message'); if (m) m.textContent = msg;
  el.style.background = type === 'error' ? '#e53e3e' : type === 'success' ? '#38a169' : 'var(--premium-gold)';
  el.style.display = 'block'; el.classList.add('show');
  setTimeout(function() { el.classList.remove('show'); setTimeout(function() { el.style.display = 'none'; }, 300); }, 3000);
}
function apFmtDate(d) {
  var MS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return d.getDate() + ' ' + MS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}
function apFmtMonth(d) {
  var ML = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return ML[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}
function apParseMin(t) {
  if (!t) return 0; var p = t.split(':').map(Number); return p[0]*60 + (p[1]||0);
}
function apCalcH(s, e) { var diff = e - s; if (diff < 0) diff += 1440; return diff / 60; }

/* ── Schedule slots ─────────────────────────────────── */
function apSlotsForDay(dow) {
  var day = apScheduleMap[dow] || apScheduleMap[String(dow)];
  if (Array.isArray(day)) {
    var arr = day;
    if (apVenueId) arr = arr.filter(function(s) { return s.venueId === apVenueId; });
    return arr.map(function(s) {
      return { start: s.startTime||'', end: s.endTime||'', members: s.members||[], venueId: s.venueId||'' };
    });
  }
  if (day && day.timeSlots && day.timeSlots.length) {
    return day.timeSlots.map(function(s) {
      return { start: s.startTime, end: s.endTime, members: s.members||[] };
    });
  }
  return [];
}

function apMemberRate(slot, mid) {
  var mr = (slot.members||[]).find(function(m) { return m.memberId === mid; });
  return mr ? { rate: mr.rate||0, type: mr.rateType||'shift', assigned: true } : { rate: 0, type: 'shift', assigned: false };
}

function apSlotPay(slot, mid) {
  var r = apMemberRate(slot, mid);
  // If member not assigned to this specific slot, fall back to their band-wide default rate
  // (covers leave+sub cases where the sub works a slot the original member isn't in)
  if (r.rate <= 0) {
    var dr = apDefaultRate(mid);
    if (dr.rate <= 0) return 0;
    r = { rate: dr.rate, type: dr.type };
  }
  if (r.type === 'hourly') return apCalcH(apParseMin(slot.start), apParseMin(slot.end)) * r.rate;
  return r.rate;
}

function apDefaultRate(mid) {
  for (var d = 0; d < 7; d++) {
    var slots = apSlotsForDay(d);
    for (var i = 0; i < slots.length; i++) {
      var mr = apMemberRate(slots[i], mid);
      if (mr.rate > 0) return mr;
    }
  }
  return { rate: 0, type: 'shift' };
}

function apExtraSlotPay(slot, mid) {
  var dr = apDefaultRate(mid);
  if (dr.rate <= 0) return 0;
  if (dr.type === 'hourly') return apCalcH(apParseMin(slot.start), apParseMin(slot.end)) * dr.rate;
  return dr.rate;
}

/* ═══ LOAD DATA ═════════════════════════════════════ */
function apLoadData() {
  apBandId = localStorage.getItem('bandId') || sessionStorage.getItem('bandId');
  apBandName = localStorage.getItem('bandName') || '';
  apBandManager = localStorage.getItem('bandManager') || localStorage.getItem('userName') || '';
  try {
    var s = JSON.parse(localStorage.getItem('bandSettings') || '{}');
    if (s.members && s.members.length) apMembers = s.members;
    if (s.venues) apVenues = s.venues;
    apScheduleMap = s.schedule || s.scheduleData || {};
    // Read payroll settings from manager's band-settings
    // NOTE: Do NOT read weekStart/weekEnd from localStorage — may be stale.
    //       These are loaded from server in apLoadData() async callback only.
    if (s.payroll) {
      if (s.payroll.period) apRecordType = s.payroll.period;
    }
  } catch(e) {}
  apUpdateBandInfo();
  apRenderVenues();

  if (apBandId && typeof apiCall === 'function') {
    var ready = { p: false, s: false };
    function onReady() {
      if (!ready.p || !ready.s) return;
      apUpdateBandInfo();
      apRenderVenues();
      apHandleUrlParams();
    }
    apiCall('getBandProfiles', { bandId: apBandId }, function(r) {
      if (r && r.success && r.data && r.data.length) {
        apMembers = r.data.map(function(p) {
          return { id: p.id, name: p.nickname||p.first_name||p.user_name||p.email||'?', position: p.instrument||'', email: p.email||'', paymentMethod: p.payment_method||'', paymentAccount: p.payment_account||'' };
        });
        try { var ls = JSON.parse(localStorage.getItem('bandSettings')||'{}'); ls.members = apMembers; localStorage.setItem('bandSettings', JSON.stringify(ls)); } catch(e){}
      }
      ready.p = true; onReady();
    });
    apiCall('getBandSettings', { bandId: apBandId }, function(r) {
      if (r && r.success && r.data) {
        if (r.data.venues) apVenues = r.data.venues;
        apScheduleMap = r.data.schedule || r.data.scheduleData || {};
        // Sync payroll config from server
        if (r.data.payroll) {
          if (r.data.payroll.period) apRecordType = r.data.payroll.period;
          if (r.data.payroll.weekStart !== undefined) apWeekStart = parseInt(r.data.payroll.weekStart, 10);
          if (r.data.payroll.weekEnd !== undefined) apWeekEnd = parseInt(r.data.payroll.weekEnd, 10);
          // Sync correct values back to localStorage so stale cache is cleared
          try {
            var _lsSync = JSON.parse(localStorage.getItem('bandSettings') || '{}');
            _lsSync.payroll = Object.assign(_lsSync.payroll || {}, r.data.payroll);
            localStorage.setItem('bandSettings', JSON.stringify(_lsSync));
          } catch(e) {}
          // Update UI to reflect manager's settings
          var _rt = apEl('recordType'); if (_rt) _rt.value = apRecordType;
          apShowDateGroups();
          apApplyWeekRange();
        }
      }
      ready.s = true; onReady();
    });
  } else {
    apHandleUrlParams();
  }
}

function apHandleUrlParams() {
  var prm = new URLSearchParams(window.location.search);
  if (prm.get('venue')) { apVenueId = prm.get('venue'); var sel = apEl('venue'); if (sel) sel.value = apVenueId; }
  if (prm.get('date')) {
    var rt = apEl('recordType'); if (rt) rt.value = 'daily';
    apRecordType = 'daily'; apShowDateGroups();
    var wd = apEl('workDate'); if (wd) wd.value = prm.get('date');
  }
  apUpdateDateRange();
  apLoadCheckIns(function() { apRenderAttendance(); apRenderPayout(); apRenderPaymentInfo(); });
}

function apUpdateBandInfo() {
  var card = apEl('bandInfoCard'); if (card) card.style.display = 'block';
  var n = apEl('bandNameDisplay');    if (n) n.textContent = apBandName || '-';
  var m = apEl('bandManagerDisplay'); if (m) m.textContent = apBandManager || '-';
  var c = apEl('memberCountDisplay'); if (c) c.textContent = apMembers.length + ' คน';
}

/* ═══ VENUES ════════════════════════════════════════ */
function apRenderVenues() {
  var sel = apEl('venue'); if (!sel) return;
  var list = (apVenues||[]).filter(function(v) { return v.name && v.name.trim(); });
  sel.innerHTML = '<option value="">— เลือกร้าน —</option>';
  list.forEach(function(v) {
    var o = document.createElement('option'); o.value = v.id||v.name; o.textContent = v.name;
    if (o.value === apVenueId) o.selected = true;
    sel.appendChild(o);
  });
}

/* ═══ DATE RANGE ════════════════════════════════════ */
function apShowDateGroups() {
  apRecordType = (apEl('recordType')||{}).value || 'daily';
  ['dailyDateGroup','weeklyDateGroup','weeklyDateGroup2','monthlyDateGroup'].forEach(function(id) {
    var el = apEl(id); if (el) el.style.display = 'none';
  });
  if (apRecordType === 'daily') { var d = apEl('dailyDateGroup'); if (d) d.style.display = 'block'; }
  else if (apRecordType === 'weekly') {
    ['weeklyDateGroup','weeklyDateGroup2'].forEach(function(id) { var el = apEl(id); if (el) el.style.display = 'block'; });
  }
  else if (apRecordType === 'monthly') { var m = apEl('monthlyDateGroup'); if (m) m.style.display = 'block'; }
}

function apUpdateDateRange() {
  apDateRange = [];
  if (apRecordType === 'daily') {
    var v = (apEl('workDate')||{}).value; if (v) apDateRange = [v];
  } else if (apRecordType === 'weekly') {
    var sv = (apEl('startDate')||{}).value, ev = (apEl('endDate')||{}).value;
    if (sv && ev) { for (var d = new Date(sv); d <= new Date(ev); d.setDate(d.getDate()+1)) apDateRange.push(apLocalDate(new Date(d))); }
  } else if (apRecordType === 'monthly') {
    var mv = (apEl('monthYear')||{}).value;
    if (mv) { var p = mv.split('-'), ms = new Date(+p[0],+p[1]-1,1), me = new Date(+p[0],+p[1],0);
      for (var d2 = new Date(ms); d2 <= me; d2.setDate(d2.getDate()+1)) apDateRange.push(apLocalDate(new Date(d2)));
    }
  }
  if (!apDateRange.length) apDateRange = [apLocalDate(new Date())];
}

/* ═══ LOAD CHECK-INS ════════════════════════════════ */
var apCheckInStatus = {}; // apCheckInStatus[memberId][date][slotKey] = 'pending'|'confirmed'|'leave'
var apCheckInVenue  = {}; // apCheckInVenue[memberId][date] = venueName
var apCheckInTime   = {}; // apCheckInTime[memberId][date] = checkInAt timestamp
var apCheckInSub    = {}; // apCheckInSub[memberId][date][slotKey] = {name, contact} or null
var apLeaveData     = []; // leave_requests for the date range
var apLeaveSlots    = {}; // apLeaveSlots[memberId][date] = ['21:00-22:00']
var _apLoadReqId    = 0;

function apLoadCheckIns(cb) {
  apChecked = {};
  apCheckInStatus = {};
  apCheckInVenue  = {};
  apCheckInTime   = {};
  apCheckInSub    = {};
  apLeaveData     = [];
  apLeaveSlots    = {};
  if (!apBandId || typeof apiCall !== 'function' || !apDateRange.length) { if (cb) cb(); return; }
  var reqId = ++_apLoadReqId;
  var dates = apDateRange.slice(), all = [];
  var dateFrom = dates[0] || '', dateTo = dates[dates.length - 1] || '';
  var leaveDone = false, ciDone = false;
  function tryFinish() {
    if (reqId !== _apLoadReqId) return;
    if (!ciDone || !leaveDone) return;
    // Process check-ins
    all.forEach(function(ci) {
      var slots = ci.slots || [];
      // If leave record has empty slots, infer from schedule so it still shows
      if (!slots.length && ci.status === 'leave' && ci.date) {
        var dow = new Date(ci.date).getDay();
        slots = apSlotsForDay(dow).map(function(s) { return s.start + '-' + s.end; });
      }
      if (!slots.length) return;
      var mem = null;
      if (ci.memberId) mem = apMembers.find(function(m) { return m.id === ci.memberId; });
      if (!mem && ci.memberName) mem = apMembers.find(function(m) { return m.name === ci.memberName; });
      if (!mem && ci.memberName) mem = apMembers.find(function(m) { return m.name.trim() === (ci.memberName||'').trim(); });
      if (!mem) return;
      if (!apChecked[mem.id]) apChecked[mem.id] = {};
      if (!apChecked[mem.id][ci.date]) apChecked[mem.id][ci.date] = [];
      slots.forEach(function(s) { if (apChecked[mem.id][ci.date].indexOf(s) === -1) apChecked[mem.id][ci.date].push(s); });
      // Store check-in metadata PER SLOT (not per-date) to avoid leave bleeding across slots
      if (!apCheckInStatus[mem.id]) apCheckInStatus[mem.id] = {};
      if (!apCheckInStatus[mem.id][ci.date]) apCheckInStatus[mem.id][ci.date] = {};
      var _ciSt = ci.status || 'pending';
      slots.forEach(function(s) { apCheckInStatus[mem.id][ci.date][s] = _ciSt; });
      if (!apCheckInVenue[mem.id]) apCheckInVenue[mem.id] = {};
      apCheckInVenue[mem.id][ci.date] = ci.venue || '';
      if (!apCheckInTime[mem.id]) apCheckInTime[mem.id] = {};
      apCheckInTime[mem.id][ci.date] = ci.checkInAt || '';
      if (!apCheckInSub[mem.id]) apCheckInSub[mem.id] = {};
      if (!apCheckInSub[mem.id][ci.date]) apCheckInSub[mem.id][ci.date] = {};
      var _ciSubVal = ci.substitute || null;
      slots.forEach(function(s) { apCheckInSub[mem.id][ci.date][s] = _ciSubVal; });
    });
    // Merge leave_requests into apCheckInSub, apCheckInStatus AND apLeaveSlots
    apLeaveData.forEach(function(lv) {
      if (lv.status === 'rejected') return;
      var mem = null;
      if (lv.memberId) mem = apMembers.find(function(m) { return m.id === lv.memberId; });
      if (!mem && lv.memberName) mem = apMembers.find(function(m) { return m.name === lv.memberName; });
      // Fallback: trim whitespace comparison (handles extra spaces in stored name)
      if (!mem && lv.memberName) mem = apMembers.find(function(m) { return m.name.trim() === (lv.memberName||'').trim(); });
      // Fallback: check by displayName or nickname if available
      if (!mem && lv.memberName) mem = apMembers.find(function(m) { return (m.displayName||'').trim() === (lv.memberName||'').trim(); });
      if (!mem) return;
      // Store which specific slots have leave (slot-aware)
      var lvSlots = lv.slots || [];
      if (typeof lvSlots === 'string') { try { lvSlots = JSON.parse(lvSlots); } catch(e) { lvSlots = []; } }
      // If leave has empty slots, infer from schedule (covers leaves submitted before schedule loaded)
      if (!lvSlots.length && lv.date) {
        var lvDow = new Date(lv.date).getDay();
        lvSlots = apSlotsForDay(lvDow).map(function(s) { return s.start + '-' + s.end; });
      }
      if (!apLeaveSlots[mem.id]) apLeaveSlots[mem.id] = {};
      if (!apLeaveSlots[mem.id][lv.date]) apLeaveSlots[mem.id][lv.date] = [];
      lvSlots.forEach(function(s) {
        if (apLeaveSlots[mem.id][lv.date].indexOf(s) === -1) apLeaveSlots[mem.id][lv.date].push(s);
      });
      // Mark leave status PER SLOT (not per-date) so leave doesn't bleed across slots
      if (!apCheckInStatus[mem.id]) apCheckInStatus[mem.id] = {};
      if (!apCheckInStatus[mem.id][lv.date]) apCheckInStatus[mem.id][lv.date] = {};
      lvSlots.forEach(function(s) {
        if (!apCheckInStatus[mem.id][lv.date][s]) apCheckInStatus[mem.id][lv.date][s] = 'leave';
      });
      // Set substitute info PER SLOT
      if (lv.substituteName) {
        if (!apCheckInSub[mem.id]) apCheckInSub[mem.id] = {};
        if (!apCheckInSub[mem.id][lv.date]) apCheckInSub[mem.id][lv.date] = {};
        var _lvSubVal = { name: lv.substituteName, contact: lv.substituteContact || '' };
        lvSlots.forEach(function(s) {
          if (!apCheckInSub[mem.id][lv.date][s]) apCheckInSub[mem.id][lv.date][s] = _lvSubVal;
        });
      }
    });
    if (cb) cb();
  }
  // Load check-ins for full date range in one request
  apiCall('getCheckInsForRange', { bandId: apBandId, dateFrom: dateFrom, dateTo: dateTo }, function(r) {
    if (reqId !== _apLoadReqId) return;
    if (r && r.success && r.data) all = r.data;
    ciDone = true; tryFinish();
  });
  // Load leave requests for the date range
  apiCall('getLeaveRequestsForRange', { bandId: apBandId, dateFrom: dateFrom, dateTo: dateTo }, function(r) {
    if (reqId !== _apLoadReqId) return;
    if (r && r.success && r.data) {
      var dSet = {}; dates.forEach(function(d) { dSet[d] = true; });
      apLeaveData = r.data.filter(function(lv) { return dSet[lv.date]; });
    }
    leaveDone = true; tryFinish();
  });
}

/* ═══ EXTRA SLOTS (outside schedule) ═══════════════ */
function apGetExtraSlotsForDate(dateStr) {
  // Find all slot keys checked-in by any member on this date that are NOT in the schedule
  var dow = new Date(dateStr).getDay();
  var scheduledSlots = apSlotsForDay(dow);
  var scheduledKeys = scheduledSlots.map(function(s) { return s.start + '-' + s.end; });
  var extraKeys = {};
  apMembers.forEach(function(m) {
    var ciSlots = (apChecked[m.id] && apChecked[m.id][dateStr]) || [];
    ciSlots.forEach(function(sk) {
      if (scheduledKeys.indexOf(sk) === -1 && !extraKeys[sk]) {
        var p = sk.split('-');
        extraKeys[sk] = { start: p[0] || '', end: p[1] || '' };
      }
    });
  });
  // Sort by start time
  return Object.keys(extraKeys).sort().map(function(sk) {
    return extraKeys[sk];
  });
}

/* ═══ ATTENDANCE TABLE ══════════════════════════════ */
function apRenderAttendance() {
  var thead = apEl('attendanceTableHead'), tbody = apEl('attendanceTableBody'), title = apEl('attendanceTableTitle');
  if (!thead || !tbody) return;
  apUpdateDateRange();
  var DN = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  var RL = { shift:'บ/เบรค', hourly:'บ/ชม', fixed:'คงที่' };

  if (title && apDateRange.length) {
    var vn = ''; var vs = apEl('venue');
    if (vs && vs.selectedIndex > 0) vn = vs.options[vs.selectedIndex].text;
    var ds = new Date(apDateRange[0]), de = new Date(apDateRange[apDateRange.length-1]);
    title.textContent = '📋 ' + (apBandName||'วง') + (vn ? ' · '+vn : '') + ' — ' +
      (apRecordType==='daily' ? apFmtDate(ds) : apRecordType==='weekly' ? apFmtDate(ds)+' ถึง '+apFmtDate(de) : apFmtMonth(ds));
  }

  var hasSlots = apDateRange.some(function(d) { return apSlotsForDay(new Date(d).getDay()).length > 0 || apGetExtraSlotsForDate(d).length > 0; });
  if (!hasSlots || !apMembers.length) {
    thead.innerHTML = '';
    var msg = !apMembers.length ? 'ยังไม่มีสมาชิกในวง' :
      'ไม่มีช่วงงาน' + (apVenueId ? 'ในร้านที่เลือก' : '') + '<br><small>ตั้งค่าตารางงานสัปดาห์ในหน้า ⚙️ ตั้งค่าวง</small>';
    tbody.innerHTML = '<tr><td colspan="20" style="text-align:center;color:var(--premium-text-muted);padding:2rem">' + msg + '</td></tr>';
    return;
  }

  var h = '<tr><th>วัน</th><th>วันที่</th><th>ช่วงเวลา</th>';
  apMembers.forEach(function(m) {
    var dr = apDefaultRate(m.id);
    h += '<th style="min-width:75px;text-align:center"><div style="font-weight:700;font-size:13px">' + apEsc(m.name) + '</div>';
    if (m.position) h += '<div style="font-size:10px;color:var(--premium-text-muted)">' + apEsc(m.position) + '</div>';
    if (dr.rate > 0) h += '<div style="font-size:10px;color:var(--premium-gold);margin-top:2px">' + dr.rate.toLocaleString('th-TH') + ' ' + (RL[dr.type]||'') + '</div>';
    h += '</th>';
  });
  h += '<th style="text-align:right">รวม</th></tr>';
  thead.innerHTML = h;

  var b = '';
  apDateRange.forEach(function(dateStr) {
    var dt = new Date(dateStr), dow = dt.getDay();
    var slots = apSlotsForDay(dow);
    var extraSlots = apGetExtraSlotsForDate(dateStr);
    var totalRows = slots.length + extraSlots.length;
    if (!totalRows) return;

    // Helper to render a single slot row
    function renderSlotRow(slot, sk, si, isExtra) {
      b += '<tr' + (isExtra ? ' style="background:rgba(49,130,206,0.04)"' : '') + '>';
      if (si === 0) {
        b += '<td rowspan="' + totalRows + '" style="font-weight:600">' + DN[dow] + '</td>';
        b += '<td rowspan="' + totalRows + '">' + apFmtDate(dt) + '</td>';
      }
      b += '<td style="white-space:nowrap">' + slot.start + ' – ' + slot.end + '</td>';
      var rowAmt = 0;
      apMembers.forEach(function(m) {
        var ciSlots = (apChecked[m.id] && apChecked[m.id][dateStr]) || [];
        var checked = ciSlots.indexOf(sk) !== -1;
        var ri = isExtra ? { rate: 0, type: 'shift', assigned: false } : apMemberRate(slot, m.id);
        var hasCheckIn = apChecked[m.id] && apChecked[m.id][dateStr] && apChecked[m.id][dateStr].length > 0;
        var ciSt = (apCheckInStatus[m.id] && apCheckInStatus[m.id][dateStr] && apCheckInStatus[m.id][dateStr][sk]) || '';
        var subInfo = (apCheckInSub[m.id] && apCheckInSub[m.id][dateStr] && apCheckInSub[m.id][dateStr][sk]) || null;
        var leaveSlots = (apLeaveSlots[m.id] && apLeaveSlots[m.id][dateStr]) || [];
        var isLeaveSlot = leaveSlots.length > 0 ? leaveSlots.indexOf(sk) !== -1 : (ciSt === 'leave');
        var subCovered = (isLeaveSlot && subInfo && subInfo.name && (ri.assigned || apDefaultRate(m.id).rate > 0));
        if (subCovered && !checked) {
          if (!apChecked[m.id]) apChecked[m.id] = {};
          if (!apChecked[m.id][dateStr]) apChecked[m.id][dateStr] = [];
          if (apChecked[m.id][dateStr].indexOf(sk) === -1) apChecked[m.id][dateStr].push(sk);
          checked = true;
        }
        if (checked) rowAmt += isExtra ? apExtraSlotPay(slot, m.id) : apSlotPay(slot, m.id);
        var tdCls = 'text-align:center;position:relative';
        if (isExtra && checked) tdCls += ';background:rgba(49,130,206,0.08)';
        else if (subCovered) tdCls += ';background:rgba(128,90,213,0.08)';
        else if (!hasCheckIn && ri.assigned) tdCls += ';background:rgba(255,193,7,0.08)';
        b += '<td style="' + tdCls + '">';
        b += '<input type="checkbox" class="ap-cb" data-m="' + apEsc(m.id) +
          '" data-d="' + dateStr + '" data-s="' + apEsc(sk) + '" data-extra="' + (isExtra?'1':'0') + '"' + (checked ? ' checked' : '') + (!apIsAdmin ? ' disabled' : '') + '>';
        if (isLeaveSlot) {
          b += '<span class="ap-ci-badge" style="color:#e53e3e;font-size:9px;display:block" title="ลางาน">🚫 ลา</span>';
          if (subInfo && subInfo.name) {
            b += '<span class="ap-ci-badge" style="color:#805ad5;font-size:9px;display:block" title="คนแทน: ' + apEsc(subInfo.name) + '">🔄 ' + apEsc(subInfo.name) + '</span>';
          }
          b += '<span class="ap-ci-badge" style="color:#718096;font-size:8px;display:block">' + apEsc(m.name) + '</span>';
        } else if (checked && ciSt) {
          var badgeTip = ciSt==='confirmed'?'ยืนยันแล้ว':'รอยืนยัน';
          if (subInfo && subInfo.name) badgeTip += ' (แทน: ' + subInfo.name + ')';
          if (ciSt==='confirmed') {
            b += '<span class="ap-ci-badge ap-ci-' + apEsc(ciSt) + '" title="' + apEsc(badgeTip) + '">✅</span>';
          }
          if (subInfo && subInfo.name) b += '<span class="ap-ci-badge" style="color:#805ad5;font-size:9px" title="คนแทน: ' + apEsc(subInfo.name) + '">🔄 ' + apEsc(subInfo.name) + '</span>';
        } else if (!isExtra && !hasCheckIn && ri.assigned) {
          b += '<span class="ap-ci-badge ap-ci-absent" title="ยังไม่ลงเวลา">—</span>';
        }
        b += '</td>';
      });
      b += '<td style="text-align:right;font-weight:600;font-size:12px" class="ap-rt">' + (rowAmt > 0 ? rowAmt.toLocaleString('th-TH') : '-') + '</td>';
      b += '</tr>';
    }

    var rowIdx = 0;
    // Merge normal + extra slots, sort by start time
    var allSlots = [];
    slots.forEach(function(slot) { allSlots.push({ slot: slot, sk: slot.start + '-' + slot.end, isExtra: false }); });
    extraSlots.forEach(function(slot) { allSlots.push({ slot: slot, sk: slot.start + '-' + slot.end, isExtra: true }); });
    allSlots.sort(function(a, b) { return a.slot.start < b.slot.start ? -1 : a.slot.start > b.slot.start ? 1 : 0; });
    allSlots.forEach(function(item) {
      renderSlotRow(item.slot, item.sk, rowIdx, item.isExtra);
      rowIdx++;
    });
  });

  b += '<tr class="total-row"><td colspan="3" style="text-align:right;font-weight:700">รวมทั้งหมด</td>';
  apMembers.forEach(function(m) {
    b += '<td class="ap-mt" data-m="' + apEsc(m.id) + '" style="text-align:center;font-weight:700">-</td>';
  });
  b += '<td class="ap-gt" style="text-align:right;font-weight:700;color:var(--premium-gold)">-</td></tr>';
  tbody.innerHTML = b;

  tbody.querySelectorAll('.ap-cb').forEach(function(cb) {
    if (!apIsAdmin) return; // only admin can toggle checkboxes
    cb.addEventListener('change', function() {
      var mid = this.dataset.m, d = this.dataset.d, s = this.dataset.s;
      if (!apChecked[mid]) apChecked[mid] = {};
      if (!apChecked[mid][d]) apChecked[mid][d] = [];
      if (this.checked) { if (apChecked[mid][d].indexOf(s)===-1) apChecked[mid][d].push(s); }
      else apChecked[mid][d] = apChecked[mid][d].filter(function(x){return x!==s;});
      apCalcTotals();
      apRenderPayout();
    });
  });
  apCalcTotals();
}

function apCalcTotals() {
  var grand = 0, mTotals = {}, mHours = {};
  apMembers.forEach(function(m) { mTotals[m.id] = 0; mHours[m.id] = 0; });
  var rows = document.querySelectorAll('#attendanceTableBody tr:not(.total-row)');
  rows.forEach(function(tr) {
    var cbs = tr.querySelectorAll('.ap-cb');
    if (!cbs.length) return;
    var dateStr = cbs[0].dataset.d, sk = cbs[0].dataset.s;
    var isExtra = cbs[0].dataset.extra === '1';
    var dow = new Date(dateStr).getDay();
    var slots = apSlotsForDay(dow);
    var slot = slots.find(function(s) { return (s.start+'-'+s.end)===sk; });
    // For extra slots, create a virtual slot object
    if (!slot && isExtra) {
      var p = sk.split('-');
      slot = { start: p[0]||'', end: p[1]||'', members: [] };
    }
    if (!slot) return;
    var slotHours = apCalcH(apParseMin(slot.start), apParseMin(slot.end));
    var rowAmt = 0;
    cbs.forEach(function(cb) {
      if (cb.checked) {
        var pay = isExtra ? apExtraSlotPay(slot, cb.dataset.m) : apSlotPay(slot, cb.dataset.m);
        mTotals[cb.dataset.m] = (mTotals[cb.dataset.m]||0) + pay;
        mHours[cb.dataset.m] = (mHours[cb.dataset.m]||0) + slotHours;
        rowAmt += pay;
      }
    });
    grand += rowAmt;
    var rtCell = tr.querySelector('.ap-rt');
    if (rtCell) rtCell.textContent = rowAmt > 0 ? rowAmt.toLocaleString('th-TH') : '-';
  });
  apMembers.forEach(function(m) {
    var el = document.querySelector('.ap-mt[data-m="'+m.id+'"]');
    if (el) el.textContent = mHours[m.id] > 0 ? mHours[m.id] + ' ชม.' : '-';
  });
  var ge = document.querySelector('.ap-gt');
  if (ge) ge.textContent = grand > 0 ? grand.toLocaleString('th-TH') + ' ฿' : '-';
}

/* ═══ PAYOUT TABLE ══════════════════════════════════ */
function apRenderPayout() {
  var thead = apEl('payoutTableHead'), tbody = apEl('payoutTableBody');
  if (!thead || !tbody) return;
  if (!apMembers.length) { thead.innerHTML=''; tbody.innerHTML=''; return; }
  var DN = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
  var RL = { shift:'บ/เบรค', hourly:'บ/ชม', fixed:'คงที่' };

  // Header row with member names + rate info
  var h = '<tr><th>วัน</th><th>วันที่</th>';
  apMembers.forEach(function(m) {
    var dr = apDefaultRate(m.id);
    var rateTxt = dr.rate > 0 ? dr.rate.toLocaleString('th-TH') + ' ' + (RL[dr.type]||'') : '-';
    h += '<th style="text-align:right;font-size:12px">' + apEsc(m.name) + '<br><span style="font-weight:400;color:#888;font-size:10px">' + rateTxt + '</span></th>';
  });
  h += '<th style="text-align:right">รวม</th></tr>';
  thead.innerHTML = h;

  var mGrand = {}; apMembers.forEach(function(m) { mGrand[m.id] = 0; });
  var b = '', grand = 0;
  apDateRange.forEach(function(dateStr) {
    var dt = new Date(dateStr), dow = dt.getDay(), slots = apSlotsForDay(dow), dayTotal = 0;
    var extraSlots = apGetExtraSlotsForDate(dateStr);
    b += '<tr><td>' + DN[dow] + '</td><td>' + apFmtDate(dt) + '</td>';
    apMembers.forEach(function(m) {
      var amt = 0;
      slots.forEach(function(slot) {
        var sk = slot.start+'-'+slot.end;
        if (apChecked[m.id] && apChecked[m.id][dateStr] && apChecked[m.id][dateStr].indexOf(sk)!==-1) amt += apSlotPay(slot, m.id);
      });
      // Include extra slots in payout
      extraSlots.forEach(function(slot) {
        var sk = slot.start+'-'+slot.end;
        if (apChecked[m.id] && apChecked[m.id][dateStr] && apChecked[m.id][dateStr].indexOf(sk)!==-1) amt += apExtraSlotPay(slot, m.id);
      });
      mGrand[m.id] += amt; dayTotal += amt;
      b += '<td style="text-align:right">' + (amt > 0 ? amt.toLocaleString('th-TH') : '-') + '</td>';
    });
    grand += dayTotal;
    b += '<td style="text-align:right;font-weight:600">' + (dayTotal>0?dayTotal.toLocaleString('th-TH'):'-') + '</td></tr>';
  });

  // Rate summary row
  b += '<tr style="background:#f7f7f5"><td colspan="2" style="text-align:right;font-size:12px;color:#888">อัตรา</td>';
  apMembers.forEach(function(m) {
    var dr = apDefaultRate(m.id);
    var rateTxt = dr.rate > 0 ? dr.rate.toLocaleString('th-TH') + ' ' + (RL[dr.type]||'') : '-';
    b += '<td style="text-align:right;font-size:11px;color:#888">' + rateTxt + '</td>';
  });
  b += '<td></td></tr>';

  // Total row
  b += '<tr class="total-row"><td colspan="2" style="text-align:right">รวมสุทธิ</td>';
  apMembers.forEach(function(m) {
    b += '<td style="text-align:right;font-weight:700">' + (mGrand[m.id]>0?mGrand[m.id].toLocaleString('th-TH'):'-') + '</td>';
  });
  b += '<td style="text-align:right;font-weight:700;color:var(--premium-gold)">' + (grand>0?grand.toLocaleString('th-TH')+' ฿':'-') + '</td></tr>';

  // Substitute remark rows per member
  var subInfo = apBuildSubSummary();
  if (subInfo.length) {
    b += '<tr><td colspan="' + (apMembers.length + 3) + '" style="padding:0;border:none"><div style="margin:12px 0 4px;border-top:2px solid #d6bcfa"></div></td></tr>';
    b += '<tr style="background:linear-gradient(135deg,#faf5ff,#f3e8ff)"><td colspan="' + (apMembers.length + 3) + '" style="padding:8px 10px;font-weight:700;font-size:13px;color:#805ad5">🔄 หมายเหตุ — คนแทน</td></tr>';
    subInfo.forEach(function(s) {
      var dateStrs = s.dates.map(function(d) { var dt = new Date(d); return DN[dt.getDay()] + ' ' + apFmtDate(dt); }).join(', ');
      b += '<tr style="background:#faf5ff">';
      b += '<td colspan="2" style="padding:6px 10px;font-size:12px;color:#553c9a">' + apEsc(s.memberName) + ' ลา ' + s.shifts + ' เบรค</td>';
      b += '<td colspan="' + (apMembers.length - 1) + '" style="padding:6px 10px;font-size:12px;color:#805ad5">🔄 คนแทน: <strong>' + apEsc(s.subName) + '</strong> (' + dateStrs + ')</td>';
      b += '<td colspan="2" style="padding:6px 10px;text-align:right;font-size:12px;font-weight:700;color:#e53e3e">จ่ายคนแทน ' + (s.amount > 0 ? s.amount.toLocaleString('th-TH') + ' ฿' : '-') + '</td>';
      b += '</tr>';
    });
  }

  tbody.innerHTML = b;
}

/* ═══ PAYMENT INFO ══════════════════════════════════ */
var _payMethodLabels = {
  'promptpay': '💚 พร้อมเพย์',
  'truemoney': '🧡 ทรูมันนี่',
  'bank_kbank': '🟢 ธ.กสิกรไทย',
  'bank_scb': '🟣 ธ.ไทยพาณิชย์',
  'bank_bbl': '🔵 ธ.กรุงเทพ',
  'bank_ktb': '🔵 ธ.กรุงไทย',
  'bank_bay': '🟡 ธ.กรุงศรี',
  'bank_ttb': '🟠 ธ.ทหารไทยธนชาต',
  'bank_gsb': '🏦 ธ.ออมสิน',
  'bank_other': '🏦 ธนาคารอื่นๆ'
};

function apRenderPaymentInfo() {
  var container = document.getElementById('paymentInfoList');
  if (!container) return;
  if (!apMembers.length) { container.innerHTML = ''; return; }

  var hasAny = apMembers.some(function(m) { return m.paymentMethod || m.paymentAccount; });
  if (!hasAny) {
    container.innerHTML = '<p style="color:var(--premium-text-muted);font-size:13px;text-align:center;padding:12px 0">สมาชิกยังไม่ได้กรอกช่องทางรับเงิน — แจ้งให้กรอกได้ที่หน้า "ข้อมูลส่วนตัว"</p>';
    return;
  }

  var html = '';
  apMembers.forEach(function(m) {
    var method  = m.paymentMethod  || '';
    var account = m.paymentAccount || '';
    if (!method && !account) return;
    var label = _payMethodLabels[method] || method || '—';
    html += '<div class="pay-info-row">'
      + '<span class="pay-info-name">' + apEsc(m.name) + '</span>'
      + '<span class="pay-info-method">' + apEsc(label) + '</span>'
      + '<span class="pay-info-account">' + apEsc(account || '—') + '</span>'
      + '</div>';
  });
  container.innerHTML = html;
}

/* ═══ SUBSTITUTE SUMMARY ════════════════════════════ */
function apBuildSubSummary() {
  // Build substitute info: who took leave, who was the sub, how many shifts, how much money
  var subInfo = []; // {memberName, memberId, subName, shifts, amount, dates[]}
  var RL = { shift:'บ/เบรค', hourly:'บ/ชม', fixed:'คงที่' };
  apMembers.forEach(function(m) {
    // Check if this member has leave with a substitute (per-slot)
    var subDates = {};
    apDateRange.forEach(function(ds) {
      var subsForDate = (apCheckInSub[m.id] && apCheckInSub[m.id][ds]) || {};
      var dow = new Date(ds).getDay();
      var slots = apSlotsForDay(dow);
      var extraSlots = apGetExtraSlotsForDate(ds);
      // Process regular + extra slots
      var allSlots = slots.map(function(s) { return { slot: s, isExtra: false }; })
        .concat(extraSlots.map(function(s) { return { slot: s, isExtra: true }; }));
      allSlots.forEach(function(item) {
        var slot = item.slot;
        var sk = slot.start+'-'+slot.end;
        var sub = subsForDate[sk] || null;
        if (!sub || !sub.name) return;
        var ri = item.isExtra ? { rate: 0, assigned: false } : apMemberRate(slot, m.id);
        var slotPay = ri.rate > 0 ? apSlotPay(slot, m.id) : (item.isExtra ? apExtraSlotPay(slot, m.id) : apDefaultRate(m.id).rate);
        if (slotPay <= 0) return;
        var key = sub.name;
        if (!subDates[key]) subDates[key] = { subName: sub.name, contact: sub.contact || '', dates: [], slots: 0, amount: 0 };
        if (subDates[key].dates.indexOf(ds) === -1) subDates[key].dates.push(ds);
        subDates[key].slots++;
        subDates[key].amount += slotPay;
      });
    });
    Object.keys(subDates).forEach(function(key) {
      subInfo.push({
        memberName: m.name, memberId: m.id,
        subName: subDates[key].subName,
        contact: subDates[key].contact,
        shifts: subDates[key].slots,
        amount: subDates[key].amount,
        dates: subDates[key].dates
      });
    });
  });
  return subInfo;
}

/* ═══ SAVE ══════════════════════════════════════════ */
function apDoSave() {
  if (!apIsAdmin) { apToast('เฉพาะแอดมินเท่านั้นที่สามารถบันทึกได้', 'error'); return; }
  var venue = (apEl('venue')||{}).value;
  if (!venue) { apToast('กรุณาเลือกร้าน', 'error'); return; }
  var breakdown = [];
  apMembers.forEach(function(m) {
    var totalAmt = 0, totalSlots = 0;
    apDateRange.forEach(function(ds) {
      apSlotsForDay(new Date(ds).getDay()).forEach(function(slot) {
        var sk = slot.start+'-'+slot.end;
        if (apChecked[m.id] && apChecked[m.id][ds] && apChecked[m.id][ds].indexOf(sk)!==-1) { totalAmt += apSlotPay(slot,m.id); totalSlots++; }
      });
      // Include extra slots in save breakdown
      apGetExtraSlotsForDate(ds).forEach(function(slot) {
        var sk = slot.start+'-'+slot.end;
        if (apChecked[m.id] && apChecked[m.id][ds] && apChecked[m.id][ds].indexOf(sk)!==-1) { totalAmt += apExtraSlotPay(slot,m.id); totalSlots++; }
      });
    });
    if (totalSlots > 0) breakdown.push({ memberId: m.id, memberName: m.name, position: m.position, slots: totalSlots, amount: totalAmt });
  });
  if (!breakdown.length) { apToast('ไม่มีข้อมูลเข้างาน', 'error'); return; }

  var data = {
    recordType: apRecordType, date: apDateRange[0]||'', startDate: apDateRange[0]||'',
    endDate: apDateRange[apDateRange.length-1]||'', venue: venue, bandId: apBandId,
    breakdown: breakdown, totalAmount: breakdown.reduce(function(s,b){return s+b.amount;},0),
    createdAt: new Date().toISOString()
  };
  var btn = apEl('saveBtn'), orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'; }
  function done(ok, msg) {
    if (btn) { btn.disabled = false; btn.textContent = orig; }
    if (ok) { apToast('บันทึกเรียบร้อย ✅', 'success');
      try { var recs = JSON.parse(localStorage.getItem('attendancePayroll')||'[]'); recs.push(data); localStorage.setItem('attendancePayroll', JSON.stringify(recs)); } catch(e){}
    } else apToast(msg||'บันทึกไม่สำเร็จ', 'error');
  }
  if (typeof apiCall === 'function' && apBandId) {
    // Map to actual attendance_payroll table columns
    var dbData = {
      band_id: data.bandId,
      date: data.startDate,
      venue: data.venue,
      time_slots: JSON.stringify({ startDate: data.startDate, endDate: data.endDate, recordType: data.recordType }),
      attendance: JSON.stringify(data.breakdown),
      total_amount: data.totalAmount
    };
    apiCall('addAttendancePayroll', dbData, function(r) { done(r&&r.success, r&&r.message); });
  } else done(true);
}

/* ═══ RECEIPTS (save as image) ═══════════════════════ */
function apIsMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /MacIntel/.test(navigator.platform));
}

function apSaveAsImage(htmlContent, fileName) {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;background:#fff;padding:36px 40px;font-family:Sarabun,Kanit,sans-serif;min-width:1000px;width:max-content;max-width:1600px';
  wrap.innerHTML = htmlContent;
  document.body.appendChild(wrap);
  if (typeof html2canvas === 'undefined') {
    document.body.removeChild(wrap);
    var pw = window.open('', '_blank');
    if (pw) {
      pw.document.write('<html><head><meta charset="UTF-8"><title>' + fileName + '</title><style>body{font-family:Sarabun,sans-serif;padding:32px}</style></head><body>' + htmlContent + '</body></html>');
      pw.document.close(); pw.focus();
      setTimeout(function(){ pw.print(); }, 500);
    } else { apToast('กรุณาอนุญาต popup เพื่อพิมพ์เอกสาร', 'error'); }
    return;
  }
  html2canvas(wrap, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(function(canvas) {
    document.body.removeChild(wrap);

    /* ── Mobile: try Web Share API first, then open in new tab ── */
    if (apIsMobile()) {
      canvas.toBlob(function(blob) {
        if (!blob) { apToast('ไม่สามารถสร้างรูปภาพได้', 'error'); return; }

        /* Try navigator.share with file (iOS 15+, Android Chrome) */
        if (navigator.share && navigator.canShare) {
          var file = new File([blob], fileName, { type: 'image/png' });
          var shareData = { files: [file] };
          if (navigator.canShare(shareData)) {
            navigator.share(shareData).then(function() {
              apToast('แชร์/บันทึกรูปภาพสำเร็จ', 'success');
            }).catch(function(e) {
              if (e.name !== 'AbortError') apOpenImageInNewTab(blob, fileName);
            });
            return;
          }
        }

        /* Fallback: open image in new tab (user can long-press to save) */
        apOpenImageInNewTab(blob, fileName);
      }, 'image/png');
      return;
    }

    /* ── Desktop: normal download ── */
    var link = document.createElement('a');
    link.download = fileName;
    link.href = canvas.toDataURL('image/png');
    link.click();
    apToast('บันทึกรูปภาพสำเร็จ', 'success');
  }).catch(function(err) {
    document.body.removeChild(wrap);
    apToast('เกิดข้อผิดพลาดในการบันทึก: ' + err, 'error');
  });
}

function apOpenImageInNewTab(blob, fileName) {
  var url = URL.createObjectURL(blob);
  var pw = window.open('', '_blank');
  if (pw) {
    pw.document.write(
      '<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + fileName + '</title>' +
      '<style>body{margin:0;display:flex;flex-direction:column;align-items:center;background:#f0f0f0;padding:16px;font-family:Sarabun,sans-serif}' +
      'img{max-width:100%;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.15)}' +
      '.hint{margin:16px 0;padding:12px 20px;background:#fff3cd;border-radius:8px;font-size:14px;text-align:center;color:#856404}</style></head><body>' +
      '<div class="hint">📱 กดค้างที่รูปภาพ แล้วเลือก "บันทึกรูปภาพ" / "Save Image"</div>' +
      '<img src="' + url + '" alt="' + fileName + '">' +
      '</body></html>'
    );
    pw.document.close();
    apToast('เปิดรูปภาพในแท็บใหม่แล้ว — กดค้างเพื่อบันทึก', 'success');
  } else {
    URL.revokeObjectURL(url);
    apToast('กรุณาอนุญาต popup เพื่อดูรูปภาพ', 'error');
  }
}

function apPrintVenueReceipt() {
  var vs = apEl('venue'), vn = (vs && vs.selectedIndex>0) ? vs.options[vs.selectedIndex].text : '';
  if (!vn) { apToast('กรุณาเลือกร้าน', 'error'); return; }
  var dt = apDateRange.length ? apFmtDate(new Date(apDateRange[0])) + (apDateRange.length>1 ? ' – ' + apFmtDate(new Date(apDateRange[apDateRange.length-1])) : '') : '';
  var DN = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  var DNS = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
  var RL = { shift:'บ./เบรค', hourly:'บ./ชม.', fixed:'คงที่' };
  var docNo = 'DOC-' + (apDateRange[0]||'').replace(/-/g,'') + '-' + Date.now().toString().slice(-4);

  // ── Accent colour per day (left border only — not full background) ──
  var DAY_ACCENT = ['#e74c3c','#f39c12','#9b59b6','#27ae60','#e67e22','#2980b9','#8e44ad'];
  // Very faint row bg — alternates between day groups for separation
  var DAY_STRIPE = ['#fafafa','#f5f5f5'];

  var BD = 'border:1px solid #ddd';
  var HEAD = 'background:#2c3e50;color:#ecf0f1;font-size:12px;font-weight:700;padding:10px 11px;text-align:center;' + BD;

  // ── Member headers ──
  var memberHeaders = '';
  apMembers.forEach(function(m) {
    var dr = apDefaultRate(m.id);
    var rateTxt = dr.rate > 0 ? dr.rate.toLocaleString('th-TH') + ' ' + (RL[dr.type]||'') : '—';
    memberHeaders += '<th style="' + HEAD + ';min-width:72px">' + apEsc(m.name) +
      (m.position ? '<br><span style="font-weight:400;color:#bdc3c7;font-size:10px">' + apEsc(m.position) + '</span>' : '') +
      '<br><span style="font-weight:400;color:#f39c12;font-size:10px">(' + rateTxt + ')</span></th>';
  });

  // ── Build rows ──
  var total = 0, mGrand = {}, mBreaks = {};
  apMembers.forEach(function(m) { mGrand[m.id] = 0; mBreaks[m.id] = 0; });
  var tableRows = '', stripeIdx = 0;
  apDateRange.forEach(function(ds) {
    var dtObj = new Date(ds), dow = dtObj.getDay(), slots = apSlotsForDay(dow);
    var extraSlots = apGetExtraSlotsForDate(ds);
    // Merge regular + extra, sorted by start time
    var allSlots = [];
    slots.forEach(function(s) { allSlots.push({ slot: s, isExtra: false }); });
    extraSlots.forEach(function(s) { allSlots.push({ slot: s, isExtra: true }); });
    allSlots.sort(function(a, b) { return a.slot.start < b.slot.start ? -1 : a.slot.start > b.slot.start ? 1 : 0; });
    var accent = DAY_ACCENT[dow];
    var rowBg = DAY_STRIPE[stripeIdx % 2];
    stripeIdx++;
    allSlots.forEach(function(item, si) {
      var slot = item.slot, isExtra = item.isExtra;
      var sk = slot.start + '-' + slot.end;
      var isFirst = si === 0;
      var isLast  = si === allSlots.length - 1;
      // Accent line spans full row
      var cellTopBd = isFirst ? 'border-top:2px solid ' + accent : 'border-top:none';
      var cellBotBd = isLast  ? 'border-bottom:1px solid #ddd'   : 'border-bottom:none';
      var cellBorder = 'border-left:1px solid #ddd;border-right:1px solid #ddd;' + cellTopBd + ';' + cellBotBd;
      var dayTotal = 0, cells = '';
      apMembers.forEach(function(m) {
        var checked = apChecked[m.id] && apChecked[m.id][ds] && apChecked[m.id][ds].indexOf(sk) !== -1;
        var subInfo = (apCheckInSub[m.id] && apCheckInSub[m.id][ds] && apCheckInSub[m.id][ds][sk]) || null;
        var hasSub = subInfo && subInfo.name;
        var slotCovered = checked || hasSub;
        var amt = slotCovered ? (isExtra ? apExtraSlotPay(slot, m.id) : apSlotPay(slot, m.id)) : 0;
        mGrand[m.id] += amt; dayTotal += amt;
        if (slotCovered) mBreaks[m.id]++;
        var cellContent = slotCovered ? '<span style="color:' + (isExtra ? '#2b6cb0' : '#27ae60') + ';font-size:16px">✓</span>' : '';
        if (isExtra && slotCovered) cellContent += '<br><span style="font-size:9px;color:#2b6cb0">พิเศษ</span>';
        if (hasSub) cellContent += '<br><span style="font-size:10px;color:#8e44ad;font-weight:700">↳ ' + apEsc(subInfo.name) + '</span>';
        cells += '<td style="text-align:center;padding:8px 6px;background:' + rowBg + ';' + cellBorder + ';font-size:13px">' + cellContent + '</td>';
      });
      total += dayTotal;

      // Visual merge: วัน+วันที่ — accent border top/bottom only on first/last slot of day
      var topBd    = isFirst ? 'border-top:2px solid ' + accent : 'border-top:none';
      var botBd    = isLast  ? 'border-bottom:1px solid #ddd'   : 'border-bottom:none';
      var dayStyle = 'padding:8px 10px;background:' + rowBg + ';border-left:4px solid ' + accent + ';border-right:1px solid #ddd;' + topBd + ';' + botBd;

      tableRows += '<tr>' +
        '<td style="text-align:center;vertical-align:middle;min-width:44px;font-weight:700;font-size:14px;color:#2c3e50;' + dayStyle + '">' + (isFirst ? DNs(dow) : '') + '</td>' +
        '<td style="vertical-align:middle;min-width:96px;white-space:nowrap;font-size:13px;color:#34495e;' + dayStyle + ';border-left:1px solid #ddd;border-right:2px solid #bbb">' + (isFirst ? apFmtDate(dtObj) : '') + '</td>' +
        '<td style="padding:8px 10px;background:' + rowBg + ';' + cellBorder + ';font-size:13px;font-weight:600;color:#c0392b;white-space:nowrap">' + apEsc(slot.start + ' – ' + slot.end) + '</td>' +
        cells +
        '<td style="text-align:right;padding:8px 10px;background:' + rowBg + ';' + cellBorder + ';font-size:13px;font-weight:700;color:#c0392b">' + (dayTotal > 0 ? dayTotal.toLocaleString('th-TH') + ' ฿' : '—') + '</td></tr>';
    });
  });

  // helper to get short day name
  function DNs(d) { return DNS[d]; }

  // ── Subtotal row ──
  var subtotalRow = '<tr style="background:#ecf0f1">' +
    '<td colspan="3" style="text-align:right;padding:9px 11px;' + BD + ';font-size:13px;font-weight:700;color:#555">จำนวนเบรค</td>';
  apMembers.forEach(function(m) {
    subtotalRow += '<td style="text-align:center;padding:9px 6px;' + BD + ';font-size:13px;font-weight:700;color:#2c3e50">' + (mBreaks[m.id]||0) + ' เบรค</td>';
  });
  subtotalRow += '<td style="padding:9px;' + BD + '"></td></tr>';

  // ── Total row ──
  var totalRow = '<tr style="background:#fef9e7">' +
    '<td colspan="3" style="text-align:right;padding:12px 11px;' + BD + ';font-weight:700;font-size:14px;color:#1a1a1a">💰 รวมเงินค่าจ้างทั้งหมด</td>';
  apMembers.forEach(function(m) {
    totalRow += '<td style="text-align:center;padding:12px 6px;' + BD + ';font-weight:700;font-size:14px;color:#7d6608">' + (mGrand[m.id] > 0 ? mGrand[m.id].toLocaleString('th-TH') + ' ฿' : '—') + '</td>';
  });
  totalRow += '<td style="text-align:right;padding:12px 11px;' + BD + ';font-weight:800;font-size:18px;color:#c0392b">' + total.toLocaleString('th-TH', {minimumFractionDigits:2}) + ' ฿</td></tr>';

  var now = new Date();
  var nowStr = apFmtDate(now) + ' เวลา ' + now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ' น.';

  var html =
    '<table style="width:100%;border-bottom:3px solid #2c3e50;margin-bottom:20px;border-collapse:collapse"><tr>' +
      '<td style="vertical-align:top;padding-bottom:14px">' +
        '<div style="font-size:11px;color:#888;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">ใบเบิกเงินค่าจ้างนักดนตรี / Musician Payment Request</div>' +
        '<div style="font-size:24px;font-weight:800;color:#1a1a1a;margin-bottom:4px">' + apEsc(apBandName) + '</div>' +
        '<div style="font-size:14px;color:#333;font-weight:600">สถานที่: ' + apEsc(vn) + '</div>' +
        '<div style="font-size:13px;color:#555;margin-top:3px">ช่วงวันที่: ' + dt + '</div>' +
      '</td>' +
      '<td style="vertical-align:top;text-align:right;padding-bottom:14px;white-space:nowrap">' +
        '<div style="font-size:13px;font-weight:700;color:#444">เลขที่เอกสาร</div>' +
        '<div style="font-size:13px;font-family:monospace;color:#333;margin-bottom:6px">' + docNo + '</div>' +
        '<div style="font-size:12px;color:#777">วันที่พิมพ์: ' + nowStr + '</div>' +
      '</td>' +
    '</tr></table>' +
    '<table style="width:100%;border-collapse:collapse">' +
    '<thead><tr>' +
      '<th style="' + HEAD + ';min-width:44px">วัน</th>' +
      '<th style="' + HEAD + ';min-width:96px">วันที่</th>' +
      '<th style="' + HEAD + ';min-width:110px">ช่วงเวลา</th>' +
      memberHeaders +
      '<th style="' + HEAD + ';text-align:right">รวม</th>' +
    '</tr></thead>' +
    '<tbody>' + tableRows + subtotalRow + totalRow + '</tbody></table>' +
    '<div style="margin-top:20px;padding-top:12px;border-top:1px solid #ddd;text-align:center;font-size:11px;color:#aaa">' +
      '&#9656;&nbsp;<strong style="color:#c9a227">BandThai</strong>&nbsp;&#9656;&nbsp;—&nbsp;แพลตฟอร์มบริหารจัดการวงดนตรีระดับมืออาชีพ · ออกแบบมาเพื่อวงดนตรียุคใหม่โดยเฉพาะ' +
    '</div>';

  var safeVn = vn.replace(/[^a-zA-Z0-9ก-๙]/g, '_');
  apSaveAsImage(html, 'ใบเบิกร้าน_' + safeVn + '_' + (apDateRange[0]||'') + '.png');
}

function apPrintMemberReceipt() {
  var dt = apDateRange.length ? apFmtDate(new Date(apDateRange[0])) + (apDateRange.length>1 ? ' – '+apFmtDate(new Date(apDateRange[apDateRange.length-1])) : '') : '';
  var RL = { shift:'บ./เบรค', hourly:'บ./ชม.', fixed:'คงที่' };
  var B = 'border:1px solid #e5e7eb';
  var grand = 0, bodyRows = '';
  var memberData = [];

  apMembers.forEach(function(m) {
    var dr = apDefaultRate(m.id);
    var totalSlots = 0, totalAmt = 0;
    apDateRange.forEach(function(ds) {
      var daySlots = apSlotsForDay(new Date(ds).getDay());
      var dayExtraSlots = apGetExtraSlotsForDate(ds);
      daySlots.forEach(function(slot) {
        var sk = slot.start+'-'+slot.end;
        // นับทุก slot ที่ checked รวมทั้ง leave+sub slots
        if (apChecked[m.id]&&apChecked[m.id][ds]&&apChecked[m.id][ds].indexOf(sk)!==-1) {
          totalSlots++; totalAmt += apSlotPay(slot, m.id);
        }
      });
      // นับรอบพิเศษ (extra slots)
      dayExtraSlots.forEach(function(slot) {
        var sk = slot.start+'-'+slot.end;
        if (apChecked[m.id]&&apChecked[m.id][ds]&&apChecked[m.id][ds].indexOf(sk)!==-1) {
          totalSlots++; totalAmt += apExtraSlotPay(slot, m.id);
        }
      });
    });
    // Substitute info aggregated per substitute name
    var mSubMap = {};
    apDateRange.forEach(function(ds) {
      var subsForDate = (apCheckInSub[m.id] && apCheckInSub[m.id][ds]) || {};
      apSlotsForDay(new Date(ds).getDay()).forEach(function(slot) {
        var sk = slot.start+'-'+slot.end;
        var sub = subsForDate[sk];
        if (!sub || !sub.name) return;
        if (!mSubMap[sub.name]) mSubMap[sub.name] = { name: sub.name, contact: sub.contact||'', shifts: 0, amount: 0 };
        mSubMap[sub.name].shifts++;
        mSubMap[sub.name].amount += apSlotPay(slot, m.id);
      });
      // รวม substitute info จากรอบพิเศษ
      apGetExtraSlotsForDate(ds).forEach(function(slot) {
        var sk = slot.start+'-'+slot.end;
        var sub = subsForDate[sk];
        if (!sub || !sub.name) return;
        if (!mSubMap[sub.name]) mSubMap[sub.name] = { name: sub.name, contact: sub.contact||'', shifts: 0, amount: 0 };
        mSubMap[sub.name].shifts++;
        mSubMap[sub.name].amount += apExtraSlotPay(slot, m.id);
      });
    });
    var mSubList = Object.values ? Object.values(mSubMap) : Object.keys(mSubMap).map(function(k){ return mSubMap[k]; });
    var totalSubAmt = mSubList.reduce(function(s,x){ return s+x.amount; }, 0);
    // Payment method
    var pmMethod = _payMethodLabels[m.paymentMethod] || m.paymentMethod || '';
    var pmAccount = m.paymentAccount || '';
    grand += totalAmt;
    memberData.push({ m:m, dr:dr, totalSlots:totalSlots, totalAmt:totalAmt, pmMethod:pmMethod, pmAccount:pmAccount, mSubList:mSubList, totalSubAmt:totalSubAmt });
  });

  // ── Table Header ──
  var headerRow = '<tr style="background:linear-gradient(135deg,#1e3a5f,#0f2640)">' +
    '<th style="padding:9px 10px;' + B + ';font-size:11px;font-weight:700;color:#93c5fd;text-align:left">ชื่อ — ตำแหน่ง</th>' +
    '<th style="padding:9px 10px;' + B + ';font-size:11px;font-weight:700;color:#93c5fd;text-align:center">อัตราค่าจ้าง</th>' +
    '<th style="padding:9px 10px;' + B + ';font-size:11px;font-weight:700;color:#93c5fd;text-align:center">เบรคที่ทำงาน</th>' +
    '<th style="padding:9px 10px;' + B + ';font-size:11px;font-weight:700;color:#93c5fd;text-align:right">ค่าจ้างรวม</th>' +
    '<th style="padding:9px 10px;' + B + ';font-size:11px;font-weight:700;color:#93c5fd;text-align:left">วิธีรับเงิน</th></tr>';

  memberData.forEach(function(d, i) {
    var m = d.m, dr = d.dr;
    var rateTxt = dr.rate > 0 ? dr.rate.toLocaleString('th-TH') + ' ' + (RL[dr.type]||'') : '—';
    var rowBg = i % 2 === 0 ? 'background:#ffffff' : 'background:#f8fafc';
    // Sub note inline
    var subNote = '';
    d.mSubList.forEach(function(si) {
      subNote += '<div style="margin-top:3px;font-size:10px;padding:2px 6px;background:#fdf4ff;border-left:2px solid #a855f7;color:#7e22ce;border-radius:0 3px 3px 0">' +
        '↳ คนแทน: <strong>' + apEsc(si.name) + '</strong>' +
        (si.contact ? ' <span style="color:#aaa">(' + apEsc(si.contact) + ')</span>' : '') +
        ' — ' + si.shifts + ' เบรค — ' +
        '<strong style="color:#dc2626">' + si.amount.toLocaleString('th-TH') + ' ฿</strong></div>';
    });
    bodyRows += '<tr style="' + rowBg + '">' +
      '<td style="padding:9px 10px;' + B + ';vertical-align:top">' +
        '<div style="font-weight:700;font-size:13px;color:#1a1a1a">' + apEsc(m.name) + '</div>' +
        '<div style="font-size:11px;color:#6b7280">' + apEsc(m.position||'—') + '</div>' +
        subNote +
      '</td>' +
      '<td style="padding:9px 10px;' + B + ';text-align:center;vertical-align:top">' +
        '<div style="font-size:12px;color:#374151">' + rateTxt + '</div>' +
      '</td>' +
      '<td style="padding:9px 10px;' + B + ';text-align:center;vertical-align:top">' +
        '<div style="font-size:14px;font-weight:700;color:#1d4ed8">' + d.totalSlots + ' <span style="font-size:11px;font-weight:400;color:#6b7280">เบรค</span></div>' +
      '</td>' +
      '<td style="padding:9px 10px;' + B + ';text-align:right;vertical-align:top">' +
        '<div style="font-size:15px;font-weight:800;color:#115e59">' +
          (d.totalAmt > 0 ? d.totalAmt.toLocaleString('th-TH', {minimumFractionDigits:2}) + ' ฿' : '—') +
        '</div>' +
        (d.totalSubAmt > 0 ? '<div style="font-size:10px;color:#7c3aed;margin-top:3px">&#8627; จ่ายให้คนแทน ' + d.totalSubAmt.toLocaleString('th-TH') + ' ฿</div>' : '') +
      '</td>' +
      '<td style="padding:9px 10px;' + B + ';vertical-align:top">' +
        '<div style="font-size:11px;color:#374151">' + (d.pmMethod ? apEsc(d.pmMethod) : '<span style="color:#d1d5db">—</span>') + '</div>' +
        (d.pmAccount ? '<div style="font-size:10px;color:#555;font-family:monospace">' + apEsc(d.pmAccount) + '</div>' : '') +
      '</td></tr>';
  });

  // ── Grand total row ──
  bodyRows += '<tr style="background:linear-gradient(135deg,#fefce8,#fef3c7)">' +
    '<td colspan="3" style="text-align:right;padding:12px 10px;' + B + ';font-weight:700;font-size:14px;color:#1a1a1a">💰 รวมค่าจ้างสมาชิกทั้งหมด</td>' +
    '<td style="text-align:right;padding:12px 10px;' + B + ';font-weight:800;font-size:18px;color:#b45309">' + grand.toLocaleString('th-TH', {minimumFractionDigits:2}) + ' ฿</td>' +
    '<td style="padding:12px 10px;' + B + '"></td></tr>';

  var now = new Date();
  var nowStr = apFmtDate(now) + ' เวลา ' + now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ' น.';
  var docNo = 'PAY-' + (apDateRange[0]||'').replace(/-/g,'') + '-' + Date.now().toString().slice(-4);

  var html =
    // ── Document header (table layout — flex not reliable in html2canvas) ──
    '<table style="width:100%;border-bottom:3px solid #1e3a5f;padding-bottom:16px;margin-bottom:18px;border-collapse:collapse"><tr>' +
      '<td style="vertical-align:top;padding-bottom:16px">' +
        '<div style="font-size:10px;color:#888;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px">ใบแจ้งจ่ายเงินสมาชิก / Member Payment Slip</div>' +
        '<h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1a1a1a">' + apEsc(apBandName) + '</h1>' +
        '<div style="font-size:13px;color:#444;font-weight:600">ผู้จัดการวง: ' + apEsc(apBandManager||'—') + '</div>' +
        '<div style="font-size:13px;color:#666;margin-top:2px">ช่วงวันที่: ' + dt + '</div>' +
      '</td>' +
      '<td style="vertical-align:top;text-align:right;padding-bottom:16px;font-size:11px;color:#888;white-space:nowrap">' +
        '<div style="font-weight:700;color:#555;font-size:13px">เลขที่เอกสาร</div>' +
        '<div style="font-family:monospace;font-size:12px;color:#444">' + docNo + '</div>' +
        '<div style="margin-top:6px">วันที่พิมพ์: ' + nowStr + '</div>' +
      '</td>' +
    '</tr></table>' +
    // ── Table ──
    '<table style="width:100%;border-collapse:collapse">' +
    '<thead>' + headerRow + '</thead>' +
    '<tbody>' + bodyRows + '</tbody></table>' +
    // ── Footer branding ──
    '<div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;text-align:center">' +
      '<div style="font-size:10px;color:#b0b0b0;letter-spacing:.07em">' +
        '&#9656;&nbsp;<strong style="color:#c9a227;letter-spacing:.06em">BandThai</strong>&nbsp;&#9656;&nbsp;—&nbsp;แพลตฟอร์มบริหารจัดการวงดนตรีระดับมืออาชีพ · ออกแบบมาเพื่อวงดนตรียุคใหม่โดยเฉพาะ' +
      '</div>' +
    '</div>';

  apSaveAsImage(html, 'แจ้งจ่ายรายคน_' + (apDateRange[0]||'') + '.png');
}

/* ═══ INIT ══════════════════════════════════════════════════════════════ */
// ── Payroll History ──────────────────────────────────────────────
var _apDayNames = ['อา','จ','อ','พ','พฤ','ศ','ส'];

function apOpenHistoryModal() {
  var m = document.getElementById('apHistoryModal');
  if (m) { m.style.display = 'block'; apLoadHistory(); }
}

function apCloseHistoryModal() {
  var m = document.getElementById('apHistoryModal');
  if (m) m.style.display = 'none';
}

function apLoadHistory() {
  var el = document.getElementById('apHistoryContent');
  if (!el) return;
  el.innerHTML = '<p style="text-align:center;color:var(--premium-text-muted);padding:2rem">กำลังโหลด...</p>';

  var bandId = (typeof getBandId === 'function') ? getBandId() : '';
  if (!bandId) {
    el.innerHTML = '<p style="text-align:center;color:#e53e3e;padding:1rem">ไม่พบ Band ID</p>';
    return;
  }

  apiCall('getAllAttendancePayroll', { bandId: bandId, year: 'all', pageSize: 100, page: 1 }, function(res) {
    if (!res || !res.success || !res.data || res.data.length === 0) {
      el.innerHTML = '<p style="text-align:center;color:var(--premium-text-muted);padding:2rem">ยังไม่มีประวัติการบันทึก</p>';
      return;
    }
    apRenderHistoryList(el, res.data, res.total);
  });
}

function apRenderHistoryList(container, records, total) {
  var _dayColors = ['#c53030','#2b6cb0','#b7791f','#276749','#553c9a','#2c7a7b','#822727'];
  var rows = records.map(function(r) {
    var ts = {};
    try { ts = typeof r.timeSlots === 'string' ? JSON.parse(r.timeSlots) : (r.timeSlots || {}); } catch(e){}
    var sd = ts.startDate || r.date || '';
    var ed = ts.endDate || sd;
    var recType = ts.recordType || 'daily';
    var typeLabel = recType === 'weekly' ? 'รายสัปดาห์' : recType === 'monthly' ? 'รายเดือน' : 'รายวัน';

    // Format dates
    var sdObj = sd ? new Date(sd + 'T00:00:00') : null;
    var edObj = ed ? new Date(ed + 'T00:00:00') : null;
    var fmtDate = function(d) {
      if (!d) return '';
      return _apDayNames[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth()+1) + '/' + (d.getFullYear()+543);
    };
    var dateRange = fmtDate(sdObj);
    if (sd !== ed && edObj) dateRange += ' – ' + fmtDate(edObj);

    // Day color
    var dayColor = sdObj ? _dayColors[sdObj.getDay()] : '#4a5568';

    // Venue name
    var venueName = '-';
    if (r.venue) {
      var vns = apVenues || [];
      var vobj = vns.find(function(v){ return (v.id || v.name) === r.venue; });
      venueName = vobj ? (vobj.name || r.venue) : r.venue;
    }

    // Amount
    var amt = Number(r.totalAmount || 0);
    var amtStr = amt.toLocaleString('th-TH') + ' ฿';

    // Created date
    var createdAt = r.createdAt || r.created_at || '';
    var createdStr = '';
    if (createdAt) {
      var cDate = new Date(createdAt);
      createdStr = cDate.getDate() + '/' + (cDate.getMonth()+1) + '/' + (cDate.getFullYear()+543) + ' ' + String(cDate.getHours()).padStart(2,'0') + ':' + String(cDate.getMinutes()).padStart(2,'0');
    }

    var rid = r.id || '';
    return '<tr>' +
      '<td style="padding:8px 10px;font-size:13px;white-space:nowrap">' +
        '<span style="display:inline-block;background:' + dayColor + ';color:#fff;border-radius:4px;padding:2px 7px;font-weight:600;font-size:12px;margin-right:6px">' + typeLabel + '</span>' +
        dateRange +
      '</td>' +
      '<td style="padding:8px 10px;font-size:13px">' + apEscape(venueName) + '</td>' +
      '<td style="padding:8px 10px;font-size:13px;text-align:right;font-weight:700;color:#2b6cb0">' + amtStr + '</td>' +
      '<td style="padding:8px 10px;font-size:12px;color:var(--premium-text-muted);white-space:nowrap">' + createdStr + '</td>' +
      '<td style="padding:8px 10px;white-space:nowrap;text-align:center">' +
        '<button onclick="apViewHistoryRecord(' + JSON.stringify(rid) + ')" class="btn btn-secondary" style="font-size:12px;padding:3px 10px;margin-right:4px">🔍 ดู</button>' +
        '<button onclick="apDeleteHistoryRecord(' + JSON.stringify(rid) + ')" class="btn" style="font-size:12px;padding:3px 10px;background:#fed7d7;color:#c53030;border:1px solid #feb2b2">🗑 ลบ</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  container.innerHTML =
    '<p style="font-size:13px;color:var(--premium-text-muted);margin-bottom:12px">พบ ' + (total || records.length) + ' รายการ</p>' +
    '<div style="overflow-x:auto">' +
      '<table style="width:100%;border-collapse:collapse;font-family:inherit">' +
        '<thead>' +
          '<tr style="background:#f7fafc">' +
            '<th style="padding:8px 10px;text-align:left;font-size:13px;border-bottom:2px solid #e2e8f0">ช่วงวันที่</th>' +
            '<th style="padding:8px 10px;text-align:left;font-size:13px;border-bottom:2px solid #e2e8f0">สถานที่</th>' +
            '<th style="padding:8px 10px;text-align:right;font-size:13px;border-bottom:2px solid #e2e8f0">ยอดรวม</th>' +
            '<th style="padding:8px 10px;text-align:left;font-size:13px;border-bottom:2px solid #e2e8f0">บันทึกเมื่อ</th>' +
            '<th style="padding:8px 10px;text-align:center;font-size:13px;border-bottom:2px solid #e2e8f0">จัดการ</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody id="apHistoryTableBody">' + rows + '</tbody>' +
      '</table>' +
    '</div>';

  // Store records on window for quick lookup
  window._apHistoryRecords = records;
}

function apEscape(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function apViewHistoryRecord(id) {
  var records = window._apHistoryRecords || [];
  var r = records.find(function(x){ return x.id === id; });
  if (!r) return;

  var modal = document.getElementById('apHistoryDetailModal');
  var title = document.getElementById('apHistoryDetailTitle');
  var content = document.getElementById('apHistoryDetailContent');
  if (!modal || !content) return;

  var ts = {};
  try { ts = typeof r.timeSlots === 'string' ? JSON.parse(r.timeSlots) : (r.timeSlots || {}); } catch(e){}
  var sd = ts.startDate || r.date || '';
  var venueName = r.venue || '-';
  var vns = apVenues || [];
  var vobj = vns.find(function(v){ return (v.id || v.name) === r.venue; });
  if (vobj) venueName = vobj.name || r.venue;

  try { var sdObj = new Date(sd + 'T00:00:00'); title.textContent = '📅 ' + sdObj.getDate() + '/' + (sdObj.getMonth()+1) + '/' + (sdObj.getFullYear()+543) + ' — ' + apEscape(venueName); } catch(e) { title.textContent = 'รายละเอียด'; }

  var attendance = [];
  try { attendance = typeof r.attendance === 'string' ? JSON.parse(r.attendance) : (r.attendance || []); } catch(e) {}

  var memberRows = attendance.map(function(m) {
    var amt = Number(m.amount || 0);
    return '<tr>' +
      '<td style="padding:7px 10px;font-size:13px;border-bottom:1px solid #e2e8f0">' + apEscape(m.memberName || m.member_name || '-') + '</td>' +
      '<td style="padding:7px 10px;font-size:13px;border-bottom:1px solid #e2e8f0;color:var(--premium-text-muted)">' + apEscape(m.position || '-') + '</td>' +
      '<td style="padding:7px 10px;font-size:13px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#2b6cb0">' + amt.toLocaleString('th-TH') + ' ฿</td>' +
    '</tr>';
  }).join('');

  var totalAmt = Number(r.totalAmount || 0);

  content.innerHTML =
    '<div style="margin-bottom:14px;font-size:13px;color:var(--premium-text-muted)">' +
      '<strong style="color:#2d3748">สถานที่:</strong> ' + apEscape(venueName) +
      ' &nbsp;|&nbsp; <strong style="color:#2d3748">ยอดรวม:</strong> <span style="color:#2c7a7b;font-weight:700">' + totalAmt.toLocaleString('th-TH') + ' ฿</span>' +
    '</div>' +
    (attendance.length > 0 ?
      '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="background:#f7fafc">' +
          '<th style="padding:7px 10px;text-align:left;font-size:13px;border-bottom:2px solid #e2e8f0">สมาชิก</th>' +
          '<th style="padding:7px 10px;text-align:left;font-size:13px;border-bottom:2px solid #e2e8f0">ตำแหน่ง</th>' +
          '<th style="padding:7px 10px;text-align:right;font-size:13px;border-bottom:2px solid #e2e8f0">รับเงิน</th>' +
        '</tr></thead>' +
        '<tbody>' + memberRows + '</tbody>' +
        '<tfoot><tr style="background:#f7fafc;font-weight:700">' +
          '<td colspan="2" style="padding:8px 10px;font-size:13px;border-top:2px solid #e2e8f0">รวมทั้งหมด</td>' +
          '<td style="padding:8px 10px;font-size:13px;text-align:right;color:#2b6cb0;border-top:2px solid #e2e8f0">' + totalAmt.toLocaleString('th-TH') + ' ฿</td>' +
        '</tr></tfoot>' +
      '</table></div>'
    : '<p style="color:var(--premium-text-muted);text-align:center;padding:1rem">ไม่มีข้อมูลสมาชิก</p>');

  modal.style.display = 'block';
}

function apDeleteHistoryRecord(id) {
  if (!confirm('ต้องการลบรายการนี้?')) return;
  apiCall('deleteAttendancePayroll', { recordId: id }, function(res) {
    if (res && res.success) {
      apLoadHistory();
    } else {
      alert('ลบไม่สำเร็จ: ' + ((res && res.message) || 'ข้อผิดพลาดไม่ทราบสาเหตุ'));
    }
  });
}

function apApplyWeekRange() {
  var sd = apEl('startDate'), ed = apEl('endDate');
  if (!sd || !ed) return;
  var today = new Date();
  sd.value = today.toISOString().split('T')[0];
  ed.value = '';
}

function apInitPage() {
  if (_apInited) return;
  _apInited = true;
  // Show read-only notice for non-admin
  if (!apIsAdmin) {
    var notice = document.createElement('div');
    notice.style.cssText = 'background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#f59e0b;padding:10px 14px;border-radius:8px;margin-bottom:12px;font-size:0.88rem;text-align:center';
    notice.textContent = '👁️ ดูได้อย่างเดียว — การลงเวลาต้องทำโดยสมาชิกเอง (เฉพาะแอดมินที่แก้ไขแทนได้)';
    var container = document.querySelector('.container') || document.querySelector('.page-content');
    if (container) container.insertBefore(notice, container.firstChild);
  }
  var today = new Date(), todayStr = today.toISOString().split('T')[0];
  var wd = apEl('workDate'); if (wd) wd.value = todayStr;
  // Pre-select record type from manager's payroll settings
  var rt = apEl('recordType'); if (rt) rt.value = apRecordType;
  var sd = apEl('startDate'), ed = apEl('endDate');
  if (sd && ed) {
    apApplyWeekRange();
  }
  var my = apEl('monthYear');
  if (my) my.value = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
  apShowDateGroups();
  rt = apEl('recordType'); if (rt) rt.addEventListener('change', apShowDateGroups);
  var vs = apEl('venue'); if (vs) vs.addEventListener('change', function() { apVenueId = this.value; });
  var lb = apEl('apLoadBtn'); if (lb) lb.addEventListener('click', function() {
    apVenueId = (apEl('venue')||{}).value||'';
    apUpdateDateRange();
    apLoadCheckIns(function() { apRenderAttendance(); apRenderPayout(); apRenderPaymentInfo(); });
  });
  var sb = apEl('saveBtn'); if (sb) { sb.addEventListener('click', apDoSave); if (!apIsAdmin) { sb.disabled = true; sb.title = 'เฉพาะแอดมินที่บันทึกได้'; } }
  var hb = apEl('historyBtn'); if (hb) hb.addEventListener('click', apOpenHistoryModal);
  var vr = apEl('generateVenueReceiptBtn'); if (vr) vr.addEventListener('click', apPrintVenueReceipt);
  var mr = apEl('generateMemberReceiptBtn'); if (mr) mr.addEventListener('click', apPrintMemberReceipt);
  apLoadData();
}