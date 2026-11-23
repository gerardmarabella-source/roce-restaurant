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
  var CSS = '.age-gate{position:fixed;inset:0;z-index:590;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.62);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);overflow-y:auto;animation:ageFade .25s ease-out both}' +
    '.age-gate[hidden]{display:none}' +
    '.age-card{position:relative;width:min(100%,26rem);box-sizing:border-box;background:#141414;color:#ece7dd;border-radius:26px 26px 0 0;padding:1.5rem 1.4rem calc(1.3rem + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;text-align:center;gap:.65rem;box-shadow:0 -24px 70px rgba(0,0,0,.55);animation:ageUp .42s cubic-bezier(.2,.8,.2,1) both}' +
    '.age-badge-lg{width:3.4rem;height:3.4rem;margin-top:.45rem;filter:drop-shadow(0 6px 20px rgba(229,69,58,.4))}' +
    '.age-title{margin:0;font-family:var(--display,"Helvetica Neue",Arial,sans-serif);font-size:1.35rem;line-height:1.15;text-wrap:balance;letter-spacing:-.01em;font-weight:700}' +
    '.age-text{margin:0;max-width:21rem;font-size:.9rem;line-height:1.5;color:rgba(236,231,221,.72)}' +
    '.age-actions{width:100%;display:flex;flex-direction:column;gap:.3rem;margin-top:.7rem}' +
    '.age-actions button{width:100%;min-height:3.1rem;padding:.6rem 1rem;border:0;border-radius:999px;font-family:var(--display,"Helvetica Neue",Arial,sans-serif);font-size:.95rem;line-height:1.15;font-weight:700;letter-spacing:.005em;text-align:center;cursor:pointer;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;transition:transform .12s ease,opacity .15s ease}' +
    '.age-actions button:active{transform:scale(.98)}' +
    '.age-actions button:focus{outline:none}.age-actions button:focus-visible{outline:2px solid #ece7dd;outline-offset:3px}' +
    '.age-yes{background:#ece7dd;color:#0a0a0a}' +
    '.age-no{background:transparent;color:rgba(236,231,221,.68);font-weight:500;font-size:.85rem;min-height:2.7rem}' +
    '@keyframes ageFade{from{opacity:0}to{opacity:1}}@keyframes ageUp{from{transform:translateY(38px);opacity:0}to{transform:none;opacity:1}}' +
    '@media(min-width:560px){.age-gate{align-items:center;padding:1.25rem}.age-card{border-radius:26px;padding:2rem 1.9rem 1.6rem}}' +
    '@media(prefers-reduced-motion:reduce){.age-gate,.age-card{animation:none}}';
  var BADGE = '<svg class="age-badge-lg" viewBox="0 0 100 100" role="img" aria-label="+18"><circle cx="50" cy="50" r="44" fill="#ffffff" stroke="#e5453a" stroke-width="9"/><text x="44" y="65" text-anchor="middle" font-family="\'Helvetica Neue Web\',\'Helvetica Neue\',Arial,sans-serif" font-weight="700" font-size="46" letter-spacing="-3" fill="#0a0a0a">18</text><text x="77" y="52" text-anchor="middle" font-family="\'Helvetica Neue Web\',\'Helvetica Neue\',Arial,sans-serif" font-weight="700" font-size="30" fill="#0a0a0a">+</text></svg>';
  var FALLBACK = {
    es: { age_title: 'Estás entrando en un espacio +18', age_text: 'Las reservas de noche son para mayores de 18 años. ¿Tienes 18 años o más?', age_yes: 'Sí, tengo 18 o más', age_no: 'No, ir a Coffee, Bakery & Kitchen' },
    en: { age_title: "You're entering an 18+ space", age_text: 'Evening bookings are for guests aged 18 and over. Are you 18 or older?', age_yes: "Yes, I'm 18 or older", age_no: 'No, take me to Coffee, Bakery & Kitchen' }
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
    var o = (pending && pending.opts) || {};
    gate.querySelectorAll('[data-i18n]').forEach(function (el) { var k = el.getAttribute('data-i18n'); el.textContent = o[k] ? t(o[k]) : t(k); });
  }
  function answer(yes) {
    gate.hidden = true; document.documentElement.classList.remove('age-open');
    var p = pending; pending = null;
    if (yes) { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} if (p && p.yes) p.yes(); }
    else if (p && p.no) p.no();
  }
  function show() {
    build(); paint(); gate.hidden = false; document.documentElement.classList.add('age-open');
    var y = gate.querySelector('.age-yes'); if (y) y.focus({ preventScroll: true });
  }
  function waitForCookies(fn) {
    var b = document.getElementById('cookieBanner');
    if (!b || b.classList.contains('is-hidden') || b.classList.contains('is-compact')) return fn();
    var mo = new MutationObserver(function () { if (b.classList.contains('is-hidden')) { mo.disconnect(); fn(); } });
    mo.observe(b, { attributes: true, attributeFilter: ['class'] });
  }

  window.ROCE_AGE = {
    confirmed: confirmed,
    // opts (opcional): claves de texto distintas para este aviso, p. ej. { age_title: 'age_book_title', age_text: 'age_book_text', age_no: 'age_book_no' }
    ask: function (yes, no, opts) {
      if (confirmed() && !(opts && opts.force)) { if (yes) yes(); return; }   // opts.force: se vuelve a preguntar aunque ya se haya confirmado antes
      pending = { yes: yes, no: no, opts: opts };
      waitForCookies(show);
    }
  };
  var css = document.createElement('style'); css.textContent = 'html.age-open{overflow:hidden}'; document.head.appendChild(css);
})();
