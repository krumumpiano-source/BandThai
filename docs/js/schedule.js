/**
 * Schedule Page JavaScript
 * ตารางงาน — ดูรายคน/ทั้งวง เพิ่มงานนอก ดูย้อนหลัง
 * Ported from old frontend — uses apiCall() instead of apiCall()
 */

var currentBandId = null;
var bandMembersData = [];
var scheduleData = [];
var filters = {
  viewType: 'all',
  memberId: '',
  periodType: 'daily',
  date: '',
  week: '',
  startDate: '',
  endDate: ''
};

function getEl(id) { return document.getElementById(id); }
function schLocalDate(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }

function escapeHtml(text) {
  if (!text) return '';
  var d = document.createElement('div'); d.textContent = text; return d.innerHTML;
}

function showToast(message) {
  var toast = getEl('toast');
  if (toast) {
    var m = toast.querySelector('.toast-message');
    if (m) m.textContent = message;
    toast.style.display = 'block'; toast.classList.add('show');
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.style.display = 'none'; }, 300);
    }, 3000);
  } else { alert(message); }
}

function formatDateThai(date) {
  var MS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return date.getDate() + ' ' + MS[date.getMonth()] + ' ' + (date.getFullYear() + 543);
}

function getWeekNumber(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getWeekStartDate(year, week) {
  var date = new Date(year, 0, 1);
  var dayOfWeek = date.getDay();
  date.setDate(date.getDate() + (week - 1) * 7 - dayOfWeek);
  return date;
}

/* ===== LOAD ===== */
function loadBandData() {
  currentBandId = localStorage.getItem('bandId') || sessionStorage.getItem('bandId');

  // Load members from localStorage bandSettings (fallback)
  var stored = localStorage.getItem('bandSettings');
  if (stored) {
    try {
      var settings = JSON.parse(stored);
      if (settings.members && settings.members.length > 0) bandMembersData = settings.members;
    } catch(e) {}
  }

  // Load profile-based members from API (source of truth)
  if (currentBandId && typeof apiCall === 'function') {
    apiCall('getBandProfiles', { bandId: currentBandId }, function(r) {
      if (r && r.success && r.data && r.data.length > 0) {
        bandMembersData = r.data.map(function(p) {
          var displayName = p.nickname || p.first_name || p.user_name || p.email || '?';
          return { id: p.id, memberId: p.id, name: displayName, position: p.instrument || '' };
        });
        // Save to localStorage for offline use
        var s = JSON.parse(localStorage.getItem('bandSettings') || '{}');
        s.members = bandMembersData;
        localStorage.setItem('bandSettings', JSON.stringify(s));
        renderMemberFilter();
        renderMemberCheckboxes();
      }
    });
  }

  // Load schedule from API
  if (currentBandId && typeof apiCall === 'function') {
    apiCall('getSchedule', { bandId: currentBandId }, function(result) {
      if (result && result.success && Array.isArray(result.data)) {
        scheduleData = result.data;
        localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
      } else {
        var ls = localStorage.getItem('scheduleData');
        if (ls) try { scheduleData = JSON.parse(ls); } catch(e) { scheduleData = []; }
      }
      renderMemberFilter();
      renderScheduleTable();
      updateSummary();
    });
  } else {
    var ls = localStorage.getItem('scheduleData');
    if (ls) try { scheduleData = JSON.parse(ls); } catch(e) { scheduleData = []; }
    renderMemberFilter();
    renderScheduleTable();
    updateSummary();
  }
}

function saveScheduleData(callback) {
  var data = { bandId: currentBandId, scheduleData: scheduleData };
  if (typeof apiCall === 'function' && currentBandId) {
    apiCall('saveSchedule', data, function(result) {
      localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
      if (callback) callback(result && result.success);
    });
  } else {
    localStorage.setItem('scheduleData', JSON.stringify(scheduleData));
    if (callback) callback(true);
  }
}

/* ===== MEMBER FILTER ===== */
function renderMemberFilter() {
  var sel = getEl('memberFilter');
  if (!sel) return;
  sel.innerHTML = '<option value="">เลือกสมาชิก</option>';
  bandMembersData.forEach(function(m) {
    var opt = document.createElement('option');
    opt.value = m.id; opt.textContent = escapeHtml(m.name);
    sel.appendChild(opt);
  });
}

/* ===== FILTER LOGIC ===== */
function filterScheduleData() {
  var filtered = scheduleData.slice();
  if (filters.viewType === 'individual' && filters.memberId) {
    filtered = filtered.filter(function(g) { return g.members && g.members.includes(filters.memberId); });
  }
  if (filters.periodType === 'daily' && filters.date) {
    filtered = filtered.filter(function(g) { return g.date === filters.date; });
  } else if (filters.periodType === 'weekly' && filters.week) {
    var parts = filters.week.split('-W');
    var start = getWeekStartDate(parseInt(parts[0]), parseInt(parts[1]));
    var end = new Date(start); end.setDate(end.getDate() + 6);
    filtered = filtered.filter(function(g) {
      var d = new Date(g.date); return d >= start && d <= end;
    });
  } else if (filters.periodType === 'history' && filters.startDate && filters.endDate) {
    var s = new Date(filters.startDate), e = new Date(filters.endDate);
    filtered = filtered.filter(function(g) { var d = new Date(g.date); return d >= s && d <= e; });
  }
  filtered.sort(function(a, b) {
    var dc = new Date(a.date) - new Date(b.date);
    return dc !== 0 ? dc : a.startTime.localeCompare(b.startTime);
  });
  return filtered;
}

/* ===== RENDER TABLE ===== */
function renderScheduleTable() {
  var thead = getEl('scheduleTableHead');
  var tbody = getEl('scheduleTableBody');
  var noData = getEl('noScheduleData');
  if (!thead || !tbody) return;

  var filtered = filterScheduleData();
  var dayNames = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  var _t = typeof t === 'function' ? t : function(k){ return k; };

  if (filtered.length === 0) {
    thead.innerHTML = ''; tbody.innerHTML = '';
    if (noData) noData.style.display = 'block';
    return;
  }
  if (noData) noData.style.display = 'none';

  var header = '<tr>';
  if (filters.periodType === 'daily') {
    header += '<th>เวลา</th><th>สถานที่</th><th>ประเภท</th>';
    if (filters.viewType === 'all') header += '<th>สมาชิก</th>';
    header += '<th>ราคา</th><th>รายละเอียด</th><th>การจัดการ</th>';
  } else if (filters.periodType === 'weekly') {
    header += '<th>วัน</th><th>วันที่</th><th>เวลา</th><th>สถานที่</th><th>ประเภท</th>';
    if (filters.viewType === 'all') header += '<th>สมาชิก</th>';
    header += '<th>ราคา</th><th>รายละเอียด</th><th>การจัดการ</th>';
  } else {
    header += '<th>วันที่</th><th>เวลา</th><th>สถานที่</th><th>ประเภท</th>';
    if (filters.viewType === 'all') header += '<th>สมาชิก</th>';
    header += '<th>ราคา</th><th>รายละเอียด</th><th>การจัดการ</th>';
  }
  header += '</tr>';
  thead.innerHTML = header;

  function gigTypeLabel(type) {
    return (type === 'venue' || type === 'regular') ? 'งานปกติ' : 'งานนอก';
  }
  function gigTypeClass(type) {
    return (type === 'venue' || type === 'regular') ? 'regular' : 'external';
  }
  function memberNames(gig) {
    if (!gig.members) return '-';
    return gig.members.map(function(mid) {
      var m = bandMembersData.find(function(x) { return x.id === mid; });
      return m ? escapeHtml(m.name) : '';
    }).filter(Boolean).join(', ') || '-';
  }
  function payoutLink(gig, idx) {
    if ((gig.type === 'external' || gig.type === 'event') && gig.sourceContractId) {
      return '<a href="external-payout.html?gigId=' + encodeURIComponent(gig.id) + '" class="btn-icon-tiny payout" title="เบิกจ่าย">💰</a>';
    } else if (gig.type === 'venue' || gig.type === 'regular') {
      return '<a href="attendance-payroll.html?venue=' + encodeURIComponent(gig.venue) + '&date=' + encodeURIComponent(gig.date) + '" class="btn-icon-tiny payout" title="เบิกจ่าย">💰</a>';
    }
    return '';
  }

  var body = '';
  filtered.forEach(function(gig, idx) {
    var date = new Date(gig.date);
    var dayName = dayNames[date.getDay()];
    var dateF = formatDateThai(date);
    var typeClass = gigTypeClass(gig.type);
    var typeLabel = gigTypeLabel(gig.type);
    var price = parseFloat(gig.price || 0).toLocaleString('th-TH');
    var actions = payoutLink(gig, idx) +
      '<button type="button" class="btn-icon-tiny edit" onclick="editGig(' + idx + ')" title="แก้ไข">✏️</button>' +
      '<button type="button" class="btn-icon-tiny delete" onclick="deleteGig(' + idx + ')" title="ลบ">🗑️</button>';
    var details = '<div class="gig-title">' + escapeHtml(gig.description || '-') + '</div>' +
      (gig.contact ? '<div class="gig-info">📞 ' + escapeHtml(gig.contact) + '</div>' : '');

    body += '<tr class="gig-row">';
    if (filters.periodType === 'daily') {
      body += '<td>' + escapeHtml(gig.startTime) + ' - ' + escapeHtml(gig.endTime) + '</td>';
      body += '<td>' + escapeHtml(gig.venue) + '</td>';
      body += '<td><span class="gig-type-badge ' + typeClass + '">' + typeLabel + '</span></td>';
      if (filters.viewType === 'all') body += '<td>' + memberNames(gig) + '</td>';
    } else if (filters.periodType === 'weekly') {
      body += '<td>' + dayName + '</td>';
      body += '<td>' + dateF + '</td>';
      body += '<td>' + escapeHtml(gig.startTime) + ' - ' + escapeHtml(gig.endTime) + '</td>';
      body += '<td>' + escapeHtml(gig.venue) + '</td>';
      body += '<td><span class="gig-type-badge ' + typeClass + '">' + typeLabel + '</span></td>';
      if (filters.viewType === 'all') body += '<td>' + memberNames(gig) + '</td>';
    } else {
      body += '<td>' + dateF + '</td>';
      body += '<td>' + escapeHtml(gig.startTime) + ' - ' + escapeHtml(gig.endTime) + '</td>';
      body += '<td>' + escapeHtml(gig.venue) + '</td>';
      body += '<td><span class="gig-type-badge ' + typeClass + '">' + typeLabel + '</span></td>';
      if (filters.viewType === 'all') body += '<td>' + memberNames(gig) + '</td>';
    }
    body += '<td class="gig-price-cell">' + price + ' บาท</td>';
    body += '<td class="gig-details-cell">' + details + '</td>';
    body += '<td class="gig-actions-cell">' + actions + '</td>';
    body += '</tr>';
  });
  tbody.innerHTML = body;
}

/* ===== SUMMARY ===== */
function updateSummary() {
  var filtered = filterScheduleData();
  var t1 = getEl('totalGigs'), r1 = getEl('regularGigs'), e1 = getEl('externalGigs'), rev = getEl('totalRevenue');
  if (t1) t1.textContent = filtered.length;
  if (r1) r1.textContent = filtered.filter(function(g){ return g.type==='venue'||g.type==='regular'; }).length;
  if (e1) e1.textContent = filtered.filter(function(g){ return g.type==='external'||g.type==='event'; }).length;
  if (rev) rev.textContent = filtered.reduce(function(s,g){ return s+parseFloat(g.price||0); }, 0).toLocaleString('th-TH') + ' บาท';
}

/* ===== FILTER HANDLERS ===== */
function handleViewTypeChange() {
  var v = getEl('viewType')?.value || 'all';
  filters.viewType = v;
  var mg = getEl('memberFilterGroup');
  if (mg) mg.style.display = v === 'individual' ? 'block' : 'none';
  if (v === 'all') filters.memberId = '';
}

function handlePeriodTypeChange() {
  var p = getEl('periodType')?.value || 'daily';
  filters.periodType = p;
  var dg = getEl('dateFilterGroup'), wg = getEl('weekFilterGroup'), hg = getEl('historyDateGroup');
  if (dg) dg.style.display = p === 'daily' ? 'block' : 'none';
  if (wg) wg.style.display = p === 'weekly' ? 'block' : 'none';
  if (hg) hg.style.display = p === 'history' ? 'block' : 'none';
}

function applyFilters() {
  filters.viewType = getEl('viewType')?.value || 'all';
  filters.memberId = getEl('memberFilter')?.value || '';
  filters.periodType = getEl('periodType')?.value || 'daily';
  filters.date = getEl('dateFilter')?.value || '';
  filters.week = getEl('weekFilter')?.value || '';
  filters.startDate = getEl('historyStartDate')?.value || '';
  filters.endDate = getEl('historyEndDate')?.value || '';
  renderScheduleTable();
  updateSummary();
}

/* ===== MODAL ===== */
function openAddExternalGigModal() {
  var modal = getEl('addExternalGigModal');
  if (!modal) return;
  var form = getEl('externalGigForm');
  if (form) { form.reset(); form.onsubmit = saveExternalGig; }
  var gigDate = getEl('gigDate');
  if (gigDate) gigDate.value = schLocalDate(new Date());
  renderMemberCheckboxes();
  modal.style.display = 'flex';
}

function closeModal() {
  var modal = getEl('addExternalGigModal');
  if (modal) modal.style.display = 'none';
}

function renderMemberCheckboxes() {
  var list = getEl('gigMembersList');
  if (!list) return;
  list.innerHTML = bandMembersData.map(function(m) {
    return '<div class="member-checkbox-item">' +
      '<input type="checkbox" id="gm_' + m.id + '" name="gigMembers" value="' + m.id + '">' +
      '<label for="gm_' + m.id + '">' + escapeHtml(m.name) + '</label>' +
      '</div>';
  }).join('');
}

function saveExternalGig(event) {
  if (event) event.preventDefault();
  var form = getEl('externalGigForm');
  if (!form) return;
  var gigDate = getEl('gigDate')?.value;
  var gigStartTime = getEl('gigStartTime')?.value;
  var gigEndTime = getEl('gigEndTime')?.value;
  var gigVenue = getEl('gigVenue')?.value;
  var gigAddress = getEl('gigAddress')?.value;
  var gigPrice = getEl('gigPrice')?.value;
  var gigDescription = getEl('gigDescription')?.value;
  var gigContact = getEl('gigContact')?.value;
  var selectedMembers = Array.from(form.querySelectorAll('input[name="gigMembers"]:checked')).map(function(cb){ return cb.value; });
  if (!gigDate || !gigStartTime || !gigEndTime || !gigVenue || !gigPrice) {
    showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
    return false;
  }
  var newGig = {
    id: 'gig_' + Date.now(),
    type: 'external',
    date: gigDate, startTime: gigStartTime, endTime: gigEndTime,
    venue: gigVenue, address: gigAddress || '',
    price: parseFloat(gigPrice) || 0,
    description: gigDescription || '',
    contact: gigContact || '',
    members: selectedMembers,
    createdAt: new Date().toISOString()
  };
  scheduleData.push(newGig);
  saveScheduleData(function() {
    closeModal();
    renderScheduleTable();
    updateSummary();
    showToast('เพิ่มงานนอกเรียบร้อยแล้ว');
  });
}

function editGig(index) {
  var filtered = filterScheduleData();
  if (index < 0 || index >= filtered.length) return;
  var gig = filtered[index];
  var actualIdx = scheduleData.findIndex(function(g){ return g.id === gig.id; });
  if (actualIdx === -1) return;
  openAddExternalGigModal();
  setTimeout(function() {
    var form = getEl('externalGigForm');
    if (!form) return;
    if (getEl('gigDate')) getEl('gigDate').value = gig.date;
    if (getEl('gigStartTime')) getEl('gigStartTime').value = gig.startTime;
    if (getEl('gigEndTime')) getEl('gigEndTime').value = gig.endTime;
    if (getEl('gigVenue')) getEl('gigVenue').value = gig.venue;
    if (getEl('gigAddress')) getEl('gigAddress').value = gig.address || '';
    if (getEl('gigPrice')) getEl('gigPrice').value = gig.price;
    if (getEl('gigDescription')) getEl('gigDescription').value = gig.description || '';
    if (getEl('gigContact')) getEl('gigContact').value = gig.contact || '';
    (gig.members || []).forEach(function(mid) {
      var cb = form.querySelector('input[name="gigMembers"][value="' + mid + '"]');
      if (cb) cb.checked = true;
    });
    form.onsubmit = function(e) {
      e.preventDefault();
      scheduleData[actualIdx] = Object.assign({}, scheduleData[actualIdx], {
        date: getEl('gigDate')?.value,
        startTime: getEl('gigStartTime')?.value,
        endTime: getEl('gigEndTime')?.value,
        venue: getEl('gigVenue')?.value,
        address: getEl('gigAddress')?.value,
        price: parseFloat(getEl('gigPrice')?.value) || 0,
        description: getEl('gigDescription')?.value || '',
        contact: getEl('gigContact')?.value || '',
        members: Array.from(form.querySelectorAll('input[name="gigMembers"]:checked')).map(function(cb){ return cb.value; }),
        updatedAt: new Date().toISOString()
      });
      saveScheduleData(function() {
        closeModal();
        renderScheduleTable();
        updateSummary();
        showToast('แก้ไขงานเรียบร้อยแล้ว');
        form.onsubmit = saveExternalGig;
      });
    };
  }, 100);
}

function deleteGig(index) {
  var filtered = filterScheduleData();
  if (index < 0 || index >= filtered.length) return;
  var gig = filtered[index];
  if (!confirm('ต้องการลบงาน "' + gig.venue + '" หรือไม่?')) return;
  var ai = scheduleData.findIndex(function(g){ return g.id === gig.id; });
  if (ai !== -1) {
    scheduleData.splice(ai, 1);
    saveScheduleData(function() {
      renderScheduleTable();
      updateSummary();
      showToast('ลบงานเรียบร้อยแล้ว');
    });
  }
}

/* ===== WEEKLY TIMETABLE ===== */
var weeklyVenues = [];
var weeklySchedule = {};

function loadWeeklyTimetable() {
  var stored = localStorage.getItem('bandSettings');
  if (stored) {
    try {
      var s = JSON.parse(stored);
      weeklyVenues = (s.venues || []).map(function(v) {
        return { id: v.id || v.venueId || '', name: v.name || v.venueName || '' };
      });
      weeklySchedule = s.schedule || {};
      // Use bandMembersData which is already profile-synced from loadBandData
    } catch(e) {}
  }
  renderWeeklyTimetable();
  if (currentBandId && typeof apiCall === 'function') {
    apiCall('getBandSettings', { bandId: currentBandId }, function(r) {
      if (r && r.success && r.data) {
        if (r.data.venues) weeklyVenues = r.data.venues.map(function(v) { return { id: v.id || v.venueId || '', name: v.name || v.venueName || '' }; });
        if (r.data.schedule) weeklySchedule = r.data.schedule;
        renderWeeklyTimetable();
      }
    });
  }
}

function renderWeeklyTimetable() {
  var container = getEl('weeklyTimetable');
  if (!container) return;
  var dayNames = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  var today = new Date().getDay();

  var hasAny = false;
  for (var d = 0; d < 7; d++) {
    var sl = weeklySchedule[d] || weeklySchedule[String(d)];
    var sArr = Array.isArray(sl) ? sl : (sl && sl.timeSlots ? sl.timeSlots : []);
    if (sArr.length) { hasAny = true; break; }
  }

  if (!hasAny) {
    container.innerHTML = '<div style="text-align:center;padding:var(--spacing-lg);color:var(--premium-text-muted);grid-column:1/-1">ยังไม่ได้กำหนดตารางงานสัปดาห์<br><span style="font-size:12px">ตั้งค่าได้ที่หน้า ตั้งค่าวง</span></div>';
    return;
  }

  var html = '';
  for (var d = 0; d < 7; d++) {
    var sl = weeklySchedule[d] || weeklySchedule[String(d)];
    var slots = Array.isArray(sl) ? sl : (sl && sl.timeSlots ? sl.timeSlots : []);
    var isToday = d === today;
    html += '<div class="wt-day' + (isToday ? ' wt-today' : '') + (slots.length ? '' : ' wt-off') + '">';
    html += '<div class="wt-day-name">' + dayNames[d] + (isToday ? ' <span class="wt-badge-today">วันนี้</span>' : '') + '</div>';
    if (slots.length) {
      slots.forEach(function(slot) {
        var venue = weeklyVenues.find(function(v) { return v.id === slot.venueId; });
        var venueName = venue ? venue.name : '';
        var memberNames = (slot.members || []).map(function(mr) {
          var mid = mr.memberId || mr;
          var m = bandMembersData.find(function(x) { return x.id === mid; });
          return m ? m.name : '';
        }).filter(Boolean).join(', ');
        html += '<div class="wt-slot">';
        html += '<span class="wt-time">🕐 ' + escapeHtml(slot.startTime || '') + ' – ' + escapeHtml(slot.endTime || '') + '</span>';
        if (venueName) html += '<span class="wt-venue">📍 ' + escapeHtml(venueName) + '</span>';
        if (memberNames) html += '<span class="wt-members">👥 ' + escapeHtml(memberNames) + '</span>';
        html += '</div>';
      });
    } else {
      html += '<div class="wt-off-text">— ว่าง —</div>';
    }
    html += '</div>';
  }
  container.innerHTML = html;
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', function() {
  var today = new Date();
  var todayStr = schLocalDate(today);

  var dateFilter = getEl('dateFilter');
  if (dateFilter) { dateFilter.value = todayStr; filters.date = todayStr; }

  var weekFilter = getEl('weekFilter');
  if (weekFilter) {
    var w = getWeekNumber(today);
    weekFilter.value = today.getFullYear() + '-W' + String(w).padStart(2,'0');
    filters.week = weekFilter.value;
  }

  var hs = getEl('historyStartDate'), he = getEl('historyEndDate');
  if (hs && he) {
    var end = new Date(), start = new Date();
    start.setDate(start.getDate() - 30);
    hs.value = schLocalDate(start);
    he.value = schLocalDate(end);
    filters.startDate = hs.value; filters.endDate = he.value;
  }

  var vt = getEl('viewType');
  if (vt) vt.addEventListener('change', handleViewTypeChange);
  var pt = getEl('periodType');
  if (pt) { pt.addEventListener('change', function() { handlePeriodTypeChange(); renderScheduleTable(); updateSummary(); }); handlePeriodTypeChange(); }
  var applyBtn = getEl('applyFiltersBtn');
  if (applyBtn) applyBtn.addEventListener('click', applyFilters);
  var addBtn = getEl('addExternalGigBtn');
  if (addBtn) addBtn.addEventListener('click', openAddExternalGigModal);
  var closeBtn = getEl('closeModalBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  var cancelBtn = getEl('cancelGigBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  var gigForm = getEl('externalGigForm');
  if (gigForm) gigForm.addEventListener('submit', saveExternalGig);
  var modal = getEl('addExternalGigModal');
  if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });

  loadBandData();
  loadWeeklyTimetable();
});
