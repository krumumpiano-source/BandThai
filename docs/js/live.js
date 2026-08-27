'use strict';

// ─────────────────────────────────────────────────────────────────
//  KEY CONSTANTS (from songs.html)
// ─────────────────────────────────────────────────────────────────
const MAJOR_KEYS = [
  {degree:'C',semi:0},{degree:'1#',semi:7},{degree:'2#',semi:2},{degree:'3#',semi:9},
  {degree:'4#',semi:4},{degree:'5#',semi:11},{degree:'6#',semi:6},
  {degree:'1b',semi:5},{degree:'2b',semi:10},{degree:'3b',semi:3},
  {degree:'4b',semi:8},{degree:'5b',semi:1}
];
const MAJOR_THEORY = [{degree:'7#',semi:1},{degree:'7b',semi:11}];
const MINOR_KEYS = [
  {degree:'0',semi:9},{degree:'1#',semi:4},{degree:'2#',semi:11},{degree:'3#',semi:6},
  {degree:'4#',semi:1},{degree:'1b',semi:2},{degree:'2b',semi:7},{degree:'3b',semi:0},
  {degree:'4b',semi:5},{degree:'5b',semi:10},{degree:'6b',semi:3}
];
const MINOR_THEORY = [{degree:'7#',semi:10},{degree:'7b',semi:8}];

function transposeKey(degree, step) {
  if (!degree || degree === '-') return degree;
  var isMinor = degree.endsWith('m');
  var cleanDeg = isMinor ? degree.slice(0, -1) : degree;
  var pool = isMinor ? [...MINOR_KEYS, ...MINOR_THEORY] : [...MAJOR_KEYS, ...MAJOR_THEORY];
  var cur = pool.find(function(k){ return k.degree === cleanDeg; });
  if (!cur) return degree;
  var newSemi = ((cur.semi + step) % 12 + 12) % 12;
  var target = pool.find(function(k){ return k.semi === newSemi && !k.degree.startsWith('7'); });
  return target ? (target.degree + (isMinor ? 'm' : '')) : degree;
}

// ─────────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────────
var _playlist  = [];   // array of {name, key, bpm, singer, artist, _key, _note, _skipped, _isRequest, _isEncore}
var _current   = 0;    // index of now playing
var _modified  = false;
var _channel   = null; // Supabase Broadcast
var _bandId    = localStorage.getItem('bandId') || '';
var _joinedAt  = Date.now();
var _trStep    = 0;   // current transpose offset for active song (temp, before commit)
var _noteIdx   = -1;  // which song is being noted
var _fontLevel = parseInt(localStorage.getItem('liveFontLevel') || '1', 10); // 0=S,1=M,2=L
var _wakeLock  = null;
var _lastLocalAddTime = 0; // timestamp ของครั้งล่าสุดที่เพิ่มเพลงในเครื่องนี้ (ป้องกัน state_sync stale)
var _lastLocalCurrentChange = 0; // timestamp เมื่อกดเปลี่ยนเพลงในเครื่องนี้ (ป้องกัน state_sync เก่าดึงเด้งกลับ)
var _currentUpdatedAt = Date.now(); // timestamp ของ _current ล่าสุด (versioning for current song)

// ── Marquee / title display ───────────────────────────────────────
var _marqueeColorsDark  = ['#fde68a','#86efac','#93c5fd','#f9a8d4'];
var _marqueeColorsLight = ['#92400e','#14532d','#1e3a8a','#831843'];
var _marqueeColorIdx    = 0;
var _marqueeRAF         = null;  // requestAnimationFrame id
var _noteMarqueeRAF     = null;  // requestAnimationFrame id for note marquee
var _endingTimer = null;
var _isEnding  = false;
var _allSongs  = [];   // preloaded band song library for autocomplete
var _allSongsLoaded = false;
var _guestLinkToken = null; // pre-generated QR token
var _breakWarningTimer = null;
// ── Break Timer ──────────────────────────────────────────────────
var _breakStarted            = false;
var _breakStartedByMe        = false; // true = this device pressed startBreak() directly (not sessionStorage restore)
var _breakStartTime          = 0;     // Date.now() when startBreak() called
var _lastEndedBreakStartTime = 0;     // breakStartTime ของเบรคล่าสุดที่จบไปแล้ว (proof for offline devices)
var _breakTargetMin          = 60;    // target minutes (from venue settings)
var _breakTimerIval          = null;
var _scheduledStartMin       = -1;  // minutes-from-midnight parsed from timeSlot
var _breakWarnedAt55         = false;
var _breakWarnedDone         = false;
// ────────────────────────────────────────────────────────────────
var _clockTimer = null;
var _ctxIdx = -1; // context menu target song index
var _clientId = 'live-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
var _stateSyncTimer = null;

// ── Sync state (realtime) ─────────────────────────────────────────
var _syncReceived     = false; // have we received a state_sync after joining?
var _syncRetryCount   = 0;
var _syncRetryTimer   = null;
var _periodicSyncTimer = null;
var _isSyncLeader     = false; // true = this device is earliest joiner & broadcast authority
var _channelStatus    = '';    // 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | ''
var _channelName      = '';    // current channel name for debug
var _rtSendOk         = 0;    // broadcast send success count
var _rtSendFail       = 0;    // broadcast send fail count
var _rtLastSent       = '';   // last event name sent + time
var _rtLastRecv       = '';   // last event name received + time
var _rtDebugTaps      = 0;    // tap counter for debug panel
var _rtDebugTimer     = null;
var _rtHeartbeatTimer = null;
var _rtLastActivity   = Date.now(); // last send or receive timestamp
var _userHasInteracted = false; // true after first click/touch — guards vibrate+AudioContext

// ── Drag-reorder state ────────────────────────────────────────────
var _drag = { active: false, fromIdx: -1, toIdx: -1, ghostEl: null };

// ── Undo state ─────────────────────────────────────────────────────
var _undoStack = []; // array of { current, songName, songKey }

// ── Chat ───────────────────────────────────────────────────────────
var _chatMessages = []; // array of { from, text, time, isMine }
var _chatUnread = 0;
var _chatOpen = false;

// ── HBD Timer ────────────────────────────────────────────────────────────
var _hbdFired = {}; // track which HBD songs already fired (by idx)
var _hbdWarned = {}; // track 2-min warning shown
var _hbdTimer = null;

// ── Double-tap / double-click detection ──────────────────────────
var _tapTimer   = null;
var _lastTapIdx = -1;

var _isGuest   = false; // guest mode (no login required)

function normalizePlaylistState(preferredCurrent) {
  if (!Array.isArray(_playlist)) _playlist = [];
  if (_playlist.length === 0) {
    _current = 0;
    return;
  }
  if (typeof preferredCurrent === 'number' && !isNaN(preferredCurrent)) {
    _current = preferredCurrent;
  }
  if (_current < 0) _current = 0;
  if (_current >= _playlist.length) _current = _playlist.length - 1;
}

function scheduleStateSync() {
  if (!_channel) return;
  if (_stateSyncTimer) clearTimeout(_stateSyncTimer);
  _stateSyncTimer = setTimeout(function() {
    _stateSyncTimer = null;
    broadcastEvent('state_sync', getState());
  }, 80);
}

function isOwnBroadcast(payload) {
  var data = payload && payload.payload;
  // Track ALL incoming broadcast events for debug (including own)
  var evtName = (payload && payload.event) || '?';
  _rtLastRecv = evtName + ' ' + new Date().toLocaleTimeString();
  _rtLastActivity = Date.now();
  return !!(data && data.senderId === _clientId);
}

function removeSongAtIndex(idx) {
  if (typeof idx !== 'number' || idx < 0 || idx >= _playlist.length) return false;
  _playlist.splice(idx, 1);
  if (_playlist.length === 0) {
    _current = 0;
    return true;
  }
  if (idx < _current) {
    _current--;
  } else if (idx === _current && _current >= _playlist.length) {
    _current = _playlist.length - 1;
  }
  normalizePlaylistState();
  return true;
}

// URL params
var _params    = new URLSearchParams(location.search);
var _date      = _params.get('date') || '';
var _venue     = _params.get('venue') || '';
var _timeSlot  = _params.get('timeSlot') || '';
var _guestToken = _params.get('token') || '';

// Default to today if no date in URL
if (!_date) {
  var _td = new Date();
  _date = _td.getFullYear() + '-' + String(_td.getMonth()+1).padStart(2,'0') + '-' + String(_td.getDate()).padStart(2,'0');
}
// guest mode: URL has guest=1&token=XXX&band=XXX
if (_params.get('guest') === '1') {
  _isGuest = true;
  _bandId  = _params.get('band') || _bandId;
}

// ─────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Dynamic title
  var _bn = localStorage.getItem('bandName');
  if (_bn) document.title = 'Live Mode — ' + _bn;
  // ── Restore theme ──────────────────────────────────────────────
  var savedTheme = localStorage.getItem('liveTheme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    var _tb = document.getElementById('themeToggleBtn');
    if (_tb) _tb.textContent = '☀️';
  }
  setFontLevel(_fontLevel);
  startClock();
  _startHbdTimer();
  acquireWakeLock();
  document.getElementById('venueLabel').textContent = [_venue, _timeSlot].filter(Boolean).join(' · ');

  // ── Break Timer Init ────────────────────────────────────────────
  try {
    var _bsData = JSON.parse(localStorage.getItem('bandSettings') || '{}');
    var _vMatch2 = (_bsData.venues || []).find(function(v){ return v.name === _venue; });
    _breakTargetMin = (_vMatch2 && _vMatch2.breakMinutes > 0) ? parseInt(_vMatch2.breakMinutes, 10) : 60;
  } catch(e) { _breakTargetMin = 60; }
  // Parse scheduled start (minutes-from-midnight) from timeSlot e.g. "20:00-01:00"
  if (_timeSlot) {
    var _tsM = _timeSlot.match(/(\d{1,2}):(\d{2})/);
    if (_tsM) _scheduledStartMin = parseInt(_tsM[1], 10) * 60 + parseInt(_tsM[2], 10);
  }
  // Restore timer if page was refreshed mid-break
  try {
    var _savedBst = sessionStorage.getItem('_breakStartTime');
    if (_savedBst && !_isGuest) {
      _breakStartTime = parseInt(_savedBst, 10);
      _breakStarted = true;
      var _sb = document.getElementById('startBreakBtn');
      var _eb = document.getElementById('endBreakBtn');
      var _tb = document.getElementById('breakTimerBar');
      if (_sb) _sb.style.display = 'none';
      if (_eb) _eb.style.display = '';
      if (_tb) _tb.style.display = 'flex';
      updateBreakTimer();
      _breakTimerIval = setInterval(updateBreakTimer, 1000); // อัพเดททุก 1 วินาที
    }
  } catch(e) {}
  // Show 📋 button if there's a saved snapshot from last break
  try {
    if (sessionStorage.getItem('_lastBreakSnap')) {
      var _scbInit = document.getElementById('showClipBtn');
      if (_scbInit) _scbInit.style.display = '';
    }
  } catch(e) {}
  // Guest mode: skip startBreakBtn flow
  if (_isGuest) {
    var _gsb = document.getElementById('startBreakBtn');
    var _geb = document.getElementById('endBreakBtn');
    if (_gsb) _gsb.style.display = 'none';
    if (_geb) _geb.style.display = '';
  }
  // ────────────────────────────────────────────────────────────────

  // Set initial metronome button states
  var _initSndBtn = document.getElementById('metSoundBtn');
  if (_initSndBtn) {
    _initSndBtn.classList.toggle('on', _metAudioOn);
    _initSndBtn.innerHTML = _metAudioOn ? '🔊' : '🔇';
  }
  // Sync key mode button label
  var _km = document.getElementById('keyModeBtn');
  if (_km) _km.textContent = getKeyDisplayMode() === 'number' ? '🔤' : '🔢';

  // ── Tap realtime indicator = manual resync (5-tap = debug panel) ──
  document.getElementById('realtimeIndicator').addEventListener('click', function() {
    // 5-tap detection for debug panel
    _rtDebugTaps++;
    if (_rtDebugTimer) clearTimeout(_rtDebugTimer);
    _rtDebugTimer = setTimeout(function() { _rtDebugTaps = 0; }, 2000);
    if (_rtDebugTaps >= 5) {
      _rtDebugTaps = 0;
      updateDebugPanel();
      document.getElementById('rtDebugPanel').classList.toggle('show');
      return;
    }
    // Normal tap = resync
    if (!_channel) { initRealtime(); showToast('🔄 กำลังเชื่อมต่อ...'); return; }
    _syncReceived = false;
    _syncRetryCount = 0;
    requestStateWithRetry();
    showToast('🔄 กำลังซิงค์...');
  });

  // ── Re-sync when app comes back from background ──
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      // Re-acquire WakeLock if lost (merged from global handler)
      if ('wakeLock' in navigator && !_wakeLock) acquireWakeLock();
      // Force reconnect if channel is stale or disconnected
      if (_channelStatus !== 'SUBSCRIBED') {
        console.log('[Live-RT] visibility: channel not SUBSCRIBED, reconnecting...');
        initRealtime();
      } else if (_channel && _playlist.length > 0) {
        _syncReceived = false;
        _syncRetryCount = 0;
        requestStateWithRetry();
      }
    }
  });

  // ── Network online/offline → auto-reconnect ──
  window.addEventListener('online', function() {
    console.log('[Live-RT] network online — reconnecting...');
    setTimeout(function() { initRealtime(); }, 1000);
  });
  window.addEventListener('offline', function() {
    console.log('[Live-RT] network offline');
    _channelStatus = '';
    var ind = document.getElementById('realtimeIndicator');
    if (ind) ind.className = 'error';
  });

  // Safety net: iOS Safari อาจ reset _isGuest ก่อน DOMContentLoaded
  // ตรวจ URL params ซ้ำเพื่อป้องกัน false redirect
  if (!_isGuest && _params.get('guest') === '1') {
    _isGuest = true;
    _bandId  = _params.get('band') || _bandId;
    _date    = _params.get('date') || _date;
    _venue   = _params.get('venue') || _venue;
    _timeSlot = _params.get('timeSlot') || _timeSlot;
    _guestToken = _params.get('token') || _guestToken;
  }

  if (_isGuest) {
    // guest mode — สแกน QR เข้าใช้งาน
    document.getElementById('guestBadge').style.display = 'inline-block';
    document.getElementById('endBreakBtn').style.display = 'inline-block';
    document.getElementById('nudgeBtn').style.display = 'inline-block';
    if (!_bandId || !_date) { showInvalidToken(); return; }
    document.getElementById('venueLabel').textContent = [_venue, _timeSlot].filter(Boolean).join(' · ');

    // ── ตรวจว่าผู้ใช้นี้เป็นสมาชิกวงจริงหรือเปล่า ──
    var storedBand  = localStorage.getItem('bandId')     || '';
    var storedToken = localStorage.getItem('auth_token') || '';
    if (storedToken && storedBand === _bandId) {
      // เป็นสมาชิก — อัปเกรดเป็น member mode
      _isGuest = false;
      document.getElementById('guestBadge').style.display = 'none';
      loadPlaylist();
      preGenerateToken();
      setupBreakWarning();
      showHintsIfFirstTime();
      return;
    }

    // ── ตรวจ token จาก URL (ถ้ามี) ──
    if (_guestToken) {
      apiCall('verifyGuestToken', { token: _guestToken }, function(rv) {
        if (rv && rv.success && rv.data) {
          // token ถูกต้อง — อัปเดตข้อมูลจาก token เป็นหลัก
          if (rv.data.bandId)   _bandId   = rv.data.bandId;
          if (rv.data.date)     _date     = rv.data.date;
          if (rv.data.venue)    _venue    = rv.data.venue;
          if (rv.data.timeSlot) _timeSlot = rv.data.timeSlot;
          document.getElementById('venueLabel').textContent = [_venue, _timeSlot].filter(Boolean).join(' · ');
        }
        // token หมดอายุ/ผิด แต่ถ้ายังมี band+date ใน URL → ยังเข้าได้
        if (!rv || !rv.success) {
          console.warn('[Live] guest token invalid/expired, proceeding with URL params');
          if (!_bandId || !_date) { showInvalidToken(); return; }
        }
        loadPlaylist();
        setupBreakWarning();
        showHintsIfFirstTime();
      });
    } else {
      // ไม่มี token — เข้าได้เลยถ้ามี band+date
      loadPlaylist();
      setupBreakWarning();
      showHintsIfFirstTime();
    }
  } else {
    // member mode — require login
    if (!_bandId || !localStorage.getItem('auth_token')) {
      window.location.replace('index.html');
      return;
    }
    document.getElementById('nudgeBtn').style.display = 'inline-block';
    loadPlaylist();
    preGenerateToken();
    setupBreakWarning();
    showHintsIfFirstTime();
  }

  // global drag events
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd);
  document.addEventListener('touchcancel', onDragEnd);

  // beforeunload guard (desktop browsers)
  window.addEventListener('beforeunload', function(e) {
    if (_modified) { e.preventDefault(); e.returnValue = ''; }
  });
  // pagehide: iOS Safari fallback — broadcast state ก่อนปิด tab/กด back
  // (iOS ไม่รองรับ beforeunload dialog แต่ pagehide fires ได้เสมอ)
  window.addEventListener('pagehide', function() {
    if (_modified && _channel && _channelStatus === 'SUBSCRIBED') {
      broadcastEvent('state_sync', getState());
    }
  });
  // NoSleep: เปิดใช้งานหลัง user gesture (iOS ต้องการ gesture ก่อน play video)
  if (_noSleep && !_noSleepEnabled) {
    try { _noSleep.enable(); _noSleepEnabled = true; } catch(e) {}
  }
  // touch close modals
  ['transposeModal','noteModal','editSongModal','bpmModal','clipModal','qrModal'].forEach(function(id) {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('show');
      }
    });
  });
  // insertPosModal: tap backdrop → ยกเลิกการเพิ่มเพลง (ต้องเรียก closeInsertPos เพื่อ clear _pendingSong)
  document.getElementById('insertPosModal').addEventListener('click', function(e) {
    if (e.target === this) closeInsertPos();
  });
  // nudgeModal uses style.display instead of .show class
  document.getElementById('nudgeModal').addEventListener('click', function(e) {
    if (e.target === this) closeNudge();
  });
  document.getElementById('nudgeSettingsModal').addEventListener('click', function(e) {
    if (e.target === this) closeNudgeSettings();
  });

  // ── Chat bar & swipe-to-switch ──
  initChatBar();
  initNowPlayingSwipe();
});

// ─────────────────────────────────────────────────────────────────
//  PRELOAD BAND SONGS & SYNC WITH LIBRARY
// ─────────────────────────────────────────────────────────────────
function preloadBandSongs(onDone) {
  if (!_bandId) { if (onDone) onDone(); return; }
  apiCall('getAllSongs', { source: 'band', bandId: _bandId }, function(r) {
    if (r && r.success && r.data) {
      _allSongs = r.data.slice().sort(function(a, b) {
        return (a.name || '').localeCompare(b.name || '', 'th');
      });
      _allSongsLoaded = true;
      syncPlaylistWithLibrary();
    }
    if (onDone) onDone();
  });
}

