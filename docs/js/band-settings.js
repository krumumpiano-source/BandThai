document.addEventListener('DOMContentLoaded', function() {
      if (typeof requireAuth === 'function') requireAuth();
      checkAdGate();
      if (typeof renderMainNav === 'function') renderMainNav('mainNav');
      // Plan badge — ฟรีทุกฟีเจอร์ (แสดงเป็น Pro ถาวร)
      (function() {
        var badge = document.getElementById('planBadge');
        var desc  = document.getElementById('planDesc');
        var btn   = document.getElementById('upgradeBtn');
        if (badge) {
          badge.textContent = 'Pro';
          badge.style.background = '#d97706';
          badge.style.color = '#fff';
        }
        if (desc) desc.textContent = 'ฟรีทุกฟีเจอร์ — ไม่มีค่าใช้จ่าย';
        if (btn) btn.style.display = 'none';
      })();
      if (typeof applyTranslations === 'function') applyTranslations();
      // Show notification admin panel for admin/manager
      var _role = localStorage.getItem('userRole') || '';
      if (_role === 'admin' || _role === 'manager') {
        var card = document.getElementById('notifAdminCard');
        if (card) card.style.display = '';
        loadNotifAdminPanel();
        loadAutoNotifState();
      }
      // Show Gemini section for admin only
      if (_role === 'admin') {
        var gemSec = document.getElementById('geminiSection');
        if (gemSec) gemSec.style.display = '';
        loadGeminiKey();
        // LINE integration hidden (Phase 5A — 2026-04-05)
        // var lineSec = document.getElementById('lineSection');
        // if (lineSec) lineSec.style.display = '';
        // loadLineConfig();
      }
      // Hide all write-buttons for members
      if (_role !== 'admin' && _role !== 'manager') {
        document.querySelectorAll('#saveBtn, #addVenueNameBtn, .btn-danger, [onclick*="remove"], [onclick*="delete"]').forEach(function(b){ b.style.display='none'; });
        document.querySelectorAll('input, select, textarea').forEach(function(el){
          if (el.type !== 'hidden') el.disabled = true;
        });
        var hdr = document.querySelector('.page-header');
        if (hdr) { var info = document.createElement('div'); info.className = 'badge'; info.style.cssText = 'background:#f59e0b;color:#fff;padding:6px 14px;border-radius:8px;font-size:var(--text-sm)'; info.textContent = '👁️ โหมดดูอย่างเดียว — เฉพาะผู้จัดการวงแก้ไขได้'; hdr.appendChild(info); }
      }
    });

    /* ── Auto-Notification Toggle + Timing ── */
    var _notifSaveTimeout = null;
    function loadAutoNotifState() {
      var bandId = localStorage.getItem('bandId') || '';
      if (!bandId) return;
      apiCall('getBandSettings', { bandId: bandId }, function(r) {
        if (r && r.success && r.data) {
          var enabled = !!r.data.notifications_enabled;
          setAutoNotifUI(enabled);
          // Load timing values (stored as total minutes)
          var extMins   = r.data.notif_external_mins || 1440;
          var firstMins = r.data.notif_first_slot_mins || 60;
          var nextMins  = r.data.notif_next_slot_mins || 5;
          _setTimingInputs('notifExtHr', 'notifExtMin', extMins);
          _setTimingInputs('notifFirstHr', 'notifFirstMin', firstMins);
          _setTimingInputs('notifNextHr', 'notifNextMin', nextMins);
        }
      });
    }
    function _setTimingInputs(hrId, minId, totalMins) {
      var hr = document.getElementById(hrId);
      var mn = document.getElementById(minId);
      if (hr) hr.value = Math.floor(totalMins / 60);
      if (mn) mn.value = totalMins % 60;
    }
    function _getTimingMins(hrId, minId, fallback) {
      var hr = document.getElementById(hrId);
      var mn = document.getElementById(minId);
      var h = parseInt(hr ? hr.value : '0', 10) || 0;
      var m = parseInt(mn ? mn.value : '0', 10) || 0;
      return (h * 60 + m) || fallback;
    }
    function setAutoNotifUI(enabled) {
      var cb    = document.getElementById('autoNotifToggle');
      var track = document.getElementById('autoNotifTrack');
      var thumb = document.getElementById('autoNotifThumb');
      var label = document.getElementById('autoNotifLabel');
      var cfg   = document.getElementById('notifTimingConfig');
      if (cb) cb.checked = enabled;
      if (track) track.style.background = enabled ? '#16a34a' : '#475569';
      if (thumb) thumb.style.left = enabled ? '22px' : '2px';
      if (label) { label.textContent = enabled ? 'เปิด' : 'ปิด'; label.style.color = enabled ? '#4ade80' : '#fff'; }
      if (cfg) cfg.style.display = enabled ? '' : 'none';
    }
    function toggleAutoNotif(enabled) {
      setAutoNotifUI(enabled);
      if (typeof notificationsEnabled !== 'undefined') notificationsEnabled = enabled;
      _saveNotifSettings({ notifications_enabled: enabled });
    }
    function saveNotifTiming() {
      clearTimeout(_notifSaveTimeout);
      _notifSaveTimeout = setTimeout(function() {
        _saveNotifSettings({
          notif_external_mins:   _getTimingMins('notifExtHr', 'notifExtMin', 1440),
          notif_first_slot_mins: _getTimingMins('notifFirstHr', 'notifFirstMin', 60),
          notif_next_slot_mins:  _getTimingMins('notifNextHr', 'notifNextMin', 5)
        });
      }, 400);
    }
    function _saveNotifSettings(patch) {
      var bandId = localStorage.getItem('bandId') || '';
      if (!bandId) return;
      apiCall('getBandSettings', { bandId: bandId }, function(r) {
        var current = (r && r.success && r.data) ? r.data : {};
        current.bandId = bandId;
        Object.keys(patch).forEach(function(k) { current[k] = patch[k]; });
        apiCall('saveBandSettings', current, function(r2) {
          var msgEl = document.getElementById('notifAdminMsg');
          if (r2 && r2.success) {
            if (msgEl) { msgEl.style.color = '#16a34a'; msgEl.textContent = '✅ บันทึกการตั้งค่าแจ้งเตือนแล้ว'; }
          } else {
            if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ บันทึกไม่สำเร็จ'; }
          }
        });
      });
    }

    function loadNotifAdminPanel() {
      var bandId = localStorage.getItem('bandId') || '';
      if (!bandId) return;
      var listEl = document.getElementById('notifSubList');
      var badgeEl = document.getElementById('notifSubCountBadge');
      if (listEl) listEl.innerHTML = '<div style="font-size:var(--text-xs);color:var(--premium-text-muted);padding:12px 0;text-align:center">กำลังโหลด…</div>';
      apiCall('getNotifSubscribers', { bandId: bandId }, function(r) {
        if (!r || !r.success || !r.data) {
          if (listEl) listEl.innerHTML = '<div style="color:#e53e3e;font-size:var(--text-xs);padding:8px 0">ไม่สามารถโหลดข้อมูลได้</div>';
          return;
        }
        var rows = r.data;
        if (badgeEl) badgeEl.textContent = rows.length + ' คนเปิดรับการแจ้งเตือน';
        if (rows.length === 0) {
          if (listEl) listEl.innerHTML = '<div style="color:var(--premium-text-muted);font-size:var(--text-xs);padding:8px 0;text-align:center">ยังไม่มีสมาชิกที่เปิดรับการแจ้งเตือน</div>';
          return;
        }
        var html = '<div style="display:flex;flex-direction:column;gap:6px">';
        rows.forEach(function(sub) {
          var name = sub.full_name || sub.email || '—';
          var domain = sub.endpoint ? (function(){ try { return new URL(sub.endpoint).hostname; } catch(e){ return sub.endpoint.substring(0,30)+'…'; }})() : 'ไม่ทราบอุปกรณ์';
          var when = sub.created_at ? new Date(sub.created_at).toLocaleDateString('th-TH') : '—';
          html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(249,207,69,.06);border:1px solid rgba(249,207,69,.18);border-radius:8px;font-size:var(--text-xs)">'
            + '<div><span style="font-weight:600;color:var(--premium-text)">🔔 ' + name + '</span>'
            + '<span style="color:var(--premium-text-muted);margin-left:8px">' + domain + '</span></div>'
            + '<span style="color:#9ca3af">' + when + '</span>'
            + '</div>';
        });
        html += '</div>';
        if (listEl) listEl.innerHTML = html;
      });
    }

    function notifAdminSendTest(btn) {
      var bandId = localStorage.getItem('bandId') || '';
      if (!bandId) return;
      var msgEl = document.getElementById('notifAdminMsg');
      btn.disabled = true; btn.textContent = 'กำลังส่ง…';
      apiCall('sendTestNotification', { bandId: bandId, title: '🎵 ทดสอบระบบแจ้งเตือน', body: 'ระบบการแจ้งเตือนของวงทำงานปกติ ✅' }, function(r) {
        btn.disabled = false; btn.textContent = '📢 ส่งการแจ้งเตือนทดสอบถึงทุกคน';
        if (msgEl) {
          if (r && r.success) {
            msgEl.style.color = '#16a34a';
            msgEl.textContent = '✅ ส่งการแจ้งเตือนสำเร็จ — ' + (r.sent || 0) + ' คน';
          } else {
            msgEl.style.color = '#e53e3e';
            msgEl.textContent = '❌ ' + (r && r.error ? r.error : 'ไม่สามารถส่งได้');
          }
        }
      });
    }

    function notifAdminCleanStale(btn) {
      var bandId = localStorage.getItem('bandId') || '';
      if (!bandId) return;
      var msgEl = document.getElementById('notifAdminMsg');
      btn.disabled = true; btn.textContent = 'กำลังล้าง…';
      apiCall('cleanStaleSubscriptions', { bandId: bandId }, function(r) {
        btn.disabled = false; btn.textContent = '🗑️ ล้าง Subscription ที่หมดอายุ';
        if (msgEl) {
          if (r && r.success) {
            msgEl.style.color = '#16a34a';
            msgEl.textContent = '✅ ล้างแล้ว ' + (r.removed || 0) + ' รายการ';
          } else {
            msgEl.style.color = '#e53e3e';
            msgEl.textContent = '❌ ' + (r && r.error ? r.error : 'เกิดข้อผิดพลาด');
          }
        }
        loadNotifAdminPanel();
      });
    }

    /* ── Gemini API Key Management ── */
    function loadGeminiKey() {
      var bandId = localStorage.getItem('bandId') || '';
      if (!bandId) return;
      apiCall('getBandSettings', { bandId: bandId }, function(r) {
        var settings = (r && r.success && r.data) || {};
        var el = document.getElementById('geminiApiKey');
        if (el && settings.geminiApiKey) el.value = settings.geminiApiKey;
      });
    }
    function saveGeminiKey() {
      var bandId = localStorage.getItem('bandId') || '';
      var key = (document.getElementById('geminiApiKey').value || '').trim();
      var msgEl = document.getElementById('geminiMsg');
      if (!key) { if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ กรุณาใส่ API Key'; } return; }
      apiCall('getBandSettings', { bandId: bandId }, function(r) {
        var current = (r && r.success && r.data) ? r.data : {};
        current.bandId = bandId;
        current.geminiApiKey = key;
        apiCall('saveBandSettings', current, function(r2) {
          if (r2 && r2.success) {
            if (msgEl) { msgEl.style.color = '#16a34a'; msgEl.textContent = '✅ บันทึก API Key แล้ว'; }
          } else {
            if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ บันทึกไม่สำเร็จ'; }
          }
        });
      });
    }
    function testGeminiKey() {
      var key = (document.getElementById('geminiApiKey').value || '').trim();
      var msgEl = document.getElementById('geminiMsg');
      if (!key) { if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ กรุณาใส่ API Key ก่อน'; } return; }
      if (msgEl) { msgEl.style.color = 'var(--premium-text-muted)'; msgEl.textContent = '⏳ กำลังทดสอบ…'; }
      fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'ตอบว่า OK' }] }] })
      }).then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.candidates) {
          if (msgEl) { msgEl.style.color = '#16a34a'; msgEl.textContent = '✅ API Key ใช้งานได้! (Free tier)'; }
        } else {
          if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ Key ไม่ถูกต้อง: ' + (data.error ? data.error.message : JSON.stringify(data)); }
        }
      }).catch(function(err) {
        if (msgEl) { msgEl.style.color = '#e53e3e'; msgEl.textContent = '❌ ไม่สามารถเชื่อมต่อ: ' + err.message; }
      });
    }

    // ── LINE Schedule Functions ──────────────────────────────────────────────
    var _lineConfigId = null;

    function loadLineConfig() {
      apiCall('getVenueLineConfig', { venueName: 'ร้านนิยมสุข' }, function(r) {
        if (!r || !r.success) return;
        var cfg = r.data;
        if (!cfg) return;
        _lineConfigId = cfg.id || null;
        document.getElementById('lineEnabled').checked = !!cfg.enabled;
        _updateLineToggle('lineEnabled', 'lineEnabledTrack', 'lineEnabledThumb', 'lineEnabledLabel', !!cfg.enabled, true);
        document.getElementById('lineToken').value = cfg.line_channel_token || '';
        document.getElementById('lineGroupId').value = cfg.line_group_id || '';
        document.getElementById('lineDailyTime').value = cfg.send_daily_time || '23:30';
        document.getElementById('lineWeeklyEnabled').checked = !!cfg.send_weekly_enabled;
        _updateLineToggle('lineWeeklyEnabled', 'lineWeeklyTrack', 'lineWeeklyThumb', 'lineWeeklyLabel', !!cfg.send_weekly_enabled, false);
        document.getElementById('lineWeeklyTime').value = cfg.send_weekly_time || '08:00';
        document.getElementById('lineFooter').value = cfg.footer_text || '';
        // Load quota
        if (_lineConfigId) refreshLineQuota();
      });
    }

    document.getElementById('lineEnabled').addEventListener('change', function() {
      var on = this.checked;
      _updateLineToggle('lineEnabled', 'lineEnabledTrack', 'lineEnabledThumb', 'lineEnabledLabel', on, true);
      // Auto-save enabled state to DB (like autoNotifToggle)
      if (_lineConfigId) {
        apiCall('saveVenueLineConfig', { id: _lineConfigId, enabled: on }, function(r) {
          var msgEl = document.getElementById('lineMsg');
          if (r && r.success) {
            msgEl.style.color = 'var(--accent-success,#38a169)';
            msgEl.textContent = on ? '✅ เปิดระบบ LINE แล้ว' : '⏸️ ปิดระบบ LINE แล้ว';
          } else {
            msgEl.style.color = '#e53e3e';
            msgEl.textContent = '❌ บันทึกไม่สำเร็จ';
          }
        });
      }
    });
    document.getElementById('lineWeeklyEnabled').addEventListener('change', function() {
      var on = this.checked;
      _updateLineToggle('lineWeeklyEnabled', 'lineWeeklyTrack', 'lineWeeklyThumb', 'lineWeeklyLabel', on, false);
      // Auto-save weekly enabled state to DB
      if (_lineConfigId) {
        apiCall('saveVenueLineConfig', { id: _lineConfigId, send_weekly_enabled: on }, function() {});
      }
    });
    function _updateLineToggle(cbId, trackId, thumbId, labelId, on, isMain) {
      var track = document.getElementById(trackId);
      var thumb = document.getElementById(thumbId);
      var label = document.getElementById(labelId);
      if (track) track.style.background = on ? '#16a34a' : '#475569';
      if (thumb) thumb.style.left = on ? (isMain ? '22px' : '18px') : '2px';
      if (isMain && label) {
        label.textContent = on ? '✅ เปิดใช้งาน' : '❌ ปิด';
        label.style.color = on ? '#16a34a' : '#ef4444';
      }
    }

    function saveLineConfig() {
      var msgEl = document.getElementById('lineMsg');
      var bandId = localStorage.getItem('bandId') || '';
      if (!bandId) {
        msgEl.style.color = '#e53e3e';
        msgEl.textContent = '❌ ไม่พบ Band ID — กรุณาล็อกอินใหม่';
        return;
      }
      msgEl.textContent = '⏳ กำลังบันทึก...';
      var payload = {
        id: _lineConfigId,
        venue_name: 'ร้านนิยมสุข',
        line_channel_token: document.getElementById('lineToken').value.trim(),
        line_group_id: document.getElementById('lineGroupId').value.trim(),
        enabled: document.getElementById('lineEnabled').checked,
        send_daily_time: document.getElementById('lineDailyTime').value || '23:30',
        send_weekly_enabled: document.getElementById('lineWeeklyEnabled').checked,
        send_weekly_time: document.getElementById('lineWeeklyTime').value || '08:00',
        footer_text: document.getElementById('lineFooter').value.trim(),
        band_ids: [bandId],
      };
      apiCall('saveVenueLineConfig', payload, function(r) {
        if (r && r.success) {
          msgEl.style.color = 'var(--accent-success,#38a169)';
          msgEl.textContent = '✅ บันทึกเรียบร้อย';
          // Reload to get assigned id
          loadLineConfig();
        } else {
          msgEl.style.color = '#e53e3e';
          msgEl.textContent = '❌ บันทึกไม่สำเร็จ: ' + (r && r.message ? r.message : 'unknown error');
        }
      });
    }

    function sendLineTest() {
      if (!_lineConfigId) { alert('กรุณาบันทึกการตั้งค่าก่อนทดสอบส่ง'); return; }
      var msgEl = document.getElementById('lineMsg');
      msgEl.style.color = 'var(--premium-text-muted)';
      msgEl.textContent = '⏳ กำลังส่งทดสอบ...';
      apiCall('sendLineTest', { configId: _lineConfigId }, function(r) {
        if (r && r.success) {
          msgEl.style.color = 'var(--accent-success,#38a169)';
          msgEl.textContent = '✅ ส่งทดสอบสำเร็จ! ตรวจสอบในกลุ่ม LINE ได้เลย';
          refreshLineQuota();
        } else {
          msgEl.style.color = '#e53e3e';
          var err = (r && r.data && r.data.error) ? r.data.error : (r && r.message ? r.message : 'ไม่สำเร็จ');
          msgEl.textContent = '❌ ส่งไม่สำเร็จ: ' + err;
        }
      });
    }

    function refreshLineQuota() {
      if (!_lineConfigId) return;
      apiCall('getLineQuota', { configId: _lineConfigId }, function(r) {
        var data = r && r.data;
        if (!data) return;
        var count = data.count || 0;
        var limit = data.limit || 200;
        var pct = Math.min(100, Math.round((count / limit) * 100));
        var bar = document.getElementById('lineQuotaBar');
        var txt = document.getElementById('lineQuotaText');
        if (bar) {
          bar.style.width = pct + '%';
          bar.style.background = pct >= 95 ? '#e53e3e' : pct >= 80 ? '#f59e0b' : 'var(--accent-primary)';
        }
        if (txt) txt.textContent = count + ' / ' + limit;

        // Render last logs
        var logs = data.logs || [];
        var logEl = document.getElementById('lineLogList');
        if (logEl && logs.length) {
          logEl.style.display = '';
          logEl.innerHTML = logs.map(function(lg) {
            var d = lg.sent_at ? new Date(lg.sent_at).toLocaleString('th-TH') : '-';
            var icon = lg.success ? '✅' : '❌';
            var typeMap = { daily: 'รายวัน', weekly: 'สัปดาห์', test: 'ทดสอบ', preview: 'ตัวอย่าง' };
            var typeTh = typeMap[lg.message_type] || lg.message_type;
            return '<div style="padding:2px 0;border-bottom:1px solid #c9d4e0">' + icon + ' ' + typeTh + ' — ' + d + (lg.error_message ? ' <span style="color:#e53e3e">' + lg.error_message.slice(0,60) + '</span>' : '') + '</div>';
          }).join('');
        }
      });
    }

    function previewLineMsg(previewMode) {
      if (!_lineConfigId) { alert('กรุณาบันทึกการตั้งค่าก่อนดูตัวอย่าง'); return; }
      var msgEl = document.getElementById('lineMsg');
      msgEl.style.color = 'var(--premium-text-muted)';
      msgEl.textContent = '⏳ กำลังโหลดตัวอย่าง...';
      apiCall('previewLineMessage', { configId: _lineConfigId, previewMode: previewMode }, function(r) {
        var data = r && r.data;
        if (r && r.success && data && data.text) {
          msgEl.textContent = '';
          var box = document.getElementById('linePreviewBox');
          var pre = document.getElementById('linePreviewText');
          if (pre) pre.textContent = data.text;
          if (box) box.style.display = '';
        } else {
          msgEl.style.color = '#e53e3e';
          var err = (data && data.error) ? data.error : (r && r.message ? r.message : 'ไม่สำเร็จ');
          msgEl.textContent = '❌ ดูตัวอย่างไม่สำเร็จ: ' + err;
        }
      });
    }