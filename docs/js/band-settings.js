/* ══════════════════════════════════════════
   Band Settings — Horizontal Timetable
   v2: venues (names only) + schedule flat + payroll
══════════════════════════════════════════ */

/* ── State ─────────────────────────────────────────── */
var currentBandId      = null;
var currentBandManager = null;
var bandNameVal        = '';
var venues = [];   // [{id, name}]
var schedule = {}; // {dayOfWeek: [{id, venueId, startTime, endTime, members:[{memberId,rate,rateType}]}]}
var payroll  = { period: 'daily', weekStart: 1, weekEnd: 0 };
var bandMembersData = [];
var profileMembers  = [];   // profiles with band_id + status=active
var currentInviteCode   = null;
var currentInviteExpires = null;
var notificationsEnabled = false;
var notifExternalMins    = 1440;
var notifFirstSlotMins   = 60;
var notifNextSlotMins    = 5;

var _editDay    = -1;
var _editSlotId = null;
var _detailDay  = -1;
var _detailSlotId = null;

/* ── Helpers ────────────────────────────────────────── */
function getEl(id) { return document.getElementById(id); }
function esc(text) {
  if (!text) return '';
  var d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}
function showToast(msg, type) {
  var toast = getEl('toast');
  if (!toast) { alert(msg); return; }
  var m = toast.querySelector('.toast-message');
  if (m) m.textContent = msg;
  toast.className = 'toast' + (type === 'error' ? ' toast-error' : type === 'success' ? ' toast-success' : '');
  toast.style.display = 'block';
  toast.classList.add('show');
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { toast.style.display = 'none'; }, 300);
  }, 3000);
}
function timeToMin(t) {
  if (!t || typeof t !== 'string') return null;
  var p = t.split(':');
  if (p.length < 2) return null;
  var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
function minToTime(min) {
  var h = Math.floor(min / 60) % 24, m = min % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
function autoFormatTime(inp) {
  inp.addEventListener('input', function() {
    var raw = this.value.replace(/[^0-9]/g, '');
    if (raw.length >= 3) raw = raw.substring(0, 2) + ':' + raw.substring(2, 4);
    this.value = raw;
  });
}

var DAY_NAMES  = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
var SLOT_COLORS = [
  {bg:'#f6ad55',text:'#7b341e'}, {bg:'#63b3ed',text:'#1a365d'},
  {bg:'#68d391',text:'#1c4532'}, {bg:'#fc8181',text:'#742a2a'},
  {bg:'#b794f4',text:'#44337a'}, {bg:'#f687b3',text:'#702459'},
  {bg:'#76e4f7',text:'#065666'}, {bg:'#faf089',text:'#744210'}
];
var POSITIONS = [
  'นักร้อง (Vocal)','นักร้องนำ (Lead Vocal)','นักร้องประสาน (Backing Vocal)',
  'กีตาร์นำ (Lead Guitar)','กีตาร์ริธึม (Rhythm Guitar)','เบส (Bass Guitar)',
  'กลองชุด (Drum Set)','เปอร์คัชชัน (Percussion)','กาออน (Cajon)',
  'คีย์บอร์ด (Keyboard)','เปียโน (Piano)','ออร์แกน (Organ)',
  'ซักโซโฟน (Saxophone)','ทรัมเป็ต (Trumpet)','ทรอมโบน (Trombone)','ฟลุต (Flute)',
  'ไวโอลิน (Violin)','เชลโล (Cello)','อุคูเลเล (Ukulele)',
  'DJ / โปรแกรมเมอร์','เสียง (Sound Engineer)','อื่นๆ'
];
var BANNED_GENRE_OPTIONS = ['ป๊อป','ร็อค','ดิสโก้','แร็ฟ/ฮิปฮอป','ลูกทุ่ง / อีสาน','เพื่อชีวิต','อาร์แอนด์บี','แจ๊ส / บลูส์','เรกเก้','อินดี้'];

function getVenueColor(venueId) {
  var idx = venues.findIndex(function(v) { return v.id === venueId; });
  return SLOT_COLORS[(idx < 0 ? 0 : idx) % SLOT_COLORS.length];
}
function getVenueName(venueId) {
  var v = venues.find(function(v) { return v.id === venueId; });
  return v ? v.name : '?';
}

/* ══════════════════════════════════════════
   PAYLOAD / AUTO-SAVE / SAVE
══════════════════════════════════════════ */
function _buildFullPayload() {
  var bName = (getEl('bandName') && getEl('bandName').value.trim()) || bandNameVal;
  var bMgr  = (getEl('bandManager') && getEl('bandManager').value.trim()) || currentBandManager;
  var validVenues  = venues.filter(function(v) { return v.name && v.name.trim(); });
  var validMembers = bandMembersData.filter(function(m) { return m.name && m.name.trim(); });
  // hourlyRates for backend compat
  var hourlyRates = [];
  Object.keys(schedule).forEach(function(day) {
    (schedule[day] || []).forEach(function(slot) {
      (slot.members || []).forEach(function(mr) {
        if (mr.memberId && mr.rate > 0) {
          hourlyRates.push({ dayOfWeek: parseInt(day), startTime: slot.startTime, endTime: slot.endTime, memberId: mr.memberId, hourlyRate: mr.rate, rateType: mr.rateType || 'shift', venueId: slot.venueId });
        }
      });
    });
  });
  return {
    bandId: currentBandId || ('BAND_' + Date.now()),
    bandName: bName, bandManager: bMgr,
    venues: validVenues, members: validMembers,
    schedule: schedule, payroll: payroll,
    hourlyRates: hourlyRates,
    inviteCode: currentInviteCode, inviteExpires: currentInviteExpires,
    notifications_enabled: notificationsEnabled,
    notif_external_mins:   notifExternalMins,
    notif_first_slot_mins: notifFirstSlotMins,
    notif_next_slot_mins:  notifNextSlotMins,
    discount_wage_enabled: (document.getElementById('discountWageToggle') ? document.getElementById('discountWageToggle').checked : false),
    discount_wage_rules: JSON.stringify(_dwRules || []),
    updatedAt: new Date().toISOString()
  };
}


function autoSaveLocal() {
  try {
    var d = _buildFullPayload();
    localStorage.setItem('bandSettings', JSON.stringify(d));
    if (d.bandId)      localStorage.setItem('bandId',      d.bandId);
    if (d.bandName)    localStorage.setItem('bandName',    d.bandName);
    if (d.bandManager) localStorage.setItem('bandManager', d.bandManager);
  } catch(e) {}
}

function _doSave(data, btn, origText, successMsg) {
  function onSuccess() {
    currentBandId = data.bandId; bandNameVal = data.bandName; currentBandManager = data.bandManager;
    localStorage.setItem('bandSettings', JSON.stringify(data));
    localStorage.setItem('bandId', data.bandId);
    localStorage.setItem('bandName', data.bandName);
    localStorage.setItem('bandManager', data.bandManager);
    if (btn) { btn.disabled = false; btn.textContent = origText; }
    showToast(successMsg || 'บันทึกเรียบร้อย ✅', 'success');
  }
  function onFail(msg) {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
    showToast(msg || 'ไม่สามารถบันทึกได้ ❌', 'error');
  }
  if (typeof apiCall === 'function') {
    apiCall('saveBandSettings', data, function(r) { if (r && r.success) onSuccess(); else onFail(r && r.message); });
  } else { onSuccess(); }
}

function saveBandInfo(btn) {
  if (!(getEl('bandName') && getEl('bandName').value.trim())) { showToast('กรุณากรอกชื่อวง', 'error'); return; }
  var orig = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
  _doSave(_buildFullPayload(), btn, orig, 'บันทึกข้อมูลวงเรียบร้อย ✅');
}
function saveMembers(btn) {
  var orig = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
  _doSave(_buildFullPayload(), btn, orig, 'บันทึกสมาชิกเรียบร้อย ✅');
}
function saveVenueNames(btn) {
  var orig = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
  _doSave(_buildFullPayload(), btn, orig, 'บันทึกร้านเรียบร้อย ✅');
}
function savePayroll(btn) {
  var sel = getEl('payrollPeriod'); if (sel) payroll.period = sel.value;
  var ws = getEl('weekStart');      if (ws)  payroll.weekStart = parseInt(ws.value, 10);
  var we = getEl('weekEnd');        if (we)  payroll.weekEnd   = parseInt(we.value, 10);
  var orig = btn ? btn.textContent : ''; if (btn) { btn.disabled = true; btn.textContent = 'บันทึก...'; }
  _doSave(_buildFullPayload(), btn, orig, 'บันทึกการตั้งค่าค่าแรงเรียบร้อย ✅');
}
function saveBandSettings() {
  var btn = getEl('saveBtn'); var orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
  _doSave(_buildFullPayload(), btn, orig, 'บันทึกทั้งหมดเรียบร้อย ✅');
}

/* ══════════════════════════════════════════
   LOAD
══════════════════════════════════════════ */
function loadBandSettings() {
  currentBandId      = localStorage.getItem('bandId') || sessionStorage.getItem('bandId');
  bandNameVal        = localStorage.getItem('bandName') || '';
  currentBandManager = localStorage.getItem('bandManager') || localStorage.getItem('userName') || '';

  var stored = localStorage.getItem('bandSettings');
  if (stored) {
    try {
      var s = JSON.parse(stored);
      if (s.bandName)    bandNameVal        = s.bandName;
      if (s.bandManager) currentBandManager = s.bandManager;
      // Venues — new format: [{id,name}], old format: [{id,name,address,phone,schedule}]
      if (s.venues) {
        venues = s.venues.map(function(v) {
          return { id: v.id || v.venueId || ('venue_' + Math.random().toString(36).substr(2,6)), name: v.name || v.venueName || '', breakMinutes: v.breakMinutes || 0, bannedGenres: v.bannedGenres || [] };
        });
      }
      // Schedule — new flat format
      if (s.schedule && typeof s.schedule === 'object' && !Array.isArray(s.schedule)) {
        // Check if it's new format (values are arrays of slot objects with id/venueId)
        var keys = Object.keys(s.schedule);
        var isNew = keys.length === 0 || (s.schedule[keys[0]] && Array.isArray(s.schedule[keys[0]]) && s.schedule[keys[0]][0] && s.schedule[keys[0]][0].venueId !== undefined);
        if (isNew) {
          schedule = s.schedule;
        } else {
          // Old format: schedule[day].timeSlots (from scheduleData / buildScheduleData)
          schedule = {};
          keys.forEach(function(day) {
            var dayData = s.schedule[day];
            var slots = dayData.timeSlots || [];
            if (slots.length) {
              schedule[day] = slots.map(function(slot) {
                return {
                  id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                  venueId: slot.venueId || (venues[0] && venues[0].id) || '',
                  startTime: slot.startTime || '', endTime: slot.endTime || '',
                  members: (slot.members || []).map(function(mr) {
                    return { memberId: mr.memberId || '', rate: mr.hourlyRate || mr.rate || 0, rateType: mr.rateType || 'shift' };
                  })
                };
              });
            }
          });
        }
      } else if (s.venues) {
        // Very old format: schedule embedded in venues[].schedule[day].timeSlots
        schedule = {};
        s.venues.forEach(function(v) {
          var vid = v.id || v.venueId || '';
          Object.keys(v.schedule || {}).forEach(function(day) {
            if (!schedule[day]) schedule[day] = [];
            (v.schedule[day].timeSlots || []).forEach(function(slot) {
              schedule[day].push({
                id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
                venueId: vid, startTime: slot.startTime || '', endTime: slot.endTime || '',
                members: (slot.members || []).map(function(mr) {
                  return { memberId: mr.memberId || '', rate: mr.hourlyRate || mr.rate || 0, rateType: 'shift' };
                })
              });
            });
          });
        });
      }
      if (s.payroll) payroll = Object.assign({ period: 'daily', weekStart: 1, weekEnd: 0 }, s.payroll);
      if (s.members)  bandMembersData = s.members;
      if (s.inviteCode) { currentInviteCode = s.inviteCode; currentInviteExpires = s.inviteExpires || null; }
    } catch(e) {}
  }
  renderAll();

  // Silent server refresh
  if (currentBandId && typeof apiCall === 'function') {
    apiCall('getBandSettings', { bandId: currentBandId }, function(r) {
      if (r && r.success && r.data) {
        var d = r.data;
        if (d.bandName)    bandNameVal        = d.bandName;
        if (d.bandManager) currentBandManager = d.bandManager;
        if (d.venues)  venues = d.venues.map(function(v) { return { id: v.id || v.venueId || ('venue_' + Math.random().toString(36).substr(2,6)), name: v.name || v.venueName || '', breakMinutes: v.breakMinutes || 0, bannedGenres: v.bannedGenres || [] }; });
        if (d.schedule && typeof d.schedule === 'object') schedule = d.schedule;
        if (d.payroll) payroll = Object.assign({ period: 'daily', weekStart: 1, weekEnd: 0 }, d.payroll);
        if (d.members) bandMembersData = d.members;
        if (d.inviteCode) { currentInviteCode = d.inviteCode; currentInviteExpires = d.inviteExpires || null; }
        notificationsEnabled = !!d.notifications_enabled;
        if (d.discount_wage_enabled !== undefined) {
          toggleDiscountWageUI(!!d.discount_wage_enabled, false);
        }
        if (d.discount_wage_rules) {
          try {
            _dwRules = typeof d.discount_wage_rules === 'string' ? JSON.parse(d.discount_wage_rules) : d.discount_wage_rules;
          } catch(e) { _dwRules = []; }
          renderDWRules();
        }
        notifExternalMins  = d.notif_external_mins || 1440;
        notifFirstSlotMins = d.notif_first_slot_mins || 60;
        notifNextSlotMins  = d.notif_next_slot_mins || 5;
        // ถ้า server ไม่ส่ง inviteCode กลับมา ให้ดึงจาก invite_codes table
        if (!currentInviteCode) {
          apiCall('getBandCode', { bandId: currentBandId }, function(r2) {
            if (r2 && r2.success && r2.code) {
              currentInviteCode = r2.code;
              var s2 = JSON.parse(localStorage.getItem('bandSettings') || '{}');
              s2.inviteCode = r2.code; s2.inviteExpires = null;
              localStorage.setItem('bandSettings', JSON.stringify(s2));
              renderBandCode();
            }
          });
        }
        renderAll();
      }
    });
  }
}

/* ══════════════════════════════════════════
   RENDER ALL
══════════════════════════════════════════ */
function renderAll() {
  updateDWVenueDropdown();
  updateBandInfo();
  renderMembers();
  renderVenueNames();
  renderScheduleGrid();
  // ดึงรหัสประจำวงจาก DB ถ้ายังไม่มีใน localStorage
  if (!currentInviteCode && currentBandId && typeof apiCall === 'function') {
    apiCall('getBandCode', { bandId: currentBandId }, function(r) {
      if (r && r.success && r.code) {
        currentInviteCode = r.code;
        var s = JSON.parse(localStorage.getItem('bandSettings') || '{}');
        s.inviteCode = r.code; s.inviteExpires = null;
        localStorage.setItem('bandSettings', JSON.stringify(s));
        renderBandCode();
      }
    });
  }
  renderBandCode();
  loadPendingMembers();
  loadProfileMembers();
  renderPayrollSettings();
}
function updateBandInfo() {
  var e = getEl('bandName');    if (e) e.value = bandNameVal        || '';
  var m = getEl('bandManager'); if (m) m.value = currentBandManager || '';
}

/* ══════════════════════════════════════════
   BAND CODE (รหัสประจำวง — ใช้ได้ตลอด)
══════════════════════════════════════════ */
function renderBandCode() {
  var disp = getEl('inviteCodeDisplay'), copyBtn = getEl('copyInviteBtn'), shareBtn = getEl('shareInviteBtn');
  if (!disp) return;
  if (currentInviteCode) {
    disp.textContent = currentInviteCode; disp.classList.remove('empty');
    if (copyBtn) copyBtn.style.display = 'inline-flex';
    if (shareBtn) shareBtn.style.display = 'inline-flex';
    // ซ่อนปุ่มสร้าง ถ้ามีรหัสแล้ว
    var genBtn = getEl('genInviteBtn');
    if (genBtn) genBtn.textContent = '🔄 สร้างรหัสใหม่';
  } else {
    disp.textContent = 'ยังไม่มีรหัสประจำวง'; disp.classList.add('empty');
    if (copyBtn) copyBtn.style.display = 'none';
    if (shareBtn) shareBtn.style.display = 'none';
  }
}
function generateBandCode() {
  var btn = getEl('genInviteBtn'); if (btn) { btn.disabled = true; btn.textContent = 'กำลังสร้าง...'; }
  function done(code) {
    currentInviteCode = code; currentInviteExpires = null; renderBandCode();
    showToast('รหัสประจำวง: ' + code);
    if (btn) { btn.disabled = false; btn.textContent = '🔄 สร้างรหัสใหม่'; }
  }
  if (typeof apiCall === 'function' && currentBandId) {
    apiCall('generateInviteCode', { bandId: currentBandId }, function(r) {
      if (r && r.success) {
        var s = JSON.parse(localStorage.getItem('bandSettings') || '{}');
        s.inviteCode = r.data.code; s.inviteExpires = null;
        localStorage.setItem('bandSettings', JSON.stringify(s));
        done(r.data.code);
      } else { showToast((r && r.message) || 'เกิดข้อผิดพลาด'); if (btn) { btn.disabled = false; btn.textContent = '🔑 สร้างรหัสประจำวง'; } }
    });
  } else {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', code = '';
    for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    var s = JSON.parse(localStorage.getItem('bandSettings') || '{}');
    s.inviteCode = code; s.inviteExpires = null;
    localStorage.setItem('bandSettings', JSON.stringify(s));
    done(code);
  }
}
function copyBandCode() {
  if (!currentInviteCode) return;
  var msg = 'คัดลอกรหัส ' + currentInviteCode + ' แล้ว';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(currentInviteCode).then(function() {
      showToast(msg);
    }).catch(function() {
      _fallbackCopyText(currentInviteCode);
      showToast(msg);
    });
  } else {
    _fallbackCopyText(currentInviteCode);
    showToast(msg);
  }
}
function _fallbackCopyText(text) {
  var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly','');
  t.style.position = 'fixed'; t.style.left = '-9999px';
  document.body.appendChild(t); t.focus(); t.select();
  try { document.execCommand('copy'); } catch(e) { console.warn('[copy] fallback failed', e); }
  document.body.removeChild(t);
}
function shareInviteLink() {
  if (!currentInviteCode) return;
  var baseUrl = location.origin + location.pathname.replace(/[^/]*$/, '');
  var url = baseUrl + 'register.html?invite=' + encodeURIComponent(currentInviteCode);
  var text = 'เข้าร่วมวง ' + (bandNameVal || 'ของเรา') + ' บน BandThai!\nสมัครฟรี ใช้งานได้ทันที';
  if (navigator.share) {
    navigator.share({ title: 'เข้าร่วมวง — BandThai', text: text, url: url }).catch(function() {});
  } else {
    // Fallback: copy link
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function() { showToast('คัดลอกลิงก์เชิญแล้ว'); });
    } else {
      _fallbackCopyText(url);
      showToast('คัดลอกลิงก์เชิญแล้ว');
    }
  }
}

