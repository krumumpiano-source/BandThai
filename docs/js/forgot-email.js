document.addEventListener('DOMContentLoaded', function() {

    document.getElementById('lookupForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var name  = document.getElementById('nameInput').value.trim();
      var phone = document.getElementById('phoneInput').value.trim();
      if (!name && !phone) {
        if (typeof showToast === 'function') showToast('กรุณากรอกชื่อ หรือ เบอร์โทร อย่างน้อย 1 อย่าง', 'error');
        return;
      }

      var btn = document.getElementById('searchBtn');
      btn.disabled = true; btn.textContent = '⏳ กำลังค้นหา...';

      apiCall('lookupEmail', { name: name, phone: phone }, function(r) {
        btn.disabled = false; btn.textContent = '🔍 ค้นหาอีเมลของฉัน';
        var container = document.getElementById('results');
        var list = document.getElementById('resultList');
        container.style.display = 'block';

        if (r && r.success && r.results && r.results.length > 0) {
          list.innerHTML = r.results.map(function(item) {
            return '<div class="result-card">'
              + '<div class="email-mask">' + escapeHtml(item.masked_email || '') + '</div>'
              + '<div class="email-info">'
              + (item.nickname ? '🏷️ ' + escapeHtml(item.nickname) : '')
              + (item.band_name ? ' · 🎸 ' + escapeHtml(item.band_name) : '')
              + '</div>'
              + '</div>';
          }).join('');
        } else {
          list.innerHTML = '<div class="no-result">'
            + '<p>❌ ไม่พบข้อมูลที่ตรงกัน</p>'
            + '<p style="font-size:12px;margin-top:8px">กรุณาตรวจสอบชื่อ/เบอร์โทร หรือติดต่อผู้จัดการวง</p>'
            + '</div>';
        }
      });
    });
  });