var UA = navigator.userAgent;
  var IS_IOS    = /iPhone|iPad|iPod/.test(UA);
  var IS_FB     = /FBAN|FBAV/.test(UA);
  var IS_IG     = /Instagram/.test(UA);
  var IS_LINE   = /Line\//.test(UA);
  var IS_WECHAT = /MicroMessenger/.test(UA);
  var IS_TIKTOK = /musical_ly|TikTok/.test(UA);
  var IS_INAPP  = IS_FB || IS_IG || IS_LINE || IS_WECHAT || IS_TIKTOK ||
                  (IS_IOS && /Safari/.test(UA) === false && /AppleWebKit/.test(UA));
  function getInAppName(){
    if(IS_FB) return 'Facebook'; if(IS_IG) return 'Instagram';
    if(IS_LINE) return 'LINE'; if(IS_WECHAT) return 'WeChat';
    if(IS_TIKTOK) return 'TikTok'; return 'แอปนี้';
  }
  function showToast(msg, dur){
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(function(){ t.classList.remove('show'); }, dur || 2400);
  }
  function clearErrors(){
    ['emailError','passwordError'].forEach(function(id){
      var e = document.getElementById(id); if(e) e.textContent = '';
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    if(IS_INAPP){
      var banner = document.getElementById('inappBanner');
      document.getElementById('inappAppName').textContent = getInAppName();
      var link = document.getElementById('inappOpenLink');
      var pageUrl = location.href;
      if(IS_LINE){
        link.href = pageUrl + (pageUrl.indexOf('?') >= 0 ? '&' : '?') + 'openExternalBrowser=1';
      } else {
        link.href = pageUrl;
        link.addEventListener('click', function(e){
          e.preventDefault();
          var intent = 'intent://' + pageUrl.replace(/^https?:\/\//, '') +
                       '#Intent;scheme=https;package=com.android.chrome;end';
          window.location = IS_IOS ? pageUrl : intent;
          setTimeout(function(){ window.location = pageUrl; }, 800);
        });
      }
      banner.classList.add('show');
    }
    document.getElementById('togglePassword').addEventListener('click', function(){
      var pw = document.getElementById('password');
      if(pw.type === 'password'){ pw.type = 'text'; this.innerHTML = '&#128584;'; }
      else { pw.type = 'password'; this.innerHTML = '&#128065;'; }
    });
    document.getElementById('loginForm').addEventListener('submit', function(e){
      e.preventDefault();
      clearErrors();
      var email    = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        document.getElementById('emailError').textContent = 'อีเมลไม่ถูกต้อง'; return;
      }
      if(!password){
        document.getElementById('passwordError').textContent = 'กรุณากรอกรหัสผ่าน'; return;
      }
      var btn = document.getElementById('loginBtn');
      btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ...';
      apiCall('login', { email: email, password: password }, function(r){
        btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
        if(r && r.success){
          localStorage.setItem('auth_token', r.token);
          localStorage.setItem('userName',   r.userName || '');
          localStorage.setItem('userEmail',  email);
          localStorage.setItem('bandName',   r.bandName || '');
          localStorage.setItem('bandId',     r.bandId   || '');
          localStorage.setItem('userRole',   r.role     || 'member');
          if(r.role === 'manager' || r.role === 'admin')
            localStorage.setItem('bandManager', '1');
          else
            localStorage.removeItem('bandManager');
          window.location.href = 'dashboard.html';
        } else {
          document.getElementById('emailError').textContent =
            (r && r.message) || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        }
      });
    });
  });