function syncPlaylistWithLibrary() {
  if (!_allSongsLoaded || !_allSongs.length || !_playlist || !_playlist.length) return;
  var changed = false;
  _playlist.forEach(function(s) {
    if (!s || !s.name) return;
    var nameLower = (s.name || '').trim().toLowerCase();
    var match = null;
    for (var i = 0; i < _allSongs.length; i++) {
      if ((_allSongs[i].name || '').trim().toLowerCase() === nameLower) {
        match = _allSongs[i];
        break;
      }
    }
    if (match) {
      if (match.bpm && s.bpm !== match.bpm) {
        s.bpm = match.bpm;
        changed = true;
      }
      // อัปเดตคีย์หากไม่ได้ transpose เองใน Live Mode
      if (match.key && s.key !== match.key && (!s._key || s._key === s.key)) {
        s.key = match.key;
        s._key = match.key;
        changed = true;
      }
      if (match.singer && s.singer !== match.singer) {
        s.singer = match.singer;
        changed = true;
      }
      if (match.artist && s.artist !== match.artist) {
        s.artist = match.artist;
        changed = true;
      }
    }
  });
  if (changed) {
    renderSongList();
    renderNowPlaying();
  }
}

// ─────────────────────────────────────────────────────────────────
//  LOAD PLAYLIST
// ─────────────────────────────────────────────────────────────────
function loadPlaylist() {
  if (!_date) { showEmpty(); initRealtime(); return; }
  console.log('[Live] loadPlaylist:', { bandId: _bandId, date: _date, venue: _venue, timeSlot: _timeSlot });
  // Preload band song library in parallel so songs have updated key/bpm/singer
  preloadBandSongs();

  // Timeout: ถ้า API ไม่ตอบใน 8 วิ → แสดง waiting + init realtime
  var _loadTimeout = setTimeout(function() {
    _loadTimeout = null;
    showWaitingForSync();
    initRealtime();
    showToast('⚠️ โหลดข้อมูลช้า — รอซิงค์จากสมาชิก...');
  }, 8000);
  apiCall('getPlaylistHistoryByDate', { bandId: _bandId, date: _date }, function(r) {
    if (_loadTimeout) { clearTimeout(_loadTimeout); _loadTimeout = null; }
    if (r && !r.success) console.warn('[Live] API error:', r.message);
    var rows = (r && r.success && r.data) ? r.data : [];
    console.log('[Live] playlist rows found:', rows.length);
    // filter by venue+timeSlot if provided
    var row = null;
    if (_venue || _timeSlot) {
      // Exact match first
      row = rows.find(function(x) {
        return x.venue === _venue && x.timeSlot === _timeSlot;
      });
      // Partial match: venue only
      if (!row && _venue) {
        row = rows.find(function(x) { return x.venue === _venue; });
      }
      // Partial match: timeSlot only
      if (!row && _timeSlot) {
        row = rows.find(function(x) { return x.timeSlot === _timeSlot; });
      }
      // No match — do not silently load wrong playlist; wait for realtime sync
      if (!row) {
        console.warn('[Live] No matching playlist for venue/timeSlot, waiting for realtime sync');
        showWaitingForSync();
        initRealtime();
        return;
      }
    } else {
      row = rows[0];
    }
    if (!row || !row.songs || row.songs.length === 0) {
      // ไม่พบใน DB — แสดง loading และรอรับ state จากสมาชิกผ่าน realtime
      console.log('[Live] No playlist in DB, waiting for realtime sync');
      showWaitingForSync();
      initRealtime();
      return;
    }
    // Update venue/timeSlot from loaded row if not specified in URL
    if (!_venue && row.venue) {
      _venue = row.venue;
      document.getElementById('venueLabel').textContent = [_venue, _timeSlot].filter(Boolean).join(' · ');
    }
    if (!_timeSlot && row.timeSlot) {
      _timeSlot = row.timeSlot;
      document.getElementById('venueLabel').textContent = [_venue, _timeSlot].filter(Boolean).join(' · ');
    }
    _playlist = row.songs.map(function(s) {
      var name = s.name || '';
      var key = s.key || '';
      var bpm = s.bpm || 0;
      var singer = s.singer || '';
      var artist = s.artist || '';

      // Cross-check with band library if already loaded
      if (_allSongsLoaded && _allSongs.length > 0) {
        var nameLower = name.trim().toLowerCase();
        for (var i = 0; i < _allSongs.length; i++) {
          if ((_allSongs[i].name || '').trim().toLowerCase() === nameLower) {
            var match = _allSongs[i];
            if (match.bpm) bpm = match.bpm;
            if (match.key && (!s._key || s._key === s.key)) key = match.key;
            if (match.singer) singer = match.singer;
            if (match.artist) artist = match.artist;
            break;
          }
        }
      }

      return { name: name, key: key, bpm: bpm,
               singer: singer, artist: artist,
               _key: s._key || key, _note: s._note || '', _skipped: !!s._skipped,
               _isRequest: !!s._isRequest, _isRequestTime: s._isRequestTime || '',
               _isEncore: !!s._isEncore };
    });
    _current = 0;
    normalizePlaylistState();
    renderSongList();
    renderNowPlaying();
    initRealtime();
  });
}

function showWaitingForSync() {
  document.getElementById('songList').innerHTML =
    '<div id="emptyState"><div style="font-size:2rem">🎵</div>' +
    '<div>กำลังโหลด playlist...</div>' +
    '<div style="font-size:.8rem;color:#555;margin-top:4px">รอรับข้อมูลจากสมาชิกในวง</div></div>';
}

function showEmpty() {
  document.getElementById('songList').innerHTML =
    '<div id="emptyState"><div>📋</div><div>ไม่พบ playlist</div><div style="font-size:.8rem;color:#555">ตรวจสอบ date/venue ใน URL</div></div>';
}

// ─────────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────────
function singerClass(singer) {
  if (!singer) return '';
  var s = singer.toLowerCase();
  if (s === 'ชาย' || s === 'male') return 'male';
  if (s === 'หญิง' || s === 'female') return 'female';
  if (s === 'คู่' || s === 'duet' || s === 'ชาย/หญิง') return 'duet';
  return '';
}

function renderNowPlaying() {
  var s = _playlist[_current];
  if (!s) return;
  var titleEl = document.getElementById('nowTitle');
  titleEl.textContent = s.name;
  // Advance color on each song change, then start marquee
  _marqueeColorIdx = (_marqueeColorIdx + 1) % (_marqueeColorsDark.length);
  _updateMarquee(titleEl);
  document.getElementById('nowKey').textContent = formatKey(s._key || s.key) || '—';
  document.getElementById('nowBpm').textContent = s.bpm ? s.bpm + ' BPM' : '';
  var sc = singerClass(s.singer);
  var singerNames = {male:'ชาย',female:'หญิง',duet:'คู่'};
  document.getElementById('nowSinger').textContent = sc ? '🎤 ' + (singerNames[sc] || s.singer) : '';
  _updateNoteMarquee(s._note || '');
  var strip = document.getElementById('singerStrip');
  strip.className = 'singer-strip' + (sc ? ' ' + sc : '');
  // song counter
  var visible = _playlist.filter(function(x){ return !x._skipped; });
  var visIdx  = visible.indexOf(s);
  document.getElementById('songCounter').textContent =
    (visIdx + 1) + ' / ' + visible.length;
  startBeatDot(s.bpm);
  // ── Next song preview ──
  renderNextPreview();
  // ── Nav arrow enable/disable ──
  updateNavButtons();
}

// ── Marquee helpers ────────────────────────────────────────────────
function _getMarqueeColor() {
  var colors = document.body.classList.contains('light-mode')
    ? _marqueeColorsLight : _marqueeColorsDark;
  return colors[_marqueeColorIdx % colors.length];
}

function _stopMarquee() {
  if (_marqueeRAF) { cancelAnimationFrame(_marqueeRAF); _marqueeRAF = null; }
}

function _updateMarquee(el) {
  if (!el) return;
  _stopMarquee();

  var wrap = document.getElementById('nowTitleWrap');
  if (!wrap) return;

  var text = el.textContent.trim();
  var colors = document.body.classList.contains('light-mode')
    ? _marqueeColorsLight : _marqueeColorsDark;

  // — safely re-parent el back to wrap —
  if (el.parentNode && el.parentNode !== wrap) el.parentNode.removeChild(el);
  // clear all wrap children except el
  var c = wrap.firstChild;
  while (c) { var nx = c.nextSibling; if (c !== el) wrap.removeChild(c); c = nx; }
  if (!el.parentNode) wrap.appendChild(el);

  // reset el
  el.classList.remove('title-static');
  el.style.display = 'inline-block';
  el.style.whiteSpace = 'nowrap';
  el.style.position = ''; el.style.transform = '';
  el.offsetHeight; // reflow to measure

  var wrapW = wrap.clientWidth || (window.innerWidth - 84);
  var textW = el.scrollWidth;

  if (textW <= wrapW * 0.92) {
    // — fits — show centered, static
    el.style.color = colors[_marqueeColorIdx % colors.length];
    el.classList.add('title-static');
    return;
  }

  // — marquee needed — build scroll container —
  var GAP = Math.max(80, wrapW * 0.28); // gap between end of title and start of next
  var cycleW = textW + GAP;

  // Build: wrap > #nowTitleScroll > [el (spanA)] [gap] [spanB]
  var scroll = document.createElement('div');
  scroll.id = 'nowTitleScroll';

  var gapSpan = document.createElement('span');
  gapSpan.style.cssText = 'display:inline-block;width:' + GAP + 'px;flex-shrink:0;';

  var spanB = document.createElement('span');
  var _elFontPx = window.getComputedStyle(el).fontSize; // responsive — matches CSS breakpoint
  spanB.style.cssText = 'font-weight:700;font-size:' + _elFontPx + ';line-height:1.3;white-space:nowrap;flex-shrink:0;';
  spanB.textContent = text;
  spanB.style.color = colors[(_marqueeColorIdx + 1) % colors.length];

  el.style.color = colors[_marqueeColorIdx % colors.length];
  el.style.display = 'inline'; el.style.flexShrink = '0';

  if (el.parentNode) el.parentNode.removeChild(el);
  scroll.appendChild(el);
  scroll.appendChild(gapSpan);
  scroll.appendChild(spanB);
  wrap.appendChild(scroll);

  // Start position: just off the right edge
  var pos = wrapW;
  var lastTs = null;
  var SPEED = 115; // px per second (long title)

  function _tick(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 0.1); // cap for tab-switch
    lastTs = ts;
    pos -= SPEED * dt;
    // when spanA has fully cycled, reset and advance colors
    if (pos <= -cycleW) {
      pos += cycleW;
      _marqueeColorIdx = (_marqueeColorIdx + 1) % colors.length;
      el.style.color    = colors[_marqueeColorIdx % colors.length];
      spanB.style.color = colors[(_marqueeColorIdx + 1) % colors.length];
    }
    scroll.style.transform = 'translateX(' + pos + 'px)';
    _marqueeRAF = requestAnimationFrame(_tick);
  }
  _marqueeRAF = requestAnimationFrame(_tick);
}

function _autoFitTitle(el) { _updateMarquee(el); } // backward compat

function _updateNoteMarquee(text) {
  if (_noteMarqueeRAF) { cancelAnimationFrame(_noteMarqueeRAF); _noteMarqueeRAF = null; }
  var wrap = document.getElementById('nowNoteWrap');
  var el   = document.getElementById('nowNote');
  if (!wrap || !el) return;
  // clear any scroll container
  while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
  if (!text) { wrap.appendChild(el); el.textContent = ''; el.classList.add('note-static'); return; }
  el.textContent = text;
  el.className = '';
  el.style.transform = '';
  wrap.appendChild(el);
  el.offsetHeight; // reflow
  var wrapW = wrap.clientWidth || window.innerWidth;
  var textW = el.scrollWidth;
  if (textW <= wrapW * 0.95) {
    el.classList.add('note-static');
    return;
  }
  // needs marquee
  var GAP = Math.max(60, wrapW * 0.25);
  var cycleW = textW + GAP;
  var scroll = document.createElement('div');
  scroll.id = 'nowNoteScroll';
  var gapSpan = document.createElement('span');
  gapSpan.style.cssText = 'display:inline-block;width:' + GAP + 'px;flex-shrink:0;';
  var spanB = document.createElement('span');
  spanB.style.cssText = 'font-size:1rem;font-style:italic;color:var(--gold);white-space:nowrap;flex-shrink:0;';
  spanB.textContent = text;
  el.style.flexShrink = '0';
  wrap.removeChild(el);
  scroll.appendChild(el);
  scroll.appendChild(gapSpan);
  scroll.appendChild(spanB);
  wrap.appendChild(scroll);
  var pos = wrapW;
  var lastTs = null;
  var SPEED = 80;
  function _tick(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 0.1);
    lastTs = ts;
    pos -= SPEED * dt;
    if (pos <= -cycleW) pos += cycleW;
    scroll.style.transform = 'translateX(' + pos + 'px)';
    _noteMarqueeRAF = requestAnimationFrame(_tick);
  }
  _noteMarqueeRAF = requestAnimationFrame(_tick);
}

function renderNextPreview() {
  var preview = document.getElementById('nextPreview');
  if (!preview) return;
  var next = -1;
  for (var j = _current + 1; j < _playlist.length; j++) {
    if (!_playlist[j]._skipped) { next = j; break; }
  }
  if (next < 0) { preview.classList.add('hidden'); return; }
  var ns = _playlist[next];
  document.getElementById('nextName').textContent = ns.name;
  var nk = document.getElementById('nextKey');
  nk.textContent = formatKey(ns._key || ns.key) || '';
  nk.style.display = (ns._key || ns.key) ? '' : 'none';
  var nb = document.getElementById('nextBpm');
  if (nb) { nb.textContent = ns.bpm ? ns.bpm + ' BPM' : ''; nb.style.display = ns.bpm ? '' : 'none'; }
  preview.classList.remove('hidden');
}

function renderSongList() {
  var el = document.getElementById('songList');
  if (_playlist.length === 0) { showEmpty(); return; }
  var buf = [];
  _playlist.forEach(function(s, i) {
    var sc  = singerClass(s.singer);
    var dot = sc ? '<div class="si-singer-dot ' + sc + '"></div>' : '<div style="width:5px"></div>';
    var isNext = !s._skipped && i !== _current && (function(){
      for (var j = _current + 1; j < _playlist.length; j++) {
        if (!_playlist[j]._skipped) return j === i;
      }
      return false;
    })();
    var badges = '';
    if (isNext)       badges += '<span class="badge-next">ถัดไป</span>';
    if (s._isRequest) badges += '<span class="badge-req">ขอ</span>';
    if (s._isEncore)  badges += '<span class="badge-encore">🔁</span>';
    if (s._skipped)   badges += '<span class="badge-skip" onclick="unskipSong(event,' + i + ')">skip ↩</span>';
    var hbdT = _parseHbdTime(s.name);
    if (hbdT && !s._skipped) badges += '<span class="badge-hbd">🎂 ' + String(hbdT.hours).padStart(2,'0') + ':' + String(hbdT.minutes).padStart(2,'0') + '</span>';
    var meta = [];
    if (s._key || s.key) meta.push('🎵 ' + formatKey(s._key || s.key));
    if (s.bpm)  meta.push(s.bpm + ' BPM');
    buf.push(
      '<div class="song-item' +
        (i === _current ? ' is-current' : '') +
        (isNext ? ' is-next' : '') +
        (s._skipped ? ' is-skipped' : '') +
      '" data-idx="' + i + '">' +
        '<div class="si-num">' + (i + 1) + '</div>' +
        dot +
        '<div class="si-arrows">' +
          '<button class="si-arrow" onclick="moveSongUp(event,' + i + ')"' + (i === 0 ? ' disabled' : '') + ' title="\u0e40\u0e25\u0e37\u0e48\u0e2d\u0e19\u0e02\u0e36\u0e49\u0e19">▲</button>' +
          '<button class="si-arrow" onclick="moveSongDown(event,' + i + ')"' + (i === _playlist.length - 1 ? ' disabled' : '') + ' title="\u0e40\u0e25\u0e37\u0e48\u0e2d\u0e19\u0e25\u0e07">▼</button>' +
        '</div>' +
        '<div class="si-content">' +
          '<div class="si-name">' + escHtml(s.name) + '</div>' +
          (meta.length ? '<div class="si-meta">' + meta.join(' · ') + '</div>' : '') +
          (s._note ? '<div class="si-note">' + escHtml(s._note) + '</div>' : '') +
        '</div>' +
        '<div class="si-badges">' + badges + '</div>' +
        '<button class="si-del" onclick="removeSong(event,' + i + ')" title="\u0e25\u0e1a\u0e40\u0e1e\u0e25\u0e07\u0e19\u0e35\u0e49">\u2715</button>' +
      '</div>'
    );
  });
  el.innerHTML = buf.join('');

  // bind all touch/click interactions per song item
  el.querySelectorAll('.song-item').forEach(function(item) {
    var idx = parseInt(item.dataset.idx, 10);
    var _sx = 0, _sy = 0, _dragTimer = null, _didSwipe = false, _didDrag = false;

    function cancelDragTimer() {
      if (_dragTimer) { clearTimeout(_dragTimer); _dragTimer = null; }
    }

    item.addEventListener('touchstart', function(e) {
      if (e.target.classList.contains('badge-skip') ||
          e.target.classList.contains('si-del') ||
          e.target.classList.contains('si-arrow')) return;
      _sx = e.touches[0].clientX;
      _sy = e.touches[0].clientY;
      _didSwipe = false;
      _didDrag  = false;

      _dragTimer = setTimeout(function() {
        _dragTimer = null;
        _didDrag = true;
        haptic(40);
        openCtx(idx);
      }, 450);
    }, { passive: true });

    item.addEventListener('touchmove', function(e) {
      if (_drag.active) return; // global handler takes over
      if (!_dragTimer) return;
      var dx = e.touches[0].clientX - _sx;
      var dy = e.touches[0].clientY - _sy;
      // ถ้าขยับก่อน 450ms → ยกเลิก drag intent
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        cancelDragTimer();
        if (Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > 15) {
          _didSwipe = true;
          item.classList.toggle('swipe-left',  dx < -20);
          item.classList.toggle('swipe-right', dx > 20);
        }
      }
    }, { passive: true });

    item.addEventListener('touchend', function(e) {
      cancelDragTimer();
      item.classList.remove('swipe-left', 'swipe-right');
      if (_drag.active) return; // global onDragEnd handles
      if (_didSwipe) {
        var dx = e.changedTouches[0].clientX - _sx;
        if (dx < -50) skipSong(idx);
        else if (dx > 50 && _playlist[idx] && _playlist[idx]._skipped) unskipSong(e, idx);
      }
    });

    item.addEventListener('touchcancel', function() {
      cancelDragTimer();
      item.classList.remove('swipe-left', 'swipe-right');
    });

    item.addEventListener('click', function(e) {
      if (_drag.active || _didDrag || _didSwipe) return;
      if (e.target.classList.contains('badge-skip')) return;
      if (e.target.classList.contains('si-del')) return;
      if (e.target.classList.contains('si-arrow')) return;
      // Detect double-tap: second click on same idx within 260ms
      if (_lastTapIdx === idx && _tapTimer) {
        clearTimeout(_tapTimer); _tapTimer = null; _lastTapIdx = -1;
        playNow(idx);
        return;
      }
      _lastTapIdx = idx;
      _tapTimer = setTimeout(function() {
        _tapTimer = null; _lastTapIdx = -1;
        // single tap → open context menu (members only)
        openCtx(idx);
      }, 260);
    });
  });

  scrollToCurrent();
}

// ─── REMOVE SONG FROM PLAYLIST ────────────────────────────────────────────────
function removeSong(e, idx) {
  e.stopPropagation();
  var name = _playlist[idx] ? _playlist[idx].name : '';
  if (!confirm('\u0e25บ \u201c' + name + '\u201d \u0e2dอกจากลิส?')) return;
  if (!removeSongAtIndex(idx)) return;
  _modified = true;
  renderNowPlaying();
  renderSongList();
  broadcastEvent('remove', { idx: idx });
  scheduleStateSync();
  showToast('\u0e25\u0e1a \u201c' + name + '\u201d \u0e41\u0e25\u0e49\u0e27');
}

