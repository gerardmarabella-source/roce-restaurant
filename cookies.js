(function () {
  // v2: el aviso ahora cubre publicidad (Meta Pixel), así que se vuelve a pedir
  // a quien aceptó o rechazó con el aviso anterior.
  var KEY = 'roce_cookie_consent_v2';
  var OLD_KEY = 'roce_cookie_consent';
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

  try { localStorage.removeItem(OLD_KEY); } catch (e) {}

  var saved = localStorage.getItem(KEY);
  if (saved) {
    banner.classList.add('is-hidden');
    if (saved === 'accepted') loadMetaPixel();
    return;
  }

  var acceptBtn = document.getElementById('cookieAccept');
  var rejectBtn = document.getElementById('cookieReject');

  function setConsent(value) {
    localStorage.setItem(KEY, value);
    banner.classList.add('is-hidden');
    if (value === 'accepted') loadMetaPixel();
  }

  acceptBtn.addEventListener('click', function () { setConsent('accepted'); });
  rejectBtn.addEventListener('click', function () { setConsent('rejected'); });
})();
