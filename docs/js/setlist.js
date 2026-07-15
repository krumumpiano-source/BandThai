// ── State ────────────────────────────────────────────────────────────────
  var allSongs     = [];
  var setsData     = {};      // { "1":[...], "2":[...] }
  var currentSetIdx= null;   // active set key (string '1','2',...)
  var todaySlots   = [];     // raw schedule time_slots for selected date
  var adUnlocked   = 0;      // extra sets unlocked via ad this session
  var adPendingSet = null;   // set index awaiting ad completion
  var adTimer      = null;
  var autoSaveTimer = null;   // debounce handle
  var lastSavedHash = '';     // detect real changes
  var _dateChangeReqId = 0;
  var todayBannedGenres = []; // genres banned at today's venue(s)

  function loadVenueBannedGenres(venueNamesList) {
    todayBannedGenres = [];
    try {
      var bs = JSON.parse(localStorage.getItem('bandSettings') || '{}');
      (bs.venues || []).forEach(function(v) {
        if (v.name && venueNamesList.indexOf(v.name) >= 0 && Array.isArray(v.bannedGenres)) {
          v.bannedGenres.forEach(function(g) {
            if (todayBannedGenres.indexOf(g) < 0) todayBannedGenres.push(g);
          });
        }
      });
    } catch(e) { todayBannedGenres = []; }
  }

  var PLAN_LIMIT = { free: 8, lite: 8, pro: 8 }; // ฟรีทุกฟีเจอร์ — ทุก plan ได้ 8 เซ็ต

  function getPlan() {
    return localStorage.getItem('plan_override') || localStorage.getItem('band_plan') || 'free';
  }

  function getMaxSets() {
    var plan  = getPlan();
    var cap   = PLAN_LIMIT[plan] || 0;
    if (cap > 0) return cap;
    // free: schedule count + ad unlocks
    return Math.max(1, todaySlots.length) + adUnlocked;
  }

  function getSelectedDate() {
    return document.getElementById('datePickerEl').value || '';
  }

  // ── Init ────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
    checkAdGate();
    renderMainNav('mainNav');
    applyTranslations();

    // Default date = today
    var t = new Date();
    document.getElementById('datePickerEl').value =
      t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');

    // Plan badge
    var plan = getPlan();
    var planLabel = { free:'🆓 Free', lite:'🎵 Lite', pro:'👑 Pro' };
    document.getElementById('planBadgeEl').textContent = planLabel[plan] || plan.toUpperCase();

    // Initialize key button text
    var keyBtn = document.getElementById('keyModeBtn');
    if (keyBtn) keyBtn.textContent = getKeyDisplayMode() === 'number' ? '🔤 อักษร' : '🔢 ตัวเลข';

    // Load songs pool
    apiCall('getAllSongs', {}, function(r) {
      allSongs = (r && r.success && r.data) ? r.data : [];
      renderPool();
    });

    onDateChange();

    // Auto-save on tab/window close
    window.addEventListener('beforeunload', function() {
      var date = getSelectedDate();
      if (date && Object.keys(setsData).length) {
        apiCall('saveSetlist', { date: date, sets: setsData }, function(){});
      }
    });

    // Auto-refresh when user comes back from another page
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) {
        apiCall('getAllSongs', {}, function(r) {
          allSongs = (r && r.success && r.data) ? r.data : [];
          renderPool();
        });
        onDateChange();
      }
    });
  });

  // ── Key Display Mode Toggle ──
  function toggleKeyMode() {
    toggleKeyDisplayMode();
    var newMode = getKeyDisplayMode();
    var btn = document.getElementById('keyModeBtn');
    if (btn) btn.textContent = newMode === 'number' ? '🔤 อักษร' : '🔢 ตัวเลข';
    renderPool();
  }

  // ── Date change ─────────────────────────────────────────────────────────
  function onDateChange() {
    var date = getSelectedDate();
    if (!date) return;
    currentSetIdx = null;
    setsData      = {};
    todaySlots    = [];
    adUnlocked    = 0;
    lastSavedHash = '';

    document.getElementById('setBuilder').style.display = 'none';
    document.getElementById('setBuilderPlaceholder').style.display = '';
    document.getElementById('setTabs').innerHTML = '<div style="color:var(--premium-text-muted);font-size:.82rem">กำลังโหลด...</div>';
    document.getElementById('scheduleInfoEl').textContent = 'กำลังโหลด...';

    var reqId = ++_dateChangeReqId;
    var schedDone = false, setsDone = false;
    function tryBuild() { if (reqId !== _dateChangeReqId) return; if (schedDone && setsDone) buildUI(); }

    apiCall('getScheduleForDate', { date: date }, function(r) {
      if (reqId !== _dateChangeReqId) return;
      todaySlots  = (r && r.slots)     || [];
      var scheds  = (r && r.schedules) || [];
      // Load banned genres for today's venues
      var todayVenueNames = scheds.map(function(s){ return s.venueName || s.venue || ''; }).filter(Boolean);
      loadVenueBannedGenres(todayVenueNames);
      var infoEl  = document.getElementById('scheduleInfoEl');
      if (!scheds.length) {
        infoEl.innerHTML = '<span style="opacity:.6">ไม่มีตารางงานในวันนี้</span>';
      } else {
        var venues = scheds.map(function(s){ return escapeHtml(s.venueName || s.venue || ''); }).filter(Boolean);
        infoEl.innerHTML = venues.join(' · ') +
          ' <span style="opacity:.6">(' + todaySlots.length + ' สล็อต)</span>';
      }
      schedDone = true;
      tryBuild();
    });

    apiCall('getSetlist', { date: date }, function(r) {
      if (reqId !== _dateChangeReqId) return;
      setsData = (r && r.data) || {};
      setsDone = true;
      tryBuild();
    });
  }

  // ── Build UI ────────────────────────────────────────────────────────────
  function buildUI() {
    // Mark current DB state as "already saved" so autoSave doesn't fire on load
    lastSavedHash = JSON.stringify(setsData);
    renderSetTabs();
    renderQuota();
    renderPool();

    // Auto-select เซ็ตแรกที่มีข้อมูลบันทึกไว้ → แสดงลิสต์โดยอัตโนมัติ
    var savedKeys = Object.keys(setsData)
      .map(Number)
      .filter(function(n){ return !isNaN(n) && n > 0 && (setsData[String(n)] || []).length > 0; });
    if (savedKeys.length) {
      savedKeys.sort(function(a, b){ return a - b; });
      currentSetIdx = String(savedKeys[0]);
      renderSetTabs();
      renderSetBuilder();
      renderPool();
    }
  }

  function renderSetTabs() {
    var max    = getMaxSets();
    // Existing saved sets count
    var savedKeys = Object.keys(setsData).map(Number).filter(function(n){ return !isNaN(n) && n > 0; });
    var maxKey = savedKeys.length ? Math.max.apply(null, savedKeys) : 0;
    var count  = Math.max(max, maxKey, todaySlots.length || 1);

    var html = '';
    for (var i = 1; i <= count; i++) {
      var si      = String(i);
      var songs   = setsData[si] || [];
      var hasData = songs.length > 0;
      // locked เฉพาะเซ็ตว่างที่เกินโควตา — ถ้ามีข้อมูลแล้วให้แก้ไขได้เสมอ
      var tooMany = !hasData && (i > getMaxSets());
      var label   = 'เซ็ต ' + i;
      var ts      = todaySlots[i - 1];
      if (ts) label += ' · ' + (typeof ts === 'string' ? ts : (ts.label || ''));
      var badge   = songs.length ? '<span class="tab-badge">' + songs.length + '</span>' : '';
      var cls     = 'set-tab' + (currentSetIdx === si ? ' active' : '') + (tooMany ? ' locked' : '');
      html += '<button class="' + cls + '" onclick="selectSet(\'' + si + '\')">' + escapeHtml(label) + badge + '</button>';
    }

    document.getElementById('setTabs').innerHTML = html || '<div style="color:var(--premium-text-muted);font-size:.82rem">—</div>';
  }

  function renderQuota() {
    var plan   = getPlan();
    var cap    = PLAN_LIMIT[plan] || 0;
    var base   = Math.max(todaySlots.length, 1);
    var max    = cap > 0 ? cap : base + adUnlocked;
    var used   = Object.keys(setsData).filter(function(k){ return (setsData[k]||[]).length > 0; }).length;
    var dots   = '';
    for (var i = 1; i <= max && i <= 12; i++) {
      var cls = i <= used ? 'used' : (i <= base ? 'sched' : '');
      dots += '<div class="q-dot ' + cls + '"></div>';
    }
    document.getElementById('quotaDots').innerHTML = dots;
    var txt = used + '/' + max;
    if (cap === 0 && adUnlocked > 0) txt += ' (+' + adUnlocked + ' โฆษณา)';
    document.getElementById('quotaText').textContent = txt;
  }

  // ── Auto-save (debounced 1.2s) ─────────────────────────────────────────
  function autoSave() {
    var date = getSelectedDate();
    if (!date) return;
    // Only save if data changed
    var hash = JSON.stringify(setsData);
    if (hash === lastSavedHash) return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(function() {
      var h2 = JSON.stringify(setsData);
      if (h2 === lastSavedHash) return;
      apiCall('saveSetlist', { date: date, sets: setsData }, function(r) {
        if (r && r.success) {
          lastSavedHash = h2;
          // แสดงสถานะ saved เบาๆ โดยไม่ขัดจังหวะ
          var ind = document.getElementById('autoSaveInd');
          if (ind) { ind.textContent = '✓ บันทึกอัตโนมัติ'; setTimeout(function(){ ind.textContent=''; }, 2000); }
        } else {
          showToast('❌ บันทึกไม่สำเร็จ: ' + ((r && r.message) || 'ลองใหม่'), 'error');
        }
      });
    }, 1200);
  }

  // ── Select set ──────────────────────────────────────────────────────────
  function selectSet(si) {
    var idx    = parseInt(si, 10);
    var plan   = getPlan();
    var cap    = PLAN_LIMIT[plan] || 0;

    // ถ้าเซ็ตนี้มีข้อมูลที่บันทึกไว้แล้ว → อนุญาตให้เข้าแก้ไข/ลบได้เสมอ
    var hasExistingData = setsData[si] && setsData[si].length > 0;
    if (!hasExistingData) {
      // Hard plan cap (เฉพาะตอนสร้างเซ็ตใหม่)
      if (cap > 0 && idx > cap) {
        var planLabel = plan === 'lite' ? '🎵 Lite (4 เซ็ต/วัน)' : '👑 Pro (8 เซ็ต/วัน)';
        showToast('ครบลิมิต ' + planLabel + ' แล้ว — ไม่สามารถเพิ่มได้อีก', 'error');
        return;
      }
      // Free: beyond schedule+unlocked → need ad (เฉพาะตอนสร้างเซ็ตใหม่)
      if (cap === 0 && idx > Math.max(todaySlots.length, 1) + adUnlocked) {
        adPendingSet = si;
        showAdGate();
        return;
      }
    }

    currentSetIdx = si;
    if (!setsData[si]) setsData[si] = [];
    document.getElementById('setRequiredHint').style.display = 'none';
    renderSetTabs();
    renderSetBuilder();
    renderPool();
  }

  // ── Add set ─────────────────────────────────────────────────────────────
  function tryAddSet() {
    var plan   = getPlan();
    var cap    = PLAN_LIMIT[plan] || 0;
    // find current max tab
    // นับจาก setsData key แทน ไม่งั้น parseInt บน label ภาษาไทยได้ NaN
    var usedKeys = Object.keys(setsData).map(Number).filter(function(n){ return !isNaN(n) && n > 0; });
    var cur    = usedKeys.length ? Math.max.apply(null, usedKeys) : 0;
    var tabs   = document.querySelectorAll('.set-tab');
    var tabMax = tabs.length ? tabs.length : 0;
    cur        = Math.max(cur, tabMax);
    var nextIdx= cur + 1;

    if (cap > 0 && nextIdx > cap) {
      showToast('ครบลิมิตแพ็กเกจแล้ว (' + cap + ' เซ็ต/วัน)', 'error'); return;
    }
    if (cap === 0 && nextIdx > Math.max(todaySlots.length, 1) + adUnlocked) {
      adPendingSet = String(nextIdx);
      showAdGate();
      return;
    }
    var si = String(nextIdx);
    if (!setsData[si]) setsData[si] = [];
    renderSetTabs();
    selectSet(si);
  }

  // ── Song pool ────────────────────────────────────────────────────────────
  function filterPool() { renderPool(); }

  function renderPool() {
    var poolEl  = document.getElementById('songPool');
    var q       = (document.getElementById('songSearch').value || '').toLowerCase();
    var songs   = allSongs.filter(function(s){
      return !q || (s.name||s.title||'').toLowerCase().includes(q) || (s.artist||'').toLowerCase().includes(q);
    });
    var canAdd  = !!currentSetIdx;
    var curSongs= currentSetIdx ? (setsData[currentSetIdx] || []) : [];

    if (!songs.length) {
      poolEl.innerHTML = '<div class="sl-empty"><div class="big-icon">🎵</div>ไม่พบเพลง</div>';
      return;
    }
    poolEl.innerHTML = songs.map(function(s) {
      var sid     = s.songId || s.id || '';
      var already = curSongs.find(function(x){ return x.id === sid; });
      var isClickable = canAdd && !already;
      var extraClass  = isClickable ? ' clickable' : ' disabled';
      var onclickAttr = isClickable ? ' onclick="addSong(\'' + escapeHtml(sid) + '\')"' : '';
      var check   = already ? '<span style="color:var(--premium-gold);margin-right:4px">✓</span>' : '';
      var key     = s.key ? ('<span style="font-size:.68rem;color:var(--premium-text-muted);margin-left:3px">(' + escapeHtml(formatKey(s.key)) + ')</span>') : '';
      var dur     = s.duration ? ('<span class="song-dur">' + parseFloat(s.duration).toFixed(1) + 'm</span>') : '';
      var isBanned = todayBannedGenres.length > 0 && s.tags && todayBannedGenres.indexOf(s.tags) >= 0;
      var warnBadge = isBanned ? '<span style="background:rgba(249,115,22,.15);color:#f97316;font-size:.58rem;border:1px solid rgba(249,115,22,.4);border-radius:5px;padding:1px 4px;flex-shrink:0;margin-left:3px" title="แนวเพลงนี้ไม่เหมาะกับร้านปัจจุบัน">⚠️</span>' : '';
      return '<div class="song-pill' + extraClass + '"' + onclickAttr + '>'
        + '<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
        + check + escapeHtml(s.name || s.title || '—') + key + '</span>' + warnBadge + dur + '</div>';
    }).join('');
  }

  // ── Set builder ──────────────────────────────────────────────────────────
  function renderSetBuilder() {
    var si = currentSetIdx;
    if (!si) return;
    document.getElementById('setBuilderPlaceholder').style.display = 'none';
    document.getElementById('setBuilder').style.display = '';

    var ts  = todaySlots[parseInt(si) - 1];
    var tsLabel = ts ? (typeof ts === 'string' ? ts : (ts.label || '')) : '';
    document.getElementById('builderTitle').textContent   = 'เซ็ตที่ ' + si;
    document.getElementById('builderTimeSlot').textContent = tsLabel ? ('⏰ ' + tsLabel) : '';

    var songs = setsData[si] || [];
    var total = songs.reduce(function(a, s){ return a + (parseFloat(s.duration) || 0); }, 0);
    document.getElementById('totalDuration').textContent = total.toFixed(1) + ' นาที';
    document.getElementById('durationFill').style.transform = 'scaleX(' + (Math.min(100, total / 60 * 100) / 100) + ')';

    if (!songs.length) {
      document.getElementById('setlistSlots').innerHTML =
        '<div class="sl-empty" style="padding:20px"><div class="big-icon">➕</div>คลิกเพลงทางซ้ายเพื่อเพิ่ม</div>';
      return;
    }
    document.getElementById('setlistSlots').innerHTML = songs.map(function(s, i) {
      // ดึงชื่อจาก allSongs ด้วย เผื่อ title ใน DB ไม่มี (เซ็ตเก่าที่บันทึกก่อน fix)
      var fullSong  = allSongs.find(function(x){ return (x.songId || x.id) === s.id; });
      var titleShow = (fullSong && (fullSong.name || fullSong.title)) || s.title || s.name || '—';
      var artShow   = (fullSong && fullSong.artist) || s.artist || '';
      var isBanned2 = todayBannedGenres.length > 0 && fullSong && fullSong.tags && todayBannedGenres.indexOf(fullSong.tags) >= 0;
      var warnTag   = isBanned2 ? ' <span style="color:#f97316;font-size:.65rem" title="แนวเพลงนี้ไม่เหมาะกับร้าน">⚠️</span>' : '';
      return '<div class="setlist-slot">'
        + '<div class="slot-num">' + (i + 1) + '</div>'
        + '<div class="slot-info"><div class="slot-title">' + escapeHtml(titleShow) + warnTag + '</div>'
        + '<div class="slot-artist">' + escapeHtml(artShow) + '</div></div>'
        + '<span class="slot-dur">' + (parseFloat(s.duration) || 0).toFixed(1) + 'm</span>'
        + '<div class="slot-actions">'
        + '<button class="slot-move" onclick="moveSong(' + i + ',-1)" title="ขึ้น"' + (i === 0 ? ' disabled' : '') + '>↑</button>'
        + '<button class="slot-move" onclick="moveSong(' + i + ',1)" title="ลง"' + (i === songs.length - 1 ? ' disabled' : '') + '>↓</button>'
        + '<button class="slot-del" onclick="removeSong(' + i + ')" title="ลบออก">×</button>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  function addSong(songId) {
    if (!currentSetIdx) {
      document.getElementById('setRequiredHint').style.display = '';
      showToast('กรุณาเลือกเซ็ตก่อนเพิ่มเพลง', 'error'); return;
    }
    var song = allSongs.find(function(s){ return (s.songId || s.id) === songId; });
    if (!song) return;
    var si = currentSetIdx;
    if (!setsData[si]) setsData[si] = [];
    if (setsData[si].find(function(x){ return x.id === songId; })) {
      showToast('เพลงนี้อยู่ในเซ็ตแล้ว', 'info'); return;
    }
    setsData[si].push({ id: songId, title: song.name || song.title || '', artist: song.artist || '', duration: parseFloat(song.duration) || 4 });
    renderSetBuilder();
    renderPool();
    renderSetTabs();
    renderQuota();
    autoSave();
  }

  function removeSong(idx) {
    if (!currentSetIdx) return;
    setsData[currentSetIdx].splice(idx, 1);
    renderSetBuilder();
    renderPool();
    renderSetTabs();
    autoSave();
  }

  function moveSong(idx, dir) {
    if (!currentSetIdx) return;
    var arr = setsData[currentSetIdx];
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    var tmp = arr[idx]; arr[idx] = arr[newIdx]; arr[newIdx] = tmp;
    renderSetBuilder();
    autoSave();
  }

  function clearCurrentSet() {
    if (!currentSetIdx || !confirm('ล้างเซ็ตที่ ' + currentSetIdx + '?')) return;
    setsData[currentSetIdx] = [];
    renderSetBuilder();
    renderPool();
    renderSetTabs();
    renderQuota();
    autoSave();
  }

  function saveCurrentSet() {
    var date = getSelectedDate();
    if (!date) { showToast('กรุณาเลือกวันที่ก่อน', 'error'); return; }
    if (!currentSetIdx) {
      document.getElementById('setRequiredHint').style.display = '';
      showToast('กรุณาเลือกเซ็ตก่อนบันทึก', 'error'); return;
    }
    var btn = document.getElementById('saveSetBtn');
    if (btn) btn.disabled = true;
    apiCall('saveSetlist', { date: date, sets: setsData }, function(r) {
      if (btn) btn.disabled = false;
      if (r && r.success) {
        lastSavedHash = JSON.stringify(setsData);
        showToast('✅ บันทึกเซ็ตที่ ' + currentSetIdx + ' สำเร็จ', 'success');
      } else showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
    });
  }

  // ── Ad gate ──────────────────────────────────────────────────────────────
  function showAdGate() {
    var modal = document.getElementById('adGateModal');
    modal.classList.remove('hidden');
    document.getElementById('adDoneBtn').style.display = 'none';
    var secs = 5;
    document.getElementById('adCountdown').textContent = secs;
    clearInterval(adTimer);
    adTimer = setInterval(function() {
      secs--;
      document.getElementById('adCountdown').textContent = secs > 0 ? secs : '—';
      if (secs <= 0) {
        clearInterval(adTimer);
        document.getElementById('adDoneBtn').style.display = '';
        document.getElementById('adCountdown').style.display = 'none';
      }
    }, 1000);
    // Trigger AdSense
    try { (adsbygoogle = window.adsbygoogle || []).push({}); } catch(e) {}
  }

  function closeAdGate() {
    clearInterval(adTimer);
    document.getElementById('adGateModal').classList.add('hidden');
    document.getElementById('adCountdown').style.display = '';
    adPendingSet = null;
  }

  function onAdDone() {
    clearInterval(adTimer);
    document.getElementById('adGateModal').classList.add('hidden');
    document.getElementById('adCountdown').style.display = '';
    if (!adPendingSet) return;
    adUnlocked++;
    var si = adPendingSet;
    adPendingSet = null;
    if (!setsData[si]) setsData[si] = [];
    renderSetTabs();
    renderQuota();
    selectSet(si);
    showToast('🔓 ปลดล็อคเซ็ตที่ ' + si + ' เรียบร้อย!', 'success');
  }

  // ── Go Live ───────────────────────────────────────────────────────────
  function goLive() {
    var date = getSelectedDate();
    if (!date) { showToast('กรุณาเลือกวันที่ก่อน', 'error'); return; }
    var si = currentSetIdx || '1';
    var ts = todaySlots[parseInt(si) - 1];
    var params = 'date=' + encodeURIComponent(date);
    if (ts && ts.time_slot) params += '&timeSlot=' + encodeURIComponent(ts.time_slot);
    if (ts && (ts.venue_name || ts.venue)) params += '&venue=' + encodeURIComponent(ts.venue_name || ts.venue);
    window.location.href = 'live.html?' + params;
  }

  // ── Load previous setlist ────────────────────────────────────────────────
  function openLoadPrevModal() {
    var date = getSelectedDate();
    if (!date) { showToast('กรุณาเลือกวันที่ปัจจุบันก่อน', 'error'); return; }
    var modal = document.getElementById('loadPrevModal');
    modal.classList.remove('hidden');
    document.getElementById('prevSetlistList').innerHTML =
      '<div class="sl-empty"><div class="big-icon">⏳</div>กำลังโหลด...</div>';

    apiCall('getSetlistDates', {}, function(r) {
      var listEl = document.getElementById('prevSetlistList');
      if (!r || !r.success || !r.data || !r.data.length) {
        listEl.innerHTML = '<div class="sl-empty"><div class="big-icon">📭</div>ยังไม่มีเซ็ตลิสต์ที่บันทึกไว้</div>';
        return;
      }
      // กรองเอาเฉพาะวันที่ไม่ใช่วันปัจจุบัน + มีเพลงจริง
      var items = r.data.filter(function(row) {
        if (row.date === date) return false;
        var sd = row.sets_data || {};
        var total = Object.keys(sd).reduce(function(sum, k) { return sum + (sd[k] || []).length; }, 0);
        return total > 0;
      });
      if (!items.length) {
        listEl.innerHTML = '<div class="sl-empty"><div class="big-icon">📭</div>ไม่มีเซ็ตลิสต์จากวันอื่น</div>';
        return;
      }
      listEl.innerHTML = items.map(function(row) {
        var sd = row.sets_data || {};
        var setKeys = Object.keys(sd).filter(function(k) { return (sd[k] || []).length > 0; });
        var totalSongs = setKeys.reduce(function(sum, k) { return sum + sd[k].length; }, 0);
        var dateObj = new Date(row.date + 'T00:00:00');
        var dayNames = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
        var monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        var label = 'วัน' + dayNames[dateObj.getDay()] + ' ' + dateObj.getDate() + ' ' + monthNames[dateObj.getMonth()] + ' ' + (dateObj.getFullYear() + 543);
        var detail = setKeys.length + ' เซ็ต · ' + totalSongs + ' เพลง';
        return '<div class="prev-date-item" onclick="loadPrevSetlist(\'' + escapeHtml(row.date) + '\')">'
          + '<div><div style="font-weight:600;font-size:.88rem">' + escapeHtml(label) + '</div>'
          + '<div style="font-size:.75rem;color:var(--premium-text-muted)">' + escapeHtml(detail) + '</div></div>'
          + '<span style="font-size:1.2rem">📥</span></div>';
      }).join('');
    });
  }

  function closeLoadPrevModal() {
    document.getElementById('loadPrevModal').classList.add('hidden');
  }

  function loadPrevSetlist(prevDate) {
    var currentDate = getSelectedDate();
    if (!currentDate) { showToast('กรุณาเลือกวันที่ก่อน', 'error'); return; }
    // ตรวจว่ามีข้อมูลอยู่แล้ววันนี้ไหม
    var hasData = Object.keys(setsData).some(function(k) { return (setsData[k] || []).length > 0; });
    if (hasData && !confirm('วันนี้มีเซ็ตลิสต์อยู่แล้ว\nต้องการแทนที่ด้วยลิสจากวัน ' + prevDate + ' หรือไม่?')) return;

    apiCall('getSetlist', { date: prevDate }, function(r) {
      if (!r || !r.success || !r.data) {
        showToast('ไม่พบข้อมูลเซ็ตลิสต์ของวันที่เลือก', 'error'); return;
      }
      setsData = JSON.parse(JSON.stringify(r.data)); // deep clone
      lastSavedHash = ''; // mark as unsaved
      closeLoadPrevModal();
      buildUI();
      // auto-select first set with data
      var firstKey = Object.keys(setsData).filter(function(k) { return (setsData[k] || []).length > 0; }).sort()[0];
      if (firstKey) selectSet(firstKey);
      autoSave();
      showToast('📋 โหลดเซ็ตลิสต์จากวัน ' + prevDate + ' เรียบร้อย', 'success');
    });
  }

  // ── Helper ───────────────────────────────────────────────────────────────
  function escapeHtml(t) {
    if (!t) return '';
    var d = document.createElement('div'); d.textContent = String(t); return d.innerHTML;
  }