/* ═══════════════════════════════════════════════════════════════
     MUSIC GAMES — BandThai
     ═══════════════════════════════════════════════════════════════ */
  (function(){
  'use strict';

  // ── Config ──
  var QUIZ_ROUNDS  = 10;
  var CHORD_ROUNDS = 10;
  var RHYTHM_ROUNDS = 5;
  var BPM_ROUNDS   = 5;
  var QUIZ_TIME    = 15; // seconds
  var CHAIN_TIME   = 15;
  var ALL_KEYS = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B',
                  'Cm','C#m','Dm','Ebm','Em','Fm','F#m','Gm','Abm','Am','Bbm','Bm'];

  // ── State ──
  var _bandId   = localStorage.getItem('bandId') || '';
  var _userId   = localStorage.getItem('userId') || '';
  var _userName = localStorage.getItem('userNickname') || localStorage.getItem('userFirstName') || 'ผู้เล่น';
  var _songs    = [];
  var _gameCh   = null;
  var _online   = {};
  var _currentGame = null;
  var _round = 0, _score = 0;
  var _timer = null, _hintTimer = null;
  var _audioCtx  = null;
  var _myScores  = null; // loaded from localStorage
  var _leaderboard = [];
  var _pendingInvite = null;

  // Quiz/Chord state
  var _qCorrect = null, _qOptions = [], _qAnswered = false, _qStart = 0, _qHintStage = 0;

  // Rhythm state
  var _rhythmBpm = 0, _tapTimes = [], _rhythmPhase = '', _expectedInterval = 0, _rhythmBeats = 5;

  // Chain state
  var _chainChar = '', _chainHistory = [], _chainUsed = {};

  // BPM guess state
  var _bpmActual = 0, _bpmGuessed = false;

  // ── Init ──
  document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
    checkAdGate();
    renderMainNav('mainNav');
    applyTranslations();
    loadMyScores();
    renderLobbyStats();
    waitForSb(function() {
      loadSongs();
      loadLeaderboard();
      initChannel();
    });
  });

  function waitForSb(cb) {
    if (window._sb) { cb(); return; }
    var t = setInterval(function(){ if (window._sb){ clearInterval(t); cb(); } }, 150);
  }

  function getAudio() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  }

  // ── Load Songs ──
  function loadSongs() {
    apiCall('getSongs', { bandId: _bandId }, function(r) {
      if (r && r.success && r.data) _songs = r.data;
    });
  }

  // ── Scores (localStorage + Supabase) ──
  function loadMyScores() {
    try {
      _myScores = JSON.parse(localStorage.getItem('gameScores_' + _bandId)) || {};
    } catch(e) { _myScores = {}; }
    if (!_myScores.pts) _myScores.pts = 0;
    if (!_myScores.quiz)    _myScores.quiz    = { w:0, p:0 };
    if (!_myScores.chord)   _myScores.chord   = { w:0, p:0 };
    if (!_myScores.rhythm)  _myScores.rhythm  = { best:0, p:0 };
    if (!_myScores.chain)   _myScores.chain   = { best:0, p:0 };
    if (!_myScores.bpmguess) _myScores.bpmguess = { w:0, p:0 };
  }

  function saveMyScores() {
    localStorage.setItem('gameScores_' + _bandId, JSON.stringify(_myScores));
  }

  function syncScoresToDb() {
    if (!window._sb || !_bandId || !_userId) return;
    window._sb.from('game_scores').upsert({
      band_id: _bandId,
      user_id: _userId,
      user_name: _userName,
      scores: _myScores,
      total_points: _myScores.pts || 0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'band_id,user_id' }).then(function(res) {
      if (res.error) console.warn('Score sync error:', res.error);
    });
  }

  function addPoints(game, pts) {
    _score += pts;
    _myScores.pts = (_myScores.pts || 0) + pts;
    if (game === 'quiz' || game === 'chord' || game === 'bpmguess') {
      _myScores[game].p++;
      if (pts > 0) _myScores[game].w++;
    }
    document.getElementById('gScore').textContent = _score;
    saveMyScores();
  }

  function loadLeaderboard() {
    if (!window._sb) return;
    window._sb.from('game_scores')
      .select('user_name, total_points, scores')
      .eq('band_id', _bandId)
      .order('total_points', { ascending: false })
      .limit(20)
      .then(function(res) {
        if (res.data) _leaderboard = res.data;
        renderLeaderboard();
      });
  }

  function renderLeaderboard() {
    var el = document.getElementById('leaderboard');
    if (!_leaderboard.length) {
      el.innerHTML = '<div class="lb-empty">ยังไม่มีคะแนน — เล่นเกมส์เลย!</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < _leaderboard.length; i++) {
      var r = _leaderboard[i];
      html += '<div class="lb-row"><div class="lb-rank">' + (i+1) + '</div>'
        + '<div class="lb-name">' + esc(r.user_name || 'ผู้เล่น') + '</div>'
        + '<div class="lb-pts">' + (r.total_points || 0) + ' pts</div></div>';
    }
    el.innerHTML = html;
  }

  function renderLobbyStats() {
    var games = ['quiz','chord','rhythm','chain','bpmguess'];
    games.forEach(function(g) {
      var el = document.getElementById('stats' + g.charAt(0).toUpperCase() + g.slice(1));
      if (!el) return;
      var s = _myScores[g];
      if (!s) return;
      if (g === 'rhythm') {
        el.textContent = s.p ? 'เล่น ' + s.p + ' ครั้ง · Best ' + s.best + '%' : '';
      } else if (g === 'chain') {
        el.textContent = s.p ? 'เล่น ' + s.p + ' ครั้ง · Best ' + s.best : '';
      } else {
        el.textContent = s.p ? 'ถูก ' + s.w + '/' + s.p : '';
      }
    });
  }

  // ── Channel & Presence ──
  function initChannel() {
    if (!window._sb || !_bandId) return;
    _gameCh = window._sb.channel('games-' + _bandId, {
      config: { presence: { key: _userId } }
    });
    _gameCh
      .on('presence', { event: 'sync' }, onPresenceSync)
      .on('broadcast', { event: 'game_ev' }, onGameEvent)
      .subscribe(function(status) {
        if (status === 'SUBSCRIBED') { updatePresence(); }
      });
    window.addEventListener('beforeunload', function() {
      if (_gameCh) _gameCh.untrack();
    });
  }

  function updatePresence() {
    if (!_gameCh) return;
    _gameCh.track({
      userId: _userId,
      name: _userName,
      game: _currentGame,
      score: _score,
      pts: _myScores.pts || 0
    });
  }

  function onPresenceSync() {
    if (!_gameCh) return;
    var state = _gameCh.presenceState();
    _online = {};
    var count = 0;
    Object.keys(state).forEach(function(key) {
      var arr = state[key];
      if (arr && arr.length) {
        var u = arr[0];
        _online[u.userId || key] = u;
        count++;
      }
    });
    document.getElementById('onlineBadge').textContent = '🟢 ' + count + ' คนออนไลน์';
    renderOnlinePlayers();
    renderPlayingBadges();
    renderInGamePlayers();
  }

  function renderOnlinePlayers() {
    var el = document.getElementById('onlineList');
    var html = '';
    Object.keys(_online).forEach(function(uid) {
      var u = _online[uid];
      var gameLabel = u.game ? ' (' + getGameName(u.game) + ')' : '';
      html += '<span class="online-player' + (uid === _userId ? ' is-me' : '') + '">'
        + '<span class="online-dot"></span>' + esc(u.name || 'ผู้เล่น') + gameLabel + '</span>';
    });
    el.innerHTML = html || '<span style="color:var(--premium-text-muted);font-size:var(--text-sm)">ยังไม่มีใครออนไลน์</span>';
  }

  function renderPlayingBadges() {
    var counts = { quiz:0, chord:0, rhythm:0, chain:0, bpmguess:0 };
    Object.keys(_online).forEach(function(uid) {
      var g = _online[uid].game;
      if (g && counts[g] !== undefined) counts[g]++;
    });
    ['quiz','chord','rhythm','chain','bpmguess'].forEach(function(g) {
      var el = document.getElementById('playing' + g.charAt(0).toUpperCase() + g.slice(1));
      if (el) {
        el.textContent = counts[g] + ' กำลังเล่น';
        el.classList.toggle('show', counts[g] > 0);
      }
    });
  }

  function renderInGamePlayers() {
    if (!_currentGame) return;
    var el = document.getElementById('igPlayers');
    var html = '';
    Object.keys(_online).forEach(function(uid) {
      var u = _online[uid];
      if (u.game === _currentGame) {
        html += '<span class="ig-player' + (uid === _userId ? ' is-me' : '') + '">'
          + esc(u.name) + ' ' + (u.score || 0) + 'pts</span>';
      }
    });
    el.innerHTML = html;
  }

  function broadcastEv(type, data) {
    if (!_gameCh) return;
    _gameCh.send({
      type: 'broadcast',
      event: 'game_ev',
      payload: { type: type, data: data, from: _userId, name: _userName, ts: Date.now() }
    });
  }

  function onGameEvent(msg) {
    var p = msg.payload;
    if (!p || p.from === _userId) return;

    if (p.type === 'invite') {
      // Another player invites to play
      _pendingInvite = p.data;
      var toastEl = document.getElementById('inviteToast');
      toastEl.textContent = '🎮 ' + esc(p.name) + ' ชวนเล่น ' + getGameName(p.data.game) + '! แตะเพื่อเข้าร่วม';
      toastEl.classList.add('show');
      setTimeout(function(){ toastEl.classList.remove('show'); _pendingInvite = null; }, 8000);
    }

    if (p.type === 'quiz_q' && _currentGame === 'quiz' && _qAnswered) {
      // Another player shared their question - could add collaborative feature later
    }
  }

  function acceptInvite() {
    if (!_pendingInvite) return;
    document.getElementById('inviteToast').classList.remove('show');
    startGame(_pendingInvite.game);
    _pendingInvite = null;
  }

  // ── Navigation ──
  function getGameName(g) {
    var names = { quiz:'ทายเพลง', chord:'ทายคีย์', rhythm:'จับจังหวะ', chain:'ต่อชื่อเพลง', bpmguess:'ทาย BPM' };
    return names[g] || g;
  }
  function getGameIcon(g) {
    var icons = { quiz:'🎵', chord:'🎹', rhythm:'🥁', chain:'🔤', bpmguess:'🎯' };
    return icons[g] || '🎮';
  }

  window.startGame = function(type) {
    if ((type === 'quiz' || type === 'chord') && _songs.length < 4) {
      showToast('⚠️ ต้องมีเพลงในคลังอย่างน้อย 4 เพลง');
      return;
    }
    if (type === 'chord') {
      var withKey = _songs.filter(function(s){ return s.key; });
      if (withKey.length < 4) {
        showToast('⚠️ ต้องมีเพลงที่มีข้อมูลคีย์อย่างน้อย 4 เพลง');
        return;
      }
    }
    _currentGame = type;
    _round = 0;
    _score = 0;
    clearTimers();
    document.getElementById('gTitle').textContent = getGameIcon(type) + ' ' + getGameName(type);
    document.getElementById('gScore').textContent = '0';
    document.getElementById('gameLobby').style.display = 'none';
    document.getElementById('gamePanel').style.display = '';
    updatePresence();
    broadcastEv('invite', { game: type });
    nextRound();
  };

  window.exitGame = function() {
    clearTimers();
    // Save & sync scores at end of game
    saveMyScores();
    syncScoresToDb();
    _currentGame = null;
    _round = 0; _score = 0;
    document.getElementById('gameLobby').style.display = '';
    document.getElementById('gamePanel').style.display = 'none';
    updatePresence();
    loadLeaderboard();
    renderLobbyStats();
  };

  function clearTimers() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    if (_hintTimer) { clearInterval(_hintTimer); _hintTimer = null; }
  }

  function nextRound() {
    if (_currentGame === 'quiz')     return quizRound();
    if (_currentGame === 'chord')    return chordRound();
    if (_currentGame === 'rhythm')   return rhythmRound();
    if (_currentGame === 'chain')    return chainInit();
    if (_currentGame === 'bpmguess') return bpmRound();
  }

  function updateTimer(seconds, total) {
    var pct = Math.max(0, (seconds / total) * 100);
    var fill = document.getElementById('timerFill');
    fill.style.transform = 'scaleX(' + (pct / 100) + ')';
    fill.classList.toggle('urgent', seconds <= 3);
  }

  function showGameOver() {
    clearTimers();
    // Update per-game stats
    if (_currentGame === 'rhythm') {
      _myScores.rhythm.p++;
    } else if (_currentGame === 'chain') {
      _myScores.chain.p++;
      if (_chainHistory.length > (_myScores.chain.best || 0)) _myScores.chain.best = _chainHistory.length;
    }
    saveMyScores();
    syncScoresToDb();
    updatePresence();

    var gc = document.getElementById('gameContent');
    gc.innerHTML = '<div class="game-over">'
      + '<h2>🎉 จบเกม!</h2>'
      + '<div class="final-score">' + _score + '</div>'
      + '<div class="final-label">คะแนนรวม</div>'
      + '<div class="game-over-btns">'
      + '<button class="btn btn-primary" onclick="startGame(\'' + _currentGame + '\')">🔄 เล่นอีกครั้ง</button>'
      + '<button class="btn btn-secondary" onclick="exitGame()">← กลับหน้าหลัก</button>'
      + '</div></div>';
  }

  // ─────────────────────────────────────────────
  // GAME 1: SONG QUIZ (ทายเพลง)
  // ─────────────────────────────────────────────
  function quizRound() {
    _round++;
    if (_round > QUIZ_ROUNDS) return showGameOver();
    document.getElementById('gRound').textContent = 'ข้อ ' + _round + '/' + QUIZ_ROUNDS;

    var pool = shuffle(_songs.slice());
    _qCorrect = pool[0];
    _qOptions = shuffle(pool.slice(0, 4));
    _qAnswered = false;
    _qStart = Date.now();
    _qHintStage = 0;

    renderQuiz();

    // Progressive hints every 4 seconds
    _hintTimer = setInterval(function() {
      _qHintStage++;
      renderQuizHints();
      if (_qHintStage >= 3) clearInterval(_hintTimer);
    }, 4000);

    // Countdown
    var sec = QUIZ_TIME;
    updateTimer(sec, QUIZ_TIME);
    _timer = setInterval(function() {
      sec--;
      updateTimer(sec, QUIZ_TIME);
      if (sec <= 0) { clearTimers(); quizTimeout(); }
    }, 1000);
  }

  function renderQuiz() {
    var gc = document.getElementById('gameContent');
    gc.innerHTML = '<div class="q-question">เพลงนี้คืออะไร? 🤔</div>'
      + '<div class="q-hint" id="quizHints"></div>'
      + '<div id="quizResult"></div>'
      + '<div class="q-options" id="quizOpts"></div>';
    renderQuizHints();
    renderQuizOptions();
  }

  function renderQuizHints() {
    var el = document.getElementById('quizHints');
    if (!el) return;
    var html = '';
    var s = _qCorrect;
    var name = s.name || '';
    // Stage 0: artist (most useful first clue)
    if (s.artist) html += '<span>ศิลปิน: ' + esc(s.artist) + '</span>';
    // Stage 1: first 2 chars of song name
    if (_qHintStage >= 1) {
      html += '<span>เริ่มด้วย: ' + esc(name.substring(0, 2)) + '...</span>';
    }
    // Stage 2: BPM + Key
    if (_qHintStage >= 2) {
      if (s.bpm) html += '<span>BPM: ' + s.bpm + '</span>';
      if (s.key) html += '<span>คีย์: ' + esc(s.key) + '</span>';
    }
    // Stage 3: half the song name
    if (_qHintStage >= 3) {
      var half = Math.ceil(name.length / 2);
      html += '<span>' + esc(name.substring(0, half)) + '...</span>';
    }
    if (!html) html = '<span>🤔 ลองเดาดู!</span>';
    el.innerHTML = html;
  }

  function renderQuizOptions() {
    var el = document.getElementById('quizOpts');
    var html = '';
    _qOptions.forEach(function(s, i) {
      html += '<div class="q-opt" data-idx="' + i + '" onclick="quizAnswer(' + i + ')">'
        + esc(s.name || 'ไม่ทราบชื่อ') + '</div>';
    });
    el.innerHTML = html;
  }

  window.quizAnswer = function(idx) {
    if (_qAnswered) return;
    _qAnswered = true;
    clearTimers();
    var chosen = _qOptions[idx];
    var isCorrect = (chosen.name === _qCorrect.name);
    var elapsed = (Date.now() - _qStart) / 1000;
    var pts = 0;

    // Color options
    var opts = document.querySelectorAll('#quizOpts .q-opt');
    opts.forEach(function(el, i) {
      el.classList.add('disabled');
      if (_qOptions[i].name === _qCorrect.name) el.classList.add('correct');
      if (i === idx && !isCorrect) el.classList.add('wrong');
    });

    if (isCorrect) {
      pts = 10;
      if (elapsed < 3) pts += 5;
      else if (elapsed < 6) pts += 3;
      else if (elapsed < 10) pts += 1;
    }
    addPoints('quiz', pts);

    var resEl = document.getElementById('quizResult');
    resEl.innerHTML = '<div class="result-flash ' + (isCorrect ? 'correct' : 'wrong') + '">'
      + (isCorrect ? '✅ ถูกต้อง! +' + pts + ' คะแนน' : '❌ ผิด! คำตอบคือ ' + esc(_qCorrect.name))
      + '</div>';

    setTimeout(function() { quizRound(); }, 2000);
  };

  function quizTimeout() {
    if (_qAnswered) return;
    _qAnswered = true;
    var opts = document.querySelectorAll('#quizOpts .q-opt');
    opts.forEach(function(el, i) {
      el.classList.add('disabled');
      if (_qOptions[i].name === _qCorrect.name) el.classList.add('correct');
    });
    addPoints('quiz', 0);
    var resEl = document.getElementById('quizResult');
    resEl.innerHTML = '<div class="result-flash wrong">⏰ หมดเวลา! คำตอบคือ ' + esc(_qCorrect.name) + '</div>';
    setTimeout(function() { quizRound(); }, 2000);
  }

  // ─────────────────────────────────────────────
  // GAME 2: CHORD CHALLENGE (ทายคีย์)
  // ─────────────────────────────────────────────
  function chordRound() {
    _round++;
    if (_round > CHORD_ROUNDS) return showGameOver();
    document.getElementById('gRound').textContent = 'ข้อ ' + _round + '/' + CHORD_ROUNDS;

    var withKey = _songs.filter(function(s) { return s.key; });
    var pool = shuffle(withKey);
    _qCorrect = pool[0];
    _qAnswered = false;
    _qStart = Date.now();

    // Generate 4 key options (1 correct + 3 random)
    var correctKey = (_qCorrect.key || '').trim();
    var wrongKeys = shuffle(ALL_KEYS.filter(function(k) { return k !== correctKey; })).slice(0, 3);
    _qOptions = shuffle([correctKey].concat(wrongKeys));

    renderChord();

    var sec = QUIZ_TIME;
    updateTimer(sec, QUIZ_TIME);
    _timer = setInterval(function() {
      sec--;
      updateTimer(sec, QUIZ_TIME);
      if (sec <= 0) { clearTimers(); chordTimeout(); }
    }, 1000);
  }

  function renderChord() {
    var gc = document.getElementById('gameContent');
    gc.innerHTML = '<div class="q-question">🎵 ' + esc(_qCorrect.name) + '</div>'
      + '<div class="q-hint"><span>เพลงนี้อยู่คีย์อะไร?</span>'
      + (_qCorrect.artist ? '<br><span style="font-size:var(--text-xs)">ศิลปิน: ' + esc(_qCorrect.artist) + '</span>' : '')
      + '</div>'
      + '<div id="chordResult"></div>'
      + '<div class="q-options" id="chordOpts"></div>';
    var el = document.getElementById('chordOpts');
    var html = '';
    _qOptions.forEach(function(k, i) {
      html += '<div class="q-opt" onclick="chordAnswer(' + i + ')">' + esc(k) + '</div>';
    });
    el.innerHTML = html;
  }

  window.chordAnswer = function(idx) {
    if (_qAnswered) return;
    _qAnswered = true;
    clearTimers();
    var chosen = _qOptions[idx];
    var correctKey = (_qCorrect.key || '').trim();
    var isCorrect = (chosen === correctKey);
    var elapsed = (Date.now() - _qStart) / 1000;
    var pts = 0;

    var opts = document.querySelectorAll('#chordOpts .q-opt');
    opts.forEach(function(el, i) {
      el.classList.add('disabled');
      if (_qOptions[i] === correctKey) el.classList.add('correct');
      if (i === idx && !isCorrect) el.classList.add('wrong');
    });

    if (isCorrect) {
      pts = 10;
      if (elapsed < 3) pts += 5;
      else if (elapsed < 6) pts += 3;
      else if (elapsed < 10) pts += 1;
    }
    addPoints('chord', pts);

    var resEl = document.getElementById('chordResult');
    resEl.innerHTML = '<div class="result-flash ' + (isCorrect ? 'correct' : 'wrong') + '">'
      + (isCorrect ? '✅ ถูกต้อง! +' + pts + ' คะแนน' : '❌ ผิด! คำตอบคือ ' + esc(correctKey))
      + '</div>';
    setTimeout(function() { chordRound(); }, 2000);
  };

  function chordTimeout() {
    if (_qAnswered) return;
    _qAnswered = true;
    var correctKey = (_qCorrect.key || '').trim();
    var opts = document.querySelectorAll('#chordOpts .q-opt');
    opts.forEach(function(el, i) {
      el.classList.add('disabled');
      if (_qOptions[i] === correctKey) el.classList.add('correct');
    });
    addPoints('chord', 0);
    document.getElementById('chordResult').innerHTML =
      '<div class="result-flash wrong">⏰ หมดเวลา! คำตอบคือ ' + esc(correctKey) + '</div>';
    setTimeout(function() { chordRound(); }, 2000);
  }

  // ─────────────────────────────────────────────
  // GAME 3: RHYTHM TAP (จับจังหวะ)
  // ─────────────────────────────────────────────
  var RHYTHM_BPMS = [80, 100, 120, 140, 160];

  function rhythmRound() {
    _round++;
    if (_round > RHYTHM_ROUNDS) return showGameOver();
    document.getElementById('gRound').textContent = 'รอบ ' + _round + '/' + RHYTHM_ROUNDS;
    updateTimer(1, 1);

    _rhythmBpm = RHYTHM_BPMS[_round - 1] || 120;
    _expectedInterval = 60000 / _rhythmBpm;
    _tapTimes = [];
    _rhythmPhase = 'listen';

    var gc = document.getElementById('gameContent');
    gc.innerHTML = '<div class="tap-area">'
      + '<div class="tap-status" id="tapStatus">🔊 ฟังจังหวะ... (' + _rhythmBpm + ' BPM)</div>'
      + '<div class="tap-beats" id="tapBeats"></div>'
      + '<button class="tap-btn listening" id="tapBtn" onclick="onTap()">ฟัง...</button>'
      + '<div id="tapResult"></div>'
      + '</div>';

    renderTapDots(_rhythmBeats);

    // Play metronome for listening
    playMetronome(_rhythmBpm, 4, function() {
      // After listening, switch to tap phase
      _rhythmPhase = 'tap';
      document.getElementById('tapStatus').textContent = '🥁 เคาะตามจังหวะ! (' + _rhythmBeats + ' ครั้ง)';
      var btn = document.getElementById('tapBtn');
      btn.className = 'tap-btn';
      btn.textContent = 'TAP';
      renderTapDots(_rhythmBeats);
    });
  }

  function renderTapDots(total) {
    var el = document.getElementById('tapBeats');
    if (!el) return;
    var html = '';
    for (var i = 0; i < total; i++) {
      var cls = 'tap-dot';
      if (i < _tapTimes.length) cls += ' hit';
      html += '<div class="' + cls + '"></div>';
    }
    el.innerHTML = html;
  }

  window.onTap = function() {
    if (_rhythmPhase !== 'tap') return;
    getAudio(); // ensure audio context is active
    _tapTimes.push(Date.now());
    renderTapDots(_rhythmBeats);

    // Play a subtle tap sound
    playTapSound();

    if (_tapTimes.length >= _rhythmBeats) {
      _rhythmPhase = 'done';
      calculateRhythm();
    }
  };

  function calculateRhythm() {
    if (_tapTimes.length < 2) {
      document.getElementById('tapResult').innerHTML =
        '<div class="result-flash wrong">ต้องเคาะอย่างน้อย 2 ครั้ง</div>';
      setTimeout(rhythmRound, 2000);
      return;
    }
    var intervals = [];
    for (var i = 1; i < _tapTimes.length; i++) {
      intervals.push(_tapTimes[i] - _tapTimes[i - 1]);
    }
    var avgInterval = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
    var deviation = Math.abs(avgInterval - _expectedInterval);
    var accuracy = Math.max(0, Math.round(100 - (deviation / _expectedInterval * 100)));

    var pts = 0;
    if (accuracy >= 90) pts = 15;
    else if (accuracy >= 75) pts = 10;
    else if (accuracy >= 60) pts = 7;
    else if (accuracy >= 40) pts = 3;

    addPoints('rhythm', pts);
    if (accuracy > (_myScores.rhythm.best || 0)) _myScores.rhythm.best = accuracy;
    saveMyScores();

    var grade = accuracy >= 90 ? '🌟 Perfect!' : accuracy >= 75 ? '👍 Great!' : accuracy >= 60 ? '😊 Good' : '😅 พยายามอีก!';
    document.getElementById('tapResult').innerHTML =
      '<div class="tap-accuracy">' + accuracy + '%</div>'
      + '<div class="result-flash ' + (pts > 0 ? 'correct' : 'wrong') + '">'
      + grade + ' +' + pts + ' คะแนน</div>';
    document.getElementById('tapBtn').style.display = 'none';
    setTimeout(function() { rhythmRound(); }, 2500);
  }

  function playMetronome(bpm, beats, callback) {
    var ctx = getAudio();
    var interval = 60 / bpm;
    for (var i = 0; i < beats; i++) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = (i === 0) ? 1200 : 800;
      gain.gain.setValueAtTime(0.5, ctx.currentTime + i * interval);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * interval + 0.08);
      osc.start(ctx.currentTime + i * interval);
      osc.stop(ctx.currentTime + i * interval + 0.1);
    }
    if (callback) setTimeout(callback, (beats * interval + 0.5) * 1000);
  }

  function playTapSound() {
    var ctx = getAudio();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  }

  // ─────────────────────────────────────────────
  // GAME 4: SONG CHAIN (ต่อชื่อเพลง)
  // ─────────────────────────────────────────────
  function chainInit() {
    _round = 0;
    document.getElementById('gRound').textContent = 'ต่อให้ได้มากที่สุด!';
    _chainHistory = [];
    _chainUsed = {};
    // Pick a random starting character (Thai consonant)
    var consonants = 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ';
    _chainChar = consonants.charAt(Math.floor(Math.random() * consonants.length));
    renderChain();
    startChainTimer();
  }

  function renderChain() {
    var gc = document.getElementById('gameContent');
    var html = '<div class="chain-display">'
      + '<div class="chain-char" id="chainCharDisplay">' + _chainChar + '</div>'
      + '<div class="chain-char-label">พิมพ์ชื่อเพลงที่ขึ้นต้นด้วยตัวนี้</div>'
      + '</div>'
      + '<div class="chain-input-wrap">'
      + '<input class="chain-input" id="chainInput" placeholder="พิมพ์ชื่อเพลง..." autocomplete="off" onkeydown="if(event.key===\'Enter\')chainSubmit()">'
      + '<button class="chain-submit" onclick="chainSubmit()">ส่ง</button>'
      + '</div>'
      + '<div class="chain-stats" id="chainStats">ต่อได้ ' + _chainHistory.length + ' เพลง</div>'
      + '<div class="chain-history" id="chainHistoryList"></div>';
    gc.innerHTML = html;
    setTimeout(function() {
      var inp = document.getElementById('chainInput');
      if (inp) inp.focus();
    }, 200);
    renderChainHistory();
  }

  function renderChainHistory() {
    var el = document.getElementById('chainHistoryList');
    if (!el) return;
    var html = '';
    for (var i = _chainHistory.length - 1; i >= 0; i--) {
      html += '<div class="chain-item"><span class="chain-num">#' + (i + 1) + '</span>' + esc(_chainHistory[i]) + '</div>';
    }
    el.innerHTML = html;
  }

  var _chainTimerSec = 0;
  function startChainTimer() {
    clearTimers();
    _chainTimerSec = CHAIN_TIME;
    updateTimer(_chainTimerSec, CHAIN_TIME);
    _timer = setInterval(function() {
      _chainTimerSec--;
      updateTimer(_chainTimerSec, CHAIN_TIME);
      if (_chainTimerSec <= 0) { clearTimers(); chainGameOver(); }
    }, 1000);
  }

  window.chainSubmit = function() {
    var inp = document.getElementById('chainInput');
    var val = (inp.value || '').trim();
    if (!val) return;

    // Validate: must start with the required character
    var firstConsonant = getFirstConsonant(val);
    if (firstConsonant !== _chainChar && val.charAt(0) !== _chainChar) {
      showToast('❌ ต้องขึ้นต้นด้วย "' + _chainChar + '"');
      return;
    }

    // Check duplicate
    var lower = val.toLowerCase();
    if (_chainUsed[lower]) {
      showToast('❌ ใช้ชื่อนี้ไปแล้ว!');
      return;
    }

    // Accept!
    _chainUsed[lower] = true;
    _chainHistory.push(val);
    _round = _chainHistory.length;

    var pts = 5;
    // Bonus if song is in library
    var inLib = _songs.some(function(s) { return (s.name || '').toLowerCase() === lower; });
    if (inLib) pts += 3;
    addPoints('chain', pts);

    // Get next chain char
    _chainChar = getLastConsonant(val);

    // Broadcast for multiplayer visibility
    broadcastEv('chain_play', { song: val, next: _chainChar, count: _chainHistory.length });

    // Reset timer and re-render
    var statsEl = document.getElementById('chainStats');
    if (statsEl) statsEl.textContent = 'ต่อได้ ' + _chainHistory.length + ' เพลง' + (inLib ? ' 🎵 อยู่ในคลัง +3!' : '');
    var charEl = document.getElementById('chainCharDisplay');
    if (charEl) charEl.textContent = _chainChar;
    inp.value = '';
    inp.focus();
    renderChainHistory();
    startChainTimer();
  };

  function chainGameOver() {
    clearTimers();
    _round = _chainHistory.length;
    // Check best
    if (_chainHistory.length > (_myScores.chain.best || 0)) {
      _myScores.chain.best = _chainHistory.length;
    }
    showGameOver();
  }

  function getFirstConsonant(str) {
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0x0E01 && c <= 0x0E2E) return str.charAt(i);
    }
    return str.charAt(0);
  }

  function getLastConsonant(str) {
    str = str.trim();
    for (var i = str.length - 1; i >= 0; i--) {
      var c = str.charCodeAt(i);
      if (c >= 0x0E01 && c <= 0x0E2E) return str.charAt(i);
    }
    // Fallback for non-Thai
    for (var j = str.length - 1; j >= 0; j--) {
      if (/[a-zA-Z]/.test(str.charAt(j))) return str.charAt(j).toUpperCase();
    }
    return str.charAt(str.length - 1);
  }

  // ─────────────────────────────────────────────
  // GAME 5: GUESS BPM (ทาย BPM)
  // ─────────────────────────────────────────────
  function bpmRound() {
    _round++;
    if (_round > BPM_ROUNDS) return showGameOver();
    document.getElementById('gRound').textContent = 'ข้อ ' + _round + '/' + BPM_ROUNDS;
    updateTimer(1, 1);

    _bpmActual = 60 + Math.floor(Math.random() * 141); // 60-200
    _bpmGuessed = false;

    var gc = document.getElementById('gameContent');
    gc.innerHTML = '<div class="bpm-guess-area">'
      + '<div class="q-question">ฟังแล้วทาย BPM!</div>'
      + '<button class="bpm-play-btn" id="bpmPlayBtn" onclick="playBpmSample()">🔊 เล่นจังหวะ</button>'
      + '<div class="bpm-input-wrap" id="bpmInputWrap" style="display:none">'
      + '<input class="bpm-guess-input" id="bpmGuessInput" type="number" min="40" max="250" placeholder="BPM" onkeydown="if(event.key===\'Enter\')submitBpmGuess()">'
      + '<button class="bpm-guess-submit" onclick="submitBpmGuess()">ตอบ</button>'
      + '</div>'
      + '<div class="bpm-guess-label" id="bpmGuessLabel">กดเพื่อฟังจังหวะก่อน</div>'
      + '<div id="bpmGuessResult"></div>'
      + '</div>';
  }

  window.playBpmSample = function() {
    var btn = document.getElementById('bpmPlayBtn');
    btn.classList.add('playing');
    btn.textContent = '🔊 กำลังเล่น...';

    playMetronome(_bpmActual, 6, function() {
      btn.classList.remove('playing');
      btn.textContent = '🔊 เล่นอีกครั้ง';
      document.getElementById('bpmInputWrap').style.display = 'flex';
      document.getElementById('bpmGuessLabel').textContent = 'พิมพ์คำตอบ BPM ที่คุณคิด';
      var inp = document.getElementById('bpmGuessInput');
      if (inp) inp.focus();
    });
  };

  window.submitBpmGuess = function() {
    if (_bpmGuessed) return;
    var inp = document.getElementById('bpmGuessInput');
    var guess = parseInt(inp.value, 10);
    if (!guess || guess < 20 || guess > 300) {
      showToast('⚠️ ใส่ค่า BPM ระหว่าง 20-300');
      return;
    }
    _bpmGuessed = true;

    var diff = Math.abs(guess - _bpmActual);
    var pts = 0;
    var grade = '';
    if (diff === 0)      { pts = 15; grade = '🌟 เป๊ะเลย!'; }
    else if (diff <= 3)  { pts = 12; grade = '🎯 เกือบเป๊ะ!'; }
    else if (diff <= 5)  { pts = 8; grade = '👍 ใกล้มาก!'; }
    else if (diff <= 10) { pts = 5; grade = '😊 พอใช้ได้'; }
    else if (diff <= 20) { pts = 2; grade = '😅 อีกนิด...'; }
    else                 { pts = 0; grade = '❌ ห่างไกล'; }

    addPoints('bpmguess', pts);

    document.getElementById('bpmGuessResult').innerHTML =
      '<div class="result-flash ' + (pts > 5 ? 'correct' : 'wrong') + '">'
      + grade + '<br>คำตอบจริง: <strong>' + _bpmActual + ' BPM</strong> (คุณตอบ ' + guess + ')<br>+' + pts + ' คะแนน'
      + '</div>';
    document.getElementById('bpmInputWrap').style.display = 'none';

    setTimeout(function() { bpmRound(); }, 2500);
  };

  // ─────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show';
    setTimeout(function() { t.className = 'toast'; }, 3000);
  }

  })();