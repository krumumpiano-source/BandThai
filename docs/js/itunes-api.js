/**
 * iTunes Search API Helper — BandThai
 * ────────────────────────────────────────────────
 * ใช้ iTunes Search API (ฟรี ไม่ต้อง API key)
 *
 * ฟังก์ชันหลัก:
 *   itunesSearch(name, artist, cb)  — ค้นหาเพลง + map ค่าตาม dropdown ของระบบ
 */
(function() {
  'use strict';

  // ── Helper to bypass CORS/429 for iTunes API ──────────
  function fetchItunes(url) {
    return fetch(url).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function(e) {
      console.warn('iTunes fetch failed (CORS/429), trying proxy...', e);
      var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
      return fetch(proxyUrl).then(function(r) {
        if (!r.ok) throw new Error('Proxy HTTP ' + r.status);
        return r.json();
      });
    });
  }

  // ── Genre → tag (ต้องตรงกับ _GENRE_OPTS ของระบบ) ────
  function genreToTag(genre) {
    var g = (genre || '').toLowerCase();
    if (g.indexOf('rock') !== -1 || g.indexOf('metal') !== -1 || g.indexOf('punk') !== -1 || g.indexOf('ร็อ') !== -1 || g.indexOf('เมทัล') !== -1 || g.indexOf('พังก์') !== -1) return 'ร็อค';
    if (g.indexOf('hip') !== -1 || g.indexOf('rap') !== -1 || g.indexOf('ฮิปฮอป') !== -1 || g.indexOf('แร็พ') !== -1 || g.indexOf('แร๊พ') !== -1) return 'แร๊ฟ/ฮิปฮอป';
    if (g.indexOf('dance') !== -1 || g.indexOf('disco') !== -1 || g.indexOf('edm') !== -1 || g.indexOf('electronic') !== -1 || g.indexOf('house') !== -1 || g.indexOf('techno') !== -1 || g.indexOf('แดนซ์') !== -1 || g.indexOf('ดิสโก') !== -1 || g.indexOf('อิเล็กทรอนิก') !== -1) return 'ดิสโก้';
    if (g.indexOf('r&b') !== -1 || g.indexOf('soul') !== -1 || g.indexOf('rnb') !== -1 || g.indexOf('อาร์แอนด์บี') !== -1 || g.indexOf('โซล') !== -1) return 'อาร์แอนด์บี';
    if (g.indexOf('jazz') !== -1 || g.indexOf('blues') !== -1 || g.indexOf('แจ๊ส') !== -1 || g.indexOf('บลูส์') !== -1) return 'แจ๊ส / บลูส์';
    if (g.indexOf('reggae') !== -1 || g.indexOf('ska') !== -1 || g.indexOf('เรกเก') !== -1 || g.indexOf('สกา') !== -1) return 'เรกเก้';
    if (g.indexOf('indie') !== -1 || g.indexOf('alternative') !== -1 || g.indexOf('อินดี') !== -1 || g.indexOf('ออลเทอร์') !== -1) return 'อินดี้';
    if (g.indexOf('country') !== -1 || g.indexOf('luk thung') !== -1 || g.indexOf('isan') !== -1 || g.indexOf('คันทรี') !== -1 || g.indexOf('ลูกทุ่ง') !== -1 || g.indexOf('อีสาน') !== -1 || g.indexOf('หมอลำ') !== -1) return 'ลูกทุ่ง / อีสาน';
    if (g.indexOf('singer') !== -1 || g.indexOf('songwriter') !== -1 || g.indexOf('เพื่อชีวิต') !== -1 || g.indexOf('folk') !== -1 || g.indexOf('โฟล์ก') !== -1) return 'เพื่อชีวิต';
    if (g.indexOf('oldies') !== -1 || g.indexOf('classic') !== -1 || g.indexOf('คลาสสิก') !== -1) return 'ป๊อป';
    if (g.indexOf('thai') !== -1 || g.indexOf('t-pop') !== -1 || g.indexOf('ไทย') !== -1 || g.indexOf('ที-ป็อป') !== -1) return 'ป๊อป';
    if (g.indexOf('pop') !== -1 || g.indexOf('ป็อป') !== -1 || g.indexOf('ป๊อป') !== -1) return 'ป๊อป';
    if (g.indexOf('world') !== -1 || g.indexOf('asia') !== -1 || g.indexOf('latin') !== -1 || g.indexOf('เวิลด์') !== -1 || g.indexOf('เอเชีย') !== -1 || g.indexOf('ละติน') !== -1) return 'ป๊อป';
    return 'ป๊อป';
  }

  // ── Year → era (ต้องตรงกับ _ERA_OPTS: 80s,90s,2000s,2010s,2020s) ──
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

  // ── Best match by artist name ─────────────────────────
  function hasThai(s) { return /[\u0E00-\u0E7F]/.test(s || ''); }
  function normalizeStr(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]/g, '');
  }
  function artistScore(result, inputArtist) {
    if (!inputArtist) return 0;
    var a = normalizeStr(result.artistName);
    var b = normalizeStr(inputArtist);
    if (!a || !b) return 0;
    if (a === b) return 100;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return 80;
    // partial word overlap
    var aw = a.split(/\s+/), bw = b.split(/\s+/), match = 0;
    for (var i = 0; i < bw.length; i++) {
      for (var j = 0; j < aw.length; j++) {
        if (aw[j].indexOf(bw[i]) !== -1 || bw[i].indexOf(aw[j]) !== -1) { match++; break; }
      }
    }
    return match > 0 ? (match / bw.length) * 60 : 0;
  }

  // ── Song name similarity score ──────────────────────
  function nameScore(result, inputName) {
    if (!inputName) return 0;
    var a = normalizeStr(result.trackName);
    var b = normalizeStr(inputName);
    if (!a || !b) return 0;
    if (a === b) return 100;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return 80;
    // Check digit+word overlap (e.g. "7นาที" vs "7 นาที")
    var aw = a.replace(/(\d+)/g, ' $1 ').trim().split(/\s+/);
    var bw = b.replace(/(\d+)/g, ' $1 ').trim().split(/\s+/);
    var match = 0;
    for (var i = 0; i < bw.length; i++) {
      for (var j = 0; j < aw.length; j++) {
        if (aw[j] === bw[i]) { match++; break; }
      }
    }
    return bw.length > 0 ? (match / bw.length) * 60 : 0;
  }

  // ── Combined score: name is weighted higher than artist ──
  function combinedScore(result, inputName, inputArtist) {
    var ns = nameScore(result, inputName);
    var as = artistScore(result, inputArtist);
    // Name match is most important (70%), artist is secondary (30%)
    return ns * 0.7 + as * 0.3;
  }

  function mapResult(t) {
    return {
      name:      t.trackName || '',
      artist:    t.artistName || '',
      singer:    '',
      nationality: (hasThai(t.trackName) || hasThai(t.artistName)) ? 'ไทย' : 'สากล',
      key:       '',
      bpm:       null,
      mood:      '',
      era:       yearToEra(t.releaseDate || ''),
      tags:      genreToTag(t.primaryGenreName || ''),
      notes:     (t.trackName || '') + ' — ' + (t.artistName || '')
                 + (t.releaseDate ? ' (' + t.releaseDate.substring(0, 4) + ')' : ''),
      trackName: t.trackName || '',
      genre:     t.primaryGenreName || '',
      year:      t.releaseDate ? t.releaseDate.substring(0, 4) : '',
      albumArt:  (t.artworkUrl100 || '').replace('100x100', '300x300'),
      previewUrl: t.previewUrl || '',
      itunesUrl: t.trackViewUrl || ''
    };
  }

  // ── Search iTunes ─────────────────────────────────────
  window.itunesSearch = function(name, artist, callback) {
    var term = ((artist || '') + ' ' + name).trim();
    if (!term) { callback(null, 'กรุณาระบุชื่อเพลง'); return; }
    var url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(term)
            + '&country=TH&media=music&limit=10' + (hasThai(term) ? '&lang=th_th' : '');

    fetchItunes(url)
      .then(function(data) {
        if (!data.results || !data.results.length) {
          // Retry with song name only if combined search fails
          if (artist && name) {
            var url2 = 'https://itunes.apple.com/search?term=' + encodeURIComponent(name)
                     + '&country=TH&media=music&limit=10' + (hasThai(name) ? '&lang=th_th' : '');
            return fetchItunes(url2);
          }
          callback(null, 'ไม่พบเพลงนี้ใน iTunes');
          return;
        }
        return data;
      })
      .then(function(data) {
        if (!data || !data.results || !data.results.length) {
          if (data !== undefined) callback(null, 'ไม่พบเพลงนี้ใน iTunes');
          return;
        }
        // Pick best match by combined name + artist score
        var best = data.results[0], bestScore = -1;
        for (var i = 0; i < data.results.length; i++) {
          var sc = combinedScore(data.results[i], name, artist);
          if (sc > bestScore) { bestScore = sc; best = data.results[i]; }
        }
        // If song name doesn't match at all → likely wrong result
        if (nameScore(best, name) === 0) {
          callback(null, 'ไม่พบเพลง "' + name + '" ใน iTunes (พบเฉพาะเพลงอื่น)');
          return;
        }
        var result = mapResult(best);
        // If original artist is Thai but iTunes returns Latin name → keep Thai
        if (artist && hasThai(artist) && !hasThai(result.artist)) {
          result.artist = artist;
        }
        callback(result, null);
      })
      .catch(function(err) { callback(null, 'iTunes search error: ' + (err.message || err)); });
  };

  // ── Search iTunes — return top N results (for multi-pick) ─────────────
  window.itunesSearchMulti = function(name, artist, callback, limit) {
    limit = limit || 5;
    var nameTerm = (name || '').trim();
    if (!nameTerm) { callback(null, 'กรุณาระบุชื่อเพลง'); return; }
    
    // Strip (...) and [...] from the search term for iTunes API to improve hit rate
    var cleanNameTerm = nameTerm.replace(/\[.*?\]|\(.*?\)/g, '').trim();
    if (!cleanNameTerm) cleanNameTerm = nameTerm; // fallback if name is entirely parentheses
    
    var p1 = Promise.resolve({results: []});
    var p2 = Promise.resolve({results: []});
    
    if (artist && artist.trim()) {
      var cleanArtist = (artist || '').replace(/\[.*?\]|\(.*?\)/g, '').trim();
      var termCombined = (cleanArtist + ' ' + cleanNameTerm).trim();
      var url1 = 'https://itunes.apple.com/search?term=' + encodeURIComponent(termCombined)
               + '&country=TH&media=music&limit=15' + (hasThai(termCombined) ? '&lang=th_th' : '');
      p1 = fetchItunes(url1).catch(function(){ return {results:[]}; });
    }
    
    var url2 = 'https://itunes.apple.com/search?term=' + encodeURIComponent(cleanNameTerm)
             + '&country=TH&media=music&limit=30' + (hasThai(cleanNameTerm) ? '&lang=th_th' : '');
    p2 = fetchItunes(url2).catch(function(){ return {results:[]}; });
    
    Promise.all([p1, p2])
      .then(function(resArray) {
        var results1 = (resArray[0] && resArray[0].results) || [];
        var results2 = (resArray[1] && resArray[1].results) || [];
        var allResults = results1.concat(results2);
        
        if (!allResults.length) {
          callback(null, 'ไม่พบเพลงนี้ใน iTunes');
          return;
        }
        
        var seen = {};
        var unique = allResults.filter(function(t) {
          var key = normalizeStr(t.trackName) + '||' + normalizeStr(t.artistName);
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        });
        unique.sort(function(a, b) {
          return combinedScore(b, nameTerm, artist) - combinedScore(a, nameTerm, artist);
        });
        var mapped = unique.slice(0, limit).map(function(t) {
          var result = mapResult(t);
          if (artist && hasThai(artist) && !hasThai(result.artist)) {
            result.artist = artist;
          }
          return result;
        });
        callback(mapped, null);
      })
      .catch(function(err) { callback(null, 'iTunes search error: ' + (err.message || err)); });
  };

  // ── Expose helpers ──────────────────────────────────
  window.itunesGenreToTag = genreToTag;
  window.itunesYearToEra  = yearToEra;

})();