/* ══════════════════════════════════════════
   PENDING MEMBERS (อนุมัติสมาชิก)
══════════════════════════════════════════ */
function loadPendingMembers() {
  var box = getEl('pendingMembersBox'), list = getEl('pendingMembersList');
  if (!box || !list) return;
  if (typeof apiCall !== 'function' || !currentBandId) return;
  apiCall('getPendingMembers', { bandId: currentBandId }, function(r) {
    if (!r || !r.success || !r.data || r.data.length === 0) {
      box.style.display = 'none'; return;
    }
    box.style.display = '';
    list.innerHTML = r.data.map(function(m) {
      var name = (m.nickname || m.first_name || m.user_name || m.email || '?');
      var detail = (m.instrument ? m.instrument + ' · ' : '') + (m.email || '');
      var created = m.created_at ? formatThaiDateFull(new Date(m.created_at)) : '';
      return '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--premium-off-white);border-radius:var(--radius-sm);margin-bottom:6px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:120px">' +
          '<div style="font-weight:700;font-size:var(--text-sm)">' + esc(name) + '</div>' +
          '<div style="font-size:var(--text-xs);color:var(--premium-text-muted)">' + esc(detail) + (created ? ' · ' + created : '') + '</div>' +
        '</div>' +
        '<button class="btn btn-sm btn-primary" style="padding:4px 12px" onclick="approveMember(\'' + esc(m.id) + '\')">✅ อนุมัติ</button>' +
        '<button class="btn btn-sm" style="padding:4px 12px;background:#e53e3e;color:#fff" onclick="rejectMember(\'' + esc(m.id) + '\')">❌ ปฏิเสธ</button>' +
      '</div>';
    }).join('');
  });
}
function approveMember(userId) {
  if (!confirm('อนุมัติสมาชิกคนนี้เข้าร่วมวง?')) return;
  apiCall('approveMember', { userId: userId, bandId: currentBandId }, function(r) {
    if (r && r.success) { showToast('อนุมัติเรียบร้อย'); loadPendingMembers(); }
    else showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
  });
}
function rejectMember(userId) {
  if (!confirm('ปฏิเสธคำขอเข้าร่วมวงนี้?')) return;
  apiCall('rejectMember', { userId: userId, bandId: currentBandId }, function(r) {
    if (r && r.success) { showToast('ปฏิเสธเรียบร้อย'); loadPendingMembers(); }
    else showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
  });
}

