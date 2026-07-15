document.addEventListener('DOMContentLoaded', function() {
    var loadingBox = document.getElementById('loadingBox');
    var errorBox   = document.getElementById('errorBox');
    var successBox = document.getElementById('successBox');
    var resetForm  = document.getElementById('resetForm');

    function showError(msg) {
      loadingBox.style.display = 'none';
      resetForm.style.display  = 'none';
      successBox.style.display = 'none';
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    }

    function showForm() {
      loadingBox.style.display = 'none';
      errorBox.style.display   = 'none';
      resetForm.style.display  = 'block';
    }

    function showSuccess() {
      loadingBox.style.display = 'none';
      errorBox.style.display   = 'none';
      resetForm.style.display  = 'none';
      successBox.style.display = 'block';
      setTimeout(function() { window.location.href = 'index.html'; }, 2500);
    }

    // รอ Supabase SDK โหลดเสร็จ แล้วตรวจสอบ session
    function waitAndCheck() {
      if (typeof apiCall === 'undefined') {
        setTimeout(waitAndCheck, 200);
        return;
      }

      // Supabase จะ auto-detect recovery token จาก URL hash
      // และสร้าง session ให้อัตโนมัติผ่าน onAuthStateChange
      // รอ session สักครู่
      var attempts = 0;
      var maxAttempts = 25; // 5 วินาที

      function checkSession() {
        attempts++;
        // ตรวจว่ามี auth session จาก recovery link
        if (typeof sb !== 'undefined' && sb.auth) {
          sb.auth.getSession().then(function(res) {
            if (res.data && res.data.session) {
              showForm();
            } else if (attempts < maxAttempts) {
              setTimeout(checkSession, 200);
            } else {
              showError('ลิงก์รีเซ็ตหมดอายุหรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่');
            }
          });
        } else if (attempts < maxAttempts) {
          setTimeout(checkSession, 200);
        } else {
          showError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองใหม่');
        }
      }

      checkSession();
    }

    waitAndCheck();

    // Handle form submit
    resetForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var pw  = document.getElementById('newPassword').value;
      var pw2 = document.getElementById('confirmPassword').value;

      if (pw.length < 6) {
        if (typeof showToast === 'function') showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
        return;
      }
      if (pw !== pw2) {
        if (typeof showToast === 'function') showToast('รหัสผ่านไม่ตรงกัน', 'error');
        return;
      }

      var btn = document.getElementById('resetBtn');
      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก...';

      apiCall('resetPassword', { newPassword: pw }, function(r) {
        if (r && r.success) {
          showSuccess();
        } else {
          btn.disabled = false;
          btn.textContent = '✅ ตั้งรหัสผ่านใหม่';
          if (typeof showToast === 'function') showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
        }
      });
    });
  });