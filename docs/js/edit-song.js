var MOOD_HINTS = {
    'มัน / สนุก':        '🎉 เพลงเร็ว เต้นได้ สนุกสนาน • เหมาะเปิดงาน เซกชั่นมัน หรือปาร์ตี้',
    'หวาน / โรแมนติก':  '❤️ เพลงรักช้า อ่อนหวาน • เหมาะงานแต่ง โมเมนต์คู่รัก หรืองานเลี้ยง',
    'เศร้า / อกหัก':    '💔 เพลงโศก คิดถึง อาลัย • เหมาะช่วงเนิบช้าที่ต้องการอารมณ์',
    'นิ่ง / ผ่อนคลาย':  '🌿 เพลง Chill เบาๆ • เหมาะบรรยากาศผ่อนคลาย งานเลี้ยงพักผ่อน',
    'ฮึกเหิม / ยิ่งใหญ่':'🔥 เพลงอลังการ ทรงพลัง • เหมาะเปิด/ปิดโชว์ใหญ่ หรือไฮไลต์งาน'
  };
  function updateMoodHint(selId, hintId) {
    var v = document.getElementById(selId).value;
    var h = document.getElementById(hintId);
    if (h) h.textContent = MOOD_HINTS[v] || '';
  }
  document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
      checkAdGate(); renderMainNav('mainNav'); applyTranslations();
    // โหลดรายชื่อศิลปินจาก master list
    apiCall('getArtists', {}, function(r) {
      if (r && r.success && r.data) {
        var dl = document.getElementById('artistDatalist');
        r.data.forEach(function(a) {
          var opt = document.createElement('option');
          opt.value = a.name;
          dl.appendChild(opt);
        });
      }
    });
    var params = new URLSearchParams(window.location.search);
    var songId = params.get('songId') || '';
    document.getElementById('songId').value = songId;
    console.log('[edit-song] songId =', songId);
    if (songId) {
      var bandName = localStorage.getItem('bandName') || '';
      apiCall('getSong', { songId: songId, bandName: bandName }, function(r) {
        console.log('[edit-song] getSong response =', r);
        if (r && r.success && r.data) {
          var s = r.data;
          document.getElementById('songName').value = s.name || '';
          document.getElementById('artist').value = s.artist || '';
          // set select: ต้องตรง option value
          var keyEl = document.getElementById('key');
          var keyOpts = Array.from(keyEl.options).map(function(o){ return o.value; });
          keyEl.value = (keyOpts.indexOf(s.key) >= 0) ? s.key : '';
          document.getElementById('bpm').value = (s.bpm > 0) ? s.bpm : '';
          // era/mood: DB อาจมี suffix เช่น "2523-2532 ('80s)" → ใช้ indexOf จับคู่
          var eraEl = document.getElementById('era');
          eraEl.value = '';
          if (s.era) Array.from(eraEl.options).forEach(function(o){ if (o.value && s.era.indexOf(o.value) >= 0) eraEl.value = o.value; });
          var moodEl = document.getElementById('mood');
          moodEl.value = '';
          if (s.mood) Array.from(moodEl.options).forEach(function(o){ if (o.value && s.mood.indexOf(o.value) >= 0) moodEl.value = o.value; });
          updateMoodHint('mood','moodHint');
          // genre (tags column)
          var genreEl = document.getElementById('genre');
          genreEl.value = s.tags || '';
          // singer: รองรับทั้ง TH และ EN จาก DB
          var singerVal = s.singer || '';
          var singerMap = { 'male': 'ชาย', 'female': 'หญิง', 'duet': 'ชาย/หญิง' };
          var mappedSinger = singerMap[singerVal] || singerVal;
          var radios = document.querySelectorAll('input[name="singer"]');
          radios.forEach(function(rd){ rd.checked = (rd.value === mappedSinger); });
        } else {
          showToast((r&&r.message)||'ไม่พบเพลง','error');
          console.error('[edit-song] getSong failed:', r);
        }
      });
    } else {
      showToast('ไม่มี songId ใน URL', 'error');
    }
    // ── Dirty tracking: เตือนเมื่อจะออกก่อนบันทึก ─────────────
    var _formDirty = false;
    var _saveSuccess = false;
    document.getElementById('editSongForm').addEventListener('input', function() { _formDirty = true; });
    document.getElementById('editSongForm').addEventListener('change', function() { _formDirty = true; });
    window.addEventListener('beforeunload', function(ev) {
      if (_formDirty && !_saveSuccess) {
        ev.preventDefault();
        ev.returnValue = 'มีข้อมูลที่ยังไม่ได้บันทึก — ออกจากหน้านี้จริงหรือ?';
      }
    });

    document.getElementById('editSongForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var errDiv = document.getElementById('saveError');
      errDiv.style.display = 'none';
      var btn = document.getElementById('saveBtn'); btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
      var singerRadio = document.querySelector('input[name="singer"]:checked');
      apiCall('updateSong', {
        songId: document.getElementById('songId').value,
        name: document.getElementById('songName').value.trim(),
        artist: document.getElementById('artist').value.trim(),
        key: document.getElementById('key').value,
        bpm: parseInt(document.getElementById('bpm').value) || 0,
        era: document.getElementById('era').value.trim(),
        tags: document.getElementById('genre').value.trim(),
        singer: singerRadio ? singerRadio.value : '',
        mood: document.getElementById('mood').value.trim()
      }, function(r) {
        btn.disabled = false; btn.textContent = '💾 บันทึก';
        if (r && r.success) {
          _formDirty = false; _saveSuccess = true;
          // auto-save artist to master table
          var art = document.getElementById('artist').value.trim();
          if (art) apiCall('ensureArtist', { name: art }, function(r) {
            if (!r || !r.success) console.warn('[ensureArtist] failed:', r && r.message);
          });
          // ล้าง cache เพลงเพื่อให้หน้าลิสโหลดใหม่
          var bid = localStorage.getItem('bandId') || '';
          var bn  = localStorage.getItem('bandName') || '';
          try { sessionStorage.removeItem('songs_cache_' + (bid || bn)); } catch(e) {}
          showToast('บันทึกเรียบร้อย ✅','success');
          setTimeout(function(){ window.location.href='songs.html'; },1000);
        } else {
          var msg = (r && r.message) || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
          errDiv.textContent = '❌ ' + msg;
          errDiv.style.display = 'block';
          errDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
          showToast(msg, 'error');
        }
      });
    });
  });

  /* ── AI Auto-Tag (Gemini) ── */
  var _geminiKey = '';
  function _loadGeminiKey() {
    apiCall('getBandSettings', {}, function(r) {
      var s = (r && r.success && r.data) || {};
      _geminiKey = s.geminiApiKey || '';
      if (_geminiKey) {
        var wrap = document.getElementById('aiTagWrap');
        if (wrap) wrap.style.display = '';
      }
    });
  }
  _loadGeminiKey();

  function aiAutoTag() {
    var songName = document.getElementById('songName').value.trim();
    var artist = document.getElementById('artist').value.trim();
    var msgEl = document.getElementById('aiTagMsg');
    var btn = document.getElementById('aiTagBtn');
    if (!songName) { if (msgEl) msgEl.textContent = '❌ กรุณากรอกชื่อเพลงก่อน'; return; }
    if (!_geminiKey) { if (msgEl) msgEl.textContent = '❌ ยังไม่ได้ตั้ง Gemini API Key (ตั้งค่าได้ที่หน้าตั้งค่าวง)'; return; }

    btn.disabled = true; btn.textContent = '🤖 กำลังวิเคราะห์…';
    if (msgEl) msgEl.textContent = '';

    var prompt = 'ฉันมีเพลงชื่อ "' + songName + '"' + (artist ? ' ของศิลปิน "' + artist + '"' : '')
      + '\nช่วยบอกข้อมูลเพลงนี้โดยตอบเป็น JSON เท่านั้น (ไม่ต้องมี markdown):'
      + '\n{"key":"คีย์เพลง เช่น C, 1#, 2b","bpm":ตัวเลข BPM,"mood":"เลือก 1 จาก: มัน / สนุก, หวาน / โรแมนติก, เศร้า / อกหัก, นิ่ง / ผ่อนคลาย, ฐึกเหิม / ยิ่งใหญ่","era":"เลือก 1 จาก: 80s, 90s, 2000s, 2010s, 2020s","tags":"เลือก 1 จาก: ป๊อป, ร็อค, ดิสโก้, แร็ฟ/ฮิปฮอป, ลูกทุ่ง / อีสาน, เพื่อชีวิต, อาร์แอนด์บี, แจ๊ส / บลูส์, เรกเก้, อินดี้","singer":"เลือก 1 จาก: ชาย, หญิง, ชาย/หญิง"}'
      + '\nตอบเฉพาะ JSON เท่านั้น ไม่ต้องอธิบาย ถ้าไม่แน่ใจให้เดาจากข้อมูลที่มี';

    fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(_geminiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }).then(function(res) { return res.json(); })
    .then(function(data) {
      btn.disabled = false; btn.textContent = '🤖 AI กรอกข้อมูลให้อัตโนมัติ';
      if (!data || !data.candidates || !data.candidates[0]) {
        if (msgEl) msgEl.textContent = '❌ AI ไม่ตอบกลับ';
        return;
      }
      var text = data.candidates[0].content.parts[0].text || '';
      var jsonStr = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      try {
        var info = JSON.parse(jsonStr);
        if (info.key) {
          var keyEl = document.getElementById('key');
          for (var i = 0; i < keyEl.options.length; i++) {
            if (keyEl.options[i].value === info.key || keyEl.options[i].text.indexOf(info.key) >= 0) {
              keyEl.selectedIndex = i; break;
            }
          }
        }
        if (info.bpm) document.getElementById('bpm').value = info.bpm;
        if (info.era) {
          var eraEl = document.getElementById('era');
          for (var j = 0; j < eraEl.options.length; j++) {
            if (eraEl.options[j].value === info.era) { eraEl.selectedIndex = j; break; }
          }
        }
        if (info.mood) {
          var moodEl = document.getElementById('mood');
          for (var k = 0; k < moodEl.options.length; k++) {
            if (moodEl.options[k].value === info.mood) { moodEl.selectedIndex = k; break; }
          }
          updateMoodHint('mood', 'moodHint');
        }
        if (info.tags) {
          var genreEl = document.getElementById('genre');
          for (var g = 0; g < genreEl.options.length; g++) {
            if (genreEl.options[g].value === info.tags) { genreEl.selectedIndex = g; break; }
          }
        }
        if (info.singer) {
          var singerMap = { 'ชาย': 's-male', 'หญิง': 's-female', 'ชาย/หญิง': 's-duet' };
          var singerRadio = document.getElementById(singerMap[info.singer]);
          if (singerRadio) singerRadio.checked = true;
        }
        if (msgEl) { msgEl.style.color = '#16a34a'; msgEl.textContent = '✅ AI กรอกข้อมูลเรียบร้อย — ตรวจสอบแล้วแก้ไขได้ก่อนบันทึก'; }
      } catch(e) {
        if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ AI ตอบกลับรูปแบบไม่ถูกต้อง'; }
      }
    }).catch(function(err) {
      btn.disabled = false; btn.textContent = '🤖 AI กรอกข้อมูลให้อัตโนมัติ';
      if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ เชื่อมต่อ AI ไม่ได้: ' + err.message; }
    });
  }