/* ══════════════════════════════════════════
   MEMBERS (from registered profiles — read only)
══════════════════════════════════════════ */
function loadProfileMembers() {
  if (typeof apiCall !== 'function' || !currentBandId) return;
  apiCall('getBandProfiles', { bandId: currentBandId }, function(r) {
    if (r && r.success && r.data) {
      profileMembers = r.data;
      // Sync into bandMembersData so schedule slot detail modal works
      bandMembersData = profileMembers.map(function(p) {
        var displayName = p.nickname || p.first_name || p.user_name || p.email || '?';
        return {
          id: p.id,
          memberId: p.id,
          name: displayName,
          position: p.instrument || '',
          profileData: p
        };
      });
      // Save synced members to localStorage for schedule page
      var s = JSON.parse(localStorage.getItem('bandSettings') || '{}');
      s.members = bandMembersData;
      localStorage.setItem('bandSettings', JSON.stringify(s));
      renderMembers();
      renderScheduleGrid();
    }
  });
}

function renderMembers() {
  var list = getEl('membersList'), noEl = getEl('noMembers'); if (!list) return;
  var countBadge = getEl('memberCountBadge');
  // If profileMembers loaded, render profile-based list; otherwise show bandMembersData
  var members = profileMembers.length > 0 ? profileMembers : [];
  if (countBadge) countBadge.textContent = members.length > 0 ? members.length + ' คน' : '';
  if (members.length === 0 && bandMembersData.length === 0) {
    list.innerHTML = '';
    if (noEl) { noEl.style.display = 'block'; noEl.innerHTML = '<p class="empty-state-small">ยังไม่มีสมาชิกในวง<br><small style="color:var(--premium-text-muted)">สมาชิกสมัครผ่านรหัสประจำวง → ผู้จัดการอนุมัติ → ปรากฏที่นี่</small></p>'; }
    return;
  }
  if (noEl) noEl.style.display = 'none';

  if (members.length > 0) {
    // Profile-based member list with role management
    var ROLE_LABELS = { admin: '👑 แอดมิน', manager: '🎯 ผู้จัดการวง', member: '🎵 สมาชิก' };
    var ROLE_COLORS = { admin: '#e53e3e', manager: '#3182ce', member: '#38a169' };
    var currentEmail = (localStorage.getItem('userEmail') || '').toLowerCase();
    list.innerHTML = members.map(function(p) {
      var displayName = p.nickname || p.first_name || p.user_name || p.email || '?';
      var fullName = (p.first_name && p.last_name) ? p.first_name + ' ' + p.last_name : '';
      var isSelf = (p.email || '').toLowerCase() === currentEmail;
      var isAdminRole = p.role === 'admin';
      // Role select (disabled for self and admin)
      var roleHtml;
      if (isAdminRole || isSelf) {
        var roleBadge = '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:' + (ROLE_COLORS[p.role] || '#666') + ';color:#fff">' + (ROLE_LABELS[p.role] || p.role) + '</span>';
        roleHtml = roleBadge;
      } else {
        roleHtml = '<select class="role-select" data-uid="' + esc(p.id) + '" style="padding:4px 8px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;font-weight:600;cursor:pointer">' +
          '<option value="member"' + (p.role === 'member' ? ' selected' : '') + '>🎵 สมาชิก</option>' +
          '<option value="manager"' + (p.role === 'manager' ? ' selected' : '') + '>🎯 ผู้จัดการวง</option>' +
        '</select>';
      }
      // Remove button (not for self or admin)
      var removeBtn = (!isSelf && !isAdminRole)
        ? '<button type="button" class="member-remove-btn" data-uid="' + esc(p.id) + '" data-name="' + esc(displayName) + '" style="background:none;border:none;cursor:pointer;font-size:16px;padding:4px;opacity:0.6;transition:opacity .15s" title="ลบออกจากวง" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">🗑️</button>'
        : '';
      return '<div class="member-item" style="align-items:center">' +
        '<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--premium-gold),#b7791f);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px;flex-shrink:0">' + esc(displayName.charAt(0).toUpperCase()) + '</div>' +
        '<div style="flex:1;min-width:120px">' +
          '<div style="font-weight:700;font-size:var(--text-sm)">' + esc(displayName) + (fullName ? ' <span style="font-weight:400;color:var(--premium-text-muted);font-size:12px">(' + esc(fullName) + ')</span>' : '') + (isSelf ? ' <span style="font-size:11px;color:var(--premium-gold)">(คุณ)</span>' : '') + '</div>' +
          '<div style="font-size:var(--text-xs);color:var(--premium-text-muted);margin-top:2px">' +
            (p.instrument ? '🎸 ' + esc(p.instrument) + ' · ' : '') +
            (p.phone ? '📱 ' + esc(p.phone) + ' · ' : '') +
            esc(p.email || '') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' + roleHtml + removeBtn + '</div>' +
      '</div>';
    }).join('');
    // Role change handler
    list.querySelectorAll('.role-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var uid = sel.dataset.uid;
        var newRole = sel.value;
        var label = newRole === 'manager' ? 'ผู้จัดการวง' : 'สมาชิก';
        if (!confirm('เปลี่ยนบทบาทเป็น "' + label + '" ?')) { loadProfileMembers(); return; }
        sel.disabled = true;
        apiCall('updateMemberRole', { userId: uid, role: newRole }, function(r) {
          sel.disabled = false;
          if (r && r.success) {
            showToast('เปลี่ยนบทบาทเรียบร้อย', 'success');
            loadProfileMembers();
          } else {
            showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
            loadProfileMembers();
          }
        });
      });
    });
    // Remove member handler
    list.querySelectorAll('.member-remove-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var uid = btn.dataset.uid;
        var name = btn.dataset.name;
        if (!confirm('ลบ "' + name + '" ออกจากวง?\nสมาชิกจะถูกนำออกจากวงทันที')) return;
        btn.disabled = true;
        apiCall('removeMember', { userId: uid }, function(r) {
          btn.disabled = false;
          if (r && r.success) {
            showToast('ลบสมาชิกออกจากวงเรียบร้อย', 'success');
            loadProfileMembers();
          } else {
            showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
          }
        });
      });
    });
  } else {
    // Fallback: old bandMembersData manual list
    list.innerHTML = bandMembersData.map(function(m, i) {
      return '<div class="member-item" data-mi="' + i + '">' +
        '<div class="form-group"><label>ชื่อสมาชิก</label><input type="text" class="mi-name" data-mi="' + i + '" value="' + esc(m.name||'') + '" placeholder="ชื่อ"></div>' +
        '<div class="form-group"><label>ตำแหน่ง</label><select class="mi-pos" data-mi="' + i + '"><option value="">เลือกตำแหน่ง</option>' +
          POSITIONS.map(function(p) { return '<option' + (m.position === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') +
        '</select></div><button type="button" class="member-remove" data-mi="' + i + '">🗑️</button></div>';
    }).join('');
    list.querySelectorAll('.mi-name').forEach(function(e) { e.addEventListener('input', function() { bandMembersData[+this.dataset.mi].name = this.value; }); });
    list.querySelectorAll('.mi-pos').forEach(function(e) { e.addEventListener('change', function() { bandMembersData[+this.dataset.mi].position = this.value; }); });
    list.querySelectorAll('.member-remove').forEach(function(btn) {
      btn.addEventListener('click', function() { if (confirm('ลบสมาชิกคนนี้?')) { bandMembersData.splice(+this.dataset.mi, 1); renderMembers(); } });
    });
  }
}
function addMember() {
  bandMembersData.push({ id: 'member_' + Date.now() + '_' + Math.random().toString(36).substr(2,5), name: '', position: '' });
  renderMembers();
  setTimeout(function() { var l = document.querySelector('.mi-name[data-mi="' + (bandMembersData.length-1) + '"]'); if (l) l.focus(); }, 80);
}

/* ══════════════════════════════════════════
   VENUE NAMES (simplified list)
══════════════════════════════════════════ */
function renderVenueNames() {
  var list = getEl('venueNamesList'); if (!list) return;
  if (venues.length === 0) {
    list.innerHTML = '<p class="empty-state-small" style="margin:8px 0">ยังไม่มีร้าน กดปุ่ม ➕ เพื่อเพิ่ม</p>';
    return;
  }
  list.innerHTML = venues.map(function(v, vi) {
    var bm = (v.breakMinutes > 0) ? String(v.breakMinutes) : '';
    var bannedChecks = BANNED_GENRE_OPTIONS.map(function(g) {
      var chked = Array.isArray(v.bannedGenres) && v.bannedGenres.indexOf(g) >= 0 ? ' checked' : '';
      return '<label style="display:inline-flex;align-items:center;gap:2px;font-size:.67rem;color:#94a3b8;cursor:pointer;white-space:nowrap">'
        + '<input type="checkbox" class="vn-banned-chk" data-vi="' + vi + '" value="' + esc(g) + '"' + chked + ' style="accent-color:#f97316;cursor:pointer;width:11px;height:11px">'
        + esc(g) + '</label>';
    }).join('');
    return '<div class="vn-row" data-vi="' + vi + '">'
      + '<span class="vn-num">' + (vi + 1) + '</span>'
      + '<input type="text" class="vn-input" data-vi="' + vi + '" value="' + esc(v.name) + '" placeholder="ชื่อร้าน">'
      + '<button type="button" class="vn-del" data-vi="' + vi + '">🗑️</button>'
      + '</div>'
      + '<div style="padding:3px 8px 8px 28px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;border-bottom:1px solid rgba(255,255,255,.04)">'
      + '<span style="font-size:.64rem;color:#64748b;flex-shrink:0;margin-right:2px">🚫 ห้ามเล่น:</span>'
      + bannedChecks
      + '<span style="font-size:.64rem;color:#64748b;flex-shrink:0;margin-left:6px">⏱ เบรคละ</span>'
      + '<input type="number" class="vn-breakmin" data-vi="' + vi + '" value="' + esc(bm) + '" min="15" max="360" placeholder="60" style="width:48px;text-align:center;background:#1a1a2e;border:1px solid rgba(255,255,255,.15);border-radius:6px;color:#e2e8f0;padding:2px 4px;font-size:.72rem;font-family:inherit">'
      + '<span style="font-size:.64rem;color:#64748b">นาที</span>'
      '</div>';
  }).join('');
  list.querySelectorAll('.vn-input').forEach(function(inp) {
    inp.addEventListener('input', function() { venues[+this.dataset.vi].name = this.value; autoSaveLocal(); renderScheduleGrid(); });
  });
  list.querySelectorAll('.vn-banned-chk').forEach(function(chk) {
    chk.addEventListener('change', function() {
      var vi = +this.dataset.vi;
      var genre = this.value;
      if (!Array.isArray(venues[vi].bannedGenres)) venues[vi].bannedGenres = [];
      if (this.checked) {
        if (venues[vi].bannedGenres.indexOf(genre) < 0) venues[vi].bannedGenres.push(genre);
      } else {
        venues[vi].bannedGenres = venues[vi].bannedGenres.filter(function(g){ return g !== genre; });
      }
      autoSaveLocal();
    });
  });
  list.querySelectorAll('.vn-breakmin').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var v = parseInt(this.value, 10);
      venues[+this.dataset.vi].breakMinutes = isNaN(v) ? 0 : v;
      autoSaveLocal();
    });
  });
  list.querySelectorAll('.vn-del').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!confirm('ลบร้านนี้? ช่วงงานทั้งหมดของร้านนี้จะถูกลบด้วย')) return;
      var vid = venues[+this.dataset.vi].id;
      venues.splice(+this.dataset.vi, 1);
      Object.keys(schedule).forEach(function(day) {
        schedule[day] = (schedule[day] || []).filter(function(s) { return s.venueId !== vid; });
      });
      autoSaveLocal(); renderVenueNames(); renderScheduleGrid();
    });
  });
}
function addVenue() {
  venues.push({ id: 'venue_' + Date.now(), name: '', breakMinutes: 0, bannedGenres: [] });
  renderVenueNames();
  setTimeout(function() {
    var inp = document.querySelector('.vn-input[data-vi="' + (venues.length - 1) + '"]');
    if (inp) inp.focus();
  }, 80);
}

