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

  // ── Genre → tag (ต้องตรงกับ _GENRE_OPTS ของระบบ) ────
  function genreToTag(genre) {
    var g = (genre || '').toLowerCase();
    if (g.indexOf('rock') !== -1) return 'ร็อค';
    if (g.indexOf('pop') !== -1) return 'ป๊อป';
    if (g.indexOf('hip') !== -1 || g.indexOf('rap') !== -1) return 'ฮิปฮอป';
    if (g.indexOf('dance') !== -1 || g.indexOf('disco') !== -1 || g.indexOf('edm') !== -1 || g.indexOf('electronic') !== -1) return 'ดิสโก้';
    if (g.indexOf('country') !== -1 || g.indexOf('folk') !== -1 || g.indexOf('luk thung') !== -1 || g.indexOf('isan') !== -1) return 'ลูกทุ่ง / อีสาน';
    if (g.indexOf('singer') !== -1 || g.indexOf('songwriter') !== -1) return 'เพื่อชีวิต';
    if (g.indexOf('oldies') !== -1 || g.indexOf('classic') !== -1) return 'สากลเก่า';
    return 'สากลปัจจุบัน';
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

  // ── Search iTunes ─────────────────────────────────────
  window.itunesSearch = function(name, artist, callback) {
    var term = ((artist || '') + ' ' + name).trim();
    if (!term) { callback(null, 'กรุณาระบุชื่อเพลง'); return; }
    var url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(term)
            + '&country=TH&media=music&limit=5';

    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.results || !data.results.length) {
          callback(null, 'ไม่พบเพลงนี้ใน iTunes');
          return;
        }
        var t = data.results[0];
        var result = {
          name:      t.trackName || '',
          artist:    t.artistName || '',
          singer:    '',               // iTunes ไม่มีข้อมูลเพศ — ให้เลือกเอง
          key:       '',               // iTunes ไม่มี key
          bpm:       null,             // iTunes ไม่มี BPM
          mood:      '',               // iTunes ไม่มี mood
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
        callback(result, null);
      })
      .catch(function(err) { callback(null, 'iTunes search error: ' + (err.message || err)); });
  };

  // ── Expose helpers ──────────────────────────────────
  window.itunesGenreToTag = genreToTag;
  window.itunesYearToEra  = yearToEra;

})();
