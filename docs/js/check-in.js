/**
 * Member Self Check-In Page JavaScript
 * สมาชิกลงเวลาทำงานของตนเอง
 * BandFlow
 */

var ciCurrentBandId = null;
var ciMemberName = '';
var ciUserRole = '';
var ciBandSettings = { scheduleData: {}, venues: [] };
var ciSelectedVenue = '';
var ciSelectedDate = '';
var ciExistingCheckIn = null;
var ciIsSubstitute = false;
var ciLeaveType = 'all'; // 'all' = ลาทั้งวัน, 'some' = ลาบางรอบ

function ciGetEl(id) { return document.getElementById(id); }
function ciLocalDate(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }

function ciEscHtml(text) {
  if (!text) return '';
  var d = document.createElement('div'); d.textContent = text; return d.innerHTML;
}

function ciShowToast(message, type) {
  var toast = ciGetEl('toast');
  if (!toast) { alert(message); return; }
  var m = toast.querySelector('.toast-message') || toast;
  m.textContent = message;
  toast.style.background = type === 'error' ? '#c53030' : (type === 'success' ? '#276749' : 'var(--premium-gold)');
  toast.style.display = 'block'; toast.classList.add('show');
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { toast.style.display = 'none'; }, 300);
  }, 3500);
}

