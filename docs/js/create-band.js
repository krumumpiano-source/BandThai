document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('createBandForm').addEventListener('submit', function(e) {
      e.preventDefault();
      clearErrs();
      var bandName = val('bandName'), nickname = val('nickname'), email = val('email');
      var pw = document.getElementById('password').value, cpw = document.getElementById('confirmPassword').value;
      var ok = true;
      if (!bandName) { err('bandNameError', 'กรุณากรอกชื่อวง'); ok = false; }
      if (!nickname) { err('nicknameError', 'กรุณากรอกชื่อเล่น'); ok = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err('emailError', 'อีเมลไม่ถูกต้อง'); ok = false; }
      if (pw.length < 8) { err('passwordError', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); ok = false; }
      if (pw !== cpw) { err('confirmError', 'รหัสผ่านไม่ตรงกัน'); ok = false; }
      if (!ok) return;

      var btn = document.getElementById('submitBtn');
      btn.disabled = true; btn.textContent = '⏳ กำลังสร้างวง...';

      apiCall('registerBandRequest', {
        bandName: bandName, nickname: nickname,
        firstName: '', lastName: '', title: '', instrument: '',
        province: '', memberCount: '1',
        email: email, password: pw
      }, function(r) {
        if (r && r.success) {
          if (typeof showToast === 'function') showToast(r.message || 'สร้างวงสำเร็จ!', 'success');
          setTimeout(function() { window.location.href = 'dashboard.html'; }, 1500);
        } else {
          btn.disabled = false; btn.textContent = '🎵 สร้างวงเลย!';
          err('generalError', (r && r.message) || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        }
      });
    });

    function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    function err(id, msg) { var el = document.getElementById(id); if (el) el.textContent = msg || ''; }
    function clearErrs() {
      ['bandNameError','nicknameError','emailError','passwordError','confirmError','generalError'].forEach(function(id){ err(id); });
    }
  });