function scrollToCurrent() {
  var items = document.querySelectorAll('.song-item');
  if (items[_current]) {
    items[_current].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────────────────────────
//  FONT SIZE
// ─────────────────────────────────────────────────────────────────
var FONT_SIZES = ['1.6rem','1.9rem','2.3rem','2.8rem','3.4rem','4rem','5rem'];
function setFontLevel(lvl) {
  _fontLevel = Math.max(0, Math.min(FONT_SIZES.length - 1, lvl));
  document.documentElement.style.setProperty('--font-size-now', FONT_SIZES[_fontLevel]);
  localStorage.setItem('liveFontLevel', _fontLevel);
}
function adjustFont(dir) {
  setFontLevel(_fontLevel + dir);
}

// ─────────────────────────────────────────────────────────────────
//  KEY DISPLAY MODE TOGGLE
// ─────────────────────────────────────────────────────────────────
function toggleKeyMode() {
  toggleKeyDisplayMode();
  var newMode = getKeyDisplayMode();
  var btn = document.getElementById('keyModeBtn');
  if (btn) btn.textContent = newMode === 'number' ? '🔤' : '🔢';
  renderNowPlaying();
  renderSongList();
}

// ─────────────────────────────────────────────────────────────────
//  THEME TOGGLE (dark / light)
// ─────────────────────────────────────────────────────────────────
function toggleTheme() {
  var isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('liveTheme', isLight ? 'light' : 'dark');
  var btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = isLight ? '☀️' : '🌙';
  // Re-apply marquee color for new theme
  var titleEl = document.getElementById('nowTitle');
  if (titleEl) titleEl.style.color = _getMarqueeColor();
}

// ─────────────────────────────────────────────────────────────────
//  SETTINGS PANEL
// ─────────────────────────────────────────────────────────────────
function toggleSettings() {
  var panel = document.getElementById('liveSettings');
  if (!panel) return;
  if (panel.classList.contains('open')) { closeSettings(); } else { openSettings(); }
}

function openSettings() {
  var panel = document.getElementById('liveSettings');
  if (panel) panel.classList.add('open');
  // Sync button states
  var km = document.getElementById('keyModeBtn');
  if (km) km.textContent = getKeyDisplayMode() === 'number' ? '🔤' : '🔢';
}

function closeSettings() {
  var panel = document.getElementById('liveSettings');
  if (panel) panel.classList.remove('open');
}

// ─────────────────────────────────────────────────────────────────
//  CLOCK
// ─────────────────────────────────────────────────────────────────
function startClock() {
  function tick() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2,'0');
    var m = String(now.getMinutes()).padStart(2,'0');
    var s = String(now.getSeconds()).padStart(2,'0');
    document.getElementById('clock').textContent = h + ':' + m + ':' + s;
  }
  tick();
  _clockTimer = setInterval(tick, 1000);
}

// ─────────────────────────────────────────────────────────────────
//  METRONOME — Web Audio API (hardware-precision scheduler)
//
//  ใช้ AudioContext.currentTime (hardware clock ±0.01ms)
//  แทน setTimeout (±4-16ms jitter) เพื่อให้จังหวะนิ่ง
//
//  หลักการ "Lookahead Scheduler" (Chris Wilson):
//    1. setTimeout วน loop ทุก ~25ms (ไม่ต้องแม่น)
//    2. ในแต่ละ loop: ดูว่า beat ถัดไปอยู่ใน scheduleAhead window ไหม
//    3. ถ้าใช่ → scheduleNote() ด้วย audioCtx time (แม่นมาก)
//    4. Visual dot ถูก trigger จาก scheduler เดียวกัน
// ─────────────────────────────────────────────────────────────────
var _audioCtx       = null;  // AudioContext (lazy init on user gesture)
var _metTimer       = null;  // setTimeout id for lookahead loop
var _metBpm         = 0;
var _metInterval    = 0;     // seconds between beats
var _metNextTime    = 0;     // audioCtx time of next scheduled beat
var _metBeatCount   = 0;     // running beat counter (for time signature)
var _metTimeSig     = 4;     // beats per bar (4/4 default)
var _metEnabled     = true;  // beat dot (light) toggle
var _metAudioOn     = localStorage.getItem('liveMetAudioOn') === '1';  // sound OFF by default (opt-in)
var _metVolume      = 0.3;   // click volume (0-1)
var _beatOffTimer   = null;
var _metWallOrigin  = 0;     // Date.now() at beat 0 (for wall-clock sync)

// Lookahead config
var MET_LOOKAHEAD   = 0.1;  // seconds to look ahead
var MET_INTERVAL    = 25;   // ms between scheduler calls

function ensureAudioCtx() {
  if (_audioCtx) return _audioCtx;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) { /* fallback: no audio, visual only */ }
  return _audioCtx;
}

// Resume AudioContext (required after user gesture on mobile)
function resumeAudio() {
  if (_userHasInteracted && _audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
}

function toggleBeatDot() {
  _metEnabled = !_metEnabled;
  var btn = document.getElementById('beatToggleBtn');
  if (btn) {
    btn.classList.toggle('off', !_metEnabled);
    btn.innerHTML = '💡';
  }
  if (!_metEnabled) {
    var bd = document.getElementById('beatDot');
    if (bd) bd.style.opacity = '0';
  }
  showToast(_metEnabled ? '💡 ไฟจังหวะ: เปิด' : '💡 ไฟจังหวะ: ปิด');
}

// Toggle audio click on/off
function toggleMetAudio() {
  _metAudioOn = !_metAudioOn;
  localStorage.setItem('liveMetAudioOn', _metAudioOn ? '1' : '0');
  var btn = document.getElementById('metSoundBtn');
  if (btn) {
    btn.classList.toggle('on', _metAudioOn);
    btn.innerHTML = _metAudioOn ? '🔊' : '🔇';
  }
  resumeAudio();
  showToast(_metAudioOn ? '🔊 เสียงเมโทรนอม: เปิด' : '🔇 เสียงเมโทรนอม: ปิด');
}

// Init beat/sound button states on load
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    // Set initial sound button state
    var sndBtn = document.getElementById('metSoundBtn');
    if (sndBtn) {
      sndBtn.classList.toggle('on', _metAudioOn);
      sndBtn.innerHTML = _metAudioOn ? '🔊' : '🔇';
    }
    // Create AudioContext on first user gesture to avoid browser warning
    function _initAudioOnGesture() {
      _userHasInteracted = true;
      ensureAudioCtx();
      resumeAudio();
      document.removeEventListener('click', _initAudioOnGesture);
      document.removeEventListener('touchstart', _initAudioOnGesture);
    }
    document.addEventListener('click', _initAudioOnGesture);
    document.addEventListener('touchstart', _initAudioOnGesture);
  });
})();

function startBeatDot(bpm) {
  stopBeatDot();
  var bd = document.getElementById('beatDot');
  if (!bpm || !bd) return;
  _metBpm       = bpm;
  _metInterval  = 60.0 / bpm;  // seconds
  _metBeatCount = 0;
  _metWallOrigin = Date.now();  // wall-clock origin for cross-device sync
  bd.style.display = 'block';
  var btn = document.getElementById('beatToggleBtn');
  if (btn) btn.classList.toggle('off', !_metEnabled);

  var ctx = _audioCtx;  // use existing only; created on first user gesture
  if (ctx) resumeAudio();

  // Start the lookahead scheduler
  _metNextTime = ctx ? ctx.currentTime + 0.05 : performance.now() / 1000;
  metScheduler();
  // Receiver: waits for beat_sync, then starts local scheduler
}

function metScheduler() {
  var ctx = _audioCtx;
  if (!ctx) {
    // Fallback: no Web Audio → use performance.now based scheduler
    metSchedulerFallback();
    return;
  }
  // Schedule all beats that fall within the lookahead window
  while (_metNextTime < ctx.currentTime + MET_LOOKAHEAD) {
    scheduleClick(_metNextTime);
    scheduleDotFlash(_metNextTime - ctx.currentTime);
    // Broadcast sync (only every 4th beat to reduce network traffic)
    if (_metBeatCount % _metTimeSig === 0 && _channelStatus === 'SUBSCRIBED') {
      // Send wall-clock origin so receivers can phase-lock precisely
      if (_metBeatCount === 0) _metWallOrigin = Date.now();
      broadcastEvent('beat_sync', {
        bpm: _metBpm, beat: _metBeatCount,
        wallOrigin: _metWallOrigin
      });
    }
    _metNextTime += _metInterval;
    _metBeatCount++;
  }
  _metTimer = setTimeout(metScheduler, MET_INTERVAL);
}

// Fallback scheduler for browsers without Web Audio
function metSchedulerFallback() {
  var now = performance.now() / 1000;
  while (_metNextTime < now + MET_LOOKAHEAD) {
    var delay = Math.max(0, (_metNextTime - now) * 1000);
    scheduleDotFlash(delay / 1000);
    if (_metBeatCount % _metTimeSig === 0 && _channelStatus === 'SUBSCRIBED') {
      broadcastEvent('beat_sync', { bpm: _metBpm, beat: _metBeatCount, wallOrigin: _metWallOrigin });
    }
    _metNextTime += _metInterval;
    _metBeatCount++;
  }
  _metTimer = setTimeout(metSchedulerFallback, MET_INTERVAL);
}

function scheduleClick(time) {
  if (!_metAudioOn || !_audioCtx) return;
  var ctx = _audioCtx;
  // Create a short click: oscillator → gain envelope
  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  // Uniform click — same pitch & volume every beat
  osc.frequency.value = 1000;
  gain.gain.value = _metVolume;

  // Very short click: 30ms attack → quick decay
  osc.start(time);
  gain.gain.setValueAtTime(gain.gain.value, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
  osc.stop(time + 0.04);
}

function scheduleDotFlash(delaySeconds) {
  var delayMs = Math.max(0, delaySeconds * 1000);
  setTimeout(function() {
    flashBeatDot();
  }, delayMs);
}

function flashBeatDot() {
  var bd = document.getElementById('beatDot');
  if (!bd || bd.style.display === 'none') return;
  if (_beatOffTimer) { clearTimeout(_beatOffTimer); _beatOffTimer = null; }
  if (!_metEnabled) return;
  bd.style.opacity = '1';
  var offDelay = (_metInterval * 1000) * 0.4;
  _beatOffTimer = setTimeout(function() {
    bd.style.opacity = '0';
    _beatOffTimer = null;
  }, offDelay);
}

function stopBeatDot() {
  if (_metTimer)     { clearTimeout(_metTimer);     _metTimer     = null; }
  if (_beatOffTimer) { clearTimeout(_beatOffTimer); _beatOffTimer = null; }
  _metBeatCount = 0;
  var bd = document.getElementById('beatDot');
  if (bd) { bd.style.display = 'none'; bd.style.opacity = '0'; }
}

// ─────────────────────────────────────────────────────────────────
//  WAKE LOCK  (Screen Wake Lock API + NoSleep.js fallback for iOS ≤15)
// ─────────────────────────────────────────────────────────────────
var _noSleep = (typeof NoSleep !== 'undefined') ? new NoSleep() : null;
var _noSleepEnabled = false;

function acquireWakeLock() {
  if ('wakeLock' in navigator) {
    // iOS 16.4+, Chrome Android, Edge
    navigator.wakeLock.request('screen').then(function(wl) {
      _wakeLock = wl;
    }).catch(function(){});
  } else if (_noSleep && !_noSleepEnabled) {
    // iOS 13-15 fallback: silent video loop via NoSleep.js (requires user gesture)
    try { _noSleep.enable(); _noSleepEnabled = true; } catch(e) {}
  }
}
// WakeLock re-acquire is merged into the visibilitychange handler in initRealtime()
function releaseWakeLock() {
  if (_wakeLock) { _wakeLock.release(); _wakeLock = null; }
  if (_noSleep && _noSleepEnabled) { try { _noSleep.disable(); } catch(e) {} _noSleepEnabled = false; }
}

// ─────────────────────────────────────────────────────────────────
//  HAPTIC  (vibrate on Android + visual flash fallback on iOS)
// ─────────────────────────────────────────────────────────────────
function haptic(ms) {
  if (_userHasInteracted && navigator.vibrate) {
    try { navigator.vibrate(ms); return; } catch(e) {}
  }
  // iOS Safari: visual flash บนปุ่มหลัก
  var el = document.getElementById('endSongBtn');
  if (!el) return;
  el.classList.remove('haptic-flash');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('haptic-flash');
  setTimeout(function(){ el.classList.remove('haptic-flash'); }, 200);
}

// ─────────────────────────────────────────────────────────────────
//  END SONG (จบเพลง → advance)
// ─────────────────────────────────────────────────────────────────
function endSong() {
  if (_isEnding) return;
  haptic(200);
  _pushUndo();
  _currentUpdatedAt = Date.now();
  _lastLocalCurrentChange = Date.now();
  var next = _current + 1;
  while (next < _playlist.length && _playlist[next]._skipped) next++;
  var nextIdx = (next < _playlist.length) ? next : -1;
  broadcastEvent('song_ending', { from: _current, next: nextIdx, currentUpdatedAt: _currentUpdatedAt });
  triggerEnding(nextIdx);
}

// nextIdx: index ที่จะไป (-1 = เพลงสุดท้าย)
function triggerEnding(nextIdx) {
  if (_isEnding) return;
  _isEnding = true;
  if (typeof nextIdx === 'undefined') nextIdx = -1;
  var np = document.getElementById('nowPlaying');
  np.classList.add('pulsing');

  var _endingDone = false;
  function finishEnding() {
    if (_endingDone) return;
    _endingDone = true;
    if (_endingTimer) { clearTimeout(_endingTimer); _endingTimer = null; }
    np.classList.remove('pulsing');
    _isEnding = false;
    if (nextIdx >= 0 && nextIdx < _playlist.length) {
      _current  = nextIdx;
      _currentUpdatedAt = Date.now();
      _lastLocalCurrentChange = Date.now();
      _modified = true;
      normalizePlaylistState();
      haptic(100);
      startBeatDot((_playlist[_current] || {}).bpm || 0);
      renderNowPlaying();
      renderSongList();
      scheduleStateSync();
    } else {
      showLastSongBanner();
    }
  }

  np.addEventListener('animationend', finishEnding, { once: true });
  // Safety timeout: if animationend never fires (prefers-reduced-motion, etc.), advance anyway
  _endingTimer = setTimeout(finishEnding, 3000);
}

// advanceSong ใช้โดย skipSong เท่านั้น — broadcast current_changed ด้วย
function advanceSong() {
  var next = _current + 1;
  while (next < _playlist.length && _playlist[next]._skipped) next++;
  if (next < _playlist.length) {
    _pushUndo();
    _current  = next;
    _currentUpdatedAt = Date.now();
    _lastLocalCurrentChange = Date.now();
    _modified = true;
    normalizePlaylistState();
    haptic(100);
    broadcastEvent('current_changed', { idx: _current, bpm: (_playlist[_current] || {}).bpm || 0, currentUpdatedAt: _currentUpdatedAt });
    scheduleStateSync();
    startBeatDot((_playlist[_current] || {}).bpm || 0);
    renderNowPlaying();
    renderSongList();
  } else {
    showLastSongBanner();
  }
}

// ─── PREV / NEXT SONG (direct, no animation) ──────────────────────────────────
function prevSong() {
  var prev = _current - 1;
  while (prev >= 0 && _playlist[prev]._skipped) prev--;
  if (prev >= 0) {
    _current = prev;
    _currentUpdatedAt = Date.now();
    _lastLocalCurrentChange = Date.now();
    _modified = true;
    normalizePlaylistState();
    haptic(80);
    broadcastEvent('current_changed', { idx: _current, bpm: (_playlist[_current] || {}).bpm || 0, currentUpdatedAt: _currentUpdatedAt });
    scheduleStateSync();
    renderNowPlaying();
    renderSongList();
    showToast('◀ ' + (_playlist[_current] ? _playlist[_current].name : ''));
  } else {
    showToast('นี่เพลงแรกแล้ว');
  }
}

function nextSongDirect() {
  var next = _current + 1;
  while (next < _playlist.length && _playlist[next]._skipped) next++;
  if (next < _playlist.length) {
    _pushUndo();
    _current = next;
    _currentUpdatedAt = Date.now();
    _lastLocalCurrentChange = Date.now();
    _modified = true;
    normalizePlaylistState();
    haptic(80);
    broadcastEvent('current_changed', { idx: _current, bpm: (_playlist[_current] || {}).bpm || 0, currentUpdatedAt: _currentUpdatedAt });
    scheduleStateSync();
    renderNowPlaying();
    renderSongList();
    showToast('▶ ' + (_playlist[_current] ? _playlist[_current].name : ''));
  } else {
    showLastSongBanner();
  }
}

// ─── CHAT BAR (inline song request) ───────────────────────────────────────────
var _cbTimer = null;
var _cbSelected = null; // selected autocomplete song object

function initChatBar() {
  var inp = document.getElementById('chatBarInput');
  var sendBtn = document.getElementById('chatBarSend');
  if (!inp || !sendBtn) return;

  inp.addEventListener('input', function() {
    _cbSelected = null;
    sendBtn.disabled = !inp.value.trim();
    if (_cbTimer) clearTimeout(_cbTimer);
    var val = inp.value.trim();
    if (!val) { closeChatSuggest(); return; }
    _cbTimer = setTimeout(function() { showChatSuggest(val); }, 120);
  });

  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); chatBarSubmit(); }
    if (e.key === 'Escape') { closeChatSuggest(); inp.blur(); }
  });

  sendBtn.addEventListener('click', function() { chatBarSubmit(); });

  // close suggestions when tapping outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('#chatBar')) closeChatSuggest();
  });

  // Preload band songs on first focus
  inp.addEventListener('focus', function() {
    if (!_allSongsLoaded) {
      preloadBandSongs();
    }
  }, { once: true });
}

function showChatSuggest(val) {
  var sg = document.getElementById('chatBarSuggest');
  var lower = val.toLowerCase();
  var hits = [];

  if (_allSongsLoaded && _allSongs.length > 0) {
    hits = _allSongs.filter(function(s) {
      return (s.name || '').toLowerCase().indexOf(lower) >= 0 ||
             (s.artist || '').toLowerCase().indexOf(lower) >= 0;
    }).slice(0, 20);
  }

  var html = '';
  hits.forEach(function(s, i) {
    var nameParts = highlightMatch(s.name || '', lower);
    var meta = [s.artist || '', s.key ? formatKey(s.key) : '', s.bpm ? s.bpm + ' BPM' : ''].filter(Boolean).join(' · ');
    html += '<div class="cb-item" data-i="' + i + '">' +
      '<div class="cb-item-info">' +
        '<div class="cb-item-name">' + nameParts + '</div>' +
        (meta ? '<div class="cb-item-meta">' + escHtml(meta) + '</div>' : '') +
      '</div>' +
      '<div class="cb-item-icon">＋</div>' +
    '</div>';
  });

  // "add as new" option at bottom
  html += '<div class="cb-item cb-add" data-add="1">' +
    '<div class="cb-item-info">' +
      '<div class="cb-item-name">➕ เพิ่ม "' + escHtml(val) + '" เป็นเพลงขอ</div>' +
      '<div class="cb-item-meta">เพลงนี้ไม่อยู่ในคลัง — เพิ่มเข้าลิสได้เลย</div>' +
    '</div>' +
  '</div>';

  sg.innerHTML = html;
  sg.classList.add('open');

  // Prevent scroll from bleeding through to page on iOS
  sg.addEventListener('touchmove', function(e) { e.stopPropagation(); }, { passive: true });

  // bind taps on library items → instant add
  sg.querySelectorAll('.cb-item:not(.cb-add)').forEach(function(el) {
    el.addEventListener('click', function() {
      var idx = parseInt(el.dataset.i, 10);
      var s = hits[idx];
      if (!s) return;
      addSongToPlaylist(s.name, s.key || '', s.bpm || 0, s.singer || '', s.artist || '', true);
    });
  });

  // bind "add as new" item
  var addEl = sg.querySelector('.cb-add');
  if (addEl) {
    addEl.addEventListener('click', function() {
      chatBarSubmit();
    });
  }
}

