(function () {
  var KEY = 'roce_cookie_consent';
  var banner = document.getElementById('cookieBanner');
  if (!banner) return;

  if (localStorage.getItem(KEY)) {
    banner.classList.add('is-hidden');
    return;
  }

  var acceptBtn = document.getElementById('cookieAccept');
  var rejectBtn = document.getElementById('cookieReject');

  function setConsent(value) {
    localStorage.setItem(KEY, value);
    banner.classList.add('is-hidden');
  }

  acceptBtn.addEventListener('click', function () { setConsent('accepted'); });
  rejectBtn.addEventListener('click', function () { setConsent('rejected'); });
})();
