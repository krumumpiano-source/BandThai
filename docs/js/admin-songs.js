// ─── State ───────────────────────────────────────────────────────
var _allSongs     = [];
var _filtered     = [];
var _sortKey      = 'name';   // kept for legacy compat
var _sortAsc      = true;
// Multi-column sort: [{key, asc}, ...] — index 0 = primary
var _sortLevels   = [{ key: 'name', asc: true }];
var _page         = 1;
var _savedPageBeforeSearch = null;
var _perPage      = 30;
var _editingId    = null;
var _dirty        = {}; // songId → draft data object (preserves edits across page turns)
var _keyDisplayMode = localStorage.getItem('keyDisplayMode') || 'number'; // 'number' | 'letter'
var _artistList   = []; // [{id, name}, ...] master list
var _loadSongsReqId = 0;
var _searchDebounce = null;
var _isAdmin = false;       // true if current user is full admin
var _selectedArtistFilter = ''; // currently selected artist for filter
var _presenceChannel = null; // Supabase Presence channel
var _myActivity = 'ดูรายการ'; // current user activity description
var _hiddenHistSongs = {}; // hidden history song keys (lowercase name → true)
var _verifiedSongs = {}; // songId → { by: name, at: ISO timestamp }
var _userNameMap = {}; // userId → display name
var _COMPLETENESS_FIELDS = ['name','artist','key','bpm','singer','era','tags','mood'];

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  requireAuth();
  var userId = localStorage.getItem('userId') || '';
  // Check admin first, then fall back to song manager
  apiCall('verifyAdmin', {}, function(r) {
    if (r && r.success) {
      _isAdmin = true;
      initAdminSongs();
      return;
    }
    // Not admin — check if user is a song manager
    apiCall('getBandSettings', {}, function(bs) {
      var settings = (bs && bs.success && bs.data) || {};
      var managers = settings.songManagers || [];
      if (managers.indexOf(userId) >= 0) {
        initAdminSongs();
      } else {
        document.querySelector('main').innerHTML = '<div style="text-align:center;padding:60px;color:#888"><div style="font-size:3rem">🔒</div><div style="margin-top:12px;font-size:1.1rem;font-weight:600">เฉพาะ Admin หรือผู้ดูแลเพลงเท่านั้น</div></div>';
      }
    });
  });
  function initAdminSongs() {
  checkAdGate();
  renderMainNav('mainNav');
  applyTranslations();
  // Initialize key mode toggle button text
  if (document.getElementById('keyModeToggle')) {
    document.getElementById('keyModeToggle').textContent = _keyDisplayMode === 'number' ? '🔤 อักษร' : '🔢 ตัวเลข';
  }
  // Show song manager settings button only for admin
  if (_isAdmin && document.getElementById('smToggleBtn')) {
    document.getElementById('smToggleBtn').style.display = '';
  }
  updateModalKeyOptions();
  loadArtists();
  loadUserNameMap();
  loadSongs();
  loadSuggestions();
  initPresence();
  } // end initAdminSongs

  // Auto-refresh when user comes back from another page
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) { loadSongs(); loadSuggestions(); }
  });
});

// ─── Song Suggestions ─────────────────────────────────────────────
var _suggestions = [];

function loadSuggestions() {
  apiCall('getSongSuggestions', { status: 'pending' }, function(r) {
    if (!r || !r.success) return;
    _suggestions = r.data || [];
    var badge = document.getElementById('sugBadge');
    var countEl = document.getElementById('sugBadgeCount');
    if (_suggestions.length > 0) {
      badge.style.display = 'inline-flex';
      countEl.textContent = _suggestions.length;
    } else {
      badge.style.display = 'none';
    }
  });
}