function highlightMatch(text, q) {
  var li = text.toLowerCase().indexOf(q);
  if (li < 0) return escHtml(text);
  return escHtml(text.substring(0, li)) +
    '<span class="cb-hl">' + escHtml(text.substring(li, li + q.length)) + '</span>' +
    escHtml(text.substring(li + q.length));
}

function closeChatSuggest() {
  var sg = document.getElementById('chatBarSuggest');
  if (sg) { sg.classList.remove('open'); sg.innerHTML = ''; }
}

function chatBarSubmit() {
  var inp = document.getElementById('chatBarInput');
  var name = (inp.value || '').trim();
  if (!name) return;
  // ถ้าชื่อเพลงตรงกับเพลงในคลังพอดี → ใช้ metadata (key/bpm/singer/artist) จากคลัง
  var s = null;
  if (_allSongs && _allSongs.length > 0) {
    var nameLower = name.toLowerCase();
    s = _allSongs.find ? _allSongs.find(function(x) { return (x.name || '').toLowerCase() === nameLower; })
      : (function() { for (var i = 0; i < _allSongs.length; i++) { if ((_allSongs[i].name || '').toLowerCase() === nameLower) return _allSongs[i]; } return null; })();
  }
  if (s) {
    addSongToPlaylist(name, s.key || '', s.bpm || 0, s.singer || '', s.artist || '', true);
  } else {
    addSongToPlaylist(name, '', 0, '', '', true);
  }
}

/* ── pending song to add (waiting for position pick) ── */
var _pendingSong = null;

function addSongToPlaylist(name, key, bpm, singer, artist, isRequest) {
  // ป้องกันเพลงซ้ำในลิสต์
  var dup = _playlist.some(function(s) { return !s._skipped && s.name === name; });
  if (dup && !confirm('เพลง "' + name + '" มีอยู่ในลิสต์แล้ว เพิ่มซ้ำ?')) return;
  // ถ้าเพลงมีในคลังอยู่แล้ว → ไม่ mark เป็นเพลงขอ
  if (isRequest && _allSongs.length > 0) {
    var nameLower = name.toLowerCase();
    var inLibrary = _allSongs.some(function(s) { return (s.name || '').toLowerCase() === nameLower; });
    if (inLibrary) isRequest = false;
  }
  _pendingSong = {
    name: name, key: key, bpm: bpm, singer: singer, artist: artist,
    _key: key ? formatKey(key) : '', _note: '', _skipped: false,
    _isRequest: !!isRequest, _isEncore: false
  };
  openInsertPos();
}

function _nowHHMM() {
  var n=new Date();return String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
}

function togglePendingRequest() {
  if (!_pendingSong) return;
  _pendingSong._isRequest = !_pendingSong._isRequest;
  if (_pendingSong._isRequest) { _pendingSong._isRequestTime = _nowHHMM(); }
  else { _pendingSong._isRequestTime = ''; }
  var btn = document.getElementById('insertReqToggleBtn');
  if (!btn) return;
  if (_pendingSong._isRequest) {
    btn.textContent = '🙏 เพลงขอ ✓';
    btn.style.background = '#4c1d95';
    btn.style.borderColor = '#7c3aed';
    btn.style.color = '#e9d5ff';
  } else {
    btn.textContent = '🙏 ทำเครื่องหมายเป็นเพลงขอ';
    btn.style.background = 'var(--bg3)';
    btn.style.borderColor = '#333';
    btn.style.color = 'var(--text)';
  }
}

function openInsertPos() {
  if (!_pendingSong) return;
  var modal = document.getElementById('insertPosModal');
  document.getElementById('insertPosSongName').textContent = '🎵 ' + _pendingSong.name;

  // Update request toggle button state
  var btn = document.getElementById('insertReqToggleBtn');
  if (btn) {
    if (_pendingSong._isRequest) {
      btn.textContent = '🙏 เพลงขอ ✓';
      btn.style.background = '#4c1d95';
      btn.style.borderColor = '#7c3aed';
      btn.style.color = '#e9d5ff';
    } else {
      btn.textContent = '🙏 ทำเครื่องหมายเป็นเพลงขอ';
      btn.style.background = 'var(--bg3)';
      btn.style.borderColor = '#333';
      btn.style.color = 'var(--text)';
    }
  }

  // Build position list
  var visible = _playlist.filter(function(s) { return !s._skipped; });
  var list = document.getElementById('insertPosList');
  var html = '';
  // Default insert: right after current song's request block (FIFO)
  var defaultAt = _current + 1;
  for (var qi = _current + 1; qi < _playlist.length; qi++) {
    if (_playlist[qi]._isRequest) { defaultAt = qi + 1; } else { break; }
  }

  for (var i = 0; i <= _playlist.length; i++) {
    if (i <= _current) continue; // ไม่ให้แทรกก่อนเพลงที่กำลังเล่น
    var isDefault = (i === defaultAt);
    var isCurrent = (i <= _current);

    if (i === _playlist.length) {
      // ตำแหน่งสุดท้าย
      html += '<div class="ip-item' + (isDefault ? ' ip-default' : '') + '" data-pos="' + i + '">' +
        '<div class="ip-num">' + (i + 1) + '</div>' +
        '<div class="ip-name" style="color:var(--text3);font-style:italic">— ท้ายลิส —</div>' +
        (isDefault ? '<div class="ip-hint">แนะนำ</div>' : '') +
      '</div>';
    } else {
      var s = _playlist[i];
      var num = i + 1;
      var cls = 'ip-item';
      if (isDefault) cls += ' ip-default';
      if (i === _current) cls += ' ip-current';
      html += '<div class="' + cls + '" data-pos="' + i + '">' +
        '<div class="ip-num">' + num + '</div>' +
        '<div class="ip-name">' + escHtml(s.name) + (s._isRequest ? ' 🙏' : '') + '</div>' +
        (isDefault ? '<div class="ip-hint">แนะนำ</div>' : '') +
      '</div>';
    }
  }

  list.innerHTML = html;

  // Bind tap on each position
  list.querySelectorAll('.ip-item').forEach(function(el) {
    el.addEventListener('click', function() {
      var pos = parseInt(el.dataset.pos, 10);
      confirmInsertAt(pos);
    });
  });

  modal.classList.add('show');

  // Scroll to default item
  setTimeout(function() {
    var def = list.querySelector('.ip-default');
    if (def) def.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 100);
}

function confirmInsertAt(pos) {
  if (!_pendingSong) return;
  var song = _pendingSong;
  _pendingSong = null;
  closeInsertPos();

  // จับเวลา insert จริง (แม่นกว่าเวลาที่กด toggle)
  if (song._isRequest) { song._isRequestTime = _nowHHMM(); }

  _playlist.splice(pos, 0, song);
  _modified = true;
  _lastLocalAddTime = Date.now(); // บันทึกเวลาที่เพิ่มเพลงในเครื่องนี้
  broadcastEvent('request_song', { song: song, insertAt: pos });
  scheduleStateSync();

  // Clear chat bar
  var inp = document.getElementById('chatBarInput');
  inp.value = '';
  document.getElementById('chatBarSend').disabled = true;
  closeChatSuggest();
  inp.blur();

  renderSongList();
  showToast('➕ ' + song.name + ' (ลำดับที่ ' + (pos + 1) + ')');
  haptic(40);
}

function closeInsertPos() {
  _pendingSong = null;
  document.getElementById('insertPosModal').classList.remove('show');
}

// ─── SWIPE ON NOW-PLAYING ─────────────────────────────────────────────────────
function initNowPlayingSwipe() {
  var np = document.getElementById('nowPlaying');
  var sx = 0, sy = 0, swiping = false;
  np.addEventListener('touchstart', function(e) {
    // Don't intercept touches on buttons/key
    if (e.target.closest('.nav-arrow, #nowKey, .s-btn, .now-side')) return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    swiping = true;
  }, { passive: true });
  np.addEventListener('touchmove', function(e) {
    if (!swiping) return;
    var dy = Math.abs(e.touches[0].clientY - sy);
    if (dy > 40) swiping = false; // vertical scroll, cancel
  }, { passive: true });
  np.addEventListener('touchend', function(e) {
    if (!swiping) return;
    swiping = false;
    var dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) < 60) return; // too short
    if (dx < 0) nextSongDirect(); // swipe left → next
    else prevSong(); // swipe right → prev
  });
}

// ─── UPDATE NAV BUTTONS STATE ─────────────────────────────────────────────────
function updateNavButtons() {
  var prevBtn = document.getElementById('prevSongBtn');
  var nextBtn = document.getElementById('nextSongBtn');
  if (!prevBtn || !nextBtn) return;
  // check prev
  var prev = _current - 1;
  while (prev >= 0 && _playlist[prev]._skipped) prev--;
  prevBtn.disabled = prev < 0;
  // check next
  var next = _current + 1;
  while (next < _playlist.length && _playlist[next]._skipped) next++;
  nextBtn.disabled = next >= _playlist.length;
}

function playNow(idx) {
  if (idx === _current) return;
  _current = idx;
  _currentUpdatedAt = Date.now();
  _lastLocalCurrentChange = Date.now();
  _modified = true;
  normalizePlaylistState();
  haptic(80);
  // broadcast ให้ทุกเครื่องเปลี่ยนเพลงพร้อมกัน
  broadcastEvent('current_changed', { idx: idx, bpm: (_playlist[idx] || {}).bpm || 0, currentUpdatedAt: _currentUpdatedAt });
  scheduleStateSync();
  renderNowPlaying();
  renderSongList();
  showToast('▶ เล่น: ' + (_playlist[idx] ? _playlist[idx].name : ''));
}

function setAsNext(idx) {
  if (idx === _current || _isEnding) return; // ไม่อนุญาตเปลี่ยนลำดับขณะ transition กำลังทำงาน
  var nextPos = _current + 1;
  if (idx === nextPos) { showToast('"' + (_playlist[idx]||{name:''}).name + '" เป็นเพลงถัดไปอยู่แล้ว ✅'); return; }
  var song = _playlist.splice(idx, 1)[0];
  var insertAt = _current + 1;
  if (idx < _current) { _current--; insertAt = _current + 1; }
  _playlist.splice(insertAt, 0, song);
  _modified = true;
  broadcastEvent('set_next', { idx: idx });
  scheduleStateSync();
  renderNowPlaying();
  renderSongList();
  showToast('"' + song.name + '" → เพลงถัดไป ✅');
  haptic(60);
}

// ─────────────────────────────────────────────────────────────────
//  SKIP / UNSKIP
// ─────────────────────────────────────────────────────────────────
function skipSong(idx) {
  if (_playlist[idx]._skipped) return;
  haptic(50);
  _playlist[idx]._skipped = true;
  _modified = true;
  broadcastEvent('skip_song', { idx: idx });
  scheduleStateSync();
  if (idx === _current) advanceSong();
  else renderSongList();
}

function unskipSong(e, idx) {
  e.stopPropagation();
  _playlist[idx]._skipped = false;
  _modified = true;
  broadcastEvent('unskip_song', { idx: idx });
  scheduleStateSync();
  renderSongList();
}

// ─────────────────────────────────────────────────────────────────
//  SWIPE GESTURES
// ─────────────────────────────────────────────────────────────────
function setupSwipe() { /* logic merged into renderSongList per-item handlers */ }

// ─────────────────────────────────────────────────────────────────
//  DRAG-TO-REORDER (global handlers)
// ─────────────────────────────────────────────────────────────────
function onDragMove(e) {
  if (!_drag.active) return;
  // ไม่ block event ถ้า modal กำลังเปิดอยู่ (ป้องกัน keyboard ไม่ขึ้นบน Android)
  if (document.querySelector('.modal-backdrop.show')) return;
  e.preventDefault();
  var touch = e.touches[0];
  var ghost = _drag.ghostEl;
  if (ghost) {
    ghost.style.left = touch.clientX - 80 + 'px';
    ghost.style.top  = touch.clientY + 14 + 'px';
  }
  // find which item the touch is over
  document.querySelectorAll('.song-item').forEach(function(item) {
    item.classList.remove('drag-over-before', 'drag-over-after');
    var rect = item.getBoundingClientRect();
    if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
      var midY = rect.top + rect.height / 2;
      var toIdx = parseInt(item.dataset.idx, 10);
      if (!isNaN(toIdx)) {
        _drag.toIdx = toIdx;
        item.classList.add(touch.clientY < midY ? 'drag-over-before' : 'drag-over-after');
      }
    }
  });
}

function onDragEnd(e) {
  if (!_drag.active) return;
  _drag.active = false;
  var ghost = _drag.ghostEl;
  if (ghost) ghost.style.display = 'none';
  document.querySelectorAll('.song-item').forEach(function(item) {
    item.classList.remove('drag-source','drag-over-before','drag-over-after');
  });
  var from = _drag.fromIdx;
  var to   = _drag.toIdx;
  _drag.fromIdx = _drag.toIdx = -1;
  if (from >= 0 && to >= 0 && from !== to) {
    var song = _playlist.splice(from, 1)[0];
    _playlist.splice(to, 0, song);
    if (_current === from) _current = to;
    else if (from < to && _current > from && _current <= to) _current--;
    else if (from > to && _current < from && _current >= to) _current++;
    _modified = true;
    renderNowPlaying();
    renderSongList();
    broadcastEvent('reorder', { from: from, to: to });
    showToast('\u0e22\u0e49\u0e32\u0e22\u0e40\u0e1e\u0e25\u0e07\u0e41\u0e25\u0e49\u0e27 ✓');
  }
}

// ─────────────────────────────────────────────────────────────────
//  BREAK WARNING
// ─────────────────────────────────────────────────────────────────
function setupBreakWarning() {
  if (!_timeSlot) return;
  // Parse "HH:MM-HH:MM" or "HH.MM-HH.MM" format from timeSlot param
  var match = _timeSlot.match(/(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})/);
  if (!match) return; // free-text timeslot (e.g. "รอบค่ำ") — no break warning
  var endH = parseInt(match[3], 10);
  var endM = parseInt(match[4], 10);
  var now = new Date();
  var endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0);
  if (endDate <= now) endDate.setDate(endDate.getDate() + 1); // next day if already past
  var warnAt = endDate.getTime() - 3 * 60 * 1000; // 3 min before
  var delay  = warnAt - Date.now();
  if (delay > 0 && delay < 14 * 60 * 60 * 1000) {
    _breakWarningTimer = setTimeout(showBreakWarning, delay);
  }
}

function showBreakWarning() {
  var el = document.getElementById('breakWarning');
  el.classList.add('show');
  haptic([200, 100, 200]);
  setTimeout(function() { el.classList.remove('show'); }, 3200);
}

// ─────────────────────────────────────────────────────────────────
//  PRE-GENERATE GUEST TOKEN
// ─────────────────────────────────────────────────────────────────
function preGenerateToken() {
  if (!_bandId || !_date) return;
  apiCall('createGuestToken', { date: _date, venue: _venue, timeSlot: _timeSlot }, function(r) {
    if (r && r.success && r.data) {
      _guestLinkToken = r.data; // { token, expiresAt }
    }
  });
}

// ─────────────────────────────────────────────────────────────────
//  ENCORE
// ─────────────────────────────────────────────────────────────────
function addEncore(idx) {
  var s = _playlist[idx];
  if (!s) return;
  var clone = Object.assign({}, s, { _isEncore: true, _skipped: false, _note: '' });
  var insertAt = idx + 1; // ✅ แทรกหลังเพลงที่เลือก (ไม่ใช่หลัง _current เสมอ)
  // ถ้า encore อยู่หลัง idx และ idx < _current, _current ต้อง shift +1
  if (insertAt <= _current) _current++;
  _playlist.splice(insertAt, 0, clone);
  _modified = true;
  broadcastEvent('request_song', { song: clone, insertAt: insertAt });
  scheduleStateSync();
  renderNowPlaying();
  renderSongList();
  showToast('🔁 Encore: ' + s.name);
}

// ─────────────────────────────────────────────────────────────────
//  TRANSPOSE MODAL
// ─────────────────────────────────────────────────────────────────
function openTranspose() {
  var hint = document.getElementById('keyHint');
  if (hint) hint.classList.add('hide');
  var s = _playlist[_current];
  if (!s) return;
  _trStep = 0;
  document.getElementById('trDisplay').textContent = s._key || '—';
  document.getElementById('trLabel').textContent = 'คีย์เดิม: ' + (s.key ? formatKey(s.key) : '—');
  document.getElementById('transposeModal').classList.add('show');
}
function closeTranspose() {
  document.getElementById('transposeModal').classList.remove('show');
}
function applyTranspose(dir) {
  var s = _playlist[_current];
  if (!s) return;
  _trStep += dir;
  var newKey = s.key ? transposeKey(s.key, _trStep) : (s._key || '—');
  s._key = newKey;
  document.getElementById('trDisplay').textContent = newKey;
  document.getElementById('nowKey').textContent = newKey;
  _modified = true;
  broadcastEvent('transpose', { idx: _current, key: newKey });
}
function resetTranspose() {
  var s = _playlist[_current];
  if (!s) return;
  _trStep = 0;
  s._key = s.key;
  document.getElementById('trDisplay').textContent = s.key || '—';
  document.getElementById('nowKey').textContent = s.key || '—';
  broadcastEvent('transpose', { idx: _current, key: s.key });
}

// ─────────────────────────────────────────────────────────────────
//  NOTE MODAL (long press)
// ─────────────────────────────────────────────────────────────────
function openNote(idx) {
  _noteIdx = idx;
  document.getElementById('noteInput').value = _playlist[idx]._note || '';
  document.getElementById('noteModal').classList.add('show');
  setTimeout(function(){ document.getElementById('noteInput').focus(); }, 200);
}
function closeNote() {
  document.getElementById('noteModal').classList.remove('show');
  _noteIdx = -1;
}
function submitNote() {
  if (_noteIdx < 0) return;
  var note = document.getElementById('noteInput').value.trim();
  _playlist[_noteIdx]._note = note;
  _modified = true;
  broadcastEvent('note_update', { idx: _noteIdx, note: note });
  if (_noteIdx === _current) _updateNoteMarquee(note);
  closeNote();
  renderSongList();
}

// ─────────────────────────────────────────────────────────────────
//  EDIT KEY / BPM MODAL
// ── BPM Modal (transpose-style) ──────────────────────────────────
var _bpmIdx = -1;
var _bpmOriginal = 0;

function openBpm() {
  var idx = _current;
  var s = _playlist[idx];
  if (!s) return;
  _bpmIdx = idx;
  _bpmOriginal = parseInt(s.bpm, 10) || 0;
  var el = document.getElementById('bpmDisplay');
  el.value = _bpmOriginal || '';
  document.getElementById('bpmLabel').textContent = 'BPM เดิม: ' + (_bpmOriginal || '—');
  var role = localStorage.getItem('userRole') || 'member';
  var isAdmin = (role === 'admin' || role === 'manager');
  document.getElementById('bpmHint').textContent = isAdmin
    ? '✅ บันทึกลงคลังเพลงอัตโนมัติ' : 'ℹ️ แก้เฉพาะรอบนี้';
  document.getElementById('bpmModal').classList.add('show');
  setTimeout(function(){ el.focus(); el.select(); }, 200);
}

function adjustBpm(delta) {
  var el = document.getElementById('bpmDisplay');
  var v = parseInt(el.value, 10) || 0;
  v = Math.max(0, Math.min(999, v + delta));
  el.value = v;
}