/* ══════════════════════════════════════════
   PAYROLL SETTINGS
══════════════════════════════════════════ */
function renderPayrollSettings() {
  var sel = getEl('payrollPeriod');        if (sel) sel.value = payroll.period || 'daily';
  var ws  = getEl('payrollWeeklySettings');if (ws)  ws.style.display = payroll.period === 'weekly' ? '' : 'none';
  var wS  = getEl('weekStart');            if (wS)  wS.value = String(payroll.weekStart !== undefined ? payroll.weekStart : 1);
  var wE  = getEl('weekEnd');              if (wE)  wE.value = String(payroll.weekEnd   !== undefined ? payroll.weekEnd   : 0);
}

/* ══════════════════════════════════════════
   SCHEDULE GRID  (Horizontal — full-width %)
   Rows = days, Columns = time axis →
══════════════════════════════════════════ */

function renderScheduleGrid() {
  var wrap = getEl('schedGridWrap'); if (!wrap) return;

  // Collect all slots with computed min offsets
  var allSlots = [];
  for (var di = 0; di < 7; di++) {
    (schedule[di] || []).forEach(function(slot) {
      var s = timeToMin(slot.startTime), e = timeToMin(slot.endTime);
      if (s === null || e === null) return;
      if (e <= s) e += 24 * 60; // overnight
      allSlots.push({ day: di, slot: slot, startMin: s, endMin: e });
    });
  }

  // Grid time range
  var gStart, gEnd;
  if (allSlots.length > 0) {
    var minS = Math.min.apply(null, allSlots.map(function(a) { return a.startMin; }));
    var maxE = Math.max.apply(null, allSlots.map(function(a) { return a.endMin; }));
    gStart = Math.floor(minS / 60) * 60;
    gEnd   = Math.ceil(maxE  / 60) * 60;
    if (gEnd - gStart < 60) gEnd = gStart + 60;
  } else {
    gStart = 18 * 60; gEnd = 23 * 60;
  }
  var totalMin = gEnd - gStart;

  // Helper: minutes offset → percentage string
  function pct(min) { return (min / totalMin * 100).toFixed(4) + '%'; }

  // ── Header row (time ticks) ──────────────────────────
  var ticksHtml = '<div class="sg-corner">&#128197;</div>' +
    '<div class="sg-time-axis">';
  for (var t = gStart; t <= gEnd; t += 60) {
    var lp = pct(t - gStart);
    ticksHtml += '<div class="sg-tick" style="left:' + lp + '">' + minToTime(t) + '</div>' +
      (t < gEnd ? '<div class="sg-tick-line" style="left:' + lp + '"></div>' : '');
  }
  ticksHtml += '</div>';

  // ── Day rows ──────────────────────────────────────────
  var rowsHtml = '';
  for (var dayIdx = 0; dayIdx < 7; dayIdx++) {
    var daySlots = allSlots.filter(function(a) { return a.day === dayIdx; });

    // Grid lines (hour + half-hour)
    var linesHtml = '';
    for (var hh = gStart; hh <= gEnd; hh += 30) {
      var lp2 = pct(hh - gStart);
      var cls = hh % 60 === 0 ? 'sg-hour-line' : 'sg-hour-line half';
      linesHtml += '<div class="' + cls + '" style="left:' + lp2 + '"></div>';
    }

    // Slot blocks — overlap detection → vertical subdivision
    var slotsHtml = '';
    daySlots.forEach(function(a, ai) {
      var peers = daySlots.filter(function(b, bi) {
        return bi !== ai && b.startMin < a.endMin && a.startMin < b.endMin;
      });
      var posInGroup = 0, groupSize = 1;
      if (peers.length > 0) {
        var group = daySlots.filter(function(b) {
          return b.startMin < a.endMin && a.startMin < b.endMin;
        }).sort(function(x, y) { return x.startMin - y.startMin; });
        posInGroup = group.indexOf(a);
        groupSize  = group.length;
      }

      var slotWidthMin = a.endMin - a.startMin;
      var leftP  = pct(a.startMin - gStart);
      var widthP = pct(slotWidthMin);
      var col    = getVenueColor(a.slot.venueId);
      var vname  = esc(getVenueName(a.slot.venueId));
      var timeStr = minToTime(a.startMin) + '–' + minToTime(a.endMin % (24 * 60));
      var mCount  = (a.slot.members || []).length;

      var topStr    = groupSize > 1 ? (posInGroup / groupSize * 100).toFixed(2) + '%' : '6px';
      var heightStr = groupSize > 1 ? (100 / groupSize).toFixed(2) + '%'             : 'calc(100% - 12px)';
      var stylePos  = 'left:' + leftP + ';width:calc(' + widthP + ' - 3px);top:' + topStr + ';height:' + heightStr + ';bottom:auto;';

      // Rough pixel estimate (assume 900px usable width) to decide text verbosity
      var approxPx = slotWidthMin / totalMin * 900;

      slotsHtml += '<div class="sg-slot" data-day="' + dayIdx + '" data-sid="' + esc(a.slot.id) + '" ' +
        'title="' + vname + ' ' + timeStr + (mCount ? ' | ' + mCount + ' คน' : '') + '" ' +
        'style="' + stylePos + 'background:' + col.bg + ';color:' + col.text + '">' +
        '<div class="sg-slot-name">' + vname + '</div>' +
        (approxPx >= 55 ? '<div class="sg-slot-time">' + timeStr + '</div>' : '') +
        (mCount > 0 && approxPx >= 80 ? '<div class="sg-slot-members">👥 ' + mCount + '</div>' : '') +
        '</div>';
    });

    rowsHtml += '<div class="sg-row">' +
      '<div class="sg-day-label">' +
        '<span>' + DAY_NAMES[dayIdx] + '</span>' +
        '<span class="sg-day-sub">' + (daySlots.length > 0 ? daySlots.length + ' เบรค' : '–') + '</span>' +
      '</div>' +
      '<div class="sg-track" data-day="' + dayIdx + '">' +
        linesHtml + slotsHtml +
        (daySlots.length === 0 ? '<div class="sg-track-hint">+ คลิกเพิ่มช่วงงาน</div>' : '') +
      '</div>' +
      '</div>';
  }

  wrap.innerHTML =
    '<div class="sg-grid">' +
      '<div class="sg-header-row">' + ticksHtml + '</div>' +
      rowsHtml +
    '</div>';

  // ── Event: click track → add slot modal ───────────────
  wrap.querySelectorAll('.sg-track').forEach(function(track) {
    track.addEventListener('click', function(e) {
      if (e.target.classList.contains('sg-slot') || e.target.closest('.sg-slot')) return;
      var day  = +this.dataset.day;
      var rect = this.getBoundingClientRect();
      var relX = e.clientX - rect.left;
      var frac = relX / rect.width;
      var approxMin = gStart + Math.round(frac * totalMin);
      approxMin = Math.floor(approxMin / 30) * 30;
      var approxEnd = Math.min(approxMin + 180, gEnd);
      approxMin = Math.max(approxMin, gStart);
      openSlotModal(day, null, minToTime(approxMin), minToTime(approxEnd));
    });
  });

  // ── Event: click slot → detail modal ──────────────────
  wrap.querySelectorAll('.sg-slot').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      openSlotDetailModal(+this.dataset.day, this.dataset.sid);
    });
  });

  // ── Legend ────────────────────────────────────────────
  var legendEl = getEl('schedLegend');
  if (legendEl) {
    var namedV = venues.filter(function(v) { return v.name && v.name.trim(); });
    legendEl.innerHTML = namedV.length === 0 ? '' : namedV.map(function(v) {
      var col = getVenueColor(v.id);
      return '<div class="sg-legend-item"><div class="sg-legend-dot" style="background:' + col.bg + '"></div>' + esc(v.name) + '</div>';
    }).join('');
  }
}