function ciSetStatus(msg, cls) {
  var el = ciGetEl('ciStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'ci-status ci-status--' + (cls || 'info');
  el.style.display = msg ? 'block' : 'none';
}

/* ===== DONE STATE (after check-in) ===== */
function ciShowDone(slots, venue, status) {
  var done = ciGetEl('ciDone');
  var form = ciGetEl('ciSubmitBtn') ? ciGetEl('ciSubmitBtn').closest('.card') : null;
  if (!done) return;
  var slotStr = (slots||[]).map(function(k){ var p=k.split('-'); return p[0]+' \u2013 '+p[1]; }).join(' \u00b7 ');
  var statusLabel = status === 'confirmed' ? '\u0e44\u0e14\u0e49\u0e23\u0e31\u0e1a\u0e01\u0e32\u0e23\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19' : status === 'leave' ? '\u0e25\u0e32' : '\u0e23\u0e2d\u0e1c\u0e39\u0e49\u0e08\u0e31\u0e14\u0e01\u0e32\u0e23\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19';
  ciGetEl('ciDoneSummary').textContent = '\u2705 ' + (status === 'leave' ? '\u0e25\u0e32\u0e07\u0e32\u0e19\u0e41\u0e25\u0e49\u0e27' : '\u0e25\u0e07\u0e40\u0e27\u0e25\u0e32\u0e41\u0e25\u0e49\u0e27') + ' (' + statusLabel + ')';
  ciGetEl('ciDoneDetail').textContent = (venue ? '\ud83d\udccd '+venue+' \u00b7 ' : '') + (slotStr ? '\u23f0 '+slotStr : '');
  done.style.display = 'block';
  // Hide form fields but keep done visible
  ['ciSlotsContainer','ciSubToggle','ciSubFields','ciNotes','ciSubmitBtn','ciLeaveBtn','ciLeaveForm','ciSelectAll','ciSelectNone','ciNoSlots'].forEach(function(id){
    var e = ciGetEl(id); if(e) e.style.display = 'none';
  });
  var shortcutRow = ciGetEl('ciSelectAll') ? ciGetEl('ciSelectAll').parentElement : null;
  if (shortcutRow) shortcutRow.style.display = 'none';
}

function ciHideDone() {
  var done = ciGetEl('ciDone');
  if (done) done.style.display = 'none';
  ['ciSlotsContainer','ciSubToggle','ciNotes','ciSubmitBtn','ciLeaveBtn','ciSelectAll','ciSelectNone'].forEach(function(id){
    var e = ciGetEl(id); if(e) e.style.display = '';
  });
  var shortcutRow = ciGetEl('ciSelectAll') ? ciGetEl('ciSelectAll').parentElement : null;
  if (shortcutRow) shortcutRow.style.display = '';
}

function ciCancelCheckIn() {
  if (!confirm('\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e01\u0e32\u0e23\u0e25\u0e07\u0e40\u0e27\u0e25\u0e32\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49\u0e43\u0e0a\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e44\u0e21\u0e48?')) return;
  var dateStr = ciSelectedDate;
  var btn = ciGetEl('ciCancelBtn');
  if (btn) { btn.disabled = true; btn.textContent = '\u23f3 \u0e01\u0e33\u0e25\u0e31\u0e07\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01...'; }
  apiCall('cancelCheckIn', { bandId: ciCurrentBandId, date: dateStr }, function(r) {
    if (btn) { btn.disabled = false; btn.textContent = '\u274c \u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e25\u0e07\u0e40\u0e27\u0e25\u0e32'; }
    if (r && r.success) {
      ciShowToast('\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e01\u0e32\u0e23\u0e25\u0e07\u0e40\u0e27\u0e25\u0e32\u0e40\u0e23\u0e35\u0e22\u0e1a\u0e23\u0e49\u0e2d\u0e22', 'success');
      ciExistingCheckIn = null;
      ciHideDone();
      ciSetStatus('', '');
      ciRenderSlots();
    } else {
      ciShowToast((r && r.message) || '\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14', 'error');
    }
  });
}

/* ===== LOAD SETTINGS ===== */
function ciLoadSettings(callback) {
  var stored = localStorage.getItem('bandSettings');
  if (stored) {
    try {
      var s = JSON.parse(stored);
      ciBandSettings = { scheduleData: s.scheduleData || s.schedule || {}, venues: s.venues || [] };
    } catch(e) {}
  }

  // Always try fetching from API for fresh data if possible
  if (ciCurrentBandId && typeof apiCall === 'function') {
    apiCall('getBandSettings', { bandId: ciCurrentBandId }, function(r) {
      if (r && r.success && r.data) {
        ciBandSettings = {
          scheduleData: r.data.scheduleData || r.data.schedule || {},
          venues: r.data.venues || []
        };
        try { localStorage.setItem('bandSettings', JSON.stringify(r.data)); } catch(e) {}
      }
      callback();
    });
  } else {
    callback();
  }
}

/* ===== RENDER VENUES ===== */
function ciRenderVenues() {
  var sel = ciGetEl('ciVenue');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- เลือกสถานที่ --</option>';
  var venues = ciBandSettings.venues || [];
  venues.forEach(function(v) {
    var name = v.name || v.venueName || String(v);
    var opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    if (name === ciSelectedVenue) opt.selected = true;
    sel.appendChild(opt);
  });
  if (!venues.length) {
    var opt = document.createElement('option');
    opt.value = 'ร้านหลัก'; opt.textContent = 'ร้านหลัก (ค่าเริ่มต้น)';
    sel.appendChild(opt);
  }
}

/* ===== GET TIME SLOTS FOR DATE ===== */
function ciGetSlotsForDate(dateStr) {
  var date = new Date(dateStr);
  var dow = date.getDay(); // 0=Sunday ... 6=Saturday
  var dayData = ciBandSettings.scheduleData[dow] || ciBandSettings.scheduleData[String(dow)];
  var slots = [];

  // New format: array of slot objects [{id, venueId, startTime, endTime, members}]
  if (Array.isArray(dayData) && dayData.length > 0) {
    slots = dayData;
  }
  // Old format: {timeSlots: [{startTime, endTime}]}
  else if (dayData && dayData.timeSlots && dayData.timeSlots.length > 0) {
    slots = dayData.timeSlots;
  }

  // Filter by selected venue if slots have venueId
  if (ciSelectedVenue && slots.length && slots[0] && slots[0].venueId !== undefined) {
    var venueId = ciGetVenueId(ciSelectedVenue);
    if (venueId) {
      var filtered = slots.filter(function(s) { return s.venueId === venueId; });
      if (filtered.length) slots = filtered;
    }
  }

  return slots.map(function(s) {
    var st = s.startTime || '', et = s.endTime || '';
    return { key: st + '-' + et, startTime: st, endTime: et, label: st + ' – ' + et };
  });
}

/* Lookup venue ID from venue name */
function ciGetVenueId(name) {
  var venues = ciBandSettings.venues || [];
  for (var i = 0; i < venues.length; i++) {
    var v = venues[i];
    var vName = v.name || v.venueName || String(v);
    if (vName === name) return v.id || v.venueId || '';
  }
  return '';
}

/* ===== RENDER SLOTS ===== */
function ciRenderSlots() {
  var container = ciGetEl('ciSlotsContainer');
  var noSlotsMsg = ciGetEl('ciNoSlots');
  if (!container) return;

  var date = ciGetEl('ciDate') ? ciGetEl('ciDate').value : ciSelectedDate;
  if (!date) { container.innerHTML = ''; if (noSlotsMsg) noSlotsMsg.style.display = 'block'; return; }
  ciSelectedDate = date;

  var slots = ciGetSlotsForDate(date);
  var existingSlots = (ciExistingCheckIn && ciExistingCheckIn.slots) ? ciExistingCheckIn.slots : [];

  if (noSlotsMsg) noSlotsMsg.style.display = 'none';

  var dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  var dow = new Date(date).getDay();
  var dayLabel = ciGetEl('ciDayLabel');
  if (dayLabel) dayLabel.textContent = dayNames[dow];

  container.innerHTML = slots.map(function(slot) {
    var checked = existingSlots.indexOf(slot.key) !== -1 ? ' checked' : '';
    return '<label class="ci-slot-label' + (checked ? ' checked' : '') + '">' +
      '<input type="checkbox" name="ciSlot" value="' + ciEscHtml(slot.key) + '"' + checked + '>' +
      '<span class="ci-slot-time">🕐 ' + ciEscHtml(slot.label) + '</span>' +
      '</label>';
  }).join('');

  // Visual toggle on check
  container.querySelectorAll('input[name="ciSlot"]').forEach(function(cb) {
    cb.addEventListener('change', function() {
      cb.closest('label').classList.toggle('checked', cb.checked);
    });
  });
}

/* ===== LOAD EXISTING CHECK-IN ===== */
function ciLoadExistingCheckIn() {
  var date = ciSelectedDate;
  var venue = ciSelectedVenue;
  if (!date) return;
  ciExistingCheckIn = null;
  ciSetStatus('', '');

  if (typeof apiCall !== 'function') { ciRenderSlots(); return; }
  apiCall('getMyCheckIn', { date: date, venue: venue, bandId: ciCurrentBandId }, function(r) {
    if (r && r.success && r.checkIn) {
      ciExistingCheckIn = r.checkIn;
      // Show done state if already checked in
      if (r.checkIn.status === 'confirmed' || r.checkIn.status === 'pending' || r.checkIn.status === 'leave') {
        ciShowDone(r.checkIn.slots, r.checkIn.venue, r.checkIn.status);
      }
    }
    ciRenderSlots();
  });
}

/* ===== SUBMIT CHECK-IN ===== */
function ciSubmit() {
  var date = ciGetEl('ciDate') ? ciGetEl('ciDate').value : '';
  var venue = ciGetEl('ciVenue') ? ciGetEl('ciVenue').value : '';
  var notes = ciGetEl('ciNotes') ? ciGetEl('ciNotes').value : '';
  var checkedSlots = Array.from(document.querySelectorAll('input[name="ciSlot"]:checked')).map(function(cb) { return cb.value; });

  if (!date) { ciShowToast('กรุณาเลือกวันที่', 'error'); return; }
  if (!venue) { ciShowToast('กรุณาเลือกสถานที่', 'error'); return; }
  if (!checkedSlots.length) { ciShowToast('กรุณาเลือกช่วงเวลาที่ทำงานอย่างน้อย 1 ช่วง', 'error'); return; }

  // Substitute validation
  var subToggle = ciGetEl('ciSubToggle');
  var isSubstitute = subToggle && subToggle.checked;
  var subName = '';
  var subContact = '';
  if (isSubstitute) {
    subName = (ciGetEl('ciSubName') ? ciGetEl('ciSubName').value : '').trim();
    subContact = (ciGetEl('ciSubContact') ? ciGetEl('ciSubContact').value : '').trim();
    if (!subName) { ciShowToast('กรุณาระบุชื่อคนแทน', 'error'); return; }
  }

  var submitBtn = ciGetEl('ciSubmitBtn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ กำลังบันทึก...'; }

  var payload = {
    bandId: ciCurrentBandId,
    date: date,
    venue: venue,
    slots: checkedSlots,
    notes: notes
  };
  // Add substitute info
  if (isSubstitute && subName) {
    payload.isSubstitute = true;
    payload.substituteName = subName;
    payload.substituteContact = subContact;
    payload.notes = (notes ? notes + ' | ' : '') + 'คนแทน: ' + subName + (subContact ? ' (' + subContact + ')' : '');
  }

  apiCall('memberCheckIn', payload, function(r) {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✅ บันทึกเวลาเข้างาน'; }
    if (r && r.success) {
      var msg = isSubstitute ? 'ลงเวลาแทน ' + subName + ' เรียบร้อยแล้ว' : (r.message || 'ลงเวลาเรียบร้อยแล้ว');
      ciShowToast(msg, 'success');
      ciSetStatus('✅ ' + msg + ' — รอผู้จัดการยืนยัน', 'success');
      ciExistingCheckIn = { slots: checkedSlots, status: 'pending', venue: venue };
      ciShowDone(checkedSlots, venue, 'pending');
    } else {
      ciShowToast((r && r.message) || 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
    }
  });
}

/* ===== INIT ===== */

/* ===== SIMPLE LEAVE (inline form) ===== */
function ciRenderLeaveSlots() {
  var container = ciGetEl('ciLeaveSlotsContainer');
  if (!container) return;
  var dateStr = ciSelectedDate || (ciGetEl('ciDate') ? ciGetEl('ciDate').value : '');
  if (!dateStr) { container.innerHTML = '<p style="font-size:12px;color:#999">เลือกวันที่ก่อน</p>'; return; }
  var slots = ciGetSlotsForDate(dateStr);
  if (!slots.length) { container.innerHTML = '<p style="font-size:12px;color:#999">ไม่พบรอบเวลาสำหรับวันนี้</p>'; return; }
  container.innerHTML = slots.map(function(slot) {
    return '<label class="ci-leave-slot-label">' +
      '<input type="checkbox" name="ciLeaveSlot" value="' + ciEscHtml(slot.key) + '">' +
      '<span>🕰️ ' + ciEscHtml(slot.label) + '</span>' +
      '</label>';
  }).join('');
  // Toggle visual check
  container.querySelectorAll('input[name="ciLeaveSlot"]').forEach(function(cb) {
    cb.addEventListener('change', function() {
      cb.closest('label').classList.toggle('checked', cb.checked);
    });
  });
}

function ciSubmitLeaveSimple() {
  var noSub = ciGetEl('ciLeaveNoSub') && ciGetEl('ciLeaveNoSub').checked;
  var subName = (ciGetEl('ciLeaveSubNameSimple') ? ciGetEl('ciLeaveSubNameSimple').value : '').trim();
  if (!noSub && !subName) { ciShowToast('กรุณากรอกชื่อคนแทน หรือเลือก "ไม่มีคนแทน"', 'error'); return; }
  if (noSub) subName = '';

  var date = ciSelectedDate || '';
  var venue = ciSelectedVenue || '';

  // Determine leave slots based on leave type
  var leaveSlots = [];
  if (ciLeaveType === 'some') {
    leaveSlots = Array.from(document.querySelectorAll('input[name="ciLeaveSlot"]:checked')).map(function(cb) { return cb.value; });
    if (!leaveSlots.length) { ciShowToast('กรุณาเลือกรอบที่ต้องการลาอย่างน้อย 1 รอบ', 'error'); return; }
  } else {
    // ลาทั้งวัน — get all slots for that day
    var allSlots = ciGetSlotsForDate(date);
    leaveSlots = allSlots.map(function(s) { return s.key; });
  }
  var reason = ciLeaveType === 'some' ? 'ลาบางรอบ' : 'ลางาน (ทั้งวัน)';

  var btn = ciGetEl('ciLeaveSubmitSimple');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...'; }

  var payload = {
    bandId: ciCurrentBandId,
    memberId: localStorage.getItem('userId') || localStorage.getItem('odooMemberId') || localStorage.getItem('memberId') || '',
    memberName: ciMemberName,
    date: date,
    venue: venue,
    slots: JSON.stringify(leaveSlots),
    reason: reason + (noSub ? ' (ไม่มีคนแทน)' : ''),
    substituteName: subName,
    substituteContact: ''
  };

  if (typeof apiCall === 'function') {
    apiCall('requestLeave', payload, function(r) {
      if (btn) { btn.disabled = false; btn.textContent = '✅ ยืนยันลา'; }
      if (r && r.success) {
        var leaveLabel = ciLeaveType === 'some' ? 'ลาบางรอบ' : 'ลาทั้งวัน';
        ciShowToast('บันทึก' + leaveLabel + 'เรียบร้อย' + (subName ? ' — คนแทน: ' + subName : ' (ไม่มีคนแทน)'), 'success');
        var form = ciGetEl('ciLeaveForm');
        if (form) form.classList.remove('show');
        ciGetEl('ciLeaveSubNameSimple').value = '';
        ciExistingCheckIn = { slots: leaveSlots, status: 'leave', venue: venue };
        ciShowDone(leaveSlots, venue, 'leave');
      } else {
        ciShowToast((r && r.message) || 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
      }
    });
  } else {
    if (btn) { btn.disabled = false; btn.textContent = '✅ ยืนยันลา'; }
    window.location.href = 'leave.html?date=' + encodeURIComponent(date) + '&sub=' + encodeURIComponent(subName);
  }
}

/* ===== INIT (continued) ===== */
document.addEventListener('DOMContentLoaded', function() {
  ciCurrentBandId = localStorage.getItem('bandId') || '';
  ciMemberName = localStorage.getItem('userName') || 'คุณ';
  ciUserRole = localStorage.getItem('userRole') || 'member';

  // Set today's date
  var today = ciLocalDate(new Date());
  ciSelectedDate = today;
  var dateInput = ciGetEl('ciDate');
  if (dateInput) { dateInput.value = today; }

  // Show member name
  var nameEl = ciGetEl('ciMemberName');
  if (nameEl) { nameEl.textContent = ciMemberName; }

  // Show role badge
  var roleBadge = ciGetEl('ciRoleBadge');
  if (roleBadge) {
    var roleLabels = { admin: 'แอดมิน · ผู้จัดการวง', manager: 'ผู้จัดการวง', member: 'สมาชิก' };
    roleBadge.textContent = roleLabels[ciUserRole] || ciUserRole;
    roleBadge.className = 'ci-role-badge ci-role-badge--' + ciUserRole;
  }

  // Load settings then render
  ciLoadSettings(function() {
    ciRenderVenues();
    ciLoadExistingCheckIn();
  });

  // Date change
  if (dateInput) {
    dateInput.addEventListener('change', function() {
      ciSelectedDate = this.value;
      ciExistingCheckIn = null;
      ciHideDone();
      ciLoadExistingCheckIn();
    });
  }

  // Venue change
  var venueEl = ciGetEl('ciVenue');
  if (venueEl) {
    venueEl.addEventListener('change', function() {
      ciSelectedVenue = this.value;
      ciExistingCheckIn = null;
      ciLoadExistingCheckIn();
    });
  }

  // Substitute toggle
  var subToggle = ciGetEl('ciSubToggle');
  if (subToggle) {
    subToggle.addEventListener('change', function() {
      var fields = ciGetEl('ciSubFields');
      if (fields) {
        fields.classList.toggle('active', this.checked);
        if (!this.checked) {
          var sn = ciGetEl('ciSubName'); if (sn) sn.value = '';
          var sc = ciGetEl('ciSubContact'); if (sc) sc.value = '';
        }
      }
      ciIsSubstitute = this.checked;
      var btn = ciGetEl('ciSubmitBtn');
      if (btn) btn.textContent = this.checked ? '🔄 บันทึกเวลา (คนแทน)' : '✅ บันทึกเวลาเข้างาน';
    });
  }

  // Submit button
  var submitBtn = ciGetEl('ciSubmitBtn');
  if (submitBtn) submitBtn.addEventListener('click', ciSubmit);

  // Edit & Cancel buttons in done state
  var editBtn = ciGetEl('ciEditBtn');
  if (editBtn) editBtn.addEventListener('click', function() {
    ciHideDone();
    ciRenderSlots();
  });
  var cancelBtn = ciGetEl('ciCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', ciCancelCheckIn);

  // ===== SIMPLE LEAVE BUTTON =====
  var leaveBtn = ciGetEl('ciLeaveBtn');
  var leaveForm = ciGetEl('ciLeaveForm');
  if (leaveBtn && leaveForm) {
    leaveBtn.addEventListener('click', function() {
      leaveForm.classList.toggle('show');
      if (leaveForm.classList.contains('show')) {
        ciRenderLeaveSlots();
      }
    });
    // Leave type toggle (all / some)
    var leaveTypeAll = ciGetEl('ciLeaveTypeAll');
    var leaveTypeSome = ciGetEl('ciLeaveTypeSome');
    var leaveSlotsWrap = ciGetEl('ciLeaveSlotsWrap');
    if (leaveTypeAll && leaveTypeSome) {
      leaveTypeAll.addEventListener('click', function() {
        ciLeaveType = 'all';
        leaveTypeAll.classList.add('active');
        leaveTypeSome.classList.remove('active');
        if (leaveSlotsWrap) leaveSlotsWrap.classList.remove('show');
      });
      leaveTypeSome.addEventListener('click', function() {
        ciLeaveType = 'some';
        leaveTypeSome.classList.add('active');
        leaveTypeAll.classList.remove('active');
        if (leaveSlotsWrap) leaveSlotsWrap.classList.add('show');
        ciRenderLeaveSlots();
      });
    }
    var leaveCancelBtn = ciGetEl('ciLeaveCancelSimple');
    if (leaveCancelBtn) leaveCancelBtn.addEventListener('click', function() {
      leaveForm.classList.remove('show');
      var inp = ciGetEl('ciLeaveSubNameSimple');
      if (inp) inp.value = '';
    });
    var leaveSubmitBtn = ciGetEl('ciLeaveSubmitSimple');
    if (leaveSubmitBtn) leaveSubmitBtn.addEventListener('click', ciSubmitLeaveSimple);
    var _ciNoSub = ciGetEl('ciLeaveNoSub');
    if (_ciNoSub) _ciNoSub.addEventListener('change', function() {
      var inp = ciGetEl('ciLeaveSubNameSimple');
      if (inp) { inp.disabled = this.checked; inp.style.opacity = this.checked ? '0.4' : '1'; if (this.checked) inp.value = ''; }
    });
  }

  // Select all / None shortcuts
  var selAll = ciGetEl('ciSelectAll');
  if (selAll) selAll.addEventListener('click', function() {
    document.querySelectorAll('input[name="ciSlot"]').forEach(function(cb) {
      cb.checked = true; cb.closest('label').classList.add('checked');
    });
  });
  var selNone = ciGetEl('ciSelectNone');
  if (selNone) selNone.addEventListener('click', function() {
    document.querySelectorAll('input[name="ciSlot"]').forEach(function(cb) {
      cb.checked = false; cb.closest('label').classList.remove('checked');
    });
  });
});