function resetBpm() {
  document.getElementById('bpmDisplay').value = _bpmOriginal || '';
}

function closeBpm() {
  document.getElementById('bpmModal').classList.remove('show');
  _bpmIdx = -1;
}

function submitBpm() {
  if (_bpmIdx < 0) return;
  var s = _playlist[_bpmIdx];
  if (!s) { closeBpm(); return; }
  var newBpm = parseInt(document.getElementById('bpmDisplay').value, 10) || 0;
  var curKey = s._key || s.key || '';
  s.bpm = newBpm;
  _modified = true;
  broadcastEvent('edit_keybpm', { idx: _bpmIdx, key: curKey, bpm: newBpm });
  if (_bpmIdx === _current) renderNowPlaying();
  renderSongList();
  var role = localStorage.getItem('userRole') || 'member';
  if (role === 'admin' || role === 'manager') {
    _saveKeyBpmToLibrary(s.name, curKey, newBpm);
  }
  closeBpm();
  showToast('🎵 BPM → ' + newBpm);
}

// ─────────────────────────────────────────────────────────────────
var _editSongIdx = -1;
var _editBpmOnly = false;

function openEditSong(idx, bpmOnly) {
  _editSongIdx = idx;
  _editBpmOnly = !!bpmOnly;
  var s = _playlist[idx];
  if (!s) return;
  document.getElementById('editSongName').textContent = '🎵 ' + s.name;
  document.getElementById('editKeyInput').value = s._key || s.key || '';
  document.getElementById('editBpmInput').value = s.bpm || '';
  // Show/hide key field
  document.getElementById('editKeyWrap').style.display = _editBpmOnly ? 'none' : '';
  document.getElementById('editSongTitle').textContent = _editBpmOnly ? '🎵 แก้ความเร็ว (BPM)' : '🎹 แก้คีย์ / BPM';
  var role = localStorage.getItem('userRole') || 'member';
  var isAdmin = (role === 'admin' || role === 'manager');
  document.getElementById('editSongHint').textContent = isAdmin
    ? '✅ แอดมิน/ผู้จัดการ — บันทึกลงคลังเพลงอัตโนมัติ'
    : 'ℹ️ แก้ไขเฉพาะ Live Mode นี้เท่านั้น';
  document.getElementById('editSongModal').classList.add('show');
  setTimeout(function(){ document.getElementById('editBpmInput').focus(); }, 200);
}

function closeEditSong() {
  document.getElementById('editSongModal').classList.remove('show');
  _editSongIdx = -1;
}

function submitEditSong() {
  if (_editSongIdx < 0) return;
  var s = _playlist[_editSongIdx];
  if (!s) { closeEditSong(); return; }
  var newKey = _editBpmOnly ? (s._key || s.key || '') : document.getElementById('editKeyInput').value.trim();
  var newBpm = parseInt(document.getElementById('editBpmInput').value, 10) || 0;

  // Update playlist in memory
  if (!_editBpmOnly) {
    s._key = newKey;
    s.key = newKey;
  }
  s.bpm = newBpm;
  _modified = true;

  // Broadcast to all devices
  broadcastEvent('edit_keybpm', { idx: _editSongIdx, key: newKey, bpm: newBpm });

  // Re-render
  if (_editSongIdx === _current) renderNowPlaying();
  renderSongList();

  // If admin/manager → also save to band_songs DB
  var role = localStorage.getItem('userRole') || 'member';
  var isAdmin = (role === 'admin' || role === 'manager');
  if (isAdmin) {
    _saveKeyBpmToLibrary(s.name, newKey, newBpm);
  }

  closeEditSong();
  showToast('🎹 อัปเดต: ' + s.name);
}

function _saveKeyBpmToLibrary(songName, key, bpm) {
  // Find song in _allSongs by name to get its ID
  if (!_allSongsLoaded || _allSongs.length === 0) {
    preloadBandSongs(function() {
      _doSaveKeyBpm(songName, key, bpm);
    });
  } else {
    _doSaveKeyBpm(songName, key, bpm);
  }
}

function _doSaveKeyBpm(songName, key, bpm) {
  var nameLower = songName.trim().toLowerCase();
  var match = null;
  for (var i = 0; i < _allSongs.length; i++) {
    if ((_allSongs[i].name || '').trim().toLowerCase() === nameLower) {
      match = _allSongs[i];
      break;
    }
  }
  if (!match || !match.id) return; // song not in library, skip
  var updateData = {};
  if (key) updateData.key = key;
  if (bpm) updateData.bpm = bpm;
  if (Object.keys(updateData).length === 0) return;
  apiCall('updateSong', { songId: match.id, data: updateData }, function(r) {
    if (r && r.success) {
      // Update cached _allSongs too
      if (key) match.key = key;
      if (bpm) match.bpm = bpm;
    }
  });
}

// ─────────────────────────────────────────────────────────────────
//  BREAK TIMER
// ─────────────────────────────────────────────────────────────────
function startBreak() {
  if (_isGuest) return;
  _endBreakDone            = false;
  _breakStarted            = true;
  _breakStartedByMe        = true;  // this device pressed the button
  _breakStartTime          = Date.now();
  _lastEndedBreakStartTime = 0;     // reset: new break started
  _breakWarnedAt55         = false;
  _breakWarnedDone         = false;
  try { sessionStorage.setItem('_breakStartTime', String(_breakStartTime)); } catch(e) {}

  var sbtn = document.getElementById('startBreakBtn');
  var ebtn = document.getElementById('endBreakBtn');
  var tbar = document.getElementById('breakTimerBar');
  if (sbtn) sbtn.style.display = 'none';
  if (ebtn) ebtn.style.display = '';
  if (tbar) tbar.style.display = 'flex';

  // Show late badge if started after scheduled time
  if (_scheduledStartMin >= 0) {
    var nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    var lateMin = nowMin - _scheduledStartMin;
    if (lateMin > 12 * 60) lateMin -= 24 * 60; // midnight wrap
    if (lateMin > 2) {
      var lb = document.getElementById('lateBadge');
      if (lb) { lb.textContent = 'ช้า ' + Math.round(lateMin) + ' นาที'; lb.style.display = ''; }
    }
  }

  // ── Clear interval เก่าก่อนเสมอ ป้องกัน interval ซ้อนกันเมื่อเริ่มเบรคครั้งที่ 2+ ──
  if (_breakTimerIval) { clearInterval(_breakTimerIval); _breakTimerIval = null; }
  updateBreakTimer();
  _breakTimerIval = setInterval(updateBreakTimer, 1000); // อัพเดททุก 1 วินาที

  // ── Broadcast ให้ทุกเครื่องทราบว่าเริ่มนับเวลาแล้ว (พร้อม timestamp ที่ตรงกัน) ──
  broadcastEvent('break_started', {
    breakStartTime: _breakStartTime,
    by: localStorage.getItem('userName') || ''
  });
  scheduleStateSync(); // ย้ำ sync state อีกรอบ ป้องกัน broadcast ธรรมดาหลุด
}

function updateBreakTimer() {
  if (!_breakStarted) return;
  var elapsedSec = Math.floor((Date.now() - _breakStartTime) / 1000);
  var elapsed = Math.floor(elapsedSec / 60);
  var secs = elapsedSec % 60;
  var pct = Math.min(100, Math.round(elapsedSec / (_breakTargetMin * 60) * 100));

  var txt  = document.getElementById('breakTimerText');
  var fill = document.getElementById('breakTimerFill');
  var done = document.getElementById('breakTimerDone');

  // แสดงนาที:วินาที ให้ดูเรียลไทม์มากขึ้น
  var dispStr = 'เล่นมา ' + elapsed + ':' + String(secs).padStart(2,'0') + ' / ' + _breakTargetMin + ' นาที';
  if (txt)  txt.textContent = dispStr;
  if (fill) {
    fill.style.transform = 'scaleX(' + (pct / 100) + ')';
    fill.className = pct >= 100 ? 'done' : pct >= 80 ? 'warn' : '';
  }

  var warn5 = _breakTargetMin - 5;
  if (!_breakWarnedAt55 && elapsed >= warn5 && elapsed < _breakTargetMin) {
    _breakWarnedAt55 = true;
    showToast('⏰ อีก ' + (_breakTargetMin - elapsed) + ' นาทีครบเป้า!');
  }
  if (!_breakWarnedDone && elapsed >= _breakTargetMin) {
    _breakWarnedDone = true;
    if (done) done.style.display = '';
    showToast('✅ ครบ ' + _breakTargetMin + ' นาทีแล้ว!');
    // ไม่ clear interval เพื่อให้เวลาเดินต่อไป (เช่น 61/60, 62/60 นาที) จนกว่าจะกดจบเบรคเอง
  }
}

// ─────────────────────────────────────────────────────────────────
//  END BREAK (จบเบรค)
// ─────────────────────────────────────────────────────────────────
var _endBreakSaving = false; // guard against concurrent saves (multi-device race)
var _endBreakDone  = false; // true = someone already saved this session (broadcast received)

function endBreak() {
  var warnParts = [];
  // Check break duration
  if (_breakStarted && _breakTargetMin > 0) {
    var elapsed = Math.floor((Date.now() - _breakStartTime) / 60000);
    if (elapsed < _breakTargetMin - 1) {
      warnParts.push('เล่นมาแค่ <b>' + elapsed + '</b> นาที ยังขาดอีก <b>' + (_breakTargetMin - elapsed) + '</b> นาที (เป้า ' + _breakTargetMin + ' นาที/เบรค)');
    }
  }
  // Count unplayed songs (after current, not skipped)
  var unplayed = 0;
  for (var i = _current + 1; i < _playlist.length; i++) {
    if (!_playlist[i]._skipped) unplayed++;
  }
  if (unplayed > 0) {
    warnParts.push('ยังมีเพลงที่ยังไม่ได้เล่นอีก <b>' + unplayed + '</b> เพลง');
  }
  if (warnParts.length) {
    document.getElementById('endBreakWarningMsg').innerHTML = warnParts.join('<br>');
    document.getElementById('endBreakModal').classList.add('show');
    return;
  }
  endBreakConfirmed();
}

function endBreakConfirmed() {
  if (_endBreakSaving) return; // prevent double-call
  var oldBreakStartTime = _breakStartTime;
  // Stop break timer completely
  if (_breakTimerIval) { clearInterval(_breakTimerIval); _breakTimerIval = null; }
  _breakStarted            = false;
  _breakStartedByMe        = false;
  _lastEndedBreakStartTime = oldBreakStartTime; // บันทึกว่าเบรคไหนจบไปแล้ว
  _breakStartTime          = 0;
  _endBreakDone            = false;
  try { sessionStorage.removeItem('_breakStartTime'); } catch(e) {}
  // Hide timer bar and reset start button so user can start next break when ready
  var _tbar = document.getElementById('breakTimerBar');
  var _sbtn = document.getElementById('startBreakBtn');
  var _ebtn = document.getElementById('endBreakBtn');
  if (_tbar) _tbar.style.display = 'none';
  if (_sbtn) _sbtn.style.display = '';
  if (_ebtn) _ebtn.style.display = 'none';
  if (!_modified) {
    // No changes made — just exit without saving or showing clipboard
    doExit();
    return;
  }

  // ตรวจว่ามีข้อมูลพอสำหรับ save
  if (!_bandId || !_date) {
    showToast('⚠️ ไม่พบ bandId หรือ date — ไม่สามารถบันทึกได้');
    _showClipModal();
    return;
  }

  _endBreakSaving = true;

  // Broadcast ให้เครื่องอื่นรู้ว่ามีคนกำลัง save → disable ปุ่มของเครื่องอื่น
  broadcastEvent('end_break_saving', { by: localStorage.getItem('userName') || '' });

  // Disable button ระหว่าง save
  var btn = document.getElementById('endBreakBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

  var snapshotPlaylist = _playlist.slice(); // snapshot ก่อน async call ป้องกัน Realtime เขียนทับ
  var actualBreakSec = 0;
  if (oldBreakStartTime > 0) {
    actualBreakSec = Math.floor((Date.now() - oldBreakStartTime) / 1000);
  }
  var songs = snapshotPlaylist.map(function(s) {
    var song = { name: s.name, key: s._key || s.key || '', bpm: s.bpm || 0,
      artist: s.artist || '', singer: s.singer || '' };
    if (s._isRequest) { song._isRequest = true; if (s._isRequestTime) song._isRequestTime = s._isRequestTime; }
    if (s._isEncore) song._isEncore = true;
    return song;
  });
  if (songs.length > 0 && actualBreakSec > 0) {
    songs[0]._actualBreakSec = actualBreakSec;
  }
  apiCall('savePlaylistHistory', {
    bandId: _bandId,
    bandName: localStorage.getItem('bandName') || '',
    date: _date, venue: _venue, timeSlot: _timeSlot,
    songs: songs
  }, function(r) {
    _endBreakSaving = false;
    if (btn) { btn.disabled = false; btn.textContent = '⏹ จบเบรค'; }
    if (!r || !r.success) {
      // บันทึกไม่สำเร็จ — คืน state ให้กดใหม่ได้
      showToast('⚠️ บันทึกไม่สำเร็จ — คัดลอกรายการแทนได้');
    } else {
      // สำเร็จแล้ว — broadcast ให้เครื่องอื่นรู้
      _endBreakDone = false;
      broadcastEvent('end_break_done', { by: localStorage.getItem('userName') || '' });
    }
    _showClipModal(snapshotPlaylist);
    // บันทึก snapshot ไว้ใน sessionStorage ให้เปิดดูทีหลังได้
    try {
      sessionStorage.setItem('_lastBreakSnap', JSON.stringify(snapshotPlaylist));
      var _scb = document.getElementById('showClipBtn');
      if (_scb) _scb.style.display = '';
    } catch(e) {}
  });
}

function _showClipModal(overrideList, isReview) {
  var list = overrideList || _playlist;
  var lines = list.filter(function(s){ return !s._skipped; }).map(function(s, i) {
    var parts = [(i + 1) + '.', s.name];
    if (s._key && s._key !== s.key) parts.push('[คีย์ ' + s._key + ']');
    else if (s._key) parts.push('[' + s._key + ']');
    if (s.bpm) parts.push(s.bpm + ' BPM');
    if (s._isRequest) parts.push('(ขอ)');
    if (s._isEncore)  parts.push('(Encore)');
    if (s._note)      parts.push('— ' + s._note);
    return parts.join(' ');
  });
  var header = ['📋 รายการเพลง' + (_venue ? ' — ' + _venue : '') + (_timeSlot ? ' ' + _timeSlot : ''),
                'วันที่: ' + (_date || '—'), ''].join('\n');
  document.getElementById('clipContent').textContent = header + lines.join('\n');

  // Show request songs → library section (admin/manager only)
  var role = localStorage.getItem('userRole') || 'member';
  var isAdmin = (role === 'admin' || role === 'manager');
  var reqSongs = list.filter(function(s) { return s._isRequest && !s._skipped; });
  var section = document.getElementById('reqToLibrarySection');

  if (isAdmin && reqSongs.length > 0) {
    // Check which ones are already in library
    var libNames = {};
    _allSongs.forEach(function(s) { libNames[(s.name || '').trim().toLowerCase()] = true; });

    var listEl = document.getElementById('reqLibList');
    listEl.innerHTML = '';
    var hasNew = false;
    reqSongs.forEach(function(s, i) {
      var nameKey = (s.name || '').trim().toLowerCase();
      var alreadyInLib = libNames[nameKey];
      var item = document.createElement('label');
      item.className = 'req-lib-item' + (alreadyInLib ? '' : ' checked');
      item.innerHTML =
        '<input type="checkbox" data-req-idx="' + i + '"' + (alreadyInLib ? '' : ' checked') + (alreadyInLib ? ' disabled' : '') + '>' +
        '<div class="rli-info">' +
          '<div class="rli-name">' + escHtml(s.name) + '</div>' +
          '<div class="rli-meta">' +
            (s._key || s.key ? 'คีย์ ' + (s._key || s.key) : '') +
            (s.bpm ? ' · ' + s.bpm + ' BPM' : '') +
            (s.artist ? ' · ' + s.artist : '') +
            (alreadyInLib ? ' · <span style="color:var(--green)">มีในคลังแล้ว ✓</span>' : '') +
          '</div>' +
        '</div>';
      var cb = item.querySelector('input');
      cb.addEventListener('change', function() {
        item.classList.toggle('checked', this.checked);
      });
      listEl.appendChild(item);
      if (!alreadyInLib) hasNew = true;
    });
    section.style.display = 'block';
    document.getElementById('saveToLibBtn').style.display = hasNew ? 'block' : 'none';
  } else {
    section.style.display = 'none';
  }

  document.getElementById('clipModal').classList.add('show');
  // ถ้าเปิดจากปุ่ม "📋 รายการ" (isReview) → ปุ่มเป็น "ปิด" แทน "ปิด & ออก"
  var exitBtn = document.getElementById('clipCloseBtn');
  var closeOnlyBtn = document.getElementById('clipJustCloseBtn');
  if (isReview) {
    if (exitBtn) exitBtn.style.display = 'none';
    if (closeOnlyBtn) closeOnlyBtn.style.display = '';
  } else {
    if (exitBtn) exitBtn.style.display = '';
    if (closeOnlyBtn) closeOnlyBtn.style.display = 'none';
  }
}

function toggleSelectAllReq() {
  var cbs = document.querySelectorAll('#reqLibList input[type=checkbox]:not(:disabled)');
  var allChecked = true;
  cbs.forEach(function(cb) { if (!cb.checked) allChecked = false; });
  cbs.forEach(function(cb) {
    cb.checked = !allChecked;
    cb.closest('.req-lib-item').classList.toggle('checked', cb.checked);
  });
}

function saveRequestsToLibrary() {
  var reqSongs = _playlist.filter(function(s) { return s._isRequest && !s._skipped; });
  var cbs = document.querySelectorAll('#reqLibList input[type=checkbox]:checked:not(:disabled)');
  var toSave = [];
  cbs.forEach(function(cb) {
    var idx = parseInt(cb.getAttribute('data-req-idx'), 10);
    var s = reqSongs[idx];
    if (s) toSave.push({ name: s.name, key: s._key || s.key || '', bpm: s.bpm || 0, singer: s.singer || '', artist: s.artist || '' });
  });
  if (!toSave.length) { showToast('ไม่ได้เลือกเพลง'); return; }

  var btn = document.getElementById('saveToLibBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }

  apiCall('bulkAddSongsToLibrary', { songs: toSave }, function(r) {
    if (btn) { btn.disabled = false; btn.textContent = '📥 เพิ่มลงคลังเพลง'; }
    if (r && r.success) {
      showToast('✅ เพิ่ม ' + (r.added || toSave.length) + ' เพลงลงคลังแล้ว!');
      // Mark saved items
      cbs.forEach(function(cb) {
        cb.checked = false;
        cb.disabled = true;
        var item = cb.closest('.req-lib-item');
        item.classList.remove('checked');
        var meta = item.querySelector('.rli-meta');
        if (meta) meta.innerHTML += ' · <span style="color:var(--green)">เพิ่มแล้ว ✓</span>';
      });
      btn.style.display = 'none';
    } else {
      showToast('⚠️ บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');
    }
  });
}

function copyClip() {
  var text = document.getElementById('clipContent').textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      showToast('📋 คัดลอกแล้ว!');
    }).catch(function() {
      _fallbackCopy(text);
      showToast('📋 คัดลอกแล้ว!');
    });
  } else {
    _fallbackCopy(text);
    showToast('📋 คัดลอกแล้ว!');
  }
}
function _fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly','');
  ta.style.position = 'fixed'; ta.style.left = '-9999px';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch(e) { console.warn('[copy] fallback failed', e); }
  document.body.removeChild(ta);
}

