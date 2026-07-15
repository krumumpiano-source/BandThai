document.addEventListener('DOMContentLoaded', function() {

    var inviteValid = false;

    // Pre-fill invite code from URL ?invite=XXXXXX
    var urlInvite = new URLSearchParams(window.location.search).get('invite') || '';
    if (urlInvite) {
      document.getElementById('inviteCode').value = urlInvite.toUpperCase();
      setTimeout(function() {
        document.getElementById('inviteCode').dispatchEvent(new Event('input'));
      }, 300);
    }

    // ── Invite code live preview ──
    var previewTimer = null;
    document.getElementById('inviteCode').addEventListener('input', function() {
      var code = this.value.trim().toUpperCase();
      this.value = code;
      var preview = document.getElementById('invitePreview');
      var loading = document.getElementById('previewLoading');
      var info    = document.getElementById('previewInfo');
      var okMsg   = document.getElementById('previewOk');
      preview.className = 'invite-preview';
      loading.style.display = 'none';
      info.style.display = 'none';
      inviteValid = false;
      document.getElementById('regBtn').disabled = true;
      clearTimeout(previewTimer);
      if (code.length < 6) return;

      preview.className = 'invite-preview show';
      loading.style.display = '';
      previewTimer = setTimeout(function() {
        apiCall('lookupInviteCode', { code: code }, function(r) {
          loading.style.display = 'none';
          if (r && r.success) {
            var province = r.province ? ' (' + r.province + ')' : '';
            document.getElementById('previewBandName').textContent = '🎵 ' + (r.bandName || r.band_name || '');
            document.getElementById('previewBandMeta').textContent =
              province + (r.memberCount || r.member_count ? ' · ' + (r.memberCount || r.member_count) + ' สมาชิก' : '');
            info.style.display = '';
            if (okMsg) okMsg.style.display = '';
            preview.className = 'invite-preview show';
            inviteValid = true;
            document.getElementById('regBtn').disabled = false;
          } else {
            document.getElementById('previewBandName').textContent = '❌ ' + ((r && r.message) || 'รหัสไม่ถูกต้อง');
            document.getElementById('previewBandMeta').textContent = 'กรุณาตรวจสอบรหัสประจำวงอีกครั้ง';
            info.style.display = '';
            if (okMsg) okMsg.style.display = 'none';
            preview.className = 'invite-preview show error';
          }
        });
      }, 500);
    });

    // ── Submit ──
    document.getElementById('registerForm').addEventListener('submit', function(e) {
      e.preventDefault();
      clearErrs();
      var nickname = val('nickname'), email = val('email');
      var pw = document.getElementById('password').value, cpw = document.getElementById('confirmPassword').value;
      var ok = true;
      if (!inviteValid) { err('generalError', 'กรุณากรอกรหัสวงให้ถูกต้อง'); ok = false; }
      if (!nickname) { err('nicknameError', 'กรุณากรอกชื่อเล่น'); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err('emailError', 'อีเมลไม่ถูกต้อง'); ok = false; }
      if (pw.length < 8) { err('passwordError', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); ok = false; }
      if (pw !== cpw) { err('confirmError', 'รหัสผ่านไม่ตรงกัน'); ok = false; }
      if (!ok) return;

      var btn = document.getElementById('regBtn');
      btn.disabled = true; btn.textContent = '⏳ กำลังสมัคร...';

      apiCall('register', {
        nickname: nickname, firstName: '', lastName: '', title: '', instrument: '',
        name: nickname, email: email, password: pw,
        inviteCode: val('inviteCode').toUpperCase()
      }, function(r) {
        if (r && r.success) {
          if (typeof showToast === 'function') showToast(r.message || 'สมัครสำเร็จ!', 'success');
          setTimeout(function() { window.location.href = 'dashboard.html'; }, 1500);
        } else {
          btn.disabled = false; btn.textContent = '✅ สมัครเข้าร่วมวง';
          err('generalError', (r && r.message) || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        }
      });
    });

    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    function err(id, msg) { var el = document.getElementById(id); if (el) el.textContent = msg || ''; }
    function clearErrs() { ['nicknameError','emailError','passwordError','confirmError','generalError'].forEach(function(id){ err(id); }); }
  });