document.addEventListener('DOMContentLoaded', function() {
    if (typeof requireAuth === 'function') requireAuth();
      checkAdGate();
    if (typeof renderMainNav === 'function') renderMainNav('mainNav');
    if (typeof applyTranslations === 'function') applyTranslations();

    var bandId = localStorage.getItem('bandId') || '';
    var allHistory = [];   // playlist_history rows [{date, songs[], createdBy}]
    var allBandSongs = []; // band_songs rows
    var currentPeriod = 7;

    function showToast(msg) {
      var t = document.getElementById('toast');
      if (!t) return;
      t.querySelector('.toast-message').textContent = msg;
      t.classList.add('show');
      setTimeout(function() { t.classList.remove('show'); }, 3000);
    }

    function escapeHtml(t) {
      return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function daysSince(dateStr) {
      if (!dateStr) return Infinity;
      var d = new Date(dateStr);
      if (isNaN(d)) return Infinity;
      return Math.floor((Date.now() - d.getTime()) / 86400000);
    }

    function renderRankList(container, songs, labelFn) {
      if (!songs || songs.length === 0) {
        container.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูล</div>';
        return;
      }
      container.innerHTML = songs.map(function(s, i) {
        var rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
        return '<div class="song-rank-item">' +
          '<div class="rank-badge ' + rankClass + '">' + (i+1) + '</div>' +
          '<div class="song-info"><div class="song-title">' + escapeHtml(s.title || s.name || '-') + '</div>' +
          '<div class="song-meta">' + escapeHtml(s.artist || '') + '</div></div>' +
          '<div class="play-count">' + labelFn(s) + '</div>' +
          '</div>';
      }).join('');
    }

    // Count song plays from playlist_history within a date range
    function countPlaysFromHistory(period) {
      var cutoffDays = period === 'all' ? Infinity : parseInt(period);
      var freq = {};
      allHistory.forEach(function(entry) {
        // Filter by date range
        if (cutoffDays !== Infinity && daysSince(entry.date) > cutoffDays) return;
        var songs = entry.songs || [];
        songs.forEach(function(s) {
          var name = (s.name || s || '').toString().trim();
          if (!name) return;
          if (!freq[name]) freq[name] = { name: name, count: 0, lastDate: '' };
          freq[name].count++;
          if (entry.date > freq[name].lastDate) freq[name].lastDate = entry.date;
        });
      });
      return freq;
    }

    function renderFrequent(period) {
      var container = document.getElementById('frequentSongsList');
      var freq = countPlaysFromHistory(period);
      var sorted = Object.values(freq).sort(function(a, b) { return b.count - a.count; });
      renderRankList(container, sorted.slice(0, 15), function(s) { return s.count + ' ครั้ง'; });
    }

    function renderNewSongs() {
      var container = document.getElementById('newSongsList');
      var sorted = allBandSongs.slice().sort(function(a, b) {
        return daysSince(a.createdAt) - daysSince(b.createdAt);
      });
      renderRankList(container, sorted.slice(0, 10), function(s) {
        var d = s.createdAt;
        if (!d) return 'ใหม่';
        var days = daysSince(d);
        return days <= 0 ? 'วันนี้' : days + ' วันที่แล้ว';
      });
    }

    function renderHits() {
      var container = document.getElementById('systemHitsList');
      var freq = countPlaysFromHistory('all');
      // Enrich with artist info from band_songs
      var songMap = {};
      allBandSongs.forEach(function(s) { songMap[s.name] = s; });
      var sorted = Object.values(freq).map(function(f) {
        var bs = songMap[f.name] || {};
        return { name: f.name, artist: bs.artist || '', count: f.count };
      }).sort(function(a, b) { return b.count - a.count; });
      renderRankList(container, sorted.slice(0, 15), function(s) { return '⭐ ' + s.count; });
    }

    function loadInsights() {
      renderFrequent(currentPeriod);
      renderNewSongs();
      renderHits();
    }

    // Period tab listeners
    document.querySelectorAll('.period-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.period-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentPeriod = btn.getAttribute('data-period');
        renderFrequent(currentPeriod);
      });
    });

    // Fetch insights data from API
    if (bandId && typeof apiCall === 'function') {
      apiCall('getSongInsights', { bandId: bandId }, function(result) {
        if (result && result.success && result.data) {
          allHistory   = result.data.history || [];
          allBandSongs = result.data.songs   || [];
          loadInsights();

          // Show total stats
          var totalPlays = 0;
          allHistory.forEach(function(h) { totalPlays += (h.songs || []).length; });
          var statsInfo = document.getElementById('insightsStats');
          if (statsInfo) {
            statsInfo.innerHTML = '📊 ลิสเพลงทั้งหมด <strong>' + allHistory.length + '</strong> รายการ &nbsp;|&nbsp; เพลงทั้งหมด <strong>' + allBandSongs.length + '</strong> เพลง &nbsp;|&nbsp; เล่นรวม <strong>' + totalPlays + '</strong> ครั้ง';
          }
        } else {
          ['frequentSongsList','newSongsList','systemHitsList'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลเพลง</div>';
          });
        }
      });
    } else {
      ['frequentSongsList','newSongsList','systemHitsList'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลเพลง</div>';
      });
    }

    // Auto-refresh when user comes back from another page
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden && bandId && typeof apiCall === 'function') {
        apiCall('getSongInsights', { bandId: bandId }, function(result) {
          if (result && result.success && result.data) {
            allHistory = result.data.history || [];
            allBandSongs = result.data.songs || [];
            loadInsights();
          }
        });
      }
    });
  });