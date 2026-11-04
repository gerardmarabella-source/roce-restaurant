// Aviso de espacio +18 (Night y sus reservas de noche).
//
// Una vez por visita (sessionStorage) se pide confirmar que se tiene 18 años o más.
// Es un aviso, no una verificación de edad. Si hay aviso de cookies sin resolver,
// espera a que se cierre para no apilar dos avisos.
//
//   ROCE_AGE.ask(onYes, onNo)   muestra el aviso (o llama a onYes si ya se confirmó)
//   ROCE_AGE.confirmed()        ¿ya se confirmó en esta visita?
(function () {
  var KEY = 'roce_age_ok';
  var CSS = '.age-gate{position:fixed;inset:0;z-index:590;display:flex;align-items:center;justify-content:center;padding:1.25rem;background:rgba(0,0,0,.86);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);overflow-y:auto}' +
    '.age-gate[hidden]{display:none}' +
    '.age-card{width:min(100%,30rem);background:#0a0a0a;color:#ece7dd;border:1px solid rgba(236,231,221,.35);padding:1.75rem 1.5rem 1.5rem;display:flex;flex-direction:column;gap:1.1rem}' +
    '.age-badge-lg{width:4.2rem;height:4.2rem}' +
    '.age-title{font-family:var(--display,"Helvetica Neue",Arial,sans-serif);font-size:clamp(1.9rem,7vw,2.6rem);line-height:.95;text-transform:uppercase;letter-spacing:.01em;font-weight:400}' +
    '.age-text{font-size:.95rem;line-height:1.55}' +
    '.age-actions{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}' +
    '.age-actions button{min-height:3.4rem;padding:.8rem 1rem;border:2px solid #ece7dd;border-radius:0;font-family:var(--display,"Helvetica Neue",Arial,sans-serif);font-size:1.05rem;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}' +
    '.age-yes{background:#ece7dd;color:#0a0a0a}.age-no{background:transparent;color:#ece7dd}' +
    '@media (max-width:420px){.age-actions{grid-template-columns:1fr}}';
  var BADGE = '<svg class="age-badge-lg" viewBox="0 0 100 100" role="img" aria-label="+18"><circle cx="50" cy="50" r="44" fill="#ffffff" stroke="#e5453a" stroke-width="9"/><text x="44" y="65" text-anchor="middle" font-family="\'Helvetica Neue Web\',\'Helvetica Neue\',Arial,sans-serif" font-weight="700" font-size="46" letter-spacing="-3" fill="#0a0a0a">18</text><text x="77" y="52" text-anchor="middle" font-family="\'Helvetica Neue Web\',\'Helvetica Neue\',Arial,sans-serif" font-weight="700" font-size="30" fill="#0a0a0a">+</text></svg>';
  var FALLBACK = {
    es: { age_title: 'Estás entrando en un espacio +18', age_text: 'Las reservas de noche son para mayores de 18 años. ¿Tienes 18 años o más?', age_yes: 'Sí, tengo 18 o más', age_no: 'No, ir a Day' },
    en: { age_title: "You're entering an 18+ space", age_text: 'Evening bookings are for guests aged 18 and over. Are you 18 or older?', age_yes: "Yes, I'm 18 or older", age_no: 'No, take me to Day' }
  };

  function confirmed() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function lang() { return window.ROCE_I18N && window.ROCE_I18N.getLang ? window.ROCE_I18N.getLang() : 'es'; }
  function t(k) { var v = window.ROCE_I18N && window.ROCE_I18N.t && window.ROCE_I18N.t(k); return v && v !== k ? v : FALLBACK[lang()][k]; }

  var gate = null, pending = null;
  function build() {
    if (gate) return gate;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    gate = document.createElement('div'); gate.className = 'age-gate'; gate.hidden = true;
    gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-modal', 'true'); gate.setAttribute('aria-labelledby', 'ageTitle');
    gate.innerHTML = '<div class="age-card">' + BADGE +
      '<h2 class="age-title" id="ageTitle" data-i18n="age_title"></h2>' +
      '<p class="age-text" data-i18n="age_text"></p>' +
      '<div class="age-actions"><button type="button" class="age-yes" data-i18n="age_yes"></button><button type="button" class="age-no" data-i18n="age_no"></button></div></div>';
    document.body.appendChild(gate);
    gate.querySelector('.age-yes').addEventListener('click', function () { answer(true); });
    gate.querySelector('.age-no').addEventListener('click', function () { answer(false); });
    document.addEventListener('roce:lang', paint);
    return gate;
  }
  function paint() {
    if (!gate) return;
    gate.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
  }
  function answer(yes) {
    gate.hidden = true; document.documentElement.classList.remove('age-open');
    var p = pending; pending = null;
    if (yes) { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} if (p && p.yes) p.yes(); }
    else if (p && p.no) p.no();
  }
  function show() {
    build(); paint(); gate.hidden = false; document.documentElement.classList.add('age-open');
    var y = gate.querySelector('.age-yes'); if (y) y.focus();
  }
  function waitForCookies(fn) {
    var b = document.getElementById('cookieBanner');
    if (!b || b.classList.contains('is-hidden') || b.classList.contains('is-compact')) return fn();
    var mo = new MutationObserver(function () { if (b.classList.contains('is-hidden')) { mo.disconnect(); fn(); } });
    mo.observe(b, { attributes: true, attributeFilter: ['class'] });
  }

  window.ROCE_AGE = {
    confirmed: confirmed,
    ask: function (yes, no) {
      if (confirmed()) { if (yes) yes(); return; }
      pending = { yes: yes, no: no };
      waitForCookies(show);
    }
  };
  var css = document.createElement('style'); css.textContent = 'html.age-open{overflow:hidden}'; document.head.appendChild(css);
})();