/* ══════════════════════════════════════════
   SLOT MODAL  (Add / Edit slot)
══════════════════════════════════════════ */
function openSlotModal(day, slotId, defaultStart, defaultEnd) {
  _editDay = day; _editSlotId = slotId;
  var modal = getEl('slotModal'); if (!modal) return;
  var namedV = venues.filter(function(v) { return v.name && v.name.trim(); });
  if (namedV.length === 0) { showToast('กรุณาเพิ่มร้านก่อน', 'error'); return; }

  var existingSlot = null;
  if (slotId) { (schedule[day] || []).forEach(function(s) { if (s.id === slotId) existingSlot = s; }); }

  // Populate venue select
  var venSel = getEl('smVenue');
  if (venSel) {
    venSel.innerHTML = '<option value="">— เลือกร้าน —</option>' +
      namedV.map(function(v) {
        return '<option value="' + esc(v.id) + '"' + (existingSlot && existingSlot.venueId === v.id ? ' selected' : '') + '>' + esc(v.name) + '</option>';
      }).join('');
  }
  var dl = getEl('smDayLabel'); if (dl) dl.textContent = DAY_NAMES[day];
  var ss = getEl('smStart'); if (ss) { ss.value = existingSlot ? existingSlot.startTime : (defaultStart || '18:00'); autoFormatTime(ss); }
  var se = getEl('smEnd');   if (se) { se.value = existingSlot ? existingSlot.endTime   : (defaultEnd   || '21:00'); autoFormatTime(se); }

  var delBtn = getEl('smDeleteBtn'); if (delBtn) delBtn.style.display = slotId ? '' : 'none';
  modal.style.display = 'flex';
}
function closeSlotModal() { var m = getEl('slotModal'); if (m) m.style.display = 'none'; }
function confirmSlotModal() {
  var venSel = getEl('smVenue'), ss = getEl('smStart'), se = getEl('smEnd');
  var venueId = venSel ? venSel.value : '';
  var start   = ss ? ss.value.trim() : '', end = se ? se.value.trim() : '';
  if (!venueId) { showToast('กรุณาเลือกร้าน', 'error'); return; }
  if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) { showToast('กรุณากรอกเวลาให้ถูกต้อง (HH:MM)', 'error'); return; }
  // Pad HH
  if (start.length === 4) start = '0' + start;
  if (end.length === 4)   end   = '0' + end;
  if (!schedule[_editDay]) schedule[_editDay] = [];
  if (_editSlotId) {
    schedule[_editDay].forEach(function(s) { if (s.id === _editSlotId) { s.venueId = venueId; s.startTime = start; s.endTime = end; } });
  } else {
    schedule[_editDay].push({ id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substr(2,4), venueId: venueId, startTime: start, endTime: end, members: [] });
  }
  autoSaveLocal(); closeSlotModal(); renderScheduleGrid();
  showToast('บันทึกช่วงงานเรียบร้อย ✅', 'success');
}
function deleteSlotFromModal() {
  if (!confirm('ลบช่วงงานนี้?')) return;
  if (_editSlotId !== null && _editDay >= 0) {
    schedule[_editDay] = (schedule[_editDay] || []).filter(function(s) { return s.id !== _editSlotId; });
  }
  autoSaveLocal(); closeSlotModal(); renderScheduleGrid();
}

/* ══════════════════════════════════════════
   SLOT DETAIL MODAL  (Members + Rates)
══════════════════════════════════════════ */
function openSlotDetailModal(day, slotId) {
  _detailDay = day; _detailSlotId = slotId;
  var slot = null; (schedule[day] || []).forEach(function(s) { if (s.id === slotId) slot = s; });
  if (!slot) return;
  var modal = getEl('slotDetailModal'); if (!modal) return;
  var t = getEl('sdTitle');
  if (t) t.textContent = getVenueName(slot.venueId) + ' — ' + DAY_NAMES[day] + '  ' + (slot.startTime || '') + '–' + (slot.endTime || '');
  renderSlotMembers(slot);
  modal.style.display = 'flex';
}
function closeSlotDetailModal() { var m = getEl('slotDetailModal'); if (m) m.style.display = 'none'; }

function getEditingSlot() {
  if (_detailDay < 0 || !_detailSlotId) return null;
  var found = null; (schedule[_detailDay] || []).forEach(function(s) { if (s.id === _detailSlotId) found = s; });
  return found;
}

function findMemberRec(slot, mid) {
  return (slot.members || []).find(function(x) { return x.memberId === mid; }) || null;
}

function renderSlotMembers(slot) {
  var list = getEl('sdMemberList'); if (!list) return;
  if (!slot) slot = getEditingSlot(); if (!slot) return;
  if (!slot.members) slot.members = [];

  var validBM = bandMembersData.filter(function(m) { return m.name && m.name.trim(); });
  if (validBM.length === 0) {
    list.innerHTML = '<p class="empty-state-small">ยังไม่มีสมาชิกในวง กรุณาเพิ่มสมาชิกในหน้าตั้งค่าก่อน</p>';
    return;
  }

  list.innerHTML = validBM.map(function(m) {
    var mid = m.memberId || m.id || '';
    var mr  = findMemberRec(slot, mid);
    var included = !!mr;
    var rate     = included ? (mr.rate != null ? mr.rate : '') : '';
    var rateType = included ? (mr.rateType || 'shift') : 'shift';

    var nameStyle   = !included ? 'opacity:.35;' : 'font-weight:700;';
    var inputDim    = !included ? 'opacity:.25;' : '';

    return '<div class="sd-member-block" data-mid="' + esc(mid) + '">' +
      '<div class="sd-member-row">' +
        '<label class="sd-m-check-label">' +
          '<input type="checkbox" class="sd-m-check" data-mid="' + esc(mid) + '"' + (included ? ' checked' : '') + '>' +
          '<span class="sd-m-name" style="' + nameStyle + '">' + esc(m.name) +
            (m.position ? '<span class="sd-m-pos"> (' + esc(m.position) + ')</span>' : '') +
          '</span>' +
        '</label>' +
        '<input type="number" class="sd-m-rate" data-mid="' + esc(mid) + '" value="' + esc(String(rate)) + '" placeholder="ค่าแรง" min="0"' +
          (!included ? ' disabled' : '') + ' style="' + inputDim + '">' +
        '<select class="sd-m-rtype" data-mid="' + esc(mid) + '"' + (!included ? ' disabled' : '') + ' style="' + inputDim + '">' +
          '<option value="shift"'  + (rateType === 'shift'  ? ' selected' : '') + '>บาท/เบรค</option>' +
          '<option value="hourly"' + (rateType === 'hourly' ? ' selected' : '') + '>บาท/ชม</option>' +
          '<option value="fixed"'  + (rateType === 'fixed'  ? ' selected' : '') + '>คงที่</option>' +
        '</select>' +
      '</div>' +
      '</div>';
  }).join('');

  // checkbox: include / exclude member
  list.querySelectorAll('.sd-m-check').forEach(function(chk) {
    chk.addEventListener('change', function() {
      var s = getEditingSlot(); if (!s) return;
      var mid = this.dataset.mid;
      if (this.checked) {
        if (!findMemberRec(s, mid)) {
          s.members.push({ memberId: mid, rate: 0, rateType: 'shift' });
        }
      } else {
        s.members = s.members.filter(function(x) { return x.memberId !== mid; });
      }
      autoSaveLocal(); renderSlotMembers(s); renderScheduleGrid();
    });
  });

  // rate input
  list.querySelectorAll('.sd-m-rate').forEach(function(inp) {
    inp.addEventListener('input', function() {
      var s = getEditingSlot(); if (!s) return;
      var mr = findMemberRec(s, this.dataset.mid);
      if (mr) { mr.rate = parseFloat(this.value) || 0; autoSaveLocal(); }
    });
  });

  // rateType select
  list.querySelectorAll('.sd-m-rtype').forEach(function(sel) {
    sel.addEventListener('change', function() {
      var s = getEditingSlot(); if (!s) return;
      var mr = findMemberRec(s, this.dataset.mid);
      if (mr) { mr.rateType = this.value; autoSaveLocal(); }
    });
  });

}

