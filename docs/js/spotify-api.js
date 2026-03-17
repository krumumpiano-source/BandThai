/**
 * Spotify Web API Helper — BandThai
 * ────────────────────────────────────────────────
 * ใช้ Client Credentials Flow (ไม่ต้อง user login)
 * เก็บ client_id / client_secret ใน app_config (Supabase)
 *
 * ฟังก์ชันหลัก:
 *   spotifyInit(callback)              — โหลด credentials + token
 *   spotifySearch(name, artist, cb)    — ค้นหาเพลง + audio features
 */
(function() {
  'use strict';
  var _spToken = null;
  var _spTokenExp = 0;
  var _spClientId = '';
  var _spClientSecret = '';
  var _spReady = false;

  // ── Pitch class → key name ──────────────────────────
  var _PITCH = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  function pitchToKey(pitch, mode) {
    if (pitch == null || pitch < 0) return '';
    var note = _PITCH[pitch] || '';
    if (mode === 0) note += 'm';       // minor
    return note;
  }

  // ── Valence → mood ──────────────────────────────────
  var _MOOD_OPTS = ['มัน / สนุก','หวาน / โรแมนติก','เศร้า / อกหัก','นิ่ง / ผ่อนคลาย','ฮึกเหิม / ยิ่งใหญ่'];
  function valenceToMood(valence, energy) {
    if (valence == null) return '';
    if (energy != null && energy > 0.75 && valence > 0.5) return _MOOD_OPTS[0]; // มัน / สนุก
    if (valence >= 0.6) return _MOOD_OPTS[1]; // หวาน / โรแมนติก
    if (valence <= 0.25) return _MOOD_OPTS[2]; // เศร้า / อกหัก
    if (energy != null && energy <= 0.35) return _MOOD_OPTS[3]; // นิ่ง / ผ่อนคลาย
    if (energy != null && energy > 0.7) return _MOOD_OPTS[4]; // ฮึกเหิม
    return _MOOD_OPTS[1]; // default หวาน
  }

  // ── Genre → tag ─────────────────────────────────────
  function genreToTag(genres) {
    var g = (genres || '').toLowerCase();
    if (g.indexOf('pop') !== -1) return 'ป๊อป';
    if (g.indexOf('rock') !== -1) return 'ร็อค';
    if (g.indexOf('hip') !== -1 || g.indexOf('rap') !== -1) return 'ฮิปฮอป';
    if (g.indexOf('dance') !== -1 || g.indexOf('disco') !== -1 || g.indexOf('edm') !== -1 || g.indexOf('electronic') !== -1) return 'ดิสโก้';
    if (g.indexOf('country') !== -1 || g.indexOf('folk') !== -1 || g.indexOf('luk thung') !== -1 || g.indexOf('isan') !== -1 || g.indexOf('thai country') !== -1) return 'ลูกทุ่ง / อีสาน';
    if (g.indexOf('singer') !== -1 || g.indexOf('songwriter') !== -1 || g.indexOf('phleng phuea chiwit') !== -1) return 'เพื่อชีวิต';
    if (g.indexOf('oldies') !== -1 || g.indexOf('classic') !== -1) return 'ป๊อป';
    return 'ป๊อป';
  }

  // ── Year → era ──────────────────────────────────────
  function yearToEra(dateStr) {
    if (!dateStr) return '';
    var y = parseInt(dateStr.substring(0, 4));
    if (!y) return '';
    if (y < 1990) return '80s';
    if (y < 2000) return '90s';
    if (y < 2010) return '2000s';
    if (y < 2020) return '2010s';
    return '2020s';
  }

  // ── Load credentials from app_config ────────────────
  function loadCredentials(callback) {
    if (_spClientId && _spClientSecret) { callback(null); return; }
    if (typeof apiCall !== 'function') { callback('apiCall not available'); return; }
    apiCall('getAppConfig', {}, function(r) {
      if (!r || !r.success) { callback('โหลด config ไม่สำเร็จ'); return; }
      var map = r.map || {};
      _spClientId = map.spotify_client_id || '';
      _spClientSecret = map.spotify_client_secret || '';
      if (!_spClientId || !_spClientSecret) {
        callback('ยังไม่ได้ตั้งค่า Spotify API — ไปที่ตั้งค่าระบบ (App Config) ใส่ spotify_client_id และ spotify_client_secret');
        return;
      }
      callback(null);
    });
  }

  // ── Get token (Client Credentials) ──────────────────
  function getToken(callback) {
    if (_spToken && Date.now() < _spTokenExp - 60000) { callback(null, _spToken); return; }
    var body = 'grant_type=client_credentials';
    var authStr = btoa(_spClientId + ':' + _spClientSecret);
    fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + authStr
      },
      body: body
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) { callback(data.error_description || data.error); return; }
      _spToken = data.access_token;
      _spTokenExp = Date.now() + (data.expires_in || 3600) * 1000;
      callback(null, _spToken);
    })
    .catch(function(err) { callback('Spotify token error: ' + (err.message || err)); });
  }

  // ── Init: load creds + get token ────────────────────
  window.spotifyInit = function(callback) {
    loadCredentials(function(err) {
      if (err) { callback(err); return; }
      getToken(function(err2) {
        if (err2) { callback(err2); return; }
        _spReady = true;
        callback(null);
      });
    });
  };

  // ── Search track + get features ─────────────────────
  window.spotifySearch = function(name, artist, callback) {
    function doSearch(token) {
      var q = encodeURIComponent(((artist || '') + ' ' + name).trim());
      fetch('https://api.spotify.com/v1/search?q=' + q + '&type=track&limit=5&market=TH', {
        headers: { 'Authorization': 'Bearer ' + token }
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.tracks || !data.tracks.items || !data.tracks.items.length) {
          callback(null, 'ไม่พบเพลงนี้ใน Spotify');
          return;
        }
        var t = data.tracks.items[0];
        var trackId = t.id;
        var baseResult = {
          name: t.name || '',
          artist: (t.artists && t.artists[0]) ? t.artists[0].name : '',
          singer: (t.artists && t.artists[0]) ? t.artists[0].name : '',
          era: yearToEra(t.album && t.album.release_date || ''),
          tags: '',
          key: '',
          bpm: null,
          mood: '',
          notes: (t.name || '') + ' — ' + ((t.artists && t.artists[0]) ? t.artists[0].name : '') + (t.album && t.album.release_date ? ' (' + t.album.release_date.substring(0, 4) + ')' : ''),
          trackName: t.name || '',
          genre: '',
          year: t.album && t.album.release_date ? t.album.release_date.substring(0, 4) : '',
          albumArt: t.album && t.album.images && t.album.images.length ? t.album.images[t.album.images.length - 1].url : '',
          previewUrl: t.preview_url || '',
          spotifyUrl: t.external_urls && t.external_urls.spotify || ''
        };

        // Try to get artist genres
        var artistId = (t.artists && t.artists[0]) ? t.artists[0].id : null;
        var genrePromise = artistId
          ? fetch('https://api.spotify.com/v1/artists/' + artistId, { headers: { 'Authorization': 'Bearer ' + token } })
              .then(function(r) { return r.json(); })
              .then(function(a) { return (a.genres || []).join(', '); })
              .catch(function() { return ''; })
          : Promise.resolve('');

        // Try to get audio features (key, BPM, mood)
        var featuresPromise = fetch('https://api.spotify.com/v1/audio-features/' + trackId, {
          headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function(r) { return r.ok ? r.json() : null; })
        .catch(function() { return null; });

        Promise.all([genrePromise, featuresPromise]).then(function(results) {
          var genres = results[0] || '';
          var feat = results[1];
          baseResult.genre = genres;
          baseResult.tags = genreToTag(genres);
          if (feat) {
            baseResult.key = pitchToKey(feat.key, feat.mode);
            baseResult.bpm = feat.tempo ? Math.round(feat.tempo) : null;
            baseResult.mood = valenceToMood(feat.valence, feat.energy);
          }
          callback(baseResult, null);
        });
      })
      .catch(function(err) { callback(null, 'Spotify search error: ' + (err.message || err)); });
    }

    // Ensure we have a token
    if (_spReady && _spToken && Date.now() < _spTokenExp - 60000) {
      doSearch(_spToken);
    } else {
      window.spotifyInit(function(err) {
        if (err) { callback(null, err); return; }
        doSearch(_spToken);
      });
    }
  };

  // ── Expose helpers ──────────────────────────────────
  window.spotifyGenreToTag = genreToTag;
  window.spotifyYearToEra = yearToEra;
  window.spotifyPitchToKey = pitchToKey;
  window.spotifyValenceToMood = valenceToMood;

})();
