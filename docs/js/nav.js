/**
 * BandFlow — Navigation (Sidebar)
 * renderMainNav() — ไฟล์นี้เป็นที่เดียวที่ renderMainNav ถูกนิยาม
 */

function renderMainNav(containerId) {
  if (typeof ensureDemoSession === 'function') ensureDemoSession();
  var container = document.getElementById(containerId || 'mainNav');
  if (!container) return;

  var bandName     = localStorage.getItem('bandName') || (typeof t === 'function' ? t('yourBand') : 'วงของคุณ');
  var bandProvince = localStorage.getItem('bandProvince') || '';
  // ชื่อสั้นเพื่อแสดง topbar: ชื่อเล่น
  var nickName   = localStorage.getItem('userNickname') || '';
  var firstName  = localStorage.getItem('userFirstName') || '';
  var lastName   = localStorage.getItem('userLastName')  || '';
  var userTitle  = localStorage.getItem('userTitle')     || '';
  var instrument = localStorage.getItem('userInstrument')|| '';
  var rawName    = localStorage.getItem('userName')      || (typeof t === 'function' ? t('user') : 'ผู้ใช้');
  // ชื่อเล่น > first_name > userName
  var userName   = nickName || firstName || rawName;
  // ชื่อเต็มสำหรับแสดงใน sidebar (คำนำหน้า ชื่อ นามสกุล)
  var fullName   = [userTitle !== 'ไม่ระบุ' ? userTitle : '', firstName, lastName].filter(Boolean).join(' ') || userName;
  var userRole  = localStorage.getItem('userRole') || 'member';
  var isAdmin   = userRole === 'admin';
  var isManager = !!(localStorage.getItem('bandManager') || userRole === 'manager' || isAdmin);
  var _t = typeof t === 'function' ? t : function(k) { return k; };

  function dashHref() { return 'dashboard.html'; }
  function indexHref() { return 'index.html'; }

  // ── ตรวจ active page ──────────────────────────────────
  var currentPage = (window.location.pathname.split('/').pop() || 'dashboard.html').replace('.html', '');

  function navLink(page, label, desc) {
    var isActive = currentPage === page ? ' active' : '';
    var href = page + '.html';
    return '<li><a href="' + href + '" class="nav-link' + isActive + '">' + label
      + (desc ? '<span class="nav-link-desc">' + desc + '</span>' : '')
      + '</a></li>';
  }
  function navSection(label) {
    return '<li class="nav-section-title">' + label + '</li>';
  }

  // ── Role display label ────────────────────────────────
  var roleLabel = isAdmin
    ? '🔧 Admin &nbsp;·&nbsp; 👔 ผู้จัดการวง'
    : isManager ? '👔 ผู้จัดการวง' : '🎸 สมาชิกวง';
  // แสดงตำแหน่ง/เครื่องดนตรีใน sidebar
  var instrumentBadge = instrument
    ? '<div class="sidebar-user-instrument">' + _escHtml(instrument) + '</div>'
    : '';
  // ── เมนูสมาชิกวง (ทุกบทบาท) ─────────────────────────
  var memberLinks =
    navSection('🎸 สมาชิกวง') +
    navLink('dashboard',     '📊 ' + _t('nav_dashboard'),    'ภาพรวมงาน สถิติ และทางลัด') +
    navLink('songs',         '🎵 ' + _t('nav_songs'),        'คลังเพลงและเซ็ตลิสต์') +
    navLink('song-insights', '🎙️ ' + _t('nav_songInsights'), 'เพลงที่เล่นบ่อย / ไม่เคยเล่น') +
    navLink('schedule',      '📅 ' + _t('nav_schedule'),     'ปฏิทินงานและตารางนัด') +
    navLink('statistics',    '📈 ' + _t('nav_statistics'),   'สรุปรายได้ & สถิติรายเดือน') +
    navLink('equipment',     '🎸 ' + _t('nav_equipment'),    'อุปกรณ์วงและงบซ่อมบำรุง') +
    navLink('band-fund',     '💰 ' + _t('nav_bandFund'),     'บัญชีรายรับรายจ่ายกองกลาง') +
    navLink('band-info',     '👥 ' + _t('nav_bandInfo'),     'สมาชิก ช่องทางติดต่อ ร้านที่เล่น') +
    navLink('my-profile',    '👤 ' + _t('nav_myProfile'),    'ข้อมูลส่วนตัวและอัตราค่าตัว');

  // ── ลิงก์อัปเกรด (แสดงเฉพาะ free/lite) ──────────────
  var _plan = (localStorage.getItem('band_plan') || 'free').toLowerCase();
  var upgradeLink = (_plan !== 'pro')
    ? '<li><a href="upgrade.html" class="nav-link' + (currentPage === 'upgrade' ? ' active' : '') + '" style="color:#f59e0b;font-weight:700">'
      + (_plan === 'lite' ? '⬆️ อัปเกรดเป็น Pro' : '🚀 อัปเกรดแผน') + '<span class="nav-link-desc">'
      + (_plan === 'lite' ? 'ปลดล็อกฟีเจอร์ Pro ทั้งหมด' : 'ใช้งานไม่จำกัด เริ่มต้น 99฿/เดือน')
      + '</span></a></li>'
    : '';

  memberLinks += upgradeLink;

  // ── เมนูผู้จัดการวง ───────────────────────────────────
  var managerLinks = isManager ? (
    navSection('👔 ผู้จัดการวง') +
    navLink('attendance-payroll', '📋 ' + _t('nav_attendance'),    'เช็คชื่อเข้างาน & จ่ายค่าตัว') +
    navLink('job-calculator',     '🧮 ' + _t('nav_jobCalculator'), 'ตั้งราคารับงานนอก') +
    navLink('quotation',          '📄 ' + _t('nav_quotation'),     'สร้างและส่งใบเสนอราคา') +
    navLink('contract',           '📜 สัญญาว่าจ้าง',               'สัญญาจ้างวงดนตรี') +
    navLink('external-payout',    '💵 ' + _t('nav_externalPayout'),'จ่ายเงินให้คนนอกวง') +
    navLink('job-history',        '📁 ประวัติงานนอก',               'ประวัติและรายละเอียดงานนอกทั้งหมด') +
    navLink('band-settings',      '⚙️ ' + _t('nav_settings'),     'ตั้งค่าวง ร้าน และตาราง')
  ) : '';

  // ── เมนูแอดมิน ────────────────────────────────────────
  var adminLinks = isAdmin ? (
    navSection('🔧 แอดมิน') +
    navLink('admin',       '🔧 ' + _t('nav_admin'),    'จัดการผู้ใช้และระบบ') +
    navLink('admin-songs', '🎵 คลังเพลง Admin',        'เพิ่ม แก้ไข ลบเพลงในคลัง')
  ) : '';

  container.innerHTML =
    /* ── Topbar (mobile only) ──────────────── */
    '<header class="nav-topbar">' +
      '<button class="nav-hamburger" id="navHamburger" aria-label="เปิดเมนู" aria-expanded="false">' +
        '<span></span><span></span><span></span>' +
      '</button>' +
      '<a href="' + dashHref() + '" class="nav-topbar-brand">🎵 ' + _escHtml(bandName) + '</a>' +
      '<div class="nav-topbar-right">' +
        '<span class="nav-user-name">' + _escHtml(userName) + '</span>' +
      '</div>' +
    '</header>' +

    /* ── Backdrop ──────────────────────────── */
    '<div class="nav-backdrop" id="navBackdrop"></div>' +

    /* ── Sidebar ───────────────────────────── */
    '<aside class="nav-sidebar" id="navSidebar" aria-label="เมนูหลัก">' +
      '<div class="sidebar-header">' +
        '<a href="' + dashHref() + '" class="sidebar-brand">🎵 ' + _escHtml(bandName) + (bandProvince ? '<span class="sidebar-province"> (' + _escHtml(bandProvince) + ')</span>' : '') + '</a>' +
        '<button class="sidebar-close" id="navClose" aria-label="ปิดเมนู">✕</button>' +
      '</div>' +
      '<div class="sidebar-user">' +
        '<div class="sidebar-avatar">🎤</div>' +
        '<div class="sidebar-user-info">' +
          '<div class="sidebar-user-name">' + _escHtml(fullName) + '</div>' +
          (nickName && nickName !== fullName ? '<div style="font-size:var(--text-xs);color:var(--premium-text-muted);">(' + _escHtml(nickName) + ')</div>' : '') +
          instrumentBadge +
          '<div class="sidebar-user-role">' + roleLabel + '</div>' +
        '</div>' +
      '</div>' +
      '<nav class="sidebar-nav">' +
        '<ul class="nav-menu">' +
          memberLinks +
          managerLinks +
          adminLinks +
        '</ul>' +
      '</nav>' +
      '<div class="sidebar-footer">' +
        '<a href="' + indexHref() + '" class="nav-logout" onclick="if(typeof doLogout===\'function\')doLogout();return true;">' + _t('logout') + '</a>' +
      '</div>' +
    '</aside>';

  // ── Toggle logic ──────────────────────────────────────
  var hamburger = document.getElementById('navHamburger');
  var sidebar   = document.getElementById('navSidebar');
  var backdrop  = document.getElementById('navBackdrop');
  var closeBtn  = document.getElementById('navClose');

  function navOpen() {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function navClose() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (hamburger) hamburger.addEventListener('click', function(e) {
    e.stopPropagation();
    sidebar.classList.contains('open') ? navClose() : navOpen();
  });
  if (closeBtn)  closeBtn.addEventListener('click', navClose);
  if (backdrop)  backdrop.addEventListener('click', navClose);

  // Close sidebar on link click (mobile)
  if (sidebar) sidebar.querySelectorAll('a.nav-link').forEach(function(a) {
    a.addEventListener('click', function() {
      if (window.innerWidth < 1024) navClose();
    });
  });

  // Keyboard: Escape key closes
  document.addEventListener('keydown', function kh(e) {
    if (e.key === 'Escape') { navClose(); document.removeEventListener('keydown', kh); }
  });

  // Remove old bottom tab bar if exists
  var oldBar = document.getElementById('_bottomTabBar');
  if (oldBar) oldBar.parentNode.removeChild(oldBar);

  // ── Ad Countdown Timer (Free tier เท่านั้น) ──────────────────────
  if (typeof getAdTimeRemaining === 'function') {
    startAdCountdown();
  }

  // ── FAQ Chatbot ───────────────────────────────────────────────────
  renderFaqBot();
}

// ── Ad Countdown Timer ──────────────────────────────────────────────
function startAdCountdown() {
  var remaining = typeof getAdTimeRemaining === 'function' ? getAdTimeRemaining() : -1;
  if (remaining < 0) return; // Lite/Pro ไม่แสดง

  // สร้าง / reset element
  var el = document.getElementById('_adCountdown');
  if (!el) {
    el = document.createElement('div');
    el.id = '_adCountdown';
    document.body.appendChild(el);
  }
  if (el._adTimer) clearInterval(el._adTimer);

  function update() {
    var rem = typeof getAdTimeRemaining === 'function' ? getAdTimeRemaining() : 0;
    if (rem <= 0) {
      clearInterval(el._adTimer);
      el.style.display = 'none';
      showAdExpiredModal();
      return;
    }
    var h = Math.floor(rem / 3600000);
    var m = Math.floor((rem % 3600000) / 60000);
    var s = Math.floor((rem % 60000) / 1000);
    el.textContent = '⏱ ' + (h ? h + ':' : '') + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }
  update();
  el._adTimer = setInterval(update, 1000);
}

function showAdExpiredModal() {
  if (document.getElementById('_adExpiredOverlay')) return;
  var ov = document.createElement('div');
  ov.id = '_adExpiredOverlay';
  ov.className = 'ad-expired-overlay';
  ov.innerHTML =
    '<div class="ad-expired-card">' +
      '<div style="font-size:2.5rem">⏰</div>' +
      '<h3 style="margin:12px 0 8px">หมดเวลาใช้งาน</h3>' +
      '<p style="color:var(--text-secondary);margin-bottom:20px">กรุณาดูโฆษณาสั้นๆ 30 วินาที เพื่อใช้งานต่ออีก 75 นาที</p>' +
      '<button class="btn btn-primary" onclick="location.replace(\'ad-gate.html\')">▶ ดูโฆษณา</button>' +
    '</div>';
  document.body.appendChild(ov);
}

function doLogout() {
  var token = typeof getAuthToken === 'function' ? getAuthToken() : (localStorage.getItem('auth_token') || '');
  if (token && token.indexOf('demo_') !== 0 && typeof apiCall === 'function') {
    apiCall('logout', { _token: token }, function() {});
  }
  ['auth_token','bandId','bandName','bandManager','userRole','userName','bandSettings',
   'userTitle','userFirstName','userLastName','userNickname','userInstrument','userEmail',
   'band_plan','ad_gate_ts'].forEach(function(k) {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
}

function _escHtml(text) {
  if (!text) return '';
  var d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

// ── FAQ Chatbot ──────────────────────────────────────────────────────────────
var FAQ_DATA = {
  th: {
    greeting: 'สวัสดีครับ 👋 จะถามเรื่องอะไรดีครับ?',
    catLabel: 'หมวดอื่นในหมวดนี้:',
    backLabel: '◀ กลับหมวดหมู่',
    headerSub: 'เลือกคำถามที่ต้องการ',
    catGreet: function(cat) { return cat + ' — เลือกคำถามได้เลยครับ'; },
    general: {
      label: '📌 ทั่วไป',
      items: [
        { q: 'วิธี Login เข้าระบบ', a: 'เปิดแอป → ใส่ Email และ Password ที่สมัครไว้ → กด "เข้าสู่ระบบ"\n\nหากลืมรหัสผ่าน กดที่ "ลืมรหัสผ่าน?" ใต้ปุ่ม Login' },
        { q: 'ลืมรหัสผ่านทำยังไง', a: 'หน้า Login → กด "ลืมรหัสผ่าน?" → ใส่ Email → กดยืนยัน\nระบบจะส่งลิงก์ Reset ไปที่ Email ของคุณ' },
        { q: 'วิธีแก้ไขโปรไฟล์ตัวเอง', a: '📌 เมนู My Profile → กดแก้ไขข้อมูล\nเช่น ชื่อ เครื่องดนตรี อัตราค่าตัว เบอร์โทร รูปบัตรประชาชน' },
        { q: 'วิธีเปลี่ยนภาษา (TH/EN)', a: 'กดปุ่ม TH / EN ที่มุมซ้ายล่างของเมนู sidebar\nหรือที่ด้านขวาบนของหน้าจอ (มือถือ)' },
      ]
    },
    member: {
      label: '🎸 สมาชิกวง',
      items: [
        { q: 'วิธีลงเวลาประจำวัน (Check-In)', a: '📍 หน้า Dashboard → กล่อง "ลงเวลาประจำวัน"\n1. เลือกวัน (ค่าเริ่มต้นคือวันนี้)\n2. เลือกร้าน (ถ้ามีหลายร้าน)\n3. เลือกรอบเวลาที่เล่น\n4. กด ✅ ยืนยันลงเวลา' },
        { q: 'วิธีลา / แจ้งขาดงาน', a: '📍 Dashboard → กล่องลงเวลา → กดปุ่ม "🚫 ลา"\n→ กรอกชื่อคนมาแทน หรือเลือก "ไม่มีคนแทน"\n→ กด ✅ ยืนยันลา' },
        { q: 'ดูตารางงานได้ที่ไหน', a: '📅 เมนู "ตารางงาน" (Schedule)\nจะแสดงงานและวันซ้อมทั้งหมด แบ่งตามสัปดาห์/เดือน' },
        { q: 'ดูรายได้ของตัวเองได้ที่ไหน', a: '📊 Dashboard → กล่อง "สรุปรายได้ของฉัน"\nหรือไปที่เมนู 📈 สถิติ เพื่อดูรายละเอียดเพิ่มเติม' },
        { q: 'วิธีดูรายชื่อสมาชิกวง', a: '👥 เมนู "ข้อมูลวง" (Band Info)\nจะแสดงรายชื่อ เบอร์โทร เครื่องดนตรีของสมาชิกทุกคน' },
        { q: 'วิธีดูเพลง / เซ็ตลิสต์', a: '🎵 เมนู "รายการเพลง" (Songs)\nดูเพลงทั้งหมดในคลัง และเซ็ตลิสต์ประจำวัน' },
      ]
    },
    manager: {
      label: '👔 ผู้จัดการวง',
      items: [
        { q: 'วิธีเชิญสมาชิกเข้าวง', a: '👥 เมนู "ข้อมูลวง" → ดูรหัสวง (Band Code)\nส่งรหัสนี้ให้สมาชิก → ให้เขาไปที่หน้า Register → กรอกรหัสวง\nหรือกด "คัดลอกลิงก์เชิญ" เพื่อแชร์ได้เลย' },
        { q: 'วิธีตั้งค่าวง (ชื่อ ร้าน ตาราง)', a: '⚙️ เมนู "ตั้งค่าวง" (Band Settings)\nตั้งได้: ชื่อวง จังหวัด ร้านที่เล่น รอบเวลา ค่าตัวสมาชิก' },
        { q: 'วิธีสร้างใบเสนอราคา', a: '📄 เมนู "ใบเสนอราคา" (Quotation)\nกรอกรายละเอียดงาน → ระบบสร้าง PDF ให้อัตโนมัติ\nสามารถส่ง หรือดาวน์โหลดได้ทันที' },
        { q: 'วิธีบันทึกการเงิน / เบิกเงิน', a: '📋 เมนู "บันทึกเข้างาน" (Attendance & Payroll)\nบันทึกการเข้างานของสมาชิก และคำนวณค่าตัวอัตโนมัติ' },
        { q: 'วิธีคำนวณราคารับงาน', a: '🧮 เมนู "คำนวณราคา" (Job Calculator)\nกรอก: จำนวนชั่วโมง จำนวนสมาชิก ค่าเดินทาง ค่าอุปกรณ์\nระบบจะคำนวณราคาแนะนำให้ทันที' },
        { q: 'วิธีอนุมัติสมาชิกใหม่', a: '📍 Dashboard → กล่อง "คำขอเข้าร่วมวง"\nกด ✅ อนุมัติ หรือ ❌ ปฏิเสธ ได้เลย' },
        { q: 'วิธีดูประวัติงานนอก', a: '📁 เมนู "ประวัติงานนอก" (Job History)\nดูรายละเอียดงานนอกทั้งหมด พร้อมสถานะและยอดเงิน' },
      ]
    }
  },
  en: {
    greeting: 'Hello 👋 What would you like to know?',
    catLabel: 'More in this category:',
    backLabel: '◀ Back to categories',
    headerSub: 'Choose a topic',
    catGreet: function(cat) { return cat + ' — Select a question'; },
    general: {
      label: '📌 General',
      items: [
        { q: 'How to login', a: 'Open the app → Enter your Email and Password → Tap "Login"\n\nIf you forgot your password, tap "Forgot password?" below the Login button.' },
        { q: 'Forgot my password', a: 'Login page → Tap "Forgot password?" → Enter your email → Confirm\nThe system will send a reset link to your email.' },
        { q: 'How to edit my profile', a: '📌 Go to My Profile menu → Tap Edit\nYou can update: name, instrument, pay rate, phone, ID card photo.' },
        { q: 'How to change language (TH/EN)', a: 'Tap TH / EN at the bottom-left of the sidebar menu\nor at the top-right of the screen (mobile).' },
      ]
    },
    member: {
      label: '🎸 Band Members',
      items: [
        { q: 'How to clock in (Check-In)', a: '📍 Dashboard → "Daily Check-In" box\n1. Select date (default is today)\n2. Select venue (if multiple)\n3. Select your time slot(s)\n4. Tap ✅ Confirm Check-In' },
        { q: 'How to request leave / absence', a: '📍 Dashboard → Check-In box → Tap "🚫 Leave"\n→ Enter substitute name or check "No substitute"\n→ Tap ✅ Confirm Leave' },
        { q: 'Where to view the schedule', a: '📅 Schedule menu\nShows all gigs and rehearsals, sorted by week/month.' },
        { q: 'Where to view my earnings', a: '📊 Dashboard → "My Earnings" summary box\nOr go to 📈 Statistics menu for detailed breakdown.' },
        { q: 'How to see band members list', a: '👥 Band Info menu\nShows all members with phone, instrument, and contact info.' },
        { q: 'How to view songs / setlist', a: '🎵 Songs menu\nBrowse the song library and view today\'s setlist.' },
      ]
    },
    manager: {
      label: '👔 Band Manager',
      items: [
        { q: 'How to invite members', a: '👥 Band Info menu → Find the Band Code\nShare this code with members → they go to Register → enter the code\nOr tap "Copy Invite Link" to share directly.' },
        { q: 'How to configure band settings', a: '⚙️ Band Settings menu\nConfigure: band name, province, venues, time slots, member pay rates.' },
        { q: 'How to create a quotation', a: '📄 Quotation menu\nFill in job details → system generates a PDF automatically\nYou can send or download it immediately.' },
        { q: 'How to manage payroll', a: '📋 Attendance & Payroll menu\nRecord member attendance and auto-calculate pay.' },
        { q: 'How to calculate job pricing', a: '🧮 Job Calculator menu\nEnter: hours, number of members, travel, equipment costs\nThe system recommends a price instantly.' },
        { q: 'How to approve new members', a: '📍 Dashboard → "Join Requests" box\nTap ✅ Approve or ❌ Reject.' },
        { q: 'How to view external job history', a: '📁 Job History menu\nSee all external jobs with status and payment details.' },
      ]
    }
  }
};

function renderFaqBot() {
  if (document.getElementById('faqBotBtn')) return; // already rendered

  // ── Floating button ──
  var btn = document.createElement('button');
  btn.id = 'faqBotBtn';
  btn.setAttribute('aria-label', 'ช่วยเหลือ / FAQ');
  btn.innerHTML = '💬<span class="faq-badge">?</span>';
  document.body.appendChild(btn);

  // ── Panel ──
  var panel = document.createElement('div');
  panel.id = 'faqBotPanel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Help / FAQ');
  var _ld0 = (typeof getLang === 'function' && getLang() === 'en') ? FAQ_DATA.en : FAQ_DATA.th;
  panel.innerHTML =
    '<div class="faqbot-header">' +
      '<div class="faqbot-avatar">🤖</div>' +
      '<div><h4>BandFlow Help</h4><p id="faqBotHeaderSub">' + _ld0.headerSub + '</p></div>' +
      '<button class="faqbot-header-close" id="faqBotClose" aria-label="Close">✕</button>' +
    '</div>' +
    '<div class="faqbot-body" id="faqBotBody"></div>' +
    '<div class="faqbot-footer">' +
      '<button class="faqbot-back" id="faqBotBack">' + _ld0.backLabel + '</button>' +
    '</div>';
  document.body.appendChild(panel);

  var body    = document.getElementById('faqBotBody');
  var backBtn = document.getElementById('faqBotBack');

  function getLangData() {
    var lang = typeof getLang === 'function' ? getLang() : 'th';
    return FAQ_DATA[lang] || FAQ_DATA.th;
  }

  function addBubble(text, type) {
    var b = document.createElement('div');
    b.className = 'faqbot-bubble ' + type;
    b.style.whiteSpace = 'pre-line';
    b.textContent = text;
    body.appendChild(b);
    body.scrollTop = body.scrollHeight;
    return b;
  }

  function showCategories() {
    body.innerHTML = '';
    backBtn.style.display = 'none';
    var ld = getLangData();
    addBubble(ld.greeting, 'bot');
    var role = localStorage.getItem('userRole') || 'member';
    var isManager = role === 'manager' || role === 'admin';

    var wrap = document.createElement('div');
    wrap.className = 'faqbot-qs';

    var cats = isManager
      ? [ld.general, ld.manager, ld.member]
      : [ld.general, ld.member, ld.manager];

    cats.forEach(function(cat) {
      var q = document.createElement('button');
      q.className = 'faqbot-q';
      q.textContent = cat.label;
      q.addEventListener('click', function() { showCategory(cat); });
      wrap.appendChild(q);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  function showCategory(cat) {
    body.innerHTML = '';
    backBtn.style.display = 'flex';
    var ld = getLangData();
    addBubble(ld.catGreet(cat.label), 'bot');
    var wrap = document.createElement('div');
    wrap.className = 'faqbot-qs';
    cat.items.forEach(function(item) {
      var q = document.createElement('button');
      q.className = 'faqbot-q';
      q.textContent = item.q;
      q.addEventListener('click', function() { showAnswer(item, cat); });
      wrap.appendChild(q);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  function showAnswer(item, cat) {
    body.innerHTML = '';
    backBtn.style.display = 'flex';
    var ld = getLangData();
    addBubble(item.q, 'user');
    setTimeout(function() {
      addBubble(item.a, 'bot');
      var moreWrap = document.createElement('div');
      moreWrap.className = 'faqbot-qs';
      moreWrap.style.marginTop = '4px';
      var moreLabel = document.createElement('div');
      moreLabel.style.cssText = 'font-size:.72rem;color:#94a3b8;margin-bottom:4px';
      moreLabel.textContent = ld.catLabel;
      moreWrap.appendChild(moreLabel);
      cat.items.filter(function(i){ return i.q !== item.q; }).slice(0,3).forEach(function(other) {
        var q = document.createElement('button');
        q.className = 'faqbot-q';
        q.textContent = other.q;
        q.addEventListener('click', function() { showAnswer(other, cat); });
        moreWrap.appendChild(q);
      });
      body.appendChild(moreWrap);
      body.scrollTop = body.scrollHeight;
    }, 200);
  }

  // ── Toggle open/close ──
  function openPanel() {
    panel.classList.add('open');
    btn.querySelector('.faq-badge').style.display = 'none';
    // update labels to current language
    var ld = getLangData();
    var backEl = document.getElementById('faqBotBack');
    var subEl  = document.getElementById('faqBotHeaderSub');
    if (backEl) backEl.textContent = ld.backLabel;
    if (subEl)  subEl.textContent  = ld.headerSub;
    if (!body.innerHTML) showCategories();
  }
  function closePanel() { panel.classList.remove('open'); }

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    panel.classList.contains('open') ? closePanel() : openPanel();
  });
  document.getElementById('faqBotClose').addEventListener('click', closePanel);
  backBtn.addEventListener('click', showCategories);

  // Close on outside click — stopPropagation inside panel prevents
  // removed-DOM-node from falsely triggering close
  panel.addEventListener('click', function(e) { e.stopPropagation(); });
  document.addEventListener('click', function(e) {
    if (panel.classList.contains('open')) closePanel();
  });
}