function closeClipAndExit() {
  document.getElementById('clipModal').classList.remove('show');
  doExit();
}

function showLastClip() {
  try {
    var snap = JSON.parse(sessionStorage.getItem('_lastBreakSnap') || 'null');
    if (snap && snap.length) { _showClipModal(snap, true); return; }
  } catch(e) {}
  _showClipModal(null, true);
}

function closeClipOnly() {
  document.getElementById('clipModal').classList.remove('show');
}

function exitLive() {
  if (_modified && !confirm('ออกจาก Live Mode?\nการเปลี่ยนแปลงจะไม่ถูกบันทึก')) return;
  doExit();
}

function doExit() {
  // ── Timers ──────────────────────────────────────────────
  if (_clockTimer)         { clearInterval(_clockTimer);          _clockTimer         = null; }
  if (_breakTimerIval)     { clearInterval(_breakTimerIval);      _breakTimerIval     = null; }
  if (_hbdTimer)           { clearInterval(_hbdTimer);            _hbdTimer           = null; }
  if (_rtHeartbeatTimer)   { clearInterval(_rtHeartbeatTimer);    _rtHeartbeatTimer   = null; }
  if (_periodicSyncTimer)  { clearInterval(_periodicSyncTimer);   _periodicSyncTimer  = null; }
  if (_breakWarningTimer)  { clearTimeout(_breakWarningTimer);    _breakWarningTimer  = null; }
  if (_syncRetryTimer)     { clearTimeout(_syncRetryTimer);        _syncRetryTimer     = null; }
  if (_stateSyncTimer)     { clearTimeout(_stateSyncTimer);        _stateSyncTimer     = null; }
  if (_endingTimer)        { clearTimeout(_endingTimer);           _endingTimer        = null; }
  if (_tapTimer)           { clearTimeout(_tapTimer);             _tapTimer           = null; }
  // ── Animation frames ────────────────────────────────────
  if (_marqueeRAF)         { cancelAnimationFrame(_marqueeRAF);   _marqueeRAF         = null; }
  if (_noteMarqueeRAF)     { cancelAnimationFrame(_noteMarqueeRAF); _noteMarqueeRAF   = null; }
  // ── Realtime + hardware ─────────────────────────────────
  if (_channel) { _channel.unsubscribe(); _channel = null; }
  stopBeatDot();
  releaseWakeLock();
  var ref = _params.get('from') || 'dashboard.html';
  location.href = ref;
}

// ─────────────────────────────────────────────────────────────────
//  REALTIME — Supabase Broadcast
// ─────────────────────────────────────────────────────────────────
function _sanitizeChannelPart(str) {
  // CRITICAL: Supabase Realtime broadcast fails with non-ASCII (Thai) chars in channel name
  // Convert Thai chars to hex to ensure ASCII-only channel names
  var out = '';
  var s = (str || '').trim();
  for (var i = 0; i < s.length; i++) {
    var code = s.charCodeAt(i);
    if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      out += s[i]; // 0-9 A-Z a-z
    } else if (code >= 0x0E00 && code <= 0x0E7F) {
      out += code.toString(16); // Thai → hex
    } else {
      out += '_';
    }
  }
  return out.replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
}

var _initRealtimePending = false; // debounce guard: ป้องกัน re-entrant call

function initRealtime() {
  if (!window._sb) {
    console.warn('[Live-RT] _sb not ready, retrying in 500ms...');
    setTimeout(initRealtime, 500);
    return;
  }
  // Debounce: ถ้ามี call ที่รออยู่ใน queue แล้ว ไม่ต้องเริ่มใหม่
  if (_initRealtimePending) { return; }
  _initRealtimePending = true;
  setTimeout(function() { _initRealtimePending = false; }, 2000);
  _channelStatus = '';
  // Clean up existing channel before creating a new one (prevent duplicate listeners)
  if (_channel) { try { _channel.unsubscribe(); } catch(e) {} _channel = null; }
  // Stop heartbeat timer
  if (_rtHeartbeatTimer) { clearInterval(_rtHeartbeatTimer); _rtHeartbeatTimer = null; }
  // Normalize venue/timeSlot for consistent channel naming
  var normVenue = (_venue || '').trim();
  var normTimeSlot = (_timeSlot || '').trim();
  var channelName = 'live-' + _bandId + '-' + _date
    + (normVenue ? '-' + _sanitizeChannelPart(normVenue) : '')
    + (normTimeSlot ? '-' + normTimeSlot.replace(/[^0-9]/g, '') : '');
  _channelName = channelName;
  console.log('[Live-RT] channel:', channelName, 'bandId:', _bandId, 'guest:', _isGuest);
  _channel = window._sb.channel(channelName, { config: { broadcast: { self: false } } });

  _channel
    .on('broadcast', { event: 'song_ending' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      var remoteUpdatedAt = typeof d.currentUpdatedAt === 'number' ? d.currentUpdatedAt : 0;
      // Guard: ถ้าเพิ่งเปลี่ยนเพลงในเครื่องนี้ (< 2.5 วิ) และ event นี้เก่ากว่า → ignore ป้องกันเด้งกลับ
      if (_lastLocalCurrentChange > 0 && Date.now() - _lastLocalCurrentChange < 2500 && remoteUpdatedAt < _currentUpdatedAt) {
        scheduleStateSync();
        return;
      }
      // sync _current ให้ตรงกับผู้กดก่อน จากนั้น advance ไป next เดียวกัน
      if (typeof d.from === 'number' && d.from >= 0 && d.from < _playlist.length) {
        if (remoteUpdatedAt >= _currentUpdatedAt || _current <= d.from) {
          _current = d.from;
        }
      }
      _currentUpdatedAt = Math.max(_currentUpdatedAt, remoteUpdatedAt);
      if (_isEnding) {
        // เครื่องนี้กำลังทำ animation อยู่ (หรือ animation ค้าง) — force-reset และรับคำสั่งจากเครื่องอื่น
        if (_endingTimer) { clearTimeout(_endingTimer); _endingTimer = null; }
        _isEnding = false;
        var _npEl = document.getElementById('nowPlaying');
        if (_npEl) _npEl.classList.remove('pulsing');
      }
      triggerEnding(typeof d.next === 'number' ? d.next : -1);
    })
    .on('broadcast', { event: 'current_changed' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      var remoteUpdatedAt = typeof d.currentUpdatedAt === 'number' ? d.currentUpdatedAt : 0;
      if (typeof d.idx === 'number' && d.idx >= 0 && d.idx < _playlist.length) {
        // Guard: ถ้าเพิ่งเปลี่ยนเพลงในเครื่องนี้ (< 2.5 วิ) และ event นี้เก่ากว่า → ignore ป้องกันเด้งกลับ
        if (_lastLocalCurrentChange > 0 && Date.now() - _lastLocalCurrentChange < 2500 && remoteUpdatedAt < _currentUpdatedAt) {
          scheduleStateSync();
          return;
        }
        _current = d.idx;
        _currentUpdatedAt = Math.max(_currentUpdatedAt, remoteUpdatedAt);
        _modified = true;
        normalizePlaylistState();
        renderNowPlaying();
        renderSongList();
        // sync beat dot ด้วย
        if (d.bpm) {
          var bd = document.getElementById('beatDot');
          if (bd) bd.style.display = 'block';
        }
      }
    })
    .on('broadcast', { event: 'transpose' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      if (_playlist[d.idx]) { _playlist[d.idx]._key = d.key; _modified = true; }
      if (d.idx === _current) {
        document.getElementById('nowKey').textContent = d.key || '—';
        document.getElementById('trDisplay').textContent = d.key || '—';
      }
      renderSongList();
    })
    .on('broadcast', { event: 'note_update' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      if (_playlist[d.idx]) { _playlist[d.idx]._note = d.note; _modified = true; }
      if (d.idx === _current) _updateNoteMarquee(d.note || '');
      renderSongList();
    })
    .on('broadcast', { event: 'edit_keybpm' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      var s = _playlist[d.idx];
      if (s) {
        if (d.key !== undefined) { s.key = d.key; s._key = d.key; }
        if (d.bpm !== undefined) s.bpm = d.bpm;
        _modified = true;
        if (d.idx === _current) renderNowPlaying();
        renderSongList();
      }
    })
    .on('broadcast', { event: 'request_song' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      if (d.song) {
        // รับ insertAt ตรง ๆ (ตำแหน่งที่แน่นอน) — fallback insertAfter สำหรับ client เก่า
        var insertPos;
        if (typeof d.insertAt === 'number') {
          insertPos = Math.max(0, Math.min(d.insertAt, _playlist.length));
        } else {
          insertPos = (typeof d.insertAfter === 'number' ? d.insertAfter : _current) + 1;
        }
        _playlist.splice(insertPos, 0, d.song);
        _modified = true;
        normalizePlaylistState();
      }
      renderSongList();
    })
    .on('broadcast', { event: 'skip_song' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      if (_playlist[d.idx]) { _playlist[d.idx]._skipped = true; _modified = true; }
      renderSongList();
    })
    .on('broadcast', { event: 'unskip_song' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      if (_playlist[d.idx]) { _playlist[d.idx]._skipped = false; _modified = true; }
      renderSongList();
    })
    .on('broadcast', { event: 'remove' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      if (removeSongAtIndex(d.idx)) {
        _modified = true;
        renderNowPlaying();
        renderSongList();
      }
    })
    .on('broadcast', { event: 'reorder' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      var from = d.from; var to = d.to;
      if (typeof from === 'number' && typeof to === 'number' && from !== to &&
          from >= 0 && to >= 0 && from < _playlist.length && to <= _playlist.length) {
        var song = _playlist.splice(from, 1)[0];
        _playlist.splice(to, 0, song);
        if (_current === from) _current = to;
        else if (from < to && _current > from && _current <= to) _current--;
        else if (from > to && _current < from && _current >= to) _current++;
        _modified = true;
        normalizePlaylistState();
        renderNowPlaying();
        renderSongList();
      }
    })
    .on('broadcast', { event: 'request_state' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      // someone is asking for state — respond if we have a non-empty playlist
      var d = payload.payload || {};
      if (_playlist.length > 0) {
        // Stagger response: earlier joiner responds faster (50ms), later joiner slower (300ms)
        var isSenior = (d.joinedAt && _joinedAt < d.joinedAt);
        var delay = isSenior ? (50 + Math.random() * 100) : (200 + Math.random() * 200);
        setTimeout(function() {
          if (isSenior) _isSyncLeader = true;
          broadcastEvent('state_sync', getState());
        }, delay);
      }
    })
    .on('broadcast', { event: 'set_next' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      var idx = d.idx;
      if (typeof idx !== 'number' || idx === _current || idx < 0 || idx >= _playlist.length) return;
      var song = _playlist.splice(idx, 1)[0];
      var insertAt = _current + 1;
      if (idx < _current) { _current--; insertAt = _current + 1; }
      _playlist.splice(insertAt, 0, song);
      _modified = true;
      normalizePlaylistState();
      renderNowPlaying();
      renderSongList();
    })
    .on('broadcast', { event: 'beat_ref' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      // New song — show dot for guest/viewer, prepare metronome
      _metBpm      = d.bpm || 0;
      _metInterval = _metBpm ? 60.0 / _metBpm : 0;
      var bd = document.getElementById('beatDot');
      var btn = document.getElementById('beatToggleBtn');
      if (!_metBpm || !bd) { if (bd) bd.style.display = 'none'; return; }
      bd.style.display = 'block';
      if (btn) btn.classList.toggle('off', !_metEnabled);
    })
    .on('broadcast', { event: 'beat_sync' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      // RECEIVER: Wall-clock phase-locked metronome
      // Manager sends wallOrigin (Date.now() at beat 0) + beat count + bpm
      // Receiver calculates exact wall-clock time of each beat and schedules accordingly
      var d = payload.payload || {};
      if (d.bpm && d.bpm !== _metBpm) {
        _metBpm      = d.bpm;
        _metInterval = 60.0 / d.bpm;
      }
      if (!_metBpm) return;
      var bd = document.getElementById('beatDot');
      if (bd) bd.style.display = 'block';

      // Stop existing local scheduler
      if (_metTimer) { clearTimeout(_metTimer); _metTimer = null; }

      // Use existing AudioContext only (create requires user gesture)
      var ctx = _userHasInteracted ? ensureAudioCtx() : _audioCtx;
      if (ctx) resumeAudio();

      // Wall-clock sync: calculate where we should be right now
      var intervalMs = _metInterval * 1000;
      var beatNum = d.beat || 0;
      var wallOrigin = d.wallOrigin || 0;
      // wallTime of this beat = wallOrigin + beatNum * intervalMs
      var beatWallTime = wallOrigin + beatNum * intervalMs;
      var now = Date.now();
      var deltaMs = beatWallTime - now; // negative = beat was in the past

      if (deltaMs > -intervalMs * 0.5 && deltaMs < intervalMs * 2) {
        // Beat is within reasonable range — schedule precisely
        var delaySec = Math.max(0, deltaMs / 1000);
        if (ctx) {
          var fireAt = ctx.currentTime + delaySec;
          scheduleClick(fireAt);
          scheduleDotFlash(delaySec);
        } else {
          setTimeout(function() { flashBeatDot(); }, Math.max(0, deltaMs));
        }
      } else {
        // Too far off — flash immediately as fallback
        flashBeatDot();
        if (_metAudioOn && ctx) scheduleClick(ctx.currentTime);
      }

      // Start local scheduler phased from wall-clock origin
      _metBeatCount = beatNum + 1;
      _metWallOrigin = wallOrigin;
      if (ctx) {
        // Calculate exact audioCtx time for next beat using wall-clock
        var nextBeatWall = wallOrigin + _metBeatCount * intervalMs;
        var nextDeltaSec = (nextBeatWall - Date.now()) / 1000;
        _metNextTime = ctx.currentTime + Math.max(0.01, nextDeltaSec);
        // Local scheduler (receiver mode — no broadcast, wall-clock aligned)
        function receiverScheduler() {
          while (_metNextTime < ctx.currentTime + MET_LOOKAHEAD) {
            scheduleClick(_metNextTime);
            scheduleDotFlash(_metNextTime - ctx.currentTime);
            _metNextTime += _metInterval;
            _metBeatCount++;
          }
          _metTimer = setTimeout(receiverScheduler, MET_INTERVAL);
        }
        receiverScheduler();
      } else {
        _metNextTime = performance.now() / 1000 + Math.max(0.01, (wallOrigin + _metBeatCount * intervalMs - Date.now()) / 1000);
        metSchedulerFallback();
      }
    })
    .on('broadcast', { event: 'state_sync' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      if (!d.playlist || d.playlist.length === 0) return;

      // Cancel retry timer on first sync
      var isFirstSync = !_syncReceived;
      if (!_syncReceived) {
        _syncReceived = true;
        if (_syncRetryTimer) { clearTimeout(_syncRetryTimer); _syncRetryTimer = null; }
      }

      // Always accept on first sync (rejoin scenario — DB state may be stale)
      var incomingCurrent = typeof d.current === 'number' ? d.current : 0;
      var incomingCurrentUpdatedAt = typeof d.currentUpdatedAt === 'number' ? d.currentUpdatedAt : 0;

      if (!isFirstSync) {
        // Guard: ถ้าเพิ่งเพิ่มเพลงในเครื่องนี้ (< 3 วิ) และ incoming state มีเพลงน้อยกว่า
        // → state นั้น stale (ส่งมาก่อนเราเพิ่ม) — ปฏิเสธ และ broadcast state ใหม่ของเราออกไป
        if (_lastLocalAddTime > 0 && Date.now() - _lastLocalAddTime < 3000 && d.playlist.length < _playlist.length) {
          scheduleStateSync();
          return;
        }
        // Guard: ถ้าเพิ่งเปลี่ยนเพลงในเครื่องนี้ (< 2.5 วิ) และ incoming state เก่ากว่า → ไม่ให้เด้งกลับเพลงเดิม
        if (_lastLocalCurrentChange > 0 && Date.now() - _lastLocalCurrentChange < 2500 && incomingCurrentUpdatedAt < _currentUpdatedAt) {
          scheduleStateSync();
          incomingCurrent = _current;
          incomingCurrentUpdatedAt = _currentUpdatedAt;
        } else if (incomingCurrentUpdatedAt < _currentUpdatedAt && incomingCurrent !== _current) {
          // incoming state เก่ากว่าการเปลี่ยนเพลงล่าสุดของเรา → คง _current ของเราไว้
          incomingCurrent = _current;
          incomingCurrentUpdatedAt = _currentUpdatedAt;
        }

        // Quick diff: skip re-render if state is already identical
        if (_playlist.length === d.playlist.length && _current === incomingCurrent) {
          var same = true;
          for (var si = 0; si < _playlist.length; si++) {
            var a = _playlist[si], b = d.playlist[si];
            if (a.name !== b.name || !!a._skipped !== !!b._skipped ||
                (a._key || '') !== (b._key || '') || (a._note || '') !== (b._note || '') ||
                !!a._isRequest !== !!b._isRequest || !!a._isEncore !== !!b._isEncore) {
              same = false; break;
            }
          }
          if (same) return; // state identical — skip
        }
      }

      _playlist = d.playlist;
      _current  = incomingCurrent;
      _currentUpdatedAt = Math.max(_currentUpdatedAt, incomingCurrentUpdatedAt);
      _isSyncLeader = false; // someone else is senior — they own broadcast
      _modified = true;
      normalizePlaylistState();
      _resetHbdTracking();
      // ── Sync break timer from leader state ──────────────────────────────
      // Step 1: ถ้า leader ยืนยันว่าเบรคนี้ (breakStartTime ตรงกัน) จบไปแล้ว → หยุด timer ทันที
      //         ป้องกันเครื่องที่ไม่ได้รับ end_break_done (ปิดจอ/ออฟไลน์) นับต่อไม่สิ้นสุด
      if (_breakStarted && d.lastEndedBreakStartTime > 0 && d.lastEndedBreakStartTime === _breakStartTime) {
        _breakStarted            = false;
        _breakStartedByMe        = false;
        _lastEndedBreakStartTime = d.lastEndedBreakStartTime;
        if (_breakTimerIval) { clearInterval(_breakTimerIval); _breakTimerIval = null; }
        try { sessionStorage.removeItem('_breakStartTime'); } catch(e) {}
        var _ssbl = document.getElementById('startBreakBtn');
        var _sebl = document.getElementById('endBreakBtn');
        var _stbl = document.getElementById('breakTimerBar');
        if (_ssbl) _ssbl.style.display = ''; // คืนปุ่มเริ่มเบรค
        if (_sebl) _sebl.style.display = 'none';
        if (_stbl) _stbl.style.display = 'none';
      }
      // Step 2: ถ้าเบรคกำลังเดินอยู่ — sync timestamp ให้ตรงกันทุกเครื่อง
      //         !_breakStarted = ยังไม่เริ่ม → เริ่ม
      //         _breakStartTime !== d.breakStartTime = เริ่มมาแล้วแต่ timestamp ต่างกัน (เช่น sessionStorage ของเบรคเก่า) → อัพเดต
      if (d.breakStarted && d.breakStartTime && (!_breakStarted || _breakStartTime !== d.breakStartTime)) {
        _breakStarted   = true;
        _breakStartTime = d.breakStartTime; // always trust leader's timestamp
        try { sessionStorage.setItem('_breakStartTime', String(_breakStartTime)); } catch(e) {}
        var _ssb = document.getElementById('startBreakBtn');
        var _seb = document.getElementById('endBreakBtn');
        var _stb = document.getElementById('breakTimerBar');
        if (_ssb) _ssb.style.display = 'none';
        if (_seb) _seb.style.display = '';
        if (_stb) _stb.style.display = 'flex';
        if (_breakTimerIval) clearInterval(_breakTimerIval);
        updateBreakTimer();
        _breakTimerIval = setInterval(updateBreakTimer, 1000); // อัพเดททุก 1 วินาที
      } else if (d.endBreakDone && _breakStarted) {
        // leader says break was definitively ended — stop our local timer
        _endBreakDone     = true;
        _breakStarted     = false;
        _breakStartedByMe = false;
        if (_breakTimerIval) { clearInterval(_breakTimerIval); _breakTimerIval = null; }
        try { sessionStorage.removeItem('_breakStartTime'); } catch(e) {}
        var _ssb2 = document.getElementById('startBreakBtn');
        var _seb2 = document.getElementById('endBreakBtn');
        var _stb2 = document.getElementById('breakTimerBar');
        if (_ssb2) _ssb2.style.display = ''; // ✅ คืนปุ่มเริ่มเบรค ให้กดเริ่มเบรคต่อไปได้
        if (_seb2) _seb2.style.display = 'none';
        if (_stb2) _stb2.style.display = 'none';
      } else if (!d.breakStarted && _breakStarted && isFirstSync) {
        // leader says break not started, but we have it running locally.
        // ถ้าเครื่องนี้ไม่ได้กด startBreak() เอง (เช่น restore จาก sessionStorage หลัง refresh)
        // ให้เชื่อ leader และหยุด timer ทันที เพื่อป้องกันเวลาเบรคเก่าฟื้นชีพ
        if (!_breakStartedByMe || Date.now() - _breakStartTime > 8 * 60 * 60 * 1000) {
           _breakStarted     = false;
           _breakStartedByMe = false;
           if (_breakTimerIval) { clearInterval(_breakTimerIval); _breakTimerIval = null; }
           try { sessionStorage.removeItem('_breakStartTime'); } catch(e) {}
           var _ssb3 = document.getElementById('startBreakBtn');
           var _seb3 = document.getElementById('endBreakBtn');
           var _stb3 = document.getElementById('breakTimerBar');
           if (_ssb3) _ssb3.style.display = '';
           if (_seb3) _seb3.style.display = 'none';
           if (_stb3) _stb3.style.display = 'none';
        }
        // else: เครื่องนี้กด startBreak() เอง แต่ leader ยังไม่รู้ (อาจ broadcast หลุด)
        // → คงนับต่อไป และรอ periodic sync ส่ง breakStartTime ไปอัพเดต leader
      }
      renderNowPlaying();
      renderSongList();
      if (isFirstSync) console.log('[Live-RT] state_sync received, playlist:', _playlist.length, 'current:', _current);
    })
    .on('broadcast', { event: 'nudge' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      if (d.from && d.msg) receiveNudge(d.from, d.msg);
    })
    .on('broadcast', { event: 'chat_msg' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      if (d.from && d.text) receiveChatMsg(d.from, d.text, d.time);
    })
    .on('broadcast', { event: 'break_started' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      // เครื่องอื่นกดเริ่มเบรค → sync timer พร้อมกันทันที โดยใช้ breakStartTime เดียวกัน
      if (!d.breakStartTime) return;
      _endBreakDone      = false;
      _breakStarted      = true;
      _breakStartedByMe  = false; // เครื่องอื่นกด ไม่ใช่เครื่องนี้
      _breakStartTime    = d.breakStartTime; // ใช้ timestamp ของเครื่องที่กด (wall-clock เดียวกัน)
      _breakWarnedAt55   = false;
      _breakWarnedDone   = false;
      try { sessionStorage.setItem('_breakStartTime', String(_breakStartTime)); } catch(e) {}
      var _sb = document.getElementById('startBreakBtn');
      var _eb = document.getElementById('endBreakBtn');
      var _tb = document.getElementById('breakTimerBar');
      if (_sb) _sb.style.display = 'none';
      if (_eb) _eb.style.display = '';
      if (_tb) _tb.style.display = 'flex';
      if (_breakTimerIval) clearInterval(_breakTimerIval);
      updateBreakTimer();
      _breakTimerIval = setInterval(updateBreakTimer, 1000);
      showToast('▶ ' + (d.by || 'สมาชิก') + ' เริ่มนับเวลาแล้ว');
    })
    .on('broadcast', { event: 'end_break_saving' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      // เครื่องอื่นกำลัง save → disable ปุ่มจบเบรคของเราเพื่อไม่ให้ save ซ้ำ
      var d = payload.payload || {};
      _endBreakSaving = true;
      var btn = document.getElementById('endBreakBtn');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
      showToast('💾 ' + (d.by || 'สมาชิก') + ' กำลังบันทึก...');
    })
    .on('broadcast', { event: 'end_break_done' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      // เครื่องอื่น save สำเร็จแล้ว → หยุด timer + ซ่อน bar + แสดงปุ่มเริ่มเบรคสำหรับเบรคถัดไป
      var d = payload.payload || {};
      _endBreakDone   = false;
      _endBreakSaving = false;
      _breakStarted   = false;
      _breakStartTime = 0;
      if (_breakTimerIval) { clearInterval(_breakTimerIval); _breakTimerIval = null; }
      try { sessionStorage.removeItem('_breakStartTime'); } catch(e) {}
      var _tbar2 = document.getElementById('breakTimerBar');
      var _sbtn2 = document.getElementById('startBreakBtn');
      var _ebtn2 = document.getElementById('endBreakBtn');
      if (_tbar2) _tbar2.style.display = 'none';
      if (_sbtn2) _sbtn2.style.display = '';
      if (_ebtn2) _ebtn2.style.display = 'none';
      showToast('✅ ' + (d.by || 'สมาชิก') + ' บันทึกลิสเรียบร้อย');
      _showClipModal();
    })
    .on('broadcast', { event: 'test_ping' }, function(payload) {
      if (isOwnBroadcast(payload)) return;
      var d = payload.payload || {};
      showToast('🔔 Ping จาก ' + (d.from || 'unknown') + ' — Realtime ทำงานปกติ!');
    })
    .subscribe(function(status) {
      var ind = document.getElementById('realtimeIndicator');
      _channelStatus = status;
      console.log('[Live-RT] subscribe status:', status, 'channel:', _channelName);
      if (status === 'SUBSCRIBED') {
        ind.className = 'connected';
        // Request state with retry (handles late joiners + reconnections)
        _isSyncLeader = false; // reset on (re)connect — will be re-elected via request_state flow
        _syncReceived = false;
        _syncRetryCount = 0;
        requestStateWithRetry();
        // Start periodic sync to keep all devices aligned
        startPeriodicSync();
        // Start heartbeat monitor
        _startHeartbeat();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        ind.className = 'error';
        _channelStatus = status;
        // Auto-reconnect after 3 seconds
        setTimeout(function() { console.log('[Live-RT] auto-reconnect...'); initRealtime(); }, 3000);
      } else {
        ind.className = '';
      }
    });
}

