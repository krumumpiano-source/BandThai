var instrumentIcons = {
    'ร้องนำ': '🎤', 'ร้องประสาน': '🎤',
    'กีตาร์ไฟฟ้า': '🎸', 'กีตาร์โปร่ง': '🎸', 'กีตาร์เบส': '🎸',
    'คีย์บอร์ด': '🎹', 'กลอง': '🥁', 'เพอร์คัสชัน': '🥁',
    'ทรัมเปต': '🎺', 'แซกโซโฟน': '🎷', 'ไวโอลิน': '🎻',
    'ผู้จัดการวง': '📋'
  };
  var roleLabels = { admin: '🔧 แอดมิน', manager: '👔 ผู้จัดการวง', member: '🎸 สมาชิก' };

  function $el(id) { return document.getElementById(id); }
  function setVal(id, val) { var el = $el(id); if (el) el.value = val || ''; }
  function setTxt(id, val) { var el = $el(id); if (el) el.textContent = val || '—'; }

  function renderDisplay(p) {
    var title     = p.title      || '';
    var firstName = p.firstName  || p.first_name || '';
    var lastName  = p.lastName   || p.last_name  || '';
    var nickname  = p.nickname   || '';
    var inst      = p.instrument || '';
    var fullName  = [title !== 'ไม่ระบุ' ? title : '', firstName, lastName].filter(Boolean).join(' ') || nickname || '—';
    $el('displayFullName').textContent   = fullName;
    $el('displayNickname').textContent   = nickname ? '(' + nickname + ')' : '';
    $el('displayInstrument').textContent = inst;
    $el('avatarIcon').textContent = instrumentIcons[inst] || '🎤';
  }

  var addrFields = ['houseNo','moo','soi','road','subDistrict','district','province','postalCode'];
  function getAddrObj(prefix) {
    var obj = {};
    addrFields.forEach(function(f) { obj[f] = ($el(prefix + f) ? $el(prefix + f).value.trim() : ''); });
    return obj;
  }
  function copySameAddress() {
    if ($el('sameAsIdAddr').checked) {
      addrFields.forEach(function(f) { setVal('curAddr_' + f, $el('idAddr_' + f) ? $el('idAddr_' + f).value : ''); });
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    if (typeof requireAuth === 'function') requireAuth();
      checkAdGate();
    renderMainNav('mainNav');

    // การแจ้งเตือน — init หลังจาก app.js โหลด (ใช้ setTimeout เผื่อ SW ลงทะเบียน)
    setTimeout(function() {
      initNotifSettings();
    }, 800);

    // ── โหลดข้อมูล ──
    function loadProfile() {
      apiCall('getMyProfile', {}, function(r) {
        if (!r || !r.success) return;
        var p = r.data || {};
        setVal('title',        p.title      || 'นาย');
        setVal('firstName',    p.firstName  || p.first_name || '');
        setVal('lastName',     p.lastName   || p.last_name  || '');
        setVal('nickname',     p.nickname   || '');
        setVal('instrument',   p.instrument || '');
        setVal('phone',        p.phone      || '');
        setVal('birthDate',    p.birthDate  || p.birth_date || '');
        setVal('paymentMethod',  p.paymentMethod  || p.payment_method || '');
        setVal('paymentAccount', p.paymentAccount || p.payment_account || '');
        // ที่อยู่ตามบัตรประชาชน (JSON)
        var idAddr = p.idCardAddress || p.id_card_address || {};
        if (typeof idAddr === 'string') try { idAddr = JSON.parse(idAddr); } catch(e) { idAddr = {}; }
        setVal('idAddr_houseNo',     idAddr.houseNo || '');
        setVal('idAddr_moo',         idAddr.moo || '');
        setVal('idAddr_soi',         idAddr.soi || '');
        setVal('idAddr_road',        idAddr.road || '');
        setVal('idAddr_subDistrict', idAddr.subDistrict || '');
        setVal('idAddr_district',    idAddr.district || '');
        setVal('idAddr_province',    idAddr.province || '');
        setVal('idAddr_postalCode',  idAddr.postalCode || '');
        // ที่อยู่ปัจจุบัน (JSON)
        var curAddr = p.currentAddress || p.current_address || {};
        if (typeof curAddr === 'string') try { curAddr = JSON.parse(curAddr); } catch(e) { curAddr = {}; }
        setVal('curAddr_houseNo',     curAddr.houseNo || '');
        setVal('curAddr_moo',         curAddr.moo || '');
        setVal('curAddr_soi',         curAddr.soi || '');
        setVal('curAddr_road',        curAddr.road || '');
        setVal('curAddr_subDistrict', curAddr.subDistrict || '');
        setVal('curAddr_district',    curAddr.district || '');
        setVal('curAddr_province',    curAddr.province || '');
        setVal('curAddr_postalCode',  curAddr.postalCode || '');
        setTxt('profileEmail',  p.email    || '—');
        setTxt('profileBand',   p.bandName || p.band_name || '—');
        setTxt('profileRole',   roleLabels[p.role] || p.role || '—');
        setTxt('profileStatus', p.status === 'active' ? '✅ ใช้งาน' : p.status || '—');
        renderDisplay(p);
      });
    }
    loadProfile();

    // ── บันทึกข้อมูลส่วนตัว ──
    $el('profileForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var firstName = $el('firstName').value.trim();
      var lastName  = $el('lastName').value.trim();
      var nickname  = $el('nickname').value.trim();
      if (!firstName || !lastName || !nickname) {
        if (typeof showToast === 'function') showToast('กรุณากรอกชื่อ นามสกุล และชื่อเล่น', 'error');
        return;
      }
      var btn = $el('saveBtn');
      btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

      apiCall('updateMyProfile', {
        title:         $el('title').value,
        firstName:     firstName,
        lastName:      lastName,
        nickname:      nickname,
        instrument:    $el('instrument').value,
        phone:         ($el('phone') ? $el('phone').value.trim() : ''),
        birthDate:     $el('birthDate').value || '',
        paymentMethod:  $el('paymentMethod')  ? $el('paymentMethod').value  : '',
        paymentAccount: $el('paymentAccount') ? $el('paymentAccount').value.trim() : '',
        idCardAddress: getAddrObj('idAddr_'),
        currentAddress: getAddrObj('curAddr_')
      }, function(r) {
        btn.disabled = false; btn.textContent = '💾 บันทึกข้อมูล';
        if (r && r.success) {
          if (typeof showToast === 'function') showToast(r.message || 'บันทึกเรียบร้อย', 'success');
          renderDisplay({
            title:      $el('title').value,
            firstName:  firstName,
            lastName:   lastName,
            nickname:   nickname,
            instrument: $el('instrument').value
          });
          setTimeout(function() { renderMainNav('mainNav'); }, 300);
        } else {
          if (typeof showToast === 'function') showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
        }
      });
    });
  });

  // ── เปลี่ยนอีเมล ──
  function doChangeEmail() {
    var newEmail = ($el('newEmail').value || '').trim();
    var msgEl = $el('emailMsg');
    msgEl.className = 'msg-box'; msgEl.textContent = '';

    if (!newEmail || !newEmail.includes('@')) {
      msgEl.className = 'msg-box error'; msgEl.textContent = 'กรุณากรอกอีเมลให้ถูกต้อง';
      return;
    }
    var btn = $el('changeEmailBtn');
    btn.disabled = true; btn.textContent = 'กำลังดำเนินการ...';

    apiCall('changeEmail', { email: newEmail }, function(r) {
      btn.disabled = false; btn.textContent = '📧 เปลี่ยนอีเมล';
      if (r && r.success) {
        msgEl.className = 'msg-box success';
        msgEl.textContent = r.message || 'ส่งลิงก์ยืนยันไปยังอีเมลใหม่แล้ว กรุณาตรวจสอบกล่องจดหมาย';
        $el('newEmail').value = '';
      } else {
        msgEl.className = 'msg-box error';
        msgEl.textContent = (r && r.message) || 'เปลี่ยนอีเมลไม่สำเร็จ';
      }
    });
  }

  // ── การแจ้งเตือน (Notification Settings) ──
  var _notifEnabled = false;

  function initNotifSettings() {
    var btn  = document.getElementById('notifToggleBtn');
    var badge = document.getElementById('notifStatusBadge');
    var iosHint = document.getElementById('notifIOSHint');

    // ตรวจสอบ iOS ที่ยังไม่ได้ add to home
    function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
    function isStandalone() { return window.navigator.standalone === true; }
    if (isIOS() && !isStandalone()) {
      if (iosHint) iosHint.style.display = 'block';
      if (btn) { btn.textContent = '📱 iOS: ดูคำแนะนำด้านล่าง'; btn.disabled = true; }
      return;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      if (btn) { btn.textContent = '❌ เบราว์เซอร์ไม่รองรับ'; btn.disabled = true; }
      if (badge) { badge.textContent = 'ไม่รองรับ'; badge.style.background = '#fee2e2'; badge.style.color = '#b91c1c'; }
      return;
    }

    var perm = Notification.permission;
    if (perm === 'denied') {
      if (btn) { btn.textContent = '🚫 ถูกบล็อก - เปิดในการตั้งค่าเบราว์เซอร์'; btn.disabled = true; }
      if (badge) { badge.textContent = 'ถูกบล็อก'; badge.style.background = '#fee2e2'; badge.style.color = '#b91c1c'; }
      return;
    }

    // ตรวจ subscription ปัจจุบัน
    if (typeof checkCurrentSubscription === 'function') {
      checkCurrentSubscription(function(sub) {
        _notifEnabled = !!sub;
        updateNotifUI();
      });
    } else {
      _notifEnabled = perm === 'granted';
      updateNotifUI();
    }
  }

  function updateNotifUI() {
    var btn   = document.getElementById('notifToggleBtn');
    var badge = document.getElementById('notifStatusBadge');
    if (_notifEnabled) {
      if (btn)   { btn.textContent = '🔔 ปิดการแจ้งเตือน'; btn.style.background = '#ef4444'; }
      if (badge) { badge.textContent = 'เปิดอยู่'; badge.style.background = '#dcfce7'; badge.style.color = '#15803d'; }
    } else {
      if (btn)   { btn.textContent = '🔔 เปิดการแจ้งเตือน'; btn.style.background = ''; }
      if (badge) { badge.textContent = 'ปิดอยู่'; badge.style.background = '#f3f4f6'; badge.style.color = '#6b7280'; }
    }
  }

  function profileToggleNotif() {
    var msgEl = document.getElementById('notifMsg');
    if (_notifEnabled) {
      if (typeof unsubscribePush === 'function') {
        unsubscribePush(function(r) {
          if (r && r.success) {
            _notifEnabled = false; updateNotifUI();
            if (msgEl) { msgEl.style.color = '#6b7280'; msgEl.textContent = '✅ ปิดการแจ้งเตือนแล้ว'; }
          } else {
            if (msgEl) { msgEl.style.color = '#b91c1c'; msgEl.textContent = '❌ ไม่สามารถปิดได้ กรุณาลองใหม่'; }
          }
        });
      }
    } else {
      if (msgEl) { msgEl.style.color = '#6b7280'; msgEl.textContent = '⏳ กำลังเปิดการแจ้งเตือน...'; }
      if (typeof requestAndSubscribePush === 'function') {
        requestAndSubscribePush(function(r) {
          /* r = { success: true/false, error: '...' } */
          if (r && r.success) {
            _notifEnabled = true; updateNotifUI();
            if (msgEl) { msgEl.style.color = '#15803d'; msgEl.textContent = '✅ เปิดการแจ้งเตือนแล้ว!'; }
          } else {
            var errMsg = (r && r.error) ? r.error : 'ตรวจสอบการตั้งค่าเบราว์เซอร์';
            if (msgEl) { msgEl.style.color = '#b91c1c'; msgEl.textContent = '❌ ' + errMsg; }
          }
        });
      }
    }
  }

  function profileTestNotif() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      alert('กรุณาเปิดการแจ้งเตือนก่อน');
      return;
    }
    navigator.serviceWorker.ready.then(function(reg) {
      reg.showNotification('🔔 ทดสอบ BandThai', {
        body: 'การแจ้งเตือนทำงานปกติ! 🎵',
        icon: '/BandThai/icons/icon-192.png',
        badge: '/BandThai/icons/icon-192.png',
        tag: 'test-notif',
        requireInteraction: false
      });
    });
  }

  // ── เปลี่ยนรหัสผ่าน ──
  function doChangePassword() {
    var newPwd = ($el('newPassword').value || '');
    var confirmPwd = ($el('confirmPassword').value || '');
    var msgEl = $el('pwdMsg');
    msgEl.className = 'msg-box'; msgEl.textContent = '';

    if (newPwd.length < 6) {
      msgEl.className = 'msg-box error'; msgEl.textContent = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
      return;
    }
    if (newPwd !== confirmPwd) {
      msgEl.className = 'msg-box error'; msgEl.textContent = 'รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบ';
      return;
    }

    var btn = $el('changePwdBtn');
    btn.disabled = true; btn.textContent = 'กำลังดำเนินการ...';

    apiCall('changePassword', { password: newPwd }, function(r) {
      btn.disabled = false; btn.textContent = '🔑 เปลี่ยนรหัสผ่าน';
      if (r && r.success) {
        msgEl.className = 'msg-box success';
        msgEl.textContent = r.message || 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว';
        $el('newPassword').value = '';
        $el('confirmPassword').value = '';
      } else {
        msgEl.className = 'msg-box error';
        msgEl.textContent = (r && r.message) || 'เปลี่ยนรหัสผ่านไม่สำเร็จ';
      }
    });
  }

  /* ── Accessibility Settings ── */
  function _initAccUI() {
    var scale = localStorage.getItem('accessibility_text_scale') || '';
    var contrast = localStorage.getItem('accessibility_high_contrast') || '';
    var simpleMenu = localStorage.getItem('accessibility_simple_menu') || '';
    // Highlight active scale button
    var btns = document.querySelectorAll('.acc-scale-btn');
    btns.forEach(function(b) {
      var s = b.getAttribute('data-scale');
      if (s === scale) {
        b.style.background = 'var(--premium-gold)'; b.style.color = '#1a202c'; b.style.fontWeight = '700';
      } else {
        b.style.background = ''; b.style.color = ''; b.style.fontWeight = '';
      }
    });
    // Contrast toggle
    var cBtn = document.getElementById('contrastToggle');
    if (cBtn) {
      cBtn.textContent = contrast === '1' ? '✅ เปิด' : 'ปิด';
      cBtn.style.background = contrast === '1' ? '#276749' : '';
      cBtn.style.color = contrast === '1' ? '#fff' : '';
    }
    // Simple menu toggle
    var mBtn = document.getElementById('simpleMenuToggle');
    if (mBtn) {
      mBtn.textContent = simpleMenu === '1' ? '✅ เปิด' : 'ปิด';
      mBtn.style.background = simpleMenu === '1' ? '#276749' : '';
      mBtn.style.color = simpleMenu === '1' ? '#fff' : '';
    }
  }
  function setTextScale(val) {
    localStorage.setItem('accessibility_text_scale', val);
    initAccessibility();
    _initAccUI();
  }
  function toggleHighContrast() {
    var current = localStorage.getItem('accessibility_high_contrast') || '';
    localStorage.setItem('accessibility_high_contrast', current === '1' ? '' : '1');
    initAccessibility();
    _initAccUI();
  }
  function toggleSimpleMenu() {
    var current = localStorage.getItem('accessibility_simple_menu') || '';
    localStorage.setItem('accessibility_simple_menu', current === '1' ? '' : '1');
    _initAccUI();
    showToast('เมนูจะเปลี่ยนเมื่อโหลดหน้าใหม่', 'info');
  }
  // Init on load
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(_initAccUI, 100);
  });