function toggleSugPanel() {
  var panel = document.getElementById('sugPanel');
  if (panel.style.display === 'block') {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  renderSuggestions();
}

var _FIELD_LABELS = { name: 'ชื่อเพลง', artist: 'ศิลปิน', key: 'คีย์', bpm: 'BPM', tags: 'แนวเพลง', singer: 'นักร้อง', era: 'ยุค', mood: 'อารมณ์' };

function renderSuggestions() {
  var listEl = document.getElementById('sugList');
  if (_suggestions.length === 0) {
    listEl.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:16px">ไม่มีคำแนะนำรอตรวจ</p>';
    return;
  }

  // Build lookup from loaded songs
  var songById = {};
  (_allSongs || []).forEach(function(s) { songById[s.id] = s; });

  var html = '';
  _suggestions.forEach(function(sug, i) {
    var song = songById[sug.songId] || {};
    var changes = sug.suggestedData || {};
    var diffHtml = '';
    Object.keys(changes).forEach(function(field) {
      var label = _FIELD_LABELS[field] || field;
      var oldVal = song[field] || song[field === 'tags' ? 'tags' : field] || '—';
      var newVal = changes[field] || '—';
      diffHtml += '<div class="sug-diff-label">' + esc(label) + '</div>';
      diffHtml += '<div class="sug-diff-old">เดิม: ' + esc(String(oldVal)) + '</div>';
      diffHtml += '<div class="sug-diff-new">แนะนำ: ' + esc(String(newVal)) + '</div>';
    });

    var noteHtml = sug.note ? '<div class="sug-card-note">💬 ' + esc(sug.note) + '</div>' : '';
    var timeAgo = sug.createdAt ? new Date(sug.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    html += '<div class="sug-card" id="sug-' + sug.id + '">' +
      '<div class="sug-card-head">' +
        '<div><span class="sug-card-title">🎵 ' + esc(song.name || 'ไม่พบเพลง') + '</span> <span style="color:#94a3b8;font-size:13px">— ' + esc(song.artist || '') + '</span></div>' +
        '<div class="sug-card-by">โดย ' + esc(sug.suggestedName || 'สมาชิก') + ' · ' + timeAgo + '</div>' +
      '</div>' +
      '<div class="sug-diff">' + diffHtml + '</div>' +
      noteHtml +
      '<div class="sug-card-actions">' +
        '<button class="sug-btn-reject" onclick="rejectSuggestion(\'' + esc(sug.id) + '\', ' + i + ')">❌ ปฏิเสธ</button>' +
        '<button class="sug-btn-approve" onclick="approveSuggestion(\'' + esc(sug.id) + '\', ' + i + ')">✅ อนุมัติ & แก้ไข</button>' +
      '</div>' +
    '</div>';
  });
  listEl.innerHTML = html;
}

function approveSuggestion(sugId, idx) {
  var sug = _suggestions[idx];
  if (!sug) return;
  var changes = sug.suggestedData || {};
  if (Object.keys(changes).length === 0) return;

  // Apply changes to the song
  var updatePayload = Object.assign({ songId: sug.songId }, changes);
  apiCall('updateSong', updatePayload, function(r) {
    if (!r || !r.success) {
      showToast('แก้ไขเพลงไม่สำเร็จ: ' + ((r && r.message) || 'error'), 'error');
      return;
    }
    // Mark suggestion as approved
    apiCall('reviewSongSuggestion', { id: sugId, status: 'approved' }, function(r2) {
      showToast('อนุมัติแล้ว — เพลงถูกแก้ไขเรียบร้อย', 'success');
      _suggestions.splice(idx, 1);
      renderSuggestions();
      updateSugBadge();
      // Refresh song in table
      loadSongs();
    });
  });
}

function rejectSuggestion(sugId, idx) {
  apiCall('reviewSongSuggestion', { id: sugId, status: 'rejected' }, function(r) {
    if (r && r.success) {
      showToast('ปฏิเสธแล้ว', 'success');
      _suggestions.splice(idx, 1);
      renderSuggestions();
      updateSugBadge();
    }
  });
}

function updateSugBadge() {
  var badge = document.getElementById('sugBadge');
  var countEl = document.getElementById('sugBadgeCount');
  if (_suggestions.length > 0) {
    badge.style.display = 'inline-flex';
    countEl.textContent = _suggestions.length;
  } else {
    badge.style.display = 'none';
    document.getElementById('sugPanel').style.display = 'none';
  }
}

// ─── Load ─────────────────────────────────────────────────────────
function loadSongs() {
  setBodyLoading(true);
  var bandId   = localStorage.getItem('bandId')   || '';
  var bandName = localStorage.getItem('bandName') || '';
  var reqId = ++_loadSongsReqId;

  // Load verified songs data alongside songs
  loadVerifiedSongs();

  apiCall('getAllSongs', { source: 'global', bandName: bandName, bandId: bandId }, function(r) {
    if (reqId !== _loadSongsReqId) return;
    setBodyLoading(false);
    _allSongs = (r && r.success) ? (r.data || []) : [];
    _allSongs.sort(function(a, b) {
      return (a.name || '').localeCompare(b.name || '', 'th');
    });
    populateArtistFilter();
    filterTable();
    // Clean up orphan artists from DB (silently, on every load)
    apiCall('cleanupOrphanArtists', {}, function(r) {
      if (r && r.deleted > 0) loadArtists(); // refresh datalist if anything was removed
    });
  });
}

function setBodyLoading(on) {
  var tb = document.getElementById('songTbody');
  if (!tb) return;
  if (on) tb.innerHTML = '<tr><td colspan="10"><div class="as-loading"><div class="as-spinner"></div>กำลังโหลด...</div></td></tr>';
}

// ─── Populate Artist Filter ───────────────────────────────────────
function populateArtistFilter() {
  // ใช้ _artistList (master) แทนการดึงจากเพลง
  updateArtistDatalist();
}

// ─── Filter + Sort + Paginate ─────────────────────────────────────
function filterTable() {
  var q       = (document.getElementById('asSearch').value || '').toLowerCase().trim();
  var source  = document.getElementById('asSource').value;
  var singer  = document.getElementById('asSinger').value;
  var artist  = _selectedArtistFilter;
  var era     = document.getElementById('asEra').value;
  var genre   = document.getElementById('asGenre').value;
  var mood    = document.getElementById('asMood').value;
  var status  = (document.getElementById('asStatus') || {}).value || '';

  _filtered = _allSongs.filter(function(s) {
    // Source filter
    if (source === 'global'  && s.source === 'band') return false;
    if (source === 'band'    && s.source !== 'band') return false;
    if (q) {
      var haystack = (s.name + ' ' + (s.artist||'') + ' ' + (s.key||'')).toLowerCase();
      if (haystack.indexOf(q) < 0) return false;
    }
    if (singer) {
      var sv = s.singer || '';
      var ok = (sv === singer) || (singer === 'คู่' && (sv === 'คู่' || sv === 'duet' || sv === 'ชาย/หญิง'));
      if (!ok) return false;
    }
    if (artist && (s.artist || '').trim() !== artist) return false;
    if (era && s.era !== era) return false;
    if (genre && (s.tags || '') !== genre) return false;
    if (mood && (s.mood || '').indexOf(mood) < 0) return false;
    // Status filter
    if (status) {
      var lvl = completenessLevel(s);
      var isV = !!_verifiedSongs[s.id];
      if (status === 'complete' && lvl !== 'complete') return false;
      if (status === 'partial'  && lvl !== 'partial')  return false;
      if (status === 'missing'  && lvl !== 'missing')  return false;
      if (status === 'verified'   && !isV) return false;
      if (status === 'unverified' && isV)  return false;
    }
    return true;
  });

  applySortToFiltered();
  if (filterTable.__keepPage) {
    var maxPage = Math.ceil(_filtered.length / _perPage) || 1;
    _page = Math.max(1, Math.min(_page, maxPage));
    delete filterTable.__keepPage;
  } else {
    _page = 1;
  }
  updateStats();
  renderTable();
}

function refilterKeepPage() {
  filterTable.__keepPage = true;
  filterTable();
}

function searchInputChanged() {
  var val = (document.getElementById('asSearch').value || '').trim();
  if (val && _savedPageBeforeSearch === null) {
    _savedPageBeforeSearch = _page;
  }
  if (!val && _savedPageBeforeSearch !== null) {
    _page = _savedPageBeforeSearch;
    _savedPageBeforeSearch = null;
    filterTable.__keepPage = true;
  } else {
    _savedPageBeforeSearch = val ? _savedPageBeforeSearch : null;
  }
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(filterTable, 150);
}

function applySortToFiltered() {
  var collator = new Intl.Collator(['th', 'en'], { numeric: true, sensitivity: 'base' });
  function valOf(song, key) {
    var v = (song[key] !== undefined && song[key] !== null) ? song[key] : '';
    return key === 'bpm' ? (parseFloat(v) || 0) : String(v);
  }
  _filtered.sort(function(a, b) {
    for (var i = 0; i < _sortLevels.length; i++) {
      var lv = _sortLevels[i];
      if (lv.key === 'bpm') {
        var diff = valOf(a, 'bpm') - valOf(b, 'bpm');
        if (diff !== 0) return lv.asc ? diff : -diff;
      } else {
        var av = valOf(a, lv.key), bv = valOf(b, lv.key);
        if (!av && bv) return 1;
        if (av && !bv) return -1;
        var cmp = collator.compare(av, bv);
        if (cmp !== 0) return lv.asc ? cmp : -cmp;
      }
    }
    return 0;
  });
  renderSortHeaders();
}

function renderSortHeaders() {
  var superNums = ['¹','²','³','⁴','⁵'];
  var cols = ['name','artist','bpm','singer','era','tags','mood'];
  cols.forEach(function(col) {
    var th = document.getElementById('th-' + col);
    if (!th) return;
    var icon = th.querySelector('.sort-icon');
    if (!icon) return;
    var idx = _sortLevels.findIndex(function(lv){ return lv.key === col; });
    if (idx >= 0) {
      var lv = _sortLevels[idx];
      var sup = _sortLevels.length > 1 ? (superNums[idx] || '') : '';
      icon.textContent = (lv.asc ? '▲' : '▼') + sup;
      th.classList.add('sort-active');
      th.title = 'คลิก = สลับ | Shift+คลิก = ยกเลิก';
    } else {
      icon.textContent = '↕';
      th.classList.remove('sort-active');
      th.title = 'คลิก = เรียง | Shift+คลิก = เพิ่มการเรียงรอง';
    }
  });
}

function sortBy(key, evt) {
  var shift = evt && evt.shiftKey;
  var idx = _sortLevels.findIndex(function(lv){ return lv.key === key; });
  if (shift) {
    if (idx >= 0) {
      // Shift+click on active: toggle direction; if already desc, remove it
      if (_sortLevels[idx].asc === false) {
        _sortLevels.splice(idx, 1); // remove from sort
      } else {
        _sortLevels[idx].asc = false;
      }
    } else {
      _sortLevels.push({ key: key, asc: true }); // add as secondary
    }
  } else {
    if (idx === 0 && _sortLevels.length === 1) {
      _sortLevels[0].asc = !_sortLevels[0].asc; // toggle primary
    } else if (idx === 0) {
      _sortLevels[0].asc = !_sortLevels[0].asc; // toggle, keep secondaries
    } else {
      _sortLevels = [{ key: key, asc: true }]; // new primary, reset all
    }
  }
  // sync legacy vars
  _sortKey = _sortLevels[0] ? _sortLevels[0].key : 'name';
  _sortAsc = _sortLevels[0] ? _sortLevels[0].asc : true;
  applySortToFiltered();
  _page = 1;
  renderTable();
}

function changePage(dir) {
  var maxPage = Math.ceil(_filtered.length / _perPage) || 1;
  _page = Math.max(1, Math.min(_page + dir, maxPage));
  renderTable();
}

// ─── Render Table (Inline Edit) ──────────────────────────────────
var _KEY_OPTS   = ['','C / Am','1#','2#','3#','4#','5#','6#','7#','1b','2b','3b','4b','5b','6b','7b'];

// Key notation mapping (number → letter)
var _KEY_MAP = {
  '': '—',
  'C / Am': 'C / Am',
  '1#': 'G / Em',   '2#': 'D / Bm',    '3#': 'A / F#m',
  '4#': 'E / C#m',  '5#': 'B / G#m',   '6#': 'F# / D#m',  '7#': 'C# / A#m',
  '1b': 'F / Dm',   '2b': 'Bb / Gm',   '3b': 'Eb / Cm',
  '4b': 'Ab / Fm',  '5b': 'Db / Bbm',  '6b': 'Gb / Ebm',  '7b': 'Cb / Abm'
};

function formatKey(key, mode) {
  if (!key) return '—';
  if (mode === 'letter' && _KEY_MAP[key]) return _KEY_MAP[key];
  return key;
}

function toggleKeyMode() {
  _keyDisplayMode = _keyDisplayMode === 'number' ? 'letter' : 'number';
  localStorage.setItem('keyDisplayMode', _keyDisplayMode);
  document.getElementById('keyModeToggle').textContent = _keyDisplayMode === 'number' ? '🔤 อักษร' : '🔢 ตัวเลข';
  updateModalKeyOptions();
  renderTable();
}

function updateModalKeyOptions() {
  var mKey = document.getElementById('mKey');
  if (!mKey) return;
  var currentValue = mKey.value;
  var html = '<option value="">—</option>';
  if (_keyDisplayMode === 'number') {
    html += '<option>C / Am</option>' +
      '<optgroup label="# Sharp"><option>1#</option><option>2#</option><option>3#</option><option>4#</option><option>5#</option><option>6#</option><option>7#</option></optgroup>' +
      '<optgroup label="b Flat"><option>1b</option><option>2b</option><option>3b</option><option>4b</option><option>5b</option><option>6b</option><option>7b</option></optgroup>';
  } else {
    html += '<option value="C / Am">' + esc(_KEY_MAP['C / Am'] || 'C / Am') + '</option>';
    html += '<optgroup label="# Sharp">';
    ['1#','2#','3#','4#','5#','6#','7#'].forEach(function(k) {
      html += '<option value="' + esc(k) + '">' + esc(_KEY_MAP[k] || k) + '</option>';
    });
    html += '</optgroup><optgroup label="b Flat">';
    ['1b','2b','3b','4b','5b','6b','7b'].forEach(function(k) {
      html += '<option value="' + esc(k) + '">' + esc(_KEY_MAP[k] || k) + '</option>';
    });
    html += '</optgroup>';
  }
  mKey.innerHTML = html;
  mKey.value = currentValue;
}

var _ERA_OPTS   = ['','80s','90s','2000s','2010s','2020s'];
var _ERA_LABELS = {'':'—','80s':'2523-2532 (80s)','90s':'2533-2542 (90s)','2000s':'2543-2553 (00s)','2010s':'2554-2562 (10s)','2020s':'2563-ปัจจุบัน (20s)'};
var _MOOD_OPTS  = ['','มัน / สนุก','หวาน / โรแมนติก','เศร้า / อกหัก','นิ่ง / ผ่อนคลาย','ฮึกเหิม / ยิ่งใหญ่'];
var _GENRE_OPTS = ['','ป๊อป','ร็อค','ดิสโก้','แร๊ฟ/ฮิปฮอป','ลูกทุ่ง / อีสาน','เพื่อชีวิต','อาร์แอนด์บี','แจ๊ส / บลูส์','เรกเก้','อินดี้'];

function _buildSel(field, opts, cur, cls, labelMap, strict) {
  var val = strict ? (opts.indexOf(cur) >= 0 ? cur : '') : (cur || '');
  var h = '<select class="il-select' + (cls ? ' ' + cls : '') + '" data-field="' + esc(field) + '" onchange="markDirty(this)">';
  opts.forEach(function(o) {
    var lbl = (labelMap && labelMap[o] !== undefined) ? labelMap[o] : (o || '—');
    // Apply key formatting if this is the key field
    if (field === 'key' && _keyDisplayMode === 'letter' && _KEY_MAP[o]) {
      lbl = _KEY_MAP[o];
    }
    h += '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(lbl) + '</option>';
  });
  return h + '</select>';
}

// ─── Song Completeness & Verified ─────────────────────────────────
function songCompleteness(s) {
  var filled = 0;
  _COMPLETENESS_FIELDS.forEach(function(f) {
    var v = s[f];
    if (v !== undefined && v !== null && v !== '' && v !== 0) filled++;
  });
  return filled;
}

function completenessLevel(s) {
  var n = songCompleteness(s);
  var total = _COMPLETENESS_FIELDS.length;
  if (n >= total) return 'complete';
  if (n >= total - 2) return 'partial';
  return 'missing';
}

function missingFields(s) {
  var miss = [];
  var labels = {name:'ชื่อเพลง',artist:'ศิลปิน',key:'คีย์',bpm:'BPM',singer:'นักร้อง',era:'ยุค',tags:'แนวเพลง',mood:'อารมณ์'};
  _COMPLETENESS_FIELDS.forEach(function(f) {
    var v = s[f];
    if (v === undefined || v === null || v === '' || v === 0) miss.push(labels[f] || f);
  });
  return miss;
}

function resolveUserName(uid) {
  if (!uid) return '';
  if (_userNameMap[uid]) return _userNameMap[uid];
  // If it doesn't look like a UUID, it's probably already a name
  if (uid.indexOf('-') < 0 || uid.length < 20) return uid;
  return uid.substring(0, 8) + '...';
}

function loadUserNameMap() {
  apiCall('getBandProfiles', {}, function(r) {
    if (!r || !r.success) return;
    (r.data || []).forEach(function(p) {
      var name = p.nickname || p.user_name || p.first_name || p.email || '';
      if (name && p.id) _userNameMap[p.id] = name;
    });
    if (_allSongs.length) refilterKeepPage();
  });
}

function loadVerifiedSongs(cb) {
  apiCall('getBandSettings', {}, function(r) {
    var settings = (r && r.success && r.data) || {};
    _verifiedSongs = settings.verifiedSongs || {};
    if (_allSongs.length) refilterKeepPage();
    if (cb) cb();
  });
}

function toggleVerified(songId) {
  var userName = localStorage.getItem('userName') || localStorage.getItem('userId') || 'unknown';
  if (_verifiedSongs[songId]) {
    delete _verifiedSongs[songId];
  } else {
    _verifiedSongs[songId] = { by: userName, at: new Date().toISOString() };
  }
  saveVerifiedSongs();
  refilterKeepPage();
}

function saveVerifiedSongs() {
  apiCall('getBandSettings', {}, function(r) {
    var existing = (r && r.success && r.data) || {};
    existing.verifiedSongs = _verifiedSongs;
    apiCall('saveBandSettings', existing, function(sr) {
      if (!sr || !sr.success) console.warn('saveVerifiedSongs failed:', sr && sr.message);
    });
  });
}

function renderTable() {
  var tb = document.getElementById('songTbody');
  if (!tb) return;
  var maxPage = Math.ceil(_filtered.length / _perPage) || 1;
  var start   = (_page - 1) * _perPage;
  var pageRows = _filtered.slice(start, start + _perPage);

  document.getElementById('pageInfo').textContent =
    'หน้า ' + _page + ' / ' + maxPage + '   (' + _filtered.length + ' เพลง)';
  document.getElementById('prevBtn').disabled = _page <= 1;
  document.getElementById('nextBtn').disabled = _page >= maxPage;

  if (pageRows.length === 0) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:#aaa">ไม่พบเพลงที่ตรงกัน</td></tr>';
    return;
  }

  var html = '';
  pageRows.forEach(function(s) {
    var id    = esc(s.id);
    var jsId  = String(s.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var draft = _dirty[s.id]; // draft values preserved across page turns
    var isDirty = !!draft;


    // Use draft values if row is dirty (preserves edits across page turns)
    var dName   = draft ? draft.name   : s.name;
    var dArtist = draft ? draft.artist : (s.artist || '');
    var dKey    = draft ? draft.key    : (s.key    || '');
    var dBpm    = draft ? String(draft.bpm || '') : String(s.bpm || '');
    var dSinger = draft ? draft.singer : (s.singer || '');
    if (dSinger === 'male')   dSinger = 'ชาย';
    else if (dSinger === 'female') dSinger = 'หญิง';
    else if (dSinger === 'duet')   dSinger = 'ชาย/หญิง';
    var dEra  = draft ? draft.era  : (s.era  || '');
    var dTags = draft ? draft.tags : (s.tags || '');
    var dMood = draft ? draft.mood : (s.mood || '');

    var singerSel = '<select class="il-select" data-field="singer" onchange="markDirty(this)">' +
      ['','ชาย','หญิง','ชาย/หญิง'].map(function(v){
        return '<option value="' + esc(v) + '"' + (dSinger === v ? ' selected' : '') + '>' + (v || '—') + '</option>';
      }).join('') + '</select>';

    // Status column: completeness + verified
    var level = completenessLevel(s);
    var vInfo = _verifiedSongs[s.id];
    var badgeMap = { complete: '🟢', partial: '🟡', missing: '🔴' };
    var miss = missingFields(s);
    var missTitle = miss.length ? 'ขาด: ' + miss.join(', ') : 'ข้อมูลครบ';
    var verBtn = '<button class="btn-verify' + (vInfo ? ' verified' : '') + '" onclick="toggleVerified(\'' + id + '\')" title="' +
      (vInfo ? 'ยืนยันโดย ' + esc(vInfo.by) + ' เมื่อ ' + new Date(vInfo.at).toLocaleDateString('th-TH') + ' — คลิกเพื่อยกเลิก' : 'คลิกเพื่อยืนยันว่าข้อมูลถูกต้อง') + '">' +
      (vInfo ? '✅' : '⬜') + '</button>';
    var statusHtml = '<span class="status-badge badge-' + level + '" title="' + esc(missTitle) + '">' + badgeMap[level] + '</span> ' + verBtn;
    // Recent edit info
    var editInfo = '';
    if (s.updatedBy && s.updatedAt) {
      var diffH = (Date.now() - new Date(s.updatedAt).getTime()) / 3600000;
      var editorName = resolveUserName(s.updatedBy);
      if (diffH < 24) editInfo = '<div class="edit-info" title="แก้ไขล่าสุดโดย ' + esc(editorName) + '">' + esc(editorName) + '</div>';
    }
    // Row class
    var rowClass = isDirty ? 'row-dirty' : '';
    if (!isDirty && s.updatedAt && (Date.now() - new Date(s.updatedAt).getTime()) < 86400000) rowClass = 'row-recent';

    html += '<tr data-id="' + id + '"' + (rowClass ? ' class="' + rowClass + '"' : '') + '>' +
      '<td><input class="il-input" data-field="name" value="' + esc(dName) + '" oninput="markDirty(this)" placeholder="ชื่อเพลง"></td>' +
      '<td><input class="il-input" data-field="artist" value="' + esc(dArtist) + '" list="artistDatalist" oninput="markDirty(this)" placeholder="ศิลปิน"></td>' +
      '<td class="hide-md">' + _buildSel('key',  _KEY_OPTS,   dKey,  'il-key',   null,        false) + '</td>' +
      '<td class="hide-md"><input class="il-input il-bpm" type="number" data-field="bpm" value="' + esc(dBpm) + '" min="0" max="300" oninput="markDirty(this)"></td>' +
      '<td class="hide-md">' + singerSel + '</td>' +
      '<td class="hide-sm">' + _buildSel('era',  _ERA_OPTS,   dEra,  'il-era',   _ERA_LABELS, true)  + '</td>' +
      '<td class="hide-lg">' + _buildSel('tags', _GENRE_OPTS, dTags, 'il-genre', null,        true)  + '</td>' +
      '<td class="hide-lg">' + _buildSel('mood', _MOOD_OPTS,  dMood, 'il-mood',  null,        true)  + '</td>' +
      '<td class="hide-sm status-cell">' + statusHtml + editInfo + '</td>' +
      '<td><div class="td-actions">' +
        '<button class="btn-sm btn-save" id="sbtn-' + id + '" onclick="saveRow(\'' + id + '\')"' + (isDirty ? '' : ' disabled') + '>💾</button>' +
        ' <button class="btn-sm btn-itunes" onclick="itunesLookup(\'' + jsId + '\')" title="ค้นหาข้อมูลจาก iTunes">🎵</button>' +
        ' <button class="btn-sm btn-del" onclick="deleteSong(\'' + id + '\',\'' + esc(s.name) + '\')">🗑️</button>' +
      '</div></td>' +
    '</tr>';
  });
  tb.innerHTML = html;
}

function updateStats() {
  var all = _allSongs;
  var flt = _filtered;
  document.getElementById('statTotal').textContent    = all.length;
  document.getElementById('statFiltered').textContent = flt.length;
  var male = 0, female = 0, duet = 0, globalCnt = 0, bandCnt = 0;
  var completeCnt = 0, verifiedCnt = 0;
  all.forEach(function(s) {
    if (s.source === 'band') bandCnt++; else globalCnt++;
    var sv = (s.singer||'').toLowerCase();
    if (sv === 'ชาย'||sv === 'male') male++;
    else if (sv === 'หญิง'||sv === 'female') female++;
    else if (sv === 'คู่'||sv === 'duet'||sv === 'ชาย/หญิง') duet++;
    if (completenessLevel(s) === 'complete') completeCnt++;
    if (_verifiedSongs[s.id]) verifiedCnt++;
  });
  document.getElementById('statMale').textContent    = male;
  document.getElementById('statFemale').textContent  = female;
  document.getElementById('statDuet').textContent    = duet;
  document.getElementById('statGlobal').textContent  = globalCnt;
  document.getElementById('statBand').textContent    = bandCnt;
  document.getElementById('statComplete').textContent  = completeCnt;
  document.getElementById('statVerified').textContent  = verifiedCnt;
  // Update completeness bar
  var pct = all.length ? Math.round(completeCnt / all.length * 100) : 0;
  var fill = document.getElementById('completenessFill');
  var txt  = document.getElementById('completenessText');
  if (fill) fill.style.transform = 'scaleX(' + (pct / 100) + ')';
  if (fill) fill.style.background = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
  if (txt)  txt.textContent = 'ข้อมูลครบ ' + completeCnt + '/' + all.length + ' เพลง (' + pct + '%)';
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Add Song ─────────────────────────────────────────────────────
function openAddModal() {
  document.getElementById('mName').value   = '';
  document.getElementById('mArtist').value = '';
  document.getElementById('mKey').value    = '';
  document.getElementById('mBpm').value    = '';
  document.getElementById('mEra').value    = '';
  document.getElementById('mMood').value   = '';
  document.getElementById('mGenre').value  = '';
  document.querySelectorAll('input[name="ms"]').forEach(function(r){ r.checked = false; });
  document.getElementById('addModal').style.display = 'flex';
  setTimeout(function(){ document.getElementById('mName').focus(); }, 100);
}
function closeAddModal() { document.getElementById('addModal').style.display = 'none'; }

function _normSong(s) { return (s||'').toLowerCase().replace(/\s+/g,'').replace(/[^\u0e00-\u0e7fa-z0-9]/g,''); }
function _normSinger(s) { var v=(s||'').toLowerCase().trim(); if(v==='male'||v==='ชาย') return 'ชาย'; if(v==='female'||v==='หญิง') return 'หญิง'; if(v==='duet'||v==='คู่'||v==='ชาย/หญิง') return 'คู่'; return v; }

function checkDuplicate() {
  var raw = document.getElementById('mName').value.trim();
  var warn = document.getElementById('dupWarn');
  if (!raw) { warn.style.display='none'; return; }
  var norm   = _normSong(raw);
  var singer = _normSinger((document.querySelector('input[name="ms"]:checked')||{}).value);
  var key    = document.getElementById('mKey').value;
  var libSongs = _allSongs.filter(function(s){ return !s._fromHistory; });
  var sameName = libSongs.filter(function(s){ return _normSong(s.name) === norm; });
  // Full exact: same name AND same singer (if both filled) AND same key (if both filled)
  var fullExact = sameName.filter(function(s){
    var ss = _normSinger(s.singer);
    var sk = (s.key||'').trim();
    var sameS = !singer || !ss || singer === ss;
    var sameK = !key    || !sk || key    === sk;
    return sameS && sameK;
  });
  // Diff-version: same name but singer or key clearly differs
  var diffVer = sameName.filter(function(s){
    var ss = _normSinger(s.singer);
    var sk = (s.key||'').trim();
    var singerDiff = singer && ss && singer !== ss;
    var keyDiff    = key    && sk && key    !== sk;
    return singerDiff || keyDiff;
  });
  var similar = sameName.length ? [] : libSongs.filter(function(s){
    var sn = _normSong(s.name);
    return sn && (sn.includes(norm) || norm.includes(sn));
  });
  if (fullExact.length) {
    warn.className='exact';
    warn.innerHTML='<strong>⛔ มีเพลงชื่อเดียวกัน นักร้องเดียวกัน และคีย์เดียวกันในคลังแล้ว</strong>' + fullExact.map(function(s){
      return '<div class="dup-item">• ' + esc(s.name) + (s.singer ? ' 🎤 ' + esc(s.singer) : '') + (s.key ? ' [' + esc(s.key) + ']' : '') + (s.artist ? ' — ' + esc(s.artist) : '') + '</div>';
    }).join('');
    warn.style.display='block';
  } else if (diffVer.length) {
    warn.className='similar';
    warn.innerHTML='<strong>⚠️ พบเพลงชื่อเดียวกันในคลัง (ต่างนักร้องหรือต่างคีย์)</strong>' + diffVer.map(function(s){
      return '<div class="dup-item">• ' + esc(s.name) + (s.singer ? ' 🎤 ' + esc(s.singer) : '') + (s.key ? ' [' + esc(s.key) + ']' : '') + (s.artist ? ' — ' + esc(s.artist) : '') + '</div>';
    }).join('') + '<div style="margin-top:4px;font-size:11px;color:#92400e">✔️ ต่างเวอร์ชันสามารถเพิ่มได้เลย</div>';
    warn.style.display='block';
  } else if (similar.length) {
    warn.className='similar';
    warn.innerHTML='<strong>⚠️ พบเพลงที่ชื่อคล้ายกัน ' + similar.length + ' เพลง</strong>' + similar.slice(0,5).map(function(s){
      return '<div class="dup-item">• ' + esc(s.name) + (s.artist ? ' — ' + esc(s.artist) : '') + '</div>';
    }).join('');
    warn.style.display='block';
  } else {
    warn.style.display='none';
  }
}

function _doSubmitAdd() {
  var name = document.getElementById('mName').value.trim();
  var singerRadio = document.querySelector('input[name="ms"]:checked');
  var btn = document.getElementById('addSaveBtn');
  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
  apiCall('addSong', {
    name:    name,
    artist:  document.getElementById('mArtist').value.trim(),
    key:     document.getElementById('mKey').value,
    bpm:     String(parseInt(document.getElementById('mBpm').value) || ''),
    era:     document.getElementById('mEra').value,
    mood:    document.getElementById('mMood').value,
    tags:    document.getElementById('mGenre').value,
    singer:  singerRadio ? singerRadio.value : '',
    bandId:  null
  }, function(r) {
    btn.disabled = false; btn.textContent = '💾 บันทึก';
    if (r && r.success) {
      ensureArtistExists(document.getElementById('mArtist').value.trim());
      closeAddModal();
      showToast('✅ เพิ่มเพลง "' + name + '" แล้ว', 'success');
      clearSongsCache();
      filterTable.__keepPage = true;
      loadSongs();
    } else {
      showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

function submitAddSong() {
  var name = document.getElementById('mName').value.trim();
  if (!name) { document.getElementById('mName').focus(); showToast('กรุณาใส่ชื่อเพลง', 'error'); return; }
  var norm   = _normSong(name);
  var singer = _normSinger((document.querySelector('input[name="ms"]:checked')||{}).value);
  var key    = document.getElementById('mKey').value;
  var libSongs = _allSongs.filter(function(s){ return !s._fromHistory; });
  var sameName = libSongs.filter(function(s){ return _normSong(s.name) === norm; });
  // Block only when name+singer+key all match
  var fullExact = sameName.filter(function(s){
    var ss = _normSinger(s.singer);
    var sk = (s.key||'').trim();
    var sameS = !singer || !ss || singer === ss;
    var sameK = !key    || !sk || key    === sk;
    return sameS && sameK;
  });
  if (fullExact.length) {
    var matches = fullExact.slice(0,3).map(function(s){
      return '"' + s.name + '"' + (s.singer ? ' 🎤 '+s.singer : '') + (s.key ? ' ['+s.key+']' : '') + (s.artist ? ' ('+s.artist+')' : '');
    }).join(', ');
    showConfirm('พบเพลงซ้ำในคลัง', 'มีเพลง ' + matches + ' อยู่แล้ว\nนักร้องและคีย์เหมือนกัน ต้องการเพิ่มซ้ำหรือไม่?', {confirmText: 'เพิ่มต่อไป'}).then(function(ok) {
      if (ok) _doSubmitAdd();
    });
    return;
  }
  // Different version (singer/key differ) → add directly, no confirm needed
  _doSubmitAdd();
}



// ─── Inline Edit Functions ───────────────────────────────────────
function markDirty(el) {
  var row = el.closest('tr');
  if (!row) return;
  var songId = row.dataset.id;
  _dirty[songId] = readRowFromDOM(row);
  row.classList.add('row-dirty');
  var btn = document.getElementById('sbtn-' + songId);
  if (btn) btn.disabled = false;
  updateSaveAllBtn();
  // Track activity: editing which song
  var nameEl = row.querySelector('[data-field="name"]');
  var songName = nameEl ? nameEl.value.substring(0, 20) : '';
  updateMyActivity('แก้ไข: ' + (songName || 'เพลง'));
}

function readRowFromDOM(row) {
  function fv(field) { var el = row.querySelector('[data-field="' + field + '"]'); return el ? el.value : ''; }
  return {
    name:   fv('name').trim(),
    artist: fv('artist').trim(),
    key:    fv('key'),
    bpm:    parseInt(fv('bpm')) || 0,
    singer: fv('singer'),
    era:    fv('era'),
    tags:   fv('tags'),
    mood:   fv('mood')
  };
}

function updateSaveAllBtn() {
  var btn = document.getElementById('saveAllBtn');
  if (!btn) return;
  var count = Object.keys(_dirty).length;
  btn.disabled = count === 0;
  btn.textContent = count > 0 ? '💾 บันทึกทั้งหมด (' + count + ')' : '💾 บันทึกทั้งหมด';
}

function saveRow(songId) {
  var data = _dirty[songId];
  if (!data) {
    var row = document.querySelector('tr[data-id="' + songId + '"]');
    if (row) data = readRowFromDOM(row);
  }
  if (!data || !data.name) { showToast('ชื่อเพลงห้ามว่าง', 'error'); return; }
  var btn = document.getElementById('sbtn-' + songId);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  apiCall('updateSong', Object.assign({}, data, { songId: songId }), function(r) {
    if (btn) { btn.disabled = false; btn.textContent = '💾'; }
    if (r && r.success) {
      ensureArtistExists(data.artist);
      delete _dirty[songId];
      var row = document.querySelector('tr[data-id="' + songId + '"]');
      if (row) row.classList.remove('row-dirty');
      var idx = _allSongs.findIndex(function(s){ return s.id === songId; });
      if (idx >= 0) Object.assign(_allSongs[idx], { name: data.name, artist: data.artist, key: data.key, bpm: data.bpm, singer: data.singer, era: data.era, tags: data.tags, mood: data.mood, updatedBy: localStorage.getItem('userName') || '', updatedAt: new Date().toISOString() });
      // Reset verified status on edit
      if (_verifiedSongs[songId]) {
        delete _verifiedSongs[songId];
        saveVerifiedSongs();
      }
      updateSaveAllBtn();
      clearSongsCache();
      refilterKeepPage();
      apiCall('cleanupOrphanArtists', {}, function() { loadArtists(); });
      showToast('✅ บันทึก "' + data.name + '" แล้ว', 'success');
    } else {
      if (btn) btn.disabled = false;
      showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
    }
  });
}

function saveAllDirty() {
  var ids = Object.keys(_dirty);
  if (!ids.length) return;
  var allBtn = document.getElementById('saveAllBtn');
  if (allBtn) { allBtn.disabled = true; allBtn.textContent = 'กำลังบันทึก...'; }
  var total = ids.length, done = 0, failed = 0;
  ids.forEach(function(songId) {
    var data = _dirty[songId];
    if (!data || !data.name) { done++; failed++; _checkAllDone(); return; }
    apiCall('updateSong', Object.assign({}, data, { songId: songId }), function(r) {
      done++;
      if (r && r.success) {
        ensureArtistExists(data.artist);
        delete _dirty[songId];
        var row = document.querySelector('tr[data-id="' + songId + '"]');
        if (row) row.classList.remove('row-dirty');
        var rowBtn = document.getElementById('sbtn-' + songId);
        if (rowBtn) { rowBtn.disabled = true; rowBtn.textContent = '💾'; }
        var idx = _allSongs.findIndex(function(s){ return s.id === songId; });
        if (idx >= 0) Object.assign(_allSongs[idx], { name: data.name, artist: data.artist, key: data.key, bpm: data.bpm, singer: data.singer, era: data.era, tags: data.tags, mood: data.mood });
      } else { failed++; }
      _checkAllDone();
    });
  });
  function _checkAllDone() {
    if (done < total) return;
    clearSongsCache();
    updateSaveAllBtn();
    apiCall('cleanupOrphanArtists', {}, function() { loadArtists(); });
    showToast('✅ บันทึกแล้ว ' + (total - failed) + ' เพลง' + (failed ? ' (' + failed + ' ล้มเหลว)' : ''), 'success');
  }
}

// ─── Delete Song ──────────────────────────────────────────────────
function deleteSong(songId, songName) {
  if (!confirm('ลบเพลง "' + songName + '" ออกจากคลัง?\n\nการลบจะไม่กระทบลิสที่บันทึกแล้ว')) return;
  apiCall('deleteSong', { songId: songId }, function(r) {
    if (r && r.success) {
      showToast('🗑️ ลบเพลง "' + songName + '" แล้ว', 'success');
      clearSongsCache();
      _allSongs = _allSongs.filter(function(s){ return s.id !== songId; });
      refilterKeepPage();
      apiCall('cleanupOrphanArtists', {}, function() { loadArtists(); });
    } else {
      showToast((r && r.message) || 'ลบไม่สำเร็จ', 'error');
    }
  });
}

// ─── Add to Library (history songs) ──────────────────────────────
function addToLibrary(songId) {
  var song = _allSongs.find(function(s){ return s.id === songId; });
  if (!song) { showToast('ไม่พบข้อมูลเพลง', 'error'); return; }

  // Pre-fill the Add Song modal with history data
  document.getElementById('mName').value   = song.name || '';
  document.getElementById('mArtist').value = song.artist || '';
  document.getElementById('mKey').value    = song.key || '';
  document.getElementById('mBpm').value    = song.bpm || '';
  document.getElementById('mEra').value    = song.era || '';
  document.getElementById('mMood').value   = song.mood || '';
  document.getElementById('mGenre').value  = '';
  // Set singer radio
  var singerVal = song.singer || '';
  document.querySelectorAll('input[name="ms"]').forEach(function(r){
    r.checked = (r.value === singerVal);
  });
  document.getElementById('addModal').style.display = 'flex';
  setTimeout(function(){ document.getElementById('mName').focus(); }, 100);
}

function clearSongsCache() {
  var bandId   = localStorage.getItem('bandId')   || '';
  var bandName = localStorage.getItem('bandName') || '';
  try { sessionStorage.removeItem('songs_cache_' + (bandId || bandName)); } catch(e) {}
}

// ─── Hidden History Songs ─────────────────────────────────────────
function loadHiddenHistSongs(cb) {
  apiCall('getBandSettings', {}, function(r) {
    var settings = (r && r.success && r.data) || {};
    var arr = settings.hiddenHistorySongs || [];
    _hiddenHistSongs = {};
    for (var i = 0; i < arr.length; i++) _hiddenHistSongs[arr[i]] = true;
    if (cb) cb();
  });
}

function deleteHistorySong(songId) {
  var song = _allSongs.find(function(s){ return s.id === songId; });
  if (!song) return;
  var key = (song.name || '').toLowerCase().trim();
  if (!key) return;

  showConfirm('ลบออกจากประวัติ', '"' + song.name + '" จะถูกลบออกจากประวัติ Setlist ทั้งหมด\nดำเนินการต่อหรือไม่?', {danger: true, confirmText: 'ลบออก'}).then(function(ok) {
    if (!ok) return;
    // Remove from local state immediately
    _hiddenHistSongs[key] = true;
    _allSongs = _allSongs.filter(function(s){ return s.id !== songId; });
    refilterKeepPage();
    showToast('กำลังลบ "' + song.name + '" ออกจากประวัติ...', 'success');
    // Remove from all playlist_history records in DB
    apiCall('removeSongFromAllHistory', { songName: song.name }, function(r) {
      if (r && r.success) {
        showToast('🗑️ ลบ "' + song.name + '" ออกจากประวัติแล้ว (' + (r.updated||0) + ' รายการ)', 'success');
        saveHiddenList(); // also store in hidden list as fallback
      } else {
        // Rollback visual if API fails
        showToast((r && r.message) || 'ลบไม่สำเร็จ', 'error');
        delete _hiddenHistSongs[key];
        loadSongs();
      }
    });
  });
}

function unhideAllHistSongs() {
  _hiddenHistSongs = {};
  saveHiddenList(function() {
    showToast('ยกเลิกซ่อนทั้งหมดแล้ว — กำลังโหลดใหม่', 'success');
    loadSongs();
  });
}

function saveHiddenList(cb) {
  apiCall('getBandSettings', {}, function(r) {
    var existing = (r && r.success && r.data) || {};
    existing.hiddenHistorySongs = Object.keys(_hiddenHistSongs);
    apiCall('saveBandSettings', existing, function() { if (cb) cb(); });
  });
}

// ─── Export ───────────────────────────────────────────────────────
function exportSongs(format) {
  var libSongs = _allSongs.filter(function(s){ return !s._fromHistory; });
  if (!libSongs.length) { showToast('ไม่มีเพลงในคลัง', 'error'); return; }

  var timestamp = new Date().toISOString().slice(0,10);
  var filename  = 'songs-export-' + timestamp;

  if (format === 'json') {
    var json = JSON.stringify(libSongs.map(function(s){ return {
      name: s.name, artist: s.artist||'', key: s.key||'', bpm: s.bpm||0,
      singer: s.singer||'', era: s.era||'', mood: s.mood||'', tags: s.tags||''
    }; }), null, 2);
    _downloadFile(filename + '.json', json, 'application/json');
    showToast('📤 Export JSON สำเร็จ (' + libSongs.length + ' เพลง)', 'success');
    return;
  }

  // CSV
  var rows = [['name','artist','key','bpm','singer','era','mood','tags']];
  libSongs.forEach(function(s){
    rows.push([s.name, s.artist||'', s.key||'', s.bpm||'', s.singer||'', s.era||'', s.mood||'', s.tags||'']);
  });
  var csv = rows.map(function(r){
    return r.map(function(v){ return '"' + String(v).replace(/"/g,'""') + '"'; }).join(',');
  }).join('\n');
  _downloadFile(filename + '.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
  showToast('📤 Export CSV สำเร็จ (' + libSongs.length + ' เพลง)', 'success');
}

function _downloadFile(name, content, mime) {
  var blob = new Blob([content], { type: mime });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// ─── Import ───────────────────────────────────────────────────────
var _importRows = []; // rows to insert

function openImportModal() {
  _importRows = [];
  document.getElementById('importFile').value = '';
  document.getElementById('importSummary').style.display = 'none';
  document.getElementById('importPreview').style.display = 'none';
  document.getElementById('importSaveBtn').style.display = 'none';
  document.getElementById('importModal').style.display = 'flex';
}
function closeImportModal() { document.getElementById('importModal').style.display = 'none'; }

// Drag-and-drop
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var dz = document.getElementById('dropZone');
    if (!dz) return;
    dz.addEventListener('dragover', function(e){ e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', function(){ dz.classList.remove('drag-over'); });
    dz.addEventListener('drop', function(e){
      e.preventDefault(); dz.classList.remove('drag-over');
      var file = e.dataTransfer.files[0];
      if (file) handleImportFile(file);
    });
  });
})();

function handleImportFile(file) {
  if (!file) return;
  var ext = file.name.split('.').pop().toLowerCase();
  if (file.size > 5 * 1024 * 1024) { showToast('ไฟล์ใหญ่เกิน 5 MB', 'error'); return; }

  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    var parsed = [];
    try {
      if (ext === 'json') {
        var arr = JSON.parse(text);
        if (!Array.isArray(arr)) throw new Error('ต้องเป็น JSON array');
        parsed = arr;
      } else {
        parsed = _parseCSV(text);
      }
    } catch(err) {
      showToast('อ่านไฟล์ไม่ได้: ' + err.message, 'error'); return;
    }
    _showImportPreview(parsed);
  };
  reader.readAsText(file, 'UTF-8');
}

function _parseCSV(text) {
  var lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(function(l){ return l.trim(); });
  if (!lines.length) return [];

  function parseLine(line) {
    var result = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    result.push(cur.trim()); return result;
  }

  var headers = parseLine(lines[0]).map(function(h){ return h.toLowerCase().replace(/[\s_-]+/g,''); });
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = parseLine(lines[i]);
    var obj = {};
    headers.forEach(function(h, idx){ obj[h] = cols[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

function _normalizeRow(raw) {
  // Accept flexible column names
  function g(keys) {
    for (var i = 0; i < keys.length; i++) {
      var val = raw[keys[i]];
      if (val !== undefined && String(val).trim() !== '') return String(val).trim();
    }
    return '';
  }
  return {
    name:   g(['name','ชื่อเพลง','song','title']),
    artist: g(['artist','ศิลปิน','band','วง']),
    key:    g(['key','คีย์','tonality']),
    bpm:    parseInt(g(['bpm','tempo'])) || 0,
    singer: g(['singer','นักร้อง','vocal']),
    era:    g(['era','ยุค','period']),
    mood:   g(['mood','อารมณ์']),
    tags:   g(['tags','genre','แนวเพลง','ประเภท']),
  };
}

function _showImportPreview(rawRows) {
  var existing = {};
  _allSongs.forEach(function(s){ existing[(s.name||'').toLowerCase().trim()] = true; });

  var normalized = rawRows.map(_normalizeRow).filter(function(r){ return r.name; });
  var newRows = [], dupRows = [];
  normalized.forEach(function(r){
    var key = r.name.toLowerCase().trim();
    if (existing[key]) dupRows.push(r);
    else newRows.push(r);
  });
  _importRows = newRows;

  // Summary badges
  var sumEl = document.getElementById('importSummary');
  sumEl.style.display = 'flex';
  sumEl.innerHTML =
    '<span style="background:#D1FAE5;color:#065F46">' + newRows.length + ' เพลงใหม่</span>' +
    '<span style="background:#FEF9C3;color:#854D0E">' + dupRows.length + ' ซ้ำ (ข้าม)</span>' +
    '<span style="background:#F1F5F9;color:#475569">' + normalized.length + ' รวม</span>';

  if (!normalized.length) {
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importSaveBtn').style.display = 'none';
    showToast('ไม่พบข้อมูลในไฟล์', 'error'); return;
  }

  // Preview table (max 50 rows shown)
  var preview = normalized.slice(0, 50);
  var html = '<table><thead><tr><th>ชื่อเพลง</th><th>ศิลปิน</th><th>คีย์</th><th>BPM</th><th>นักร้อง</th><th>สถานะ</th></tr></thead><tbody>';
  preview.forEach(function(r){
    var isDup = existing[r.name.toLowerCase().trim()];
    var cls   = isDup ? 'import-row-dup' : 'import-row-ok';
    var badge = isDup ? '<span class="badge-dup">ซ้ำ</span>' : '<span class="badge-new">ใหม่</span>';
    html += '<tr class="' + cls + '">' +
      '<td>' + esc(r.name) + '</td><td>' + esc(r.artist) + '</td><td>' + esc(r.key) + '</td>' +
      '<td>' + (r.bpm||'') + '</td><td>' + esc(r.singer) + '</td><td>' + badge + '</td>' +
      '</tr>';
  });
  if (normalized.length > 50) html += '<tr><td colspan="6" style="text-align:center;color:#9CA3AF;padding:8px">... และอีก ' + (normalized.length-50) + ' รายการ</td></tr>';
  html += '</tbody></table>';

  var preEl = document.getElementById('importPreview');
  preEl.innerHTML = html;
  preEl.style.display = 'block';

  var saveBtn = document.getElementById('importSaveBtn');
  if (newRows.length > 0) {
    saveBtn.style.display = 'inline-flex';
    saveBtn.textContent = '💾 บันทึก ' + newRows.length + ' เพลงใหม่';
  } else {
    saveBtn.style.display = 'none';
    showToast('ทุกเพลงในไฟล์มีอยู่ในคลังแล้ว', 'success');
  }
}

function submitImport() {
  if (!_importRows.length) return;
  var btn = document.getElementById('importSaveBtn');
  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

  var bandId = localStorage.getItem('bandId') || '';
  var total  = _importRows.length;
  var done   = 0;
  var failed = 0;

  function next(idx) {
    if (idx >= total) {
      btn.disabled = false;
      closeImportModal();
      clearSongsCache();
      loadSongs();
      showToast('✅ เพิ่ม ' + (total - failed) + ' เพลงสำเร็จ' + (failed ? ' (' + failed + ' ล้มเหลว)' : ''), 'success');
      return;
    }
    var r = _importRows[idx];
    apiCall('addSong', {
      name: r.name, artist: r.artist, key: r.key, bpm: r.bpm,
      singer: r.singer, era: r.era, mood: r.mood, tags: r.tags || '', bandId: bandId
    }, function(res) {
      if (!res || !res.success) failed++;
      done++;
      btn.textContent = 'กำลังบันทึก... (' + done + '/' + total + ')';
      next(idx + 1);
    });
  }
  next(0);
}

// ─── Artist Management ────────────────────────────────────────────
function loadArtists() {
  apiCall('getArtists', {}, function(r) {
    _artistList = (r && r.success && r.data) ? r.data : [];
    updateArtistDatalist();
  });
}

function updateArtistDatalist() {
  var dl = document.getElementById('artistDatalist');
  if (!dl) return;
  // Only show artists that have at least one song in library (prevents orphan entries)
  var usedNames = new Set(_allSongs.map(function(s){ return (s.artist||'').trim().toLowerCase(); }).filter(Boolean));
  var filtered = usedNames.size > 0
    ? _artistList.filter(function(a){ return usedNames.has((a.name||'').trim().toLowerCase()); })
    : _artistList;
  dl.innerHTML = filtered.map(function(a) {
    return '<option value="' + esc(a.name) + '">';
  }).join('');
  // Note: filter autocomplete (buildArtistACList) uses _allSongs, not _artistList
}

// Auto-save artist name to master table when saving song
function ensureArtistExists(name, cb) {
  if (!name || !name.trim()) { if (cb) cb(); return; }
  apiCall('ensureArtist', { name: name.trim() }, function() {
    loadArtists(); // refresh datalist
    if (cb) cb();
  });
}

// ─── Keyboard shortcuts ───────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  var tag = (e.target.tagName || '').toLowerCase();
  var isEditable = (tag === 'input' || tag === 'textarea' || tag === 'select')
                || e.target.isContentEditable;

  // Prevent Backspace/Delete from triggering browser back-navigation
  // (Firefox and some browsers still support this shortcut)
  if ((e.key === 'Backspace' || e.key === 'Delete') && !isEditable) {
    e.preventDefault();
  }

  // iTunes popover: Escape closes it
  var itunesOpen = document.getElementById('itunesPopoverWrap').style.display !== 'none';
  if (itunesOpen) {
    if (e.key === 'Escape') { closeItunesPopover(); return; }
  }

  if (e.key === 'Escape') {
    closeAddModal();
    closeImportModal();
    closeArtistAC();
  }
  // Ctrl+Shift+A = เปิด add modal อย่างเร็ว
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    openAddModal();
  }
});

// ─── Artist Autocomplete (filter dropdown) ────────────────────────
var _acActiveIdx = -1;

function buildArtistACList(filterText) {
  var list = document.getElementById('acArtistList');
  if (!list) return;
  var q = (filterText || '').toLowerCase().trim();
  // Use artists from songs currently in library (not master table, to avoid orphan entries)
  var seen = {};
  var artists = [];
  _allSongs.forEach(function(s) {
    var n = (s.artist || '').trim();
    if (n && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = true; artists.push(n); }
  });
  artists.sort(function(a, b) { return a.localeCompare(b, 'th'); });
  var matched = q ? artists.filter(function(n) { return n.toLowerCase().indexOf(q) >= 0; }) : artists;
  var html = '<div class="ac-item ac-item-all" data-val="">ทุกศิลปิน</div>';
  for (var i = 0; i < matched.length; i++) {
    html += '<div class="ac-item" data-val="' + esc(matched[i]) + '">' + esc(matched[i]) + '</div>';
  }
  if (matched.length === 0 && q) {
    html += '<div class="ac-item" style="color:var(--premium-text-muted);pointer-events:none">ไม่พบศิลปิน</div>';
  }
  list.innerHTML = html;
  _acActiveIdx = -1;
}

// Event delegation for artist autocomplete (avoid duplicate listeners)
(function() {
  var acList = document.getElementById('acArtistList');
  if (acList) acList.addEventListener('click', function(e) {
    var item = e.target.closest('.ac-item[data-val]');
    if (item) selectArtistAC(item.getAttribute('data-val'));
  });
})();

function openArtistAC() {
  buildArtistACList(document.getElementById('asArtist').value);
  document.getElementById('acArtistList').classList.add('show');
}

function filterArtistAC() {
  var val = document.getElementById('asArtist').value;
  buildArtistACList(val);
  document.getElementById('acArtistList').classList.add('show');
}

function selectArtistAC(val) {
  _selectedArtistFilter = val;
  var inp = document.getElementById('asArtist');
  inp.value = val;
  closeArtistAC();
  filterTable();
}

function closeArtistAC() {
  var list = document.getElementById('acArtistList');
  if (list) list.classList.remove('show');
  _acActiveIdx = -1;
}

// Close autocomplete on outside click
document.addEventListener('click', function(e) {
  var wrap = e.target.closest('.ac-wrap');
  if (!wrap) closeArtistAC();
});

// Keyboard navigation in autocomplete
document.getElementById('asArtist') && document.getElementById('asArtist').addEventListener('keydown', function(e) {
  var list = document.getElementById('acArtistList');
  if (!list || !list.classList.contains('show')) return;
  var items = list.querySelectorAll('.ac-item[data-val]');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _acActiveIdx = Math.min(_acActiveIdx + 1, items.length - 1);
    updateACHighlight(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _acActiveIdx = Math.max(_acActiveIdx - 1, 0);
    updateACHighlight(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_acActiveIdx >= 0 && items[_acActiveIdx]) {
      selectArtistAC(items[_acActiveIdx].getAttribute('data-val'));
    }
  }
});

function updateACHighlight(items) {
  for (var i = 0; i < items.length; i++) {
    items[i].classList.toggle('active', i === _acActiveIdx);
    if (i === _acActiveIdx) items[i].scrollIntoView({ block: 'nearest' });
  }
}

// ─── Song Manager Settings ────────────────────────────────────────
function toggleSongManagerPanel() {
  var panel = document.getElementById('smPanel');
  if (panel.classList.contains('show')) {
    panel.classList.remove('show');
    return;
  }
  panel.classList.add('show');
  loadSongManagerList();
}

function loadSongManagerList() {
  var listEl = document.getElementById('smMemberList');
  listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--premium-text-muted)">กำลังโหลด...</div>';

  // Load band members and current song managers in parallel
  var members = null, currentManagers = [];
  var done = 0;
  function check() {
    done++;
    if (done < 2) return;
    renderSongManagerList(members, currentManagers);
  }
  apiCall('getBandProfiles', {}, function(r) {
    members = (r && r.success && r.data) || [];
    check();
  });
  apiCall('getBandSettings', {}, function(r) {
    var settings = (r && r.success && r.data) || {};
    currentManagers = settings.songManagers || [];
    check();
  });
}

function renderSongManagerList(members, currentManagers) {
  var listEl = document.getElementById('smMemberList');
  // Filter out admin users (they already have access)
  var nonAdmin = members.filter(function(m) {
    return m.role !== 'admin';
  });
  if (nonAdmin.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--premium-text-muted)">ไม่มีสมาชิกที่ไม่ใช่ Admin</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < nonAdmin.length; i++) {
    var m = nonAdmin[i];
    var name = m.nickname || m.first_name || m.user_name || m.email || '(ไม่มีชื่อ)';
    var checked = currentManagers.indexOf(m.id) >= 0 ? ' checked' : '';
    var roleLabel = m.role === 'manager' ? 'ผู้จัดการ' : 'สมาชิก';
    html += '<label class="sm-member"><input type="checkbox" value="' + esc(m.id) + '"' + checked + '><span class="sm-member-name">' + esc(name) + '</span><span class="sm-member-role">' + roleLabel + '</span></label>';
  }
  listEl.innerHTML = html;
}

function saveSongManagers() {
  var checkboxes = document.querySelectorAll('#smMemberList input[type=checkbox]');
  var ids = [];
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].checked) ids.push(checkboxes[i].value);
  }
  // Read existing settings first, then merge songManagers into it
  apiCall('getBandSettings', {}, function(r) {
    var existing = (r && r.success && r.data) || {};
    existing.songManagers = ids;
    apiCall('saveBandSettings', existing, function(res) {
      if (res && res.success) {
        alert('บันทึกผู้ดูแลเพลงเรียบร้อยแล้ว (' + ids.length + ' คน)');
        document.getElementById('smPanel').classList.remove('show');
      } else {
        alert('ไม่สามารถบันทึกได้ กรุณาลองอีกครั้ง');
      }
    });
  });
}

// ─── Online Presence (Realtime) ───────────────────────────────────
var _ACTIVITY_COLORS = {
  'ดูรายการ': '#EFF6FF',
  'ค้นหาเพลง': '#FEF3C7',
  'แก้ไขเพลง': '#FEF2F2',
  'เพิ่มเพลง': '#F0FDF4',
  'นำเข้าเพลง': '#EDE9FE',
  'ตั้งค่าผู้ดูแล': '#FCE7F3'
};

function initPresence() {
  if (!window._sb) return;
  var bandId = localStorage.getItem('bandId') || 'default';
  var channelName = 'presence-admin-songs-' + bandId;
  var userId = localStorage.getItem('userId') || '';
  var userName = localStorage.getItem('userName') || localStorage.getItem('userNickname') || 'ไม่ทราบชื่อ';

  _presenceChannel = window._sb.channel(channelName, {
    config: { presence: { key: userId } }
  });

  _presenceChannel
    .on('presence', { event: 'sync' }, function() {
      renderPresence();
    })
    .on('presence', { event: 'join' }, function() {
      renderPresence();
    })
    .on('presence', { event: 'leave' }, function() {
      renderPresence();
    })
    .subscribe(function(status) {
      if (status === 'SUBSCRIBED') {
        _presenceChannel.track({
          userId: userId,
          name: userName,
          activity: _myActivity,
          joinedAt: new Date().toISOString()
        });
      }
    });

  // Cleanup on page unload
  window.addEventListener('beforeunload', function() {
    if (_presenceChannel) _presenceChannel.untrack();
  });
}

function updateMyActivity(activity) {
  _myActivity = activity;
  if (_presenceChannel) {
    var userId = localStorage.getItem('userId') || '';
    var userName = localStorage.getItem('userName') || localStorage.getItem('userNickname') || 'ไม่ทราบชื่อ';
    _presenceChannel.track({
      userId: userId,
      name: userName,
      activity: activity,
      joinedAt: new Date().toISOString()
    });
  }
}

function renderPresence() {
  if (!_presenceChannel) return;
  var state = _presenceChannel.presenceState();
  var myId = localStorage.getItem('userId') || '';
  var users = [];

  // presenceState returns { key: [{ ... }], ... }
  var keys = Object.keys(state);
  for (var i = 0; i < keys.length; i++) {
    var entries = state[keys[i]];
    if (entries && entries.length > 0) {
      users.push(entries[0]); // latest presence per user
    }
  }

  var container = document.getElementById('presenceUsers');
  if (!container) return;

  if (users.length === 0) {
    container.innerHTML = '<span style="font-size:12px;color:var(--premium-text-muted)">ไม่มีใครออนไลน์</span>';
    return;
  }

  var html = '';
  for (var j = 0; j < users.length; j++) {
    var u = users[j];
    var isMe = u.userId === myId;
    var initial = (u.name || '?').charAt(0).toUpperCase();
    var chipClass = isMe ? 'presence-chip me' : 'presence-chip';
    var activity = u.activity || 'ดูรายการ';
    html += '<span class="' + chipClass + '">'
      + '<span class="pc-avatar">' + esc(initial) + '</span>'
      + esc(u.name || 'ไม่ทราบชื่อ') + (isMe ? ' (คุณ)' : '')
      + '<span class="pc-activity">— ' + esc(activity) + '</span>'
      + '</span>';
  }
  container.innerHTML = html;
}

// ─── Activity Tracking Hooks ──────────────────────────────────────
// Hook into existing functions to track user activity
(function() {
  // Track search
  var _origSearchInput = window.searchInputChanged;
  window.searchInputChanged = function() {
    var val = (document.getElementById('asSearch').value || '').trim();
    if (val) updateMyActivity('ค้นหา: "' + val.substring(0, 20) + '"');
    else updateMyActivity('ดูรายการ');
    if (_origSearchInput) _origSearchInput.apply(this, arguments);
  };

  // Track opening add modal
  var _origOpenAdd = window.openAddModal;
  if (_origOpenAdd) {
    window.openAddModal = function() {
      updateMyActivity('เพิ่มเพลง');
      _origOpenAdd.apply(this, arguments);
    };
  }

  // Track closing add modal
  var _origCloseAdd = window.closeAddModal;
  if (_origCloseAdd) {
    window.closeAddModal = function() {
      updateMyActivity('ดูรายการ');
      _origCloseAdd.apply(this, arguments);
    };
  }

  // Track import modal
  var _origOpenImport = window.openImportModal;
  if (_origOpenImport) {
    window.openImportModal = function() {
      updateMyActivity('นำเข้าเพลง');
      _origOpenImport.apply(this, arguments);
    };
  }
  var _origCloseImport = window.closeImportModal;
  if (_origCloseImport) {
    window.closeImportModal = function() {
      updateMyActivity('ดูรายการ');
      _origCloseImport.apply(this, arguments);
    };
  }

  // Track song manager panel
  var _origToggleSM = window.toggleSongManagerPanel;
  if (_origToggleSM) {
    window.toggleSongManagerPanel = function() {
      var panel = document.getElementById('smPanel');
      var willOpen = !panel.classList.contains('show');
      _origToggleSM.apply(this, arguments);
      updateMyActivity(willOpen ? 'ตั้งค่าผู้ดูแล' : 'ดูรายการ');
    };
  }
})();

// ─── iTunes Lookup for Admin Songs ──────────────────────────────
var _itunesPendingSongId = null;
var _itunesPendingData   = null;

var _AS_ERA_OPTS  = ['80s','90s','2000s','2010s','2020s'];
var _AS_TAGS_OPTS = ['ป๊อป','ร็อค','ดิสโก้','แร๊ฟ/ฮิปฮอป','ลูกทุ่ง / อีสาน','เพื่อชีวิต','อาร์แอนด์บี','แจ๊ส / บลูส์','เรกเก้','อินดี้'];
var _AS_MOOD_OPTS = ['มัน / สนุก','หวาน / โรแมนติก','เศร้า / อกหัก','นิ่ง / ผ่อนคลาย','ฮึกเหิม / ยิ่งใหญ่'];
var _AS_KEY_OPTS  = ['C / Am','1#','2#','3#','4#','5#','6#','7#','1b','2b','3b','4b','5b','6b','7b'];
var _AS_SINGER_OPTS = ['ชาย','หญิง','ชาย/หญิง'];
var _AS_ITUNES_FIELDS = [
  { f:'name',   label:'ชื่อเพลง', icon:'🎶', type:'text' },
  { f:'artist', label:'ศิลปิน',   icon:'👤', type:'text' },
  { f:'singer', label:'นักร้อง',  icon:'🎤', type:'singer' },
  { f:'key',    label:'คีย์',     icon:'🎵', type:'key'  },
  { f:'bpm',    label:'BPM',      icon:'♩',  type:'number' },
  { f:'mood',   label:'อารมณ์',   icon:'💫', type:'mood' },
  { f:'era',    label:'ยุค',      icon:'📅', type:'era'  },
  { f:'tags',   label:'แนวเพลง', icon:'🏷️', type:'tags' }
];

function itunesLookup(songId) {
  var song = _allSongs.find(function(s) { return s.id === songId; });
  if (!song) return;
  _itunesPendingSongId = songId;
  _itunesPendingData   = null;
  var wrap = document.getElementById('itunesPopoverWrap');
  var cnt  = document.getElementById('itunesPopoverContent');
  var act  = document.getElementById('itunesPopoverActions');
  cnt.innerHTML = '<div style="text-align:center;color:#0ea5e9;padding:16px 0">🎵 กำลังค้นหา &ldquo;<strong>' + esc(song.name) + '</strong>&rdquo; ใน iTunes...</div>';
  act.style.display = 'none';
  wrap.style.display = '';
  itunesSearch(song.name, song.artist || '', function(result, errText) {
    if (!result) {
      cnt.innerHTML = '<div style="color:#DC2626;font-size:.85rem;padding:10px 0">⚠️ ' + esc(errText || 'ไม่พบข้อมูล') + '</div>'
        + '<button onclick="itunesLookup(\'' + esc(songId) + '\')" style="margin-top:8px;background:#6366f1;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:.8rem;cursor:pointer">🔄 ลองใหม่</button>';
      act.style.display = 'none';
      return;
    }
    _itunesPendingData = result;
    var row = document.querySelector('tr[data-id="' + songId + '"]');

    // Build field-by-field table with checkbox + editable input
    var tableRows = '';
    _AS_ITUNES_FIELDS.forEach(function(fd) {
      var sug = result[fd.f] || '';
      if (!sug && fd.f !== 'bpm') return;
      if (fd.f === 'bpm' && !result.bpm) return;
      var curEl = row ? row.querySelector('[data-field="' + fd.f + '"]') : null;
      var cur = curEl ? (curEl.value || '') : (song[fd.f] || '');
      var isDiff = String(cur).toLowerCase().trim() !== String(sug).toLowerCase().trim();
      var inputId = 'as-it-' + fd.f;
      var chkId   = 'as-itchk-' + fd.f;
      var inputHtml;
      if (fd.type === 'era') {
        inputHtml = '<select id="' + inputId + '" style="border:1px solid #d1d5db;border-radius:5px;padding:3px 6px;font-size:.82rem;background:#fff;font-family:inherit;width:100%">'
          + _AS_ERA_OPTS.map(function(o){ return '<option' + (o===sug?' selected':'') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
      } else if (fd.type === 'tags') {
        inputHtml = '<select id="' + inputId + '" style="border:1px solid #d1d5db;border-radius:5px;padding:3px 6px;font-size:.82rem;background:#fff;font-family:inherit;width:100%">'
          + _AS_TAGS_OPTS.map(function(o){ return '<option' + (o===sug?' selected':'') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
      } else if (fd.type === 'mood') {
        inputHtml = '<select id="' + inputId + '" style="border:1px solid #d1d5db;border-radius:5px;padding:3px 6px;font-size:.82rem;background:#fff;font-family:inherit;width:100%">'
          + _AS_MOOD_OPTS.map(function(o){ return '<option' + (o===sug?' selected':'') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
      } else if (fd.type === 'key') {
        inputHtml = '<select id="' + inputId + '" style="border:1px solid #d1d5db;border-radius:5px;padding:3px 6px;font-size:.82rem;background:#fff;font-family:inherit;width:100%">'
          + _AS_KEY_OPTS.map(function(o){ return '<option' + (o===sug?' selected':'') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
      } else if (fd.type === 'singer') {
        inputHtml = '<select id="' + inputId + '" style="border:1px solid #d1d5db;border-radius:5px;padding:3px 6px;font-size:.82rem;background:#fff;font-family:inherit;width:100%">'
          + '<option value="">—</option>' + _AS_SINGER_OPTS.map(function(o){ return '<option' + (o===cur?' selected':'') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
        isDiff = false;
      } else if (fd.type === 'number') {
        inputHtml = '<input id="' + inputId + '" type="number" value="' + esc(String(sug)) + '" min="0" max="300" style="border:1px solid #d1d5db;border-radius:5px;padding:3px 6px;font-size:.82rem;background:#fff;font-family:inherit;width:100%;box-sizing:border-box">';
      } else {
        inputHtml = '<input id="' + inputId + '" value="' + esc(sug) + '" style="border:1px solid #d1d5db;border-radius:5px;padding:3px 6px;font-size:.82rem;background:#fff;font-family:inherit;width:100%;box-sizing:border-box">';
      }
      tableRows += '<tr style="border-bottom:1px solid #f3f4f6">'
        + '<td style="padding:5px 4px;white-space:nowrap;width:1%"><input type="checkbox" id="' + chkId + '" ' + (isDiff ? 'checked' : '') + ' style="accent-color:#16a34a;cursor:pointer;width:15px;height:15px"></td>'
        + '<td style="padding:5px 4px;white-space:nowrap"><label for="' + chkId + '" style="font-size:.8rem;font-weight:700;color:#374151;cursor:pointer">' + fd.icon + ' ' + esc(fd.label) + '</label></td>'
        + '<td style="padding:5px 4px;font-size:.75rem;color:#9ca3af;text-decoration:line-through;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(cur || '—') + '</td>'
        + '<td style="padding:5px 4px;font-size:.75rem;color:#9ca3af">→</td>'
        + '<td style="padding:5px 4px;min-width:120px">' + inputHtml + '</td>'
        + '</tr>';
    });

    var infoHtml = '<div style="background:#e0f2fe;border-radius:6px;padding:6px 10px;margin-bottom:10px;font-size:.78rem;color:#374151">'
      + '🎵 <strong>' + esc(result.trackName || result.name) + '</strong>'
      + (result.year ? ' · ' + esc(result.year) : '')
      + (result.genre ? ' · ' + esc(result.genre) : '')
      + (result.itunesUrl ? ' · <a href="' + esc(result.itunesUrl) + '" target="_blank" style="color:#0ea5e9">เปิดใน iTunes</a>' : '')
      + '</div>';

    cnt.innerHTML = infoHtml
      + '<div style="font-size:.72rem;color:#6b7280;margin-bottom:6px">☑️ เลือก field แก้ค่าได้ แล้วกด <strong>นำไปใช้</strong></div>'
      + '<table style="width:100%;border-collapse:collapse">' + tableRows + '</table>'
      + '<div style="margin-top:8px;display:flex;gap:6px">'
      + '<button onclick="asItunesCheckAll(true)" style="background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:5px;padding:3px 8px;font-size:.72rem;cursor:pointer">☑️ ทั้งหมด</button>'
      + '<button onclick="asItunesCheckAll(false)" style="background:#f1f5f9;color:#374151;border:1px solid #d1d5db;border-radius:5px;padding:3px 8px;font-size:.72rem;cursor:pointer">☐ ยกเลิก</button>'
      + '</div>';

    act.style.display = '';
    act.innerHTML = '<button class="btn-sm" style="background:#0ea5e9;color:#fff;border:none;flex:1" onclick="applyItunesData()">✅ นำไปใช้ที่เลือก</button>'
      + '<button class="btn-sm" style="background:#f1f5f9;color:#374151;border:1px solid #d1d5db" onclick="closeItunesPopover()">ยกเลิก</button>';
  });
}

function asItunesCheckAll(check) {
  _AS_ITUNES_FIELDS.forEach(function(fd) {
    var el = document.getElementById('as-itchk-' + fd.f);
    if (el) el.checked = check;
  });
}

function applyItunesData() {
  var songId = _itunesPendingSongId;
  var data   = _itunesPendingData;
  if (!songId || !data) return;
  var row = document.querySelector('tr[data-id="' + songId + '"]');
  if (!row) { closeItunesPopover(); showToast('เพลงอยู่คนละหน้า — เปิดหน้าที่มีเพลงนั้นก่อน แล้วกด 🎵 ใหม่', 'warning'); return; }
  var changed = false;
  _AS_ITUNES_FIELDS.forEach(function(fd) {
    var chk = document.getElementById('as-itchk-' + fd.f);
    if (!chk || !chk.checked) return;
    var inp = document.getElementById('as-it-' + fd.f);
    var val = inp ? inp.value.trim() : (data[fd.f] || '');
    if (!val) return;
    var el = row.querySelector('[data-field="' + fd.f + '"]');
    if (el) { el.value = val; changed = true; }
  });
  if (changed) {
    var anyEl = row.querySelector('input,select');
    if (anyEl) markDirty(anyEl);
    showToast('✅ นำข้อมูล iTunes มาใส่แล้ว กด 💾 เพื่อบันทึก', 'success');
  } else {
    showToast('ℹ️ ไม่ได้เลือก field ใด', 'info');
  }
  closeItunesPopover();
}

function closeItunesPopover() {
  document.getElementById('itunesPopoverWrap').style.display = 'none';
  _itunesPendingSongId = null;
  _itunesPendingData   = null;
}