function getState() {
  return {
    playlist: _playlist,
    current: _current,
    currentUpdatedAt: _currentUpdatedAt,
    bpm: (_playlist[_current] || {}).bpm || 0,
    breakStarted: _breakStarted,
    breakStartTime: _breakStartTime,
    lastEndedBreakStartTime: _lastEndedBreakStartTime, // proof เบรคล่าสุดที่จบแล้ว
    endBreakDone: _endBreakDone
  };
}

// ── Realtime tracking helpers ─────────────────────────────────────
function _rtTrackRecv(eventName) {
  _rtLastRecv = eventName + ' ' + new Date().toLocaleTimeString();
  _rtLastActivity = Date.now();
}

function _rtTimeStr() { return new Date().toLocaleTimeString(); }

function broadcastEvent(event, data) {
  if (!_channel) {
    console.warn('[Live-RT] broadcastEvent: no channel for', event);
    _rtSendFail++;
    return;
  }
  if (_channelStatus !== 'SUBSCRIBED') {
    console.warn('[Live-RT] broadcastEvent: channel not SUBSCRIBED (status:', _channelStatus, ') for', event);
    _rtSendFail++;
    // Attempt reconnect if channel is in bad state
    if (_channelStatus === 'CHANNEL_ERROR' || _channelStatus === 'TIMED_OUT' || _channelStatus === '') {
      setTimeout(function() { initRealtime(); }, 100);
    }
    return;
  }
  var payload = {};
  if (data && typeof data === 'object') {
    for (var key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) payload[key] = data[key];
    }
  }
  payload.senderId = _clientId;
  try {
    var result = _channel.send({ type: 'broadcast', event: event, payload: payload });
    // Supabase JS v2 send() returns a Promise or 'ok'
    if (result && typeof result.then === 'function') {
      result.then(function(res) {
        if (res === 'ok' || res === undefined) {
          _rtSendOk++;
        } else {
          console.warn('[Live-RT] send resolved with:', res, 'event:', event);
          _rtSendFail++;
        }
      }).catch(function(err) {
        console.error('[Live-RT] send promise rejected:', err, 'event:', event);
        _rtSendFail++;
      });
    } else {
      _rtSendOk++;
    }
    _rtLastSent = event + ' ' + _rtTimeStr();
    _rtLastActivity = Date.now();
  } catch(e) {
    console.error('[Live-RT] broadcastEvent exception:', e, 'event:', event);
    _rtSendFail++;
  }
}

// ── Heartbeat: detect stale channel + reconnect ────────────────────
function _startHeartbeat() {
  if (_rtHeartbeatTimer) clearInterval(_rtHeartbeatTimer);
  _rtHeartbeatTimer = setInterval(function() {
    if (_channelStatus !== 'SUBSCRIBED') return;
    var elapsed = Date.now() - _rtLastActivity;
    // If no activity for 90 seconds, channel may be silently dead → reconnect
    if (elapsed > 90000) {
      console.log('[Live-RT] heartbeat: no activity for', Math.round(elapsed/1000), 's — reconnecting...');
      initRealtime();
    }
  }, 30000); // check every 30s
}

// ── Debug panel helpers ─────────────────────────────────────────────
function updateDebugPanel() {
  var el = function(id) { return document.getElementById(id); };
  el('dbgChannel').textContent = _channelName || '(none)';
  var st = el('dbgStatus');
  st.textContent = _channelStatus || '(none)';
  st.className = 'dbg-val' + (_channelStatus === 'SUBSCRIBED' ? '' : ' error');
  el('dbgBandId').textContent = _bandId || '(empty)';
  el('dbgDate').textContent = _date || '(empty)';
  el('dbgVenue').textContent = _venue || '(empty)';
  el('dbgTimeSlot').textContent = _timeSlot || '(empty)';
  el('dbgClientId').textContent = _clientId;
  el('dbgGuest').textContent = _isGuest ? 'Yes' : 'No';
  el('dbgLastSent').textContent = _rtLastSent || '—';
  el('dbgLastRecv').textContent = _rtLastRecv || '—';
  el('dbgSendOk').textContent = _rtSendOk;
  var sf = el('dbgSendFail');
  sf.textContent = _rtSendFail;
  sf.className = 'dbg-val' + (_rtSendFail > 0 ? ' error' : '');
}

function rtDebugPing() {
  var name = localStorage.getItem('userName') || localStorage.getItem('userNickname') || _clientId;
  broadcastEvent('test_ping', { from: name });
  showToast('🔔 Ping sent!');
  setTimeout(updateDebugPanel, 500);
}

function rtDebugReconnect() {
  showToast('🔄 Reconnecting...');
  initRealtime();
  setTimeout(updateDebugPanel, 2000);
}

// ─── SYNC: Retry + Periodic ──────────────────────────────────────
function requestStateWithRetry() {
  if (_syncReceived || _syncRetryCount >= 8) {
    // After 8 retries with no response + empty playlist → warn
    if (!_syncReceived && _syncRetryCount >= 8 && _playlist.length === 0) {
      showToast('⚠️ ไม่พบสมาชิกออนไลน์ รอรับข้อมูล...');
    }
    return;
  }
  broadcastEvent('request_state', { joinedAt: _joinedAt });
  _syncRetryCount++;
  _syncRetryTimer = setTimeout(function() {
    if (!_syncReceived) requestStateWithRetry();
  }, 3000); // retry every 3 seconds (8 retries = 24s total)
}

function startPeriodicSync() {
  if (_periodicSyncTimer) clearInterval(_periodicSyncTimer);
  _periodicSyncTimer = setInterval(function() {
    if (_playlist.length > 0 && _channel) {
      if (_isSyncLeader) {
        // Leader: broadcast every 30s
        broadcastEvent('state_sync', getState());
      } else if (!_isSyncLeader && _playlist.length > 0) {
        // Fallback: if no leader responded after 60s, broadcast once as fallback
        if (Date.now() - _joinedAt > 60000) {
          broadcastEvent('state_sync', getState());
        }
      }
    }
  }, 30000);
}

// ─── UNDO ─────────────────────────────────────────────────────────
function _pushUndo() {
  var s = _playlist[_current];
  if (!s) return;
  _undoStack.push({ current: _current, songName: s.name, songKey: s._key || s.key });
  if (_undoStack.length > 20) _undoStack.shift();
  _updateUndoBtn();
}

function _updateUndoBtn() {
  var btn = document.getElementById('undoBtn');
  if (!btn) return;
  if (_undoStack.length > 0) { btn.disabled = false; btn.classList.add('active'); }
  else { btn.disabled = true; btn.classList.remove('active'); }
}

function undoSong() {
  if (_undoStack.length === 0) { showToast('ไม่มีอะไรให้ย้อนกลับ'); return; }
  var state = _undoStack.pop();
  _current = state.current;
  _currentUpdatedAt = Date.now();
  _lastLocalCurrentChange = Date.now();
  _modified = true;
  normalizePlaylistState();
  haptic(80);
  broadcastEvent('current_changed', { idx: _current, bpm: (_playlist[_current] || {}).bpm || 0, currentUpdatedAt: _currentUpdatedAt });
  scheduleStateSync();
  renderNowPlaying();
  renderSongList();
  _updateUndoBtn();
  showToast('↩ ย้อนกลับ: ' + state.songName);
}

function _escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

// ─── CHAT ─────────────────────────────────────────────────────────
function openChat() {
  var panel = document.getElementById('chatPanel');
  if (panel.classList.contains('open')) { closeChat(); return; }
  _chatOpen = true;
  _chatUnread = 0;
  _updateChatBadge();
  // Stop pulse animation when chat opened
  var chatBtn = document.getElementById('chatMsgBtn');
  if (chatBtn) chatBtn.classList.remove('chat-alert');
  _renderChatMessages();
  panel.classList.add('open');
  document.getElementById('chatBarInner').style.display = 'none';
  var inp = document.getElementById('chatMsgInput');
  if (inp) {
    inp.value = '';
    inp.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); sendChatMsg(); } };
  }
}

function closeChat() {
  _chatOpen = false;
  document.getElementById('chatPanel').classList.remove('open');
  document.getElementById('chatBarInner').style.display = 'flex';
}

// No backdrop listener needed for mini panel;

function sendChatMsg() {
  var inp = document.getElementById('chatMsgInput');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  var myName = localStorage.getItem('userName') || 'สมาชิก';
  var now = new Date();
  var hh = String(now.getHours()).padStart(2, '0');
  var mm = String(now.getMinutes()).padStart(2, '0');
  var msg = { from: myName, text: text, time: hh + ':' + mm, isMine: true };
  _chatMessages.push(msg);
  broadcastEvent('chat_msg', { from: myName, text: text, time: hh + ':' + mm });
  inp.value = '';
  _renderChatMessages();
}

function receiveChatMsg(from, text, time) {
  _chatMessages.push({ from: from, text: text, time: time || '', isMine: false });
  if (!_chatOpen) {
    _chatUnread++;
    _updateChatBadge();
    _chatNotify(from, text);
  } else {
    _renderChatMessages();
  }
}

function _renderChatMessages() {
  var container = document.getElementById('chatMessages');
  if (!container) return;
  if (_chatMessages.length === 0) {
    container.innerHTML = '<div class="chat-empty">ยังไม่มีข้อความ</div>';
    return;
  }
  container.innerHTML = '';
  _chatMessages.forEach(function(m) {
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + (m.isMine ? 'mine' : 'other');
    bubble.innerHTML = (m.isMine ? '' : '<div class="chat-sender">' + _escHtml(m.from) + '</div>') +
      '<div class="chat-text">' + _escHtml(m.text) + '</div>' +
      '<div class="chat-ts">' + (m.time || '') + '</div>';
    container.appendChild(bubble);
  });
  container.scrollTop = container.scrollHeight;
}

function _updateChatBadge() {
  var badge = document.getElementById('chatBtnBadge');
  if (!badge) return;
  if (_chatUnread > 0) {
    badge.textContent = _chatUnread > 99 ? '99+' : _chatUnread;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ─── CHAT NOTIFICATION (sound + vibrate + pulse + toast) ─────────
var _chatToastTimer = null;
function _chatNotify(from, text) {
  // A) Sound — soft single-tone ping (gentler than nudge)
  _playChatSound();
  // B) Vibrate — single short pulse
  if (navigator.vibrate) navigator.vibrate(150);
  // C) Pulse animation on chat button
  var btn = document.getElementById('chatMsgBtn');
  if (btn) btn.classList.add('chat-alert');
  // D) Toast popup showing sender + message
  var toast = document.getElementById('chatToast');
  if (toast) {
    toast.innerHTML = '<span class="ct-from">' + _escHtml(from) + ':</span><span class="ct-text">' + _escHtml(text.length > 40 ? text.substring(0, 40) + '...' : text) + '</span>';
    toast.classList.add('show');
    if (_chatToastTimer) clearTimeout(_chatToastTimer);
    _chatToastTimer = setTimeout(function() { toast.classList.remove('show'); }, 3000);
    // Tap toast to open chat
    toast.onclick = function() { toast.classList.remove('show'); openChat(); };
  }
}

function _playChatSound() {
  try {
    if (!_nudgeAudioCtx) {
      _nudgeAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    var ctx = _nudgeAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; // A5 — softer than nudge C6/E6
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.start(t); osc.stop(t + 0.2);
  } catch(e) { /* no audio support */ }
}

// ─── HBD TIMED AUTO-SWITCH ─────────────────────────────────────────
function _parseHbdTime(name) {
  // Match: HBD followed by time like 21.30, 21:30, 9.00, 09:15
  var m = name.match(/^HBD\s+(\d{1,2})[.:](\d{2})/i);
  if (!m) return null;
  var h = parseInt(m[1], 10);
  var min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { hours: h, minutes: min };
}

function _startHbdTimer() {
  if (_hbdTimer) clearInterval(_hbdTimer);
  _hbdTimer = setInterval(_checkHbdSongs, 15000); // check every 15s
}

function _checkHbdSongs() {
  if (_isGuest) return; // guests don't control playback
  var now = new Date();
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var nowSec = now.getSeconds();
  var banner = document.getElementById('hbdBanner');

  var activeWarning = null;

  for (var i = 0; i < _playlist.length; i++) {
    var s = _playlist[i];
    if (s._skipped) continue;
    var t = _parseHbdTime(s.name);
    if (!t) continue;
    var targetMin = t.hours * 60 + t.minutes;
    var diff = targetMin - nowMin; // minutes until HBD

    // Already fired this song
    if (_hbdFired[i]) continue;

    // Already playing this song
    if (i === _current) { _hbdFired[i] = true; continue; }

    // AUTO-SWITCH: time reached (0 to -1 min window)
    if (diff <= 0 && diff >= -1) {
      _hbdFired[i] = true;
      _hbdWarned[i] = true;
      if (banner) { banner.classList.remove('show','urgent'); }
      // Play HBD sound alert
      _playHbdSound();
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      playNow(i);
      showToast('🎂 HBD! เปลี่ยนเพลงตามเวลาที่ตั้งไว้ → ' + s.name);
      return; // handle one at a time
    }

    // 2-MIN WARNING
    if (diff > 0 && diff <= 2 && !_hbdWarned[i]) {
      _hbdWarned[i] = true;
      activeWarning = { idx: i, name: s.name, diff: diff };
    }

    // Show countdown if within 3 minutes
    if (diff > 0 && diff <= 3) {
      activeWarning = activeWarning || { idx: i, name: s.name, diff: diff };
    }
  }

  // Update banner
  if (banner) {
    if (activeWarning) {
      var minLeft = activeWarning.diff;
      banner.innerHTML = '🎂 ' + _escHtml(activeWarning.name) + ' — อีก ' + minLeft + ' นาที!';
      banner.classList.add('show');
      banner.classList.toggle('urgent', minLeft <= 1);
    } else {
      banner.classList.remove('show', 'urgent');
    }
  }
}

function _playHbdSound() {
  try {
    if (!_nudgeAudioCtx) {
      _nudgeAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    var ctx = _nudgeAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    var t = ctx.currentTime;
    // Three ascending tones: C5 → E5 → G5
    var notes = [523, 659, 784];
    notes.forEach(function(freq, j) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      var start = t + j * 0.18;
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.start(start); osc.stop(start + 0.25);
    });
  } catch(e) {}
}

// Reset HBD tracking when playlist changes
function _resetHbdTracking() {
  _hbdFired = {};
  _hbdWarned = {};
}

// ─── NUDGE (สะกิด) ────────────────────────────────────────────────
var _nudgeAudioCtx = null;
var _lastNudgeTime = 0;

// Default presets — emoji and message text stored separately
var NUDGE_DEFAULTS = [
  { emoji: '🎤', text: 'พร้อมยัง?' },
  { emoji: '⏩', text: 'เร็วขึ้น' },
  { emoji: '⏪', text: 'ช้าลง' },
  { emoji: '⏭', text: 'จบเพลงนะ' },
  { emoji: '☕', text: 'เบรคเลย' },
  { emoji: '👏', text: 'ดีมาก!' }
];

var _nudgePresets = null; // loaded lazily

function _loadNudgePresets() {
  if (_nudgePresets) return _nudgePresets;
  try {
    var raw = localStorage.getItem('liveNudgePresets');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _nudgePresets = parsed;
        return _nudgePresets;
      }
    }
  } catch(e) {}
  _nudgePresets = NUDGE_DEFAULTS.map(function(p) { return Object.assign({}, p); });
  return _nudgePresets;
}

function _saveNudgePresetsToStorage() {
  localStorage.setItem('liveNudgePresets', JSON.stringify(_nudgePresets));
}

function renderNudgePresets() {
  var presets = _loadNudgePresets();
  var grid = document.getElementById('nudgePresetsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  presets.forEach(function(p, i) {
    var btn = document.createElement('button');
    btn.className = 'nudge-preset' + (p.isAll ? ' nudge-all' : '');
    btn.textContent = p.emoji + ' ' + p.text;
    btn.onclick = function() { sendNudge(p.emoji + ' ' + p.text); };
    grid.appendChild(btn);
  });
}

