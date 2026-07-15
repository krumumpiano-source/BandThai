document.addEventListener('DOMContentLoaded', function() {
    var isLoggedIn = !!localStorage.getItem('auth_token');
    if (isLoggedIn) {
      renderMainNav('mainNav');
      if (typeof checkAdGate === 'function') checkAdGate();
      applyTranslations();
    } else {
      document.getElementById('mainNav').innerHTML =
        '<div style="background:#111827;color:#fff;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;font-family:Kanit,sans-serif">' +
        '<span style="font-size:1.1rem;font-weight:700;color:#f6ad55">\uD83C\uDFB5 BandThai</span>' +
        '<a href="index.html" style="color:#f6ad55;text-decoration:none;font-size:.9rem">\u2190 \u0E01\u0E25\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A</a>' +
        '</div>';
    }
    // TOC scroll tracking
    var sections = document.querySelectorAll('.m-section');
    var tocItems = document.querySelectorAll('.toc-item');
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          tocItems.forEach(function(t) { t.classList.remove('active'); });
          var active = document.querySelector('.toc-item[href="#' + e.target.id + '"]');
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    sections.forEach(function(s) { observer.observe(s); });
  });