/**
 * Band Management By SoulCiety — Navigation (Sidebar)
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
    navLink('dashboard',     '📊 ' + _t('nav_dashboard'),    'ภาพรวมงาน & สถิติด่วน') +
    navLink('songs',         '🎵 ' + _t('nav_songs'),        'คลังเพลงและเซ็ตลิสต์') +
    navLink('song-insights', '🎙️ ' + _t('nav_songInsights'), 'สถิติการเล่นเพลง') +
    navLink('schedule',      '📅 ' + _t('nav_schedule'),     'ปฏิทินงานและตารางนัด') +
    navLink('statistics',    '📈 ' + _t('nav_statistics'),   'รายได้ & สถิติรายเดือน') +
    navLink('equipment',     '🎸 ' + _t('nav_equipment'),    'อุปกรณ์วงและงบซ่อมบำรุง') +
    navLink('band-info',     '👥 ' + _t('nav_bandInfo'),     'สมาชิก ช่องทางติดต่อ ร้านที่เล่น') +
    navLink('my-profile',    '👤 ' + _t('nav_myProfile'),    'ข้อมูลส่วนตัวและอัตราค่าตัว');

  // ── เมนูผู้จัดการวง ───────────────────────────────────
  var managerLinks = isManager ? (
    navSection('👔 ผู้จัดการวง') +
    navLink('attendance-payroll', '📋 ' + _t('nav_attendance'),    'บันทึกเข้างานและค่าตัว') +
    navLink('job-calculator',     '🧮 ' + _t('nav_jobCalculator'), 'คำนวณราคารับงาน') +
    navLink('band-fund',          '💰 ' + _t('nav_bandFund'),      'กองกลางและค่าใช้จ่ายวง') +
    navLink('external-payout',    '💵 ' + _t('nav_externalPayout'),'จ่ายเงินให้บุคคลภายนอก') +
    navLink('quotation',          '📄 ' + _t('nav_quotation'),     'สร้างและส่งใบเสนอราคา') +
    navLink('clients',            '🤝 ' + _t('nav_clients'),       'ข้อมูลลูกค้าและสถานที่') +
    navLink('band-settings',      '⚙️ ' + _t('nav_settings'),     'ตั้งค่าวง ร้าน และตาราง')
  ) : '';

  // ── เมนูแอดมิน ────────────────────────────────────────
  var adminLinks = isAdmin ? (
    navSection('🔧 แอดมิน') +
    navLink('admin', '🔧 ' + _t('nav_admin'), 'จัดการผู้ใช้และระบบ')
  ) : '';

  container.innerHTML =
    /* ── Topbar (mobile only) ──────────────── */
    '<header class="nav-topbar">' +
      '<button class="nav-hamburger" id="navHamburger" aria-label="เปิดเมนู" aria-expanded="false">' +
        '<span></span><span></span><span></span>' +
      '</button>' +
      '<a href="' + dashHref() + '" class="nav-topbar-brand">🎵 ' + _escHtml(bandName) + '</a>' +
      '<div class="nav-topbar-right">' +
        '<div id="navLangSwitcherTop"></div>' +
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
        '<div id="navLangSwitcher"></div>' +
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

  // ── Lang switchers ────────────────────────────────────
  if (typeof renderLangSwitcher === 'function') {
    renderLangSwitcher('navLangSwitcher');
    renderLangSwitcher('navLangSwitcherTop');
  } else {
    _renderNavLang('navLangSwitcher');
    _renderNavLang('navLangSwitcherTop');
  }

  // Remove old bottom tab bar if exists
  var oldBar = document.getElementById('_bottomTabBar');
  if (oldBar) oldBar.parentNode.removeChild(oldBar);
}

function _renderNavLang(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  var lang = typeof getLang === 'function' ? getLang() : 'th';
  el.innerHTML =
    '<div class="lang-switcher">' +
      '<button type="button" class="lang-btn ' + (lang==='th'?'active':'') + '" data-lang="th">TH</button>' +
      '<button type="button" class="lang-btn ' + (lang==='en'?'active':'') + '" data-lang="en">EN</button>' +
    '</div>';
  el.querySelectorAll('[data-lang]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (typeof setLang === 'function') setLang(btn.dataset.lang);
      renderMainNav('mainNav');
      if (typeof applyTranslations === 'function') applyTranslations();
    });
  });
}

function renderLangSwitcher(containerId) { _renderNavLang(containerId); }

function doLogout() {
  var token = typeof getAuthToken === 'function' ? getAuthToken() : (localStorage.getItem('auth_token') || '');
  if (token && token.indexOf('demo_') !== 0 && typeof apiCall === 'function') {
    apiCall('logout', { _token: token }, function() {});
  }
  ['auth_token','bandId','bandName','bandManager','userRole','userName','bandSettings',
   'userTitle','userFirstName','userLastName','userNickname','userInstrument','userEmail'].forEach(function(k) {
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