function openNudge() {
  renderNudgePresets();
  var inp = document.getElementById('nudgeCustomInput');
  if (inp) inp.value = '';
  document.getElementById('nudgeModal').style.display = 'flex';
  if (inp) inp.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); sendCustomNudge(); } };
}
function closeNudge() {
  document.getElementById('nudgeModal').style.display = 'none';
}

// ── Nudge Settings ──────────────────────────────────────────────
function openNudgeSettings() {
  closeNudge();
  renderNudgeSettingsEditor();
  document.getElementById('nudgeSettingsModal').style.display = 'flex';
}
function closeNudgeSettings() {
  document.getElementById('nudgeSettingsModal').style.display = 'none';
  // re-open nudge modal
  renderNudgePresets();
  document.getElementById('nudgeModal').style.display = 'flex';
}

function renderNudgeSettingsEditor() {
  var presets = _loadNudgePresets();
  var list = document.getElementById('nudgeSettingsList');
  if (!list) return;
  list.innerHTML = '';
  presets.forEach(function(p, i) {
    var row = document.createElement('div');
    row.className = 'nse-row' + (p.isAll ? ' nse-first' : '');
    row.dataset.index = i;

    var emojiBtn = document.createElement('button');
    emojiBtn.type = 'button';
    emojiBtn.className = 'nse-emoji';
    emojiBtn.textContent = p.emoji;
    emojiBtn.onclick = function() { openEmojiPicker(emojiBtn); };

    var textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'nse-text';
    textInput.value = p.text;
    textInput.maxLength = 30;
    textInput.placeholder = 'ข้อความ...';

    row.appendChild(emojiBtn);
    row.appendChild(textInput);

    if (!p.isAll) {
      var delBtn = document.createElement('button');
      delBtn.className = 'nse-del';
      delBtn.innerHTML = '✕';
      delBtn.title = 'ลบ';
      delBtn.onclick = (function(r) { return function() { r.remove(); }; })(row);
      row.appendChild(delBtn);
    }

    list.appendChild(row);
  });
  // Clear add-row
  var addEmoji = document.getElementById('nudgeAddEmojiInput');
  var addText  = document.getElementById('nudgeAddTextInput');
  if (addEmoji) addEmoji.textContent = '😊';
  if (addText)  addText.value  = '';
}

function addNudgePresetRow() {
  var emoji = (document.getElementById('nudgeAddEmojiInput').textContent.trim()) || '✨';
  var text  = document.getElementById('nudgeAddTextInput').value.trim();
  if (!text) { showToast('กรุณาพิมพ์ข้อความ'); return; }

  var list = document.getElementById('nudgeSettingsList');
  var row = document.createElement('div');
  row.className = 'nse-row';

  var emojiBtn = document.createElement('button');
  emojiBtn.type = 'button';
  emojiBtn.className = 'nse-emoji';
  emojiBtn.textContent = emoji;
  emojiBtn.onclick = function() { openEmojiPicker(emojiBtn); };

  var textInput = document.createElement('input');
  textInput.type = 'text';
  textInput.className = 'nse-text';
  textInput.value = text;
  textInput.maxLength = 30;

  var delBtn = document.createElement('button');
  delBtn.className = 'nse-del';
  delBtn.innerHTML = '✕';
  delBtn.title = 'ลบ';
  delBtn.onclick = (function(r) { return function() { r.remove(); }; })(row);

  row.appendChild(emojiBtn);
  row.appendChild(textInput);
  row.appendChild(delBtn);
  list.appendChild(row);

  document.getElementById('nudgeAddEmojiInput').textContent = '😊';
  document.getElementById('nudgeAddTextInput').value  = '';
  document.getElementById('nudgeAddTextInput').focus();
}

function saveNudgeSettings() {
  var rows = document.querySelectorAll('#nudgeSettingsList .nse-row');
  var newPresets = [];
  rows.forEach(function(row, i) {
    var emoji = row.querySelector('.nse-emoji').textContent.trim() || '👋';
    var text  = row.querySelector('.nse-text').value.trim();
    if (!text) return;
    var p = { emoji: emoji, text: text };
    if (i === 0) p.isAll = true; // first row always isAll
    newPresets.push(p);
  });
  if (newPresets.length === 0) { showToast('ต้องมีอย่างน้อย 1 ข้อความ'); return; }
  _nudgePresets = newPresets;
  _saveNudgePresetsToStorage();
  showToast('✅ บันทึกข้อความสะกิดแล้ว');
  document.getElementById('nudgeSettingsModal').style.display = 'none';
  renderNudgePresets();
  document.getElementById('nudgeModal').style.display = 'flex';
}

function resetNudgePresets() {
  if (!confirm('รีเซ็ตข้อความสะกิดกลับเป็นค่าเดิม?')) return;
  _nudgePresets = NUDGE_DEFAULTS.map(function(p) { return Object.assign({}, p); });
  _saveNudgePresetsToStorage();
  renderNudgeSettingsEditor();
  showToast('รีเซ็ตแล้ว');
}

// ── Emoji Picker ──────────────────────────────────────────────────
var EMOJI_OPTIONS = [
  '👋','🎤','⏩','⏪','🔉','🔊','🎸','⏭','☕','👏','💃',
  '🎵','🎶','🎹','🥁','🎷','🎺','🪗','🎻','🪘','🎧',
  '🔥','⚡','💥','✨','🌟','❤️','💪','🙏','😎','🤩',
  '😍','🥳','😂','🤣','😱','😤','🤔','👍','👎','🤘',
  '✅','❌','⭐','🏆','🎯','💬','📢','⏰','🔔','🚀',
  '💋','👩','👧','💅','👠','👙','🍺','🍻','🥂','🍷',
  '🍾','🥃','🍸','🌿','🍀','💨','🪴','😏','😜','🫦'
];
var _emojiPickerTarget = null;

function openEmojiPicker(targetEl) {
  _emojiPickerTarget = targetEl;
  targetEl.classList.add('picking');
  var grid = document.getElementById('emojiGrid');
  grid.innerHTML = '';
  EMOJI_OPTIONS.forEach(function(em) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-opt';
    btn.textContent = em;
    btn.onclick = function() { selectEmoji(em); };
    grid.appendChild(btn);
  });
  document.getElementById('emojiPickerOverlay').classList.add('show');
}

function selectEmoji(em) {
  if (_emojiPickerTarget) {
    _emojiPickerTarget.textContent = em;
    _emojiPickerTarget.classList.remove('picking');
  }
  closeEmojiPicker();
}

function closeEmojiPicker() {
  document.getElementById('emojiPickerOverlay').classList.remove('show');
  if (_emojiPickerTarget) _emojiPickerTarget.classList.remove('picking');
  _emojiPickerTarget = null;
}

function sendCustomNudge() {
  var inp = document.getElementById('nudgeCustomInput');
  var text = inp ? inp.value.trim() : '';
  if (!text) { showToast('กรุณาพิมพ์ข้อความ'); return; }
  sendNudge('👋 ' + text);
  inp.value = '';
}

function sendNudge(msg) {
  var myName = localStorage.getItem('userName') || 'สมาชิก';
  broadcastEvent('nudge', { from: myName, msg: msg });
  closeNudge();
  showToast('👋 ส่งสะกิดแล้ว: ' + msg);
}

function receiveNudge(from, msg) {
  // Throttle: ignore if nudge received within 1s
  var now = Date.now();
  if (now - _lastNudgeTime < 1000) return;
  _lastNudgeTime = now;

  // 1) Screen flash (white strobe)
  var flash = document.getElementById('nudgeFlash');
  if (flash) {
    flash.classList.remove('active');
    void flash.offsetWidth; // force reflow
    flash.classList.add('active');
    setTimeout(function() { flash.classList.remove('active'); }, 700);
  }

  // 2) Popup message
  var popup = document.getElementById('nudgePopup');
  var fromEl = document.getElementById('nudgeFrom');
  var msgEl = document.getElementById('nudgeMsg');
  if (popup && fromEl && msgEl) {
    fromEl.textContent = from + ' สะกิดคุณ!';
    msgEl.textContent = msg;
    popup.classList.remove('active');
    void popup.offsetWidth;
    popup.classList.add('active');
    // removed auto-hide; now requires manual tap to dismiss
  }

  // 3) Vibration (pattern: short-pause-short-pause-long)
  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100, 50, 200]);
  }

  // 4) Audio ping
  playNudgeSound();
}

function playNudgeSound() {
  try {
    if (!_nudgeAudioCtx) {
      _nudgeAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    var ctx = _nudgeAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    var t = ctx.currentTime;
    // Two-tone ping: C6 then E6
    var osc1 = ctx.createOscillator();
    var gain1 = ctx.createGain();
    osc1.connect(gain1); gain1.connect(ctx.destination);
    osc1.frequency.value = 1047; // C6
    gain1.gain.setValueAtTime(0.25, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc1.start(t); osc1.stop(t + 0.15);

    var osc2 = ctx.createOscillator();
    var gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.frequency.value = 1319; // E6
    gain2.gain.setValueAtTime(0.25, t + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc2.start(t + 0.12); osc2.stop(t + 0.3);
  } catch(e) { /* no audio support */ }
}

function showInvalidToken() {
  document.getElementById('songList').innerHTML =
    '<div id="emptyState"><div>🔒</div><div>ลิงก์หมดอายุหรือไม่ถูกต้อง</div><div style="font-size:.8rem;color:#555">ขอ QR ใหม่จากสมาชิกในวง</div></div>';
}

// ─── QR CODE / SHARE ──────────────────────────────────────────────
function shareQR() {
  // ถ้า token พร้อมแล้ว → แสดง QR ทันที
  if (_guestLinkToken && _guestLinkToken.token) {
    _renderQR(_guestLinkToken);
    return;
  }
  // ยังไม่มี token → สร้างใหม่ก่อน
  showToast('⏳ กำลังสร้าง QR...');
  apiCall('createGuestToken', { date: _date, venue: _venue, timeSlot: _timeSlot }, function(r) {
    if (r && r.success && r.data) {
      _guestLinkToken = r.data;
      _renderQR(_guestLinkToken);
    } else {
      showToast('⚠️ สร้าง QR ไม่ได้');
    }
  });
}

function _renderQR(tok) {
  var base = location.origin + location.pathname;
  var url  = base + '?guest=1&band=' + encodeURIComponent(_bandId) +
             '&date=' + encodeURIComponent(_date) +
             '&venue=' + encodeURIComponent(_venue) +
             '&timeSlot=' + encodeURIComponent(_timeSlot) +
             '&token=' + encodeURIComponent(tok.token);
  var qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(url);
  document.getElementById('qrCode').src = qrSrc;
  document.getElementById('qrUrl').textContent = url;
  var exp = tok.expiresAt ? new Date(tok.expiresAt) : null;
  document.getElementById('qrExpiry').textContent = exp
    ? '⏱ หมดอายุ: ' + exp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' (' + exp.toLocaleDateString('th-TH') + ')'
    : '✅ ใครสแกนก็เข้าได้ ไม่ต้องสมัคร';
  document.getElementById('qrModal').classList.add('show');
}

function closeQR() {
  document.getElementById('qrModal').classList.remove('show');
}

// ─────────────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
//  CONTEXT MENU (long-press / single-tap on song)
// ─────────────────────────────────────────────────────────────────
function openCtx(idx) {
  _ctxIdx = idx;
  var s = _playlist[idx];
  if (!s) return;
  document.getElementById('ctxTitle').textContent = '🎵 ' + s.name;
  var grid = document.getElementById('ctxGrid');
  var btns = [];

  if (idx !== _current) {
    btns.push({ icon: '▶', label: 'เล่นตอนนี้', action: 'play' });
    btns.push({ icon: '⏭', label: 'ตั้งเป็นถัดไป', action: 'next' });
  }
  if (!s._skipped) {
    btns.push({ icon: '⏩', label: 'Skip', action: 'skip' });
  } else {
    btns.push({ icon: '↩', label: 'ยกเลิก Skip', action: 'unskip' });
  }
  btns.push({ icon: '📝', label: 'เพิ่มโน้ต', action: 'note' });
  btns.push({ icon: '🎹', label: 'แก้คีย์/BPM', action: 'editkeybpm' });
  btns.push({ icon: '🔁', label: 'Encore', action: 'encore' });
  if (s._isRequest) {
    btns.push({ icon: '🙏', label: 'ยกเลิกเพลงขอ', action: 'unrequest' });
  } else {
    btns.push({ icon: '🙏', label: 'ทำเครื่องหมายเป็นเพลงขอ', action: 'request' });
  }
  btns.push({ icon: '', label: 'ลบ', action: 'remove' });

  grid.innerHTML = btns.map(function(b) {
    return '<button class="ctx-btn" data-action="' + b.action + '"><span class="ctx-icon">' + b.icon + '</span>' + b.label + '</button>';
  }).join('') + '<button class="ctx-btn ctx-cancel" data-action="close">ปิด</button>';

  // Attach click handlers via event delegation
  grid.onclick = function(e) {
    var btn = e.target.closest('.ctx-btn');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    if (action === 'close') { closeCtx(); return; }
    ctxAction(action);
  };

  document.getElementById('ctxMenu').classList.add('show');
}

function closeCtx() {
  document.getElementById('ctxMenu').classList.remove('show');
  _ctxIdx = -1;
}

function ctxAction(action) {
  var idx = _ctxIdx;
  closeCtx();
  if (idx < 0 || idx >= _playlist.length) return;
  switch(action) {
    case 'play':   playNow(idx);      break;
    case 'next':   setAsNext(idx);    break;
    case 'skip':   skipSong(idx);     break;
    case 'unskip': _playlist[idx]._skipped = false; _modified = true; broadcastEvent('unskip_song', { idx: idx }); renderSongList(); break;
    case 'note':   openNote(idx);     break;
    case 'editkeybpm': openEditSong(idx); break;
    case 'encore': addEncore(idx);    break;
    case 'request':
      _playlist[idx]._isRequest = true;
      _playlist[idx]._isRequestTime = _nowHHMM();
      _modified = true;
      broadcastEvent('state_sync', getState());
      scheduleStateSync();
      renderSongList();
      showToast('🙏 ทำเครื่องหมายเป็นเพลงขอแล้ว');
      break;
    case 'unrequest':
      _playlist[idx]._isRequest = false;
      _playlist[idx]._isRequestTime = '';
      _modified = true;
      broadcastEvent('state_sync', getState());
      scheduleStateSync();
      renderSongList();
      showToast('✓ ยกเลิกเครื่องหมายเพลงขอแล้ว');
      break;
    case 'remove': removeSongDirect(idx); break;
  }
}

function moveSongUp(e, idx) {
  e.stopPropagation();
  if (idx <= 0) return;
  _doMoveSong(idx, idx - 1);
}
function moveSongDown(e, idx) {
  e.stopPropagation();
  if (idx >= _playlist.length - 1) return;
  _doMoveSong(idx, idx + 1);
}
function _doMoveSong(from, to) {
  var song = _playlist.splice(from, 1)[0];
  _playlist.splice(to, 0, song);
  if (_current === from) _current = to;
  else if (from < to && _current > from && _current <= to) _current--;
  else if (from > to && _current < from && _current >= to) _current++;
  _modified = true;
  normalizePlaylistState();
  renderNowPlaying();
  renderSongList();
  broadcastEvent('reorder', { from: from, to: to });
  scheduleStateSync();
}

function removeSongDirect(idx) {
  var name = _playlist[idx] ? _playlist[idx].name : '';
  if (!confirm('ลบ "' + name + '" ออกจากลิส?')) return;
  if (!removeSongAtIndex(idx)) return;
  _modified = true;
  renderNowPlaying();
  renderSongList();
  broadcastEvent('remove', { idx: idx });
  scheduleStateSync();
  showToast('ลบ "' + name + '" แล้ว');
}

// ─────────────────────────────────────────────────────────────────
//  GESTURE HINTS (first visit only)
// ─────────────────────────────────────────────────────────────────
function showHintsIfFirstTime() {
  try { if (localStorage.getItem('liveHintsSeen') === '1') return; } catch(err) {}
  var el = document.getElementById('gestureHints');
  if (el) el.classList.remove('hidden');
}

function dismissHints(e) {
  if (e) e.stopPropagation();
  try { localStorage.setItem('liveHintsSeen', '1'); } catch(err) {}
  var el = document.getElementById('gestureHints');
  if (el) el.classList.add('hidden');
}

var _toastTimer = null;
function showToast(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2000);
}

function showLastSongBanner() {
  var bw = document.getElementById('breakWarning');
  if (bw) {
    bw.innerHTML = '🎉 เพลงสุดท้ายแล้ว!<br><span style="font-size:.85rem;font-weight:400">กดปุ่ม ✅ จบเบรค เพื่อบันทึกและสรุป</span>';
    bw.classList.add('show');
    setTimeout(function(){ bw.classList.remove('show'); }, 5000);
  }
}