function applyBulkRate() {
  var rateInp = getEl('bulkRate'), typesel = getEl('bulkType');
  var rate = parseFloat(rateInp ? rateInp.value : '');
  if (isNaN(rate) || rate < 0) { showToast('กรุณากรอกค่าแรงให้ถูกต้อง', 'error'); return; }
  var rtype = typesel ? typesel.value : 'shift';
  var slot = getEditingSlot(); if (!slot) return;
  // Apply only to currently-included (checked) members
  (slot.members || []).forEach(function(m) { m.rate = rate; m.rateType = rtype; });
  autoSaveLocal(); renderSlotMembers(slot);
  var rtypeLabel = { shift: 'บาท/เบรค', hourly: 'บาท/ชม', fixed: 'บาท คงที่' }[rtype] || rtype;
  showToast('ตั้งค่าแรง ' + rate.toLocaleString('th-TH') + ' ' + rtypeLabel + ' ให้ทุกคนแล้ว ✅', 'success');
}
function saveSlotDetail() {
  _doSave(_buildFullPayload(), null, '', 'บันทึกค่าแรงเรียบร้อย ✅');
  closeSlotDetailModal(); renderScheduleGrid();
}
function editThisSlot() {
  closeSlotDetailModal(); openSlotModal(_detailDay, _detailSlotId, null, null);
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */


/* ══════════════════════════════════════════
   NOTIFICATIONS, GEMINI, LINE
══════════════════════════════════════════ */
var _notifSaveTimeout = null;
function loadAutoNotifState() {
  var bandId = localStorage.getItem('bandId') || '';
  if (!bandId) return;
  apiCall('getBandSettings', { bandId: bandId }, function(r) {
    if (r && r.success && r.data) {
      var enabled = !!r.data.notifications_enabled;
      setAutoNotifUI(enabled);
      var extMins   = r.data.notif_external_mins || 1440;
      var firstMins = r.data.notif_first_slot_mins || 60;
      var nextMins  = r.data.notif_next_slot_mins || 5;
      _setTimingInputs('notifExtHr', 'notifExtMin', extMins);
      _setTimingInputs('notifFirstHr', 'notifFirstMin', firstMins);
      _setTimingInputs('notifNextHr', 'notifNextMin', nextMins);
    }
  });
}
function _setTimingInputs(hrId, minId, totalMins) {
  var hr = document.getElementById(hrId);
  var mn = document.getElementById(minId);
  if (hr) hr.value = Math.floor(totalMins / 60);
  if (mn) mn.value = totalMins % 60;
}
function _getTimingMins(hrId, minId, fallback) {
  var hr = document.getElementById(hrId);
  var mn = document.getElementById(minId);
  var h = parseInt(hr ? hr.value : '0', 10) || 0;
  var m = parseInt(mn ? mn.value : '0', 10) || 0;
  return (h * 60 + m) || fallback;
}
function setAutoNotifUI(enabled) {
  var cb    = document.getElementById('autoNotifToggle');
  var track = document.getElementById('autoNotifTrack');
  var thumb = document.getElementById('autoNotifThumb');
  var label = document.getElementById('autoNotifLabel');
  var cfg   = document.getElementById('notifTimingConfig');
  if (cb) cb.checked = enabled;
  if (track) track.style.background = enabled ? '#16a34a' : '#475569';
  if (thumb) thumb.style.left = enabled ? '22px' : '2px';
  if (label) { label.textContent = enabled ? 'เปิด' : 'ปิด'; label.style.color = enabled ? '#4ade80' : '#fff'; }
  if (cfg) cfg.style.display = enabled ? '' : 'none';
}
function toggleAutoNotif(enabled) {
  setAutoNotifUI(enabled);
  if (typeof notificationsEnabled !== 'undefined') notificationsEnabled = enabled;
  _saveNotifSettings({ notifications_enabled: enabled });
}
function saveNotifTiming() {
  clearTimeout(_notifSaveTimeout);
  _notifSaveTimeout = setTimeout(function() {
    _saveNotifSettings({
      notif_external_mins:   _getTimingMins('notifExtHr', 'notifExtMin', 1440),
      notif_first_slot_mins: _getTimingMins('notifFirstHr', 'notifFirstMin', 60),
      notif_next_slot_mins:  _getTimingMins('notifNextHr', 'notifNextMin', 5)
    });
  }, 400);
}
function _saveNotifSettings(patch) {
  var bandId = localStorage.getItem('bandId') || '';
  if (!bandId) return;
  apiCall('getBandSettings', { bandId: bandId }, function(r) {
    var current = (r && r.success && r.data) ? r.data : {};
    current.bandId = bandId;
    Object.keys(patch).forEach(function(k) { current[k] = patch[k]; });
    apiCall('saveBandSettings', current, function(r2) {
      var msgEl = document.getElementById('notifAdminMsg');
      if (r2 && r2.success) {
        if (msgEl) { msgEl.style.color = '#16a34a'; msgEl.textContent = '✅ บันทึกการตั้งค่าแจ้งเตือนแล้ว'; }
      } else {
        if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ บันทึกไม่สำเร็จ'; }
      }
    });
  });
}

function loadNotifAdminPanel() {
  var bandId = localStorage.getItem('bandId') || '';
  if (!bandId) return;
  var listEl = document.getElementById('notifSubList');
  var badgeEl = document.getElementById('notifSubCountBadge');
  if (listEl) listEl.innerHTML = '<div style="font-size:var(--text-xs);color:var(--premium-text-muted);padding:12px 0;text-align:center">กำลังโหลด…</div>';
  apiCall('getNotifSubscribers', { bandId: bandId }, function(r) {
    if (!r || !r.success || !r.data) {
      if (listEl) listEl.innerHTML = '<div style="color:#e53e3e;font-size:var(--text-xs);padding:8px 0">ไม่สามารถโหลดข้อมูลได้</div>';
      return;
    }
    var rows = r.data;
    if (badgeEl) badgeEl.textContent = rows.length + ' คนเปิดรับการแจ้งเตือน';
    if (rows.length === 0) {
      if (listEl) listEl.innerHTML = '<div style="color:var(--premium-text-muted);font-size:var(--text-xs);padding:8px 0;text-align:center">ยังไม่มีสมาชิกที่เปิดรับการแจ้งเตือน</div>';
      return;
    }
    var html = '<div style="display:flex;flex-direction:column;gap:6px">';
    rows.forEach(function(sub) {
      var name = sub.full_name || sub.email || '—';
      var domain = sub.endpoint ? (function(){ try { return new URL(sub.endpoint).hostname; } catch(e){ return sub.endpoint.substring(0,30)+'…'; }})() : 'ไม่ทราบอุปกรณ์';
      var when = sub.created_at ? new Date(sub.created_at).toLocaleDateString('th-TH') : '—';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(249,207,69,.06);border:1px solid rgba(249,207,69,.18);border-radius:8px;font-size:var(--text-xs)">'
        + '<div><span style="font-weight:600;color:var(--premium-text)">🔔 ' + esc(name) + '</span>'
        + '<span style="color:var(--premium-text-muted);margin-left:8px">' + esc(domain) + '</span></div>'
        + '<span style="color:#9ca3af">' + when + '</span>'
        + '</div>';
    });
    html += '</div>';
    if (listEl) listEl.innerHTML = html;
  });
}

function notifAdminSendTest(btn) {
  var bandId = localStorage.getItem('bandId') || '';
  if (!bandId) return;
  var msgEl = document.getElementById('notifAdminMsg');
  btn.disabled = true; btn.textContent = 'กำลังส่ง…';
  apiCall('sendTestNotification', { bandId: bandId, title: '🎵 ทดสอบระบบแจ้งเตือน', body: 'ระบบการแจ้งเตือนของวงทำงานปกติ ✅' }, function(r) {
    btn.disabled = false; btn.textContent = '📢 ส่งการแจ้งเตือนทดสอบถึงทุกคน';
    if (msgEl) {
      if (r && r.success) {
        msgEl.style.color = '#16a34a';
        msgEl.textContent = '✅ ส่งการแจ้งเตือนสำเร็จ — ' + (r.sent || 0) + ' คน';
      } else {
        msgEl.style.color = '#e53e3e';
        msgEl.textContent = '❌ ' + (r && r.error ? r.error : 'ไม่สามารถส่งได้');
      }
    }
  });
}

function notifAdminCleanStale(btn) {
  var bandId = localStorage.getItem('bandId') || '';
  if (!bandId) return;
  var msgEl = document.getElementById('notifAdminMsg');
  btn.disabled = true; btn.textContent = 'กำลังล้าง…';
  apiCall('cleanStaleSubscriptions', { bandId: bandId }, function(r) {
    btn.disabled = false; btn.textContent = '🗑️ ล้าง Subscription ที่หมดอายุ';
    if (msgEl) {
      if (r && r.success) {
        msgEl.style.color = '#16a34a';
        msgEl.textContent = '✅ ล้างแล้ว ' + (r.removed || 0) + ' รายการ';
      } else {
        msgEl.style.color = '#e53e3e';
        msgEl.textContent = '❌ ' + (r && r.error ? r.error : 'เกิดข้อผิดพลาด');
      }
    }
    loadNotifAdminPanel();
  });
}

/* ── Gemini API Key Management ── */
function loadGeminiKey() {
  var bandId = localStorage.getItem('bandId') || '';
  if (!bandId) return;
  apiCall('getBandSettings', { bandId: bandId }, function(r) {
    var settings = (r && r.success && r.data) || {};
    var el = document.getElementById('geminiApiKey');
    if (el && settings.geminiApiKey) el.value = settings.geminiApiKey;
  });
}
function saveGeminiKey() {
  var bandId = localStorage.getItem('bandId') || '';
  var key = (document.getElementById('geminiApiKey').value || '').trim();
  var msgEl = document.getElementById('geminiMsg');
  if (!key) { if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ กรุณาใส่ API Key'; } return; }
  apiCall('getBandSettings', { bandId: bandId }, function(r) {
    var current = (r && r.success && r.data) ? r.data : {};
    current.bandId = bandId;
    current.geminiApiKey = key;
    apiCall('saveBandSettings', current, function(r2) {
      if (r2 && r2.success) {
        if (msgEl) { msgEl.style.color = '#16a34a'; msgEl.textContent = '✅ บันทึก API Key แล้ว'; }
      } else {
        if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ บันทึกไม่สำเร็จ'; }
      }
    });
  });
}
function testGeminiKey() {
  var key = (document.getElementById('geminiApiKey').value || '').trim();
  var msgEl = document.getElementById('geminiMsg');
  if (!key) { if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ กรุณาใส่ API Key ก่อน'; } return; }
  if (msgEl) { msgEl.style.color = 'var(--premium-text-muted)'; msgEl.textContent = '⏳ กำลังทดสอบ…'; }
  fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'ตอบว่า OK' }] }] })
  }).then(function(res) { return res.json(); })
  .then(function(data) {
    if (data && data.candidates) {
      if (msgEl) { msgEl.style.color = '#16a34a'; msgEl.textContent = '✅ API Key ใช้งานได้! (Free tier)'; }
    } else {
      if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ Key ไม่ถูกต้อง: ' + (data.error ? data.error.message : JSON.stringify(data)); }
    }
  }).catch(function(err) {
    if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ ไม่สามารถเชื่อมต่อ: ' + err.message; }
  });
}

