(function () {
  // v3: el aviso ahora también cubre Google Tag Manager (además del Meta Pixel),
  // así que se vuelve a pedir a quien aceptó o rechazó con el aviso anterior.
  var KEY = 'roce_cookie_consent_v3';
  var OLD_KEYS = ['roce_cookie_consent', 'roce_cookie_consent_v2'];
  var GTM_ID = 'GTM-KGMC2VF4';

  function loadGoogleTagManager() {
    if (window.__roceGtmLoaded) return;
    window.__roceGtmLoaded = true;
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0], j = d.createElement(s), dl = l != 'dataLayer' ? '&l=' + l : '';
      j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', GTM_ID);
  }
  var PIXEL_ID = '1122900673669175';

  function loadMetaPixel() {
    if (window.fbq) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
    // En la página de reservas (widget de CoverManager) registramos la visita a la reserva.
    if (document.querySelector('iframe[src*="covermanager.com"]')) {
      fbq('track', 'ViewContent', { content_name: 'Reserva de mesa' });
    }
  }

  var banner = document.getElementById('cookieBanner');
  if (!banner) return;

  try { OLD_KEYS.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}

  var saved = localStorage.getItem(KEY);
  if (saved) {
    banner.classList.add('is-hidden');
    if (saved === 'accepted') { loadMetaPixel(); loadGoogleTagManager(); }
    return;
  }

  var acceptBtn = document.getElementById('cookieAccept');
  var rejectBtn = document.getElementById('cookieReject');

  function setConsent(value) {
    localStorage.setItem(KEY, value);
    banner.classList.add('is-hidden');
    if (value === 'accepted') { loadMetaPixel(); loadGoogleTagManager(); }
  }

  acceptBtn.addEventListener('click', function () { setConsent('accepted'); });
  rejectBtn.addEventListener('click', function () { setConsent('rejected'); });
})();