// ── LINE Schedule Functions ──
var _lineConfigId = null;
function loadLineConfig() {
  apiCall('getVenueLineConfig', { venueName: 'ร้านนิยมสุข' }, function(r) {
    if (!r || !r.success) return;
    var cfg = r.data;
    if (!cfg) return;
    _lineConfigId = cfg.id || null;
    var le = document.getElementById('lineEnabled');
    if (le) {
      le.checked = !!cfg.enabled;
      _updateLineToggle('lineEnabled', 'lineEnabledTrack', 'lineEnabledThumb', 'lineEnabledLabel', !!cfg.enabled, true);
    }
    var lt = document.getElementById('lineToken'); if (lt) lt.value = cfg.line_channel_token || '';
    var lg = document.getElementById('lineGroupId'); if (lg) lg.value = cfg.line_group_id || '';
    var ld = document.getElementById('lineDailyTime'); if (ld) ld.value = cfg.send_daily_time || '23:30';
    var lw = document.getElementById('lineWeeklyEnabled');
    if (lw) {
      lw.checked = !!cfg.send_weekly_enabled;
      _updateLineToggle('lineWeeklyEnabled', 'lineWeeklyTrack', 'lineWeeklyThumb', 'lineWeeklyLabel', !!cfg.send_weekly_enabled, false);
    }
    var lwt = document.getElementById('lineWeeklyTime'); if (lwt) lwt.value = cfg.send_weekly_time || '08:00';
    var lf = document.getElementById('lineFooter'); if (lf) lf.value = cfg.footer_text || '';
    if (_lineConfigId) refreshLineQuota();
  });
}
function _updateLineToggle(cbId, trackId, thumbId, labelId, on, isMain) {
  var track = document.getElementById(trackId);
  var thumb = document.getElementById(thumbId);
  var label = document.getElementById(labelId);
  if (track) track.style.background = on ? '#16a34a' : '#475569';
  if (thumb) thumb.style.left = on ? (isMain ? '22px' : '18px') : '2px';
  if (isMain && label) {
    label.textContent = on ? '✅ เปิดใช้งาน' : '❌ ปิด';
    label.style.color = on ? '#16a34a' : '#ef4444';
  }
}
function saveLineConfig() {
  var msgEl = document.getElementById('lineMsg');
  var bandId = localStorage.getItem('bandId') || '';
  if (!bandId) {
    if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ ไม่พบ Band ID — กรุณาล็อกอินใหม่'; }
    return;
  }
  if (msgEl) msgEl.textContent = '⏳ กำลังบันทึก...';
  var payload = {
    id: _lineConfigId,
    venue_name: 'ร้านนิยมสุข',
    line_channel_token: (document.getElementById('lineToken') ? document.getElementById('lineToken').value.trim() : ''),
    line_group_id: (document.getElementById('lineGroupId') ? document.getElementById('lineGroupId').value.trim() : ''),
    enabled: document.getElementById('lineEnabled') ? document.getElementById('lineEnabled').checked : false,
    send_daily_time: (document.getElementById('lineDailyTime') ? document.getElementById('lineDailyTime').value : '23:30'),
    send_weekly_enabled: document.getElementById('lineWeeklyEnabled') ? document.getElementById('lineWeeklyEnabled').checked : false,
    send_weekly_time: (document.getElementById('lineWeeklyTime') ? document.getElementById('lineWeeklyTime').value : '08:00'),
    footer_text: (document.getElementById('lineFooter') ? document.getElementById('lineFooter').value.trim() : ''),
    band_ids: [bandId]
  };
  apiCall('saveVenueLineConfig', payload, function(r) {
    if (r && r.success) {
      if (msgEl) { msgEl.style.color = 'var(--accent-success,#38a169)'; msgEl.textContent = '✅ บันทึกเรียบร้อย'; }
      loadLineConfig();
    } else {
      if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ บันทึกไม่สำเร็จ: ' + (r && r.message ? r.message : 'unknown error'); }
    }
  });
}
function sendLineTest() {
  if (!_lineConfigId) { alert('กรุณาบันทึกการตั้งค่าก่อนทดสอบส่ง'); return; }
  var msgEl = document.getElementById('lineMsg');
  if (msgEl) { msgEl.style.color = 'var(--premium-text-muted)'; msgEl.textContent = '⏳ กำลังส่งทดสอบ...'; }
  apiCall('sendLineTest', { configId: _lineConfigId }, function(r) {
    if (r && r.success) {
      if (msgEl) { msgEl.style.color = 'var(--accent-success,#38a169)'; msgEl.textContent = '✅ ส่งทดสอบสำเร็จ! ตรวจสอบในกลุ่ม LINE ได้เลย'; }
      refreshLineQuota();
    } else {
      if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ ส่งไม่สำเร็จ: ' + ((r && r.data && r.data.error) ? r.data.error : (r && r.message ? r.message : 'ไม่สำเร็จ')); }
    }
  });
}
function refreshLineQuota() {
  if (!_lineConfigId) return;
  apiCall('getLineQuota', { configId: _lineConfigId }, function(r) {
    var data = r && r.data;
    if (!data) return;
    var count = data.count || 0;
    var limit = data.limit || 200;
    var pct = Math.min(100, Math.round((count / limit) * 100));
    var bar = document.getElementById('lineQuotaBar');
    var txt = document.getElementById('lineQuotaText');
    if (bar) {
      bar.style.width = pct + '%';
      bar.style.background = pct >= 95 ? '#e53e3e' : pct >= 80 ? '#f59e0b' : 'var(--accent-primary)';
    }
    if (txt) txt.textContent = count + ' / ' + limit;
    var logs = data.logs || [];
    var logEl = document.getElementById('lineLogList');
    if (logEl && logs.length) {
      logEl.style.display = '';
      logEl.innerHTML = logs.map(function(lg) {
        var d = lg.sent_at ? new Date(lg.sent_at).toLocaleString('th-TH') : '-';
        var icon = lg.success ? '✅' : '❌';
        var typeMap = { daily: 'รายวัน', weekly: 'สัปดาห์', test: 'ทดสอบ', preview: 'ตัวอย่าง' };
        var typeTh = typeMap[lg.message_type] || lg.message_type;
        return '<div style="padding:2px 0;border-bottom:1px solid #c9d4e0">' + icon + ' ' + typeTh + ' — ' + d + (lg.error_message ? ' <span style="color:#e53e3e">' + lg.error_message.slice(0,60) + '</span>' : '') + '</div>';
      }).join('');
    }
  });
}
function previewLineMsg(previewMode) {
  if (!_lineConfigId) { alert('กรุณาบันทึกการตั้งค่าก่อนดูตัวอย่าง'); return; }
  var msgEl = document.getElementById('lineMsg');
  if (msgEl) { msgEl.style.color = 'var(--premium-text-muted)'; msgEl.textContent = '⏳ กำลังโหลดตัวอย่าง...'; }
  apiCall('previewLineMessage', { configId: _lineConfigId, previewMode: previewMode }, function(r) {
    var data = r && r.data;
    if (r && r.success && data && data.text) {
      if (msgEl) msgEl.textContent = '';
      var box = document.getElementById('linePreviewBox');
      var pre = document.getElementById('linePreviewText');
      if (pre) pre.textContent = data.text;
      if (box) box.style.display = '';
    } else {
      if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ ดูตัวอย่างไม่สำเร็จ: ' + ((data && data.error) ? data.error : (r && r.message ? r.message : 'ไม่สำเร็จ')); }
    }
  });
}



/* ══════════════════════════════════════════
   DISCOUNTED WAGE (ระบบลดราคาค่าแรง)
══════════════════════════════════════════ */
var _dwRules = [];

function toggleDiscountWageUI(enabled, save) {
  var cb    = document.getElementById('discountWageToggle');
  var track = document.getElementById('discountWageTrack');
  var thumb = document.getElementById('discountWageThumb');
  var label = document.getElementById('discountWageLabel');
  var cfg   = document.getElementById('discountWageConfig');

  if (cb) cb.checked = !!enabled;
  if (track) track.style.background = enabled ? '#16a34a' : '#475569';
  if (thumb) thumb.style.left = enabled ? '22px' : '2px';
  if (label) {
    label.textContent = enabled ? 'เปิดใช้งาน' : 'ปิด';
    label.style.color = enabled ? '#16a34a' : 'var(--premium-text-muted)';
  }
  if (cfg) cfg.style.display = enabled ? '' : 'none';

  if (save) {
    _saveDWSettings();
  }
}

function updateDWVenueDropdown() {
  var sel = document.getElementById('dwVenue');
  if (!sel) return;
  var currentVal = sel.value;
  sel.innerHTML = '<option value="">-- เลือกร้าน --</option>';
  (venues || []).filter(function(v) { return v && v.name && v.name.trim(); }).forEach(function(v) {
    var opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = v.name;
    sel.appendChild(opt);
  });
  if (currentVal) sel.value = currentVal;
  updateDWTimeSlots();
}

function updateDWTimeSlots() {
  var vEl = document.getElementById('dwVenue');
  var dEl = document.getElementById('dwDay');
  var tsEl = document.getElementById('dwTimeSlot');
  if (!tsEl) return;

  var currentVal = tsEl.value;
  var venueName = vEl ? vEl.value : '';
  var dayVal = dEl ? dEl.value : '*';

  var currentVenue = (venues || []).find(function(v) { return v && (v.name === venueName || v.id === venueName); });
  var venueId = currentVenue ? currentVenue.id : '';

  var timeSlots = [];
  var daysToCheck = (dayVal === '*') ? [0, 1, 2, 3, 4, 5, 6] : [parseInt(dayVal, 10)];

  daysToCheck.forEach(function(d) {
    var daySlots = schedule[d] || schedule[String(d)] || [];
    if (daySlots && daySlots.timeSlots) daySlots = daySlots.timeSlots;
    if (Array.isArray(daySlots)) {
      daySlots.forEach(function(s) {
        var matchesVenue = (venueId && s.venueId === venueId) || (venueName && (s.venue === venueName || s.venueId === venueName));
        if (matchesVenue) {
          var start = s.startTime || s.start || '';
          var end = s.endTime || s.end || '';
          if (start && end) {
            var key = start + '-' + end;
            if (timeSlots.indexOf(key) < 0) {
              timeSlots.push(key);
            }
          }
        }
      });
    }
  });

  timeSlots.sort();

  tsEl.innerHTML = '<option value="*">ทุกช่วงเวลา</option>';
  timeSlots.forEach(function(ts) {
    var opt = document.createElement('option');
    opt.value = ts;
    opt.textContent = ts.replace('-', ' - ');
    tsEl.appendChild(opt);
  });

  if (currentVal && (currentVal === '*' || timeSlots.indexOf(currentVal) >= 0)) {
    tsEl.value = currentVal;
  }
}

function loadDWState() {
  var bandId = localStorage.getItem('bandId') || '';
  if (!bandId) return;
  apiCall('getBandSettings', { bandId: bandId }, function(r) {
    if (r && r.success && r.data) {
      var enabled = !!r.data.discount_wage_enabled;
      toggleDiscountWageUI(enabled, false);
      try {
        _dwRules = r.data.discount_wage_rules ? (typeof r.data.discount_wage_rules === 'string' ? JSON.parse(r.data.discount_wage_rules) : r.data.discount_wage_rules) : [];
      } catch(e) { _dwRules = []; }
      renderDWRules();
      updateDWTimeSlots();
    }
  });
}

function renderDWRules() {
  var list = document.getElementById('dwRulesList');
  if (!list) return;
  if (!_dwRules || _dwRules.length === 0) {
    list.innerHTML = '<div style="font-size:11px;color:var(--premium-text-muted)">ยังไม่มีเงื่อนไข</div>';
    return;
  }

  var html = '';
  var daysMap = { '*': 'ทุกวัน', '0':'อาทิตย์', '1':'จันทร์', '2':'อังคาร', '3':'พุธ', '4':'พฤหัสบดี', '5':'ศุกร์', '6':'เสาร์' };

  _dwRules.forEach(function(r, idx) {
    var timeLabel = (r.timeSlot && r.timeSlot !== '*')
      ? r.timeSlot.replace('-', ' - ')
      : (r.breakIdx ? ('เบรค ' + r.breakIdx) : 'ทุกช่วงเวลา');
    var desc = esc(r.venue) + ' | ' + (daysMap[r.day] || r.day) + ' | ' + esc(timeLabel);
    desc += '<br>📅 ' + esc(r.startDate || '-') + ' ถึง ' + esc(r.endDate || '-');
    var amt;
    if (r.type === 'fixed') amt = 'ราคาใหม่: ฿' + Number(r.amount).toLocaleString('th-TH') + '/เบรค';
    else if (r.type === 'percent') amt = 'ลด ' + Number(r.amount) + '% ต่อเบรค';
    else amt = 'หักออก: ฿' + Number(r.amount).toLocaleString('th-TH') + '/คน/เบรค';

    html += '<div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #e2e8f0;padding:8px;border-radius:4px;margin-bottom:6px">';
    html += '<div style="font-size:11px;line-height:1.4"><b>' + desc + '</b><br><span style="color:#e53e3e;font-weight:600">' + amt + '</span></div>';
    html += '<button type="button" class="btn btn-sm" style="background:#fef2f2;color:#e53e3e;border:1px solid #fecaca;padding:4px 8px" onclick="removeDWRule(' + idx + ')">ลบ</button>';
    html += '</div>';
  });
  list.innerHTML = html;
}

function addDiscountRule() {
  var vEl = document.getElementById('dwVenue');
  var dEl = document.getElementById('dwDay');
  var tsEl = document.getElementById('dwTimeSlot') || document.getElementById('dwBreak');
  var sdEl = document.getElementById('dwStartDate');
  var edEl = document.getElementById('dwEndDate');
  var tEl = document.getElementById('dwType');
  var aEl = document.getElementById('dwAmount');

  var venue = vEl ? vEl.value : '';
  var day = dEl ? dEl.value : '*';
  var timeSlot = tsEl ? tsEl.value : '*';
  var sd = sdEl ? sdEl.value : '';
  var ed = edEl ? edEl.value : '';
  var type = tEl ? tEl.value : 'discount';
  var amt = parseFloat(aEl ? aEl.value : '');

  if (!venue) { alert('กรุณาเลือกร้าน'); return; }
  if (type === 'percent') {
    if (isNaN(amt) || amt <= 0 || amt > 100) { alert('กรุณากรอกเปอร์เซ็นต์ที่ถูกต้อง (1-100)'); return; }
  } else {
    if (isNaN(amt) || amt < 0) { alert('กรุณากรอกจำนวนเงินให้ถูกต้อง'); return; }
  }

  _dwRules.push({
    venue: venue,
    day: day,
    timeSlot: timeSlot,
    startDate: sd,
    endDate: ed,
    type: type,
    amount: amt
  });

  renderDWRules();
  _saveDWSettings();
  if (aEl) aEl.value = '';
}

function removeDWRule(idx) {
  if (confirm('ลบเงื่อนไขนี้?')) {
    _dwRules.splice(idx, 1);
    renderDWRules();
    _saveDWSettings();
  }
}

function _saveDWSettings() {
  var bandId = localStorage.getItem('bandId') || '';
  if (!bandId) return;
  var enabled = document.getElementById('discountWageToggle') ? document.getElementById('discountWageToggle').checked : false;

  apiCall('getBandSettings', { bandId: bandId }, function(r) {
    var current = (r && r.success && r.data) ? r.data : {};
    current.bandId = bandId;
    current.discount_wage_enabled = enabled;
    current.discount_wage_rules = JSON.stringify(_dwRules || []);

    apiCall('saveBandSettings', current, function(r2) {
      if (r2 && r2.success) {
        showToast('บันทึกการตั้งค่าลดราคาค่าแรงแล้ว ✅', 'success');
      }
    });
  });
}



/* ══════════════════════════════════════════
   INIT & EVENT LISTENERS
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  if (typeof requireAuth === 'function') requireAuth();
  checkAdGate();
  if (typeof renderMainNav === 'function') renderMainNav('mainNav');

  // Plan badge — ฟรีทุกฟีเจอร์ (แสดงเป็น Pro ถาวร)
  (function() {
    var badge = document.getElementById('planBadge');
    var desc  = document.getElementById('planDesc');
    var btn   = document.getElementById('upgradeBtn');
    if (badge) {
      badge.textContent = 'Pro';
      badge.style.background = '#d97706';
      badge.style.color = '#fff';
    }
    if (desc) desc.textContent = 'ฟรีทุกฟีเจอร์ — ไม่มีค่าใช้จ่าย';
    if (btn) btn.style.display = 'none';
  })();

  if (typeof applyTranslations === 'function') applyTranslations();

  // Wire up core band settings buttons
  var ev = getEl('addVenueNameBtn'); if (ev) ev.addEventListener('click', function(e) { e.preventDefault(); addVenue(); });
  var es = getEl('saveBtn');         if (es) es.addEventListener('click', function(e) { e.preventDefault(); saveBandSettings(); });
  var pp = getEl('payrollPeriod');   if (pp) pp.addEventListener('change', function() { payroll.period = this.value; renderPayrollSettings(); });

  // LINE listeners if present
  var le = document.getElementById('lineEnabled');
  if (le) {
    le.addEventListener('change', function() {
      var on = this.checked;
      _updateLineToggle('lineEnabled', 'lineEnabledTrack', 'lineEnabledThumb', 'lineEnabledLabel', on, true);
      if (_lineConfigId) {
        apiCall('saveVenueLineConfig', { id: _lineConfigId, enabled: on }, function(r) {
          var msgEl = document.getElementById('lineMsg');
          if (r && r.success) {
            if (msgEl) { msgEl.style.color = 'var(--accent-success,#38a169)'; msgEl.textContent = on ? '✅ เปิดระบบ LINE แล้ว' : '⏸️ ปิดระบบ LINE แล้ว'; }
          } else {
            if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ บันทึกไม่สำเร็จ'; }
          }
        });
      }
    });
  }
  var lw = document.getElementById('lineWeeklyEnabled');
  if (lw) {
    lw.addEventListener('change', function() {
      var on = this.checked;
      _updateLineToggle('lineWeeklyEnabled', 'lineWeeklyTrack', 'lineWeeklyThumb', 'lineWeeklyLabel', on, false);
      if (_lineConfigId) {
        apiCall('saveVenueLineConfig', { id: _lineConfigId, send_weekly_enabled: on }, function() {});
      }
    });
  }

  // Show notification admin panel & DW for admin/manager
  var _role = localStorage.getItem('userRole') || '';
  if (_role === 'admin' || _role === 'manager') {
    var card = document.getElementById('notifAdminCard');
    if (card) card.style.display = '';
    loadNotifAdminPanel();
    loadAutoNotifState();
    loadDWState();
  } else {
    loadDWState();
  }

  // Show Gemini section for admin only
  if (_role === 'admin') {
    var gemSec = document.getElementById('geminiSection');
    if (gemSec) gemSec.style.display = '';
    loadGeminiKey();
  }

  // Hide all write-buttons for members
  if (_role !== 'admin' && _role !== 'manager') {
    document.querySelectorAll('#saveBtn, #addVenueNameBtn, .btn-danger, [onclick*="remove"], [onclick*="delete"]').forEach(function(b){ b.style.display='none'; });
    document.querySelectorAll('input, select, textarea').forEach(function(el){
      if (el.type !== 'hidden') el.disabled = true;
    });
    var hdr = document.querySelector('.page-header');
    if (hdr) {
      var info = document.createElement('div');
      info.className = 'badge';
      info.style.cssText = 'background:#f59e0b;color:#fff;padding:6px 14px;border-radius:8px;font-size:var(--text-sm)';
      info.textContent = '👁️ โหมดดูอย่างเดียว — เฉพาะผู้จัดการวงแก้ไขได้';
      hdr.appendChild(info);
    }
  }

  // Load all band settings from storage & Supabase
  loadBandSettings();
});
