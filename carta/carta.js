/* ROCE · Carta digital: hojas (Brunch / Bebidas / Bakery) que se cambian como las de una carpeta, lista tipográfica,
   filtro de alérgenos y ES/EN. Sin cookies ni rastreo. */
(function () {
  'use strict';
  var D = window.CARTA;
  var UI = {
    es: { allergies: 'Alergias', al_h: '¿Alguna alergia o intolerancia?', al_p: 'Marca lo que debes evitar y ocultamos los platos que lo llevan.', clear: 'Quitar', done: 'Ver carta', without: 'Sin', pending: 'Consulta alérgenos', soon: 'Muy pronto', soon_p: 'Estamos preparando esta carta.',
      note: 'Si tienes alguna alergia o intolerancia, avisa a nuestro equipo antes de pedir. Pueden existir trazas de otros alérgenos. Los alérgenos de las bebidas los confirma el equipo.', remove: 'Quitar filtro', menu: 'Carta' },
    en: { allergies: 'Allergies', al_h: 'Any allergy or intolerance?', al_p: 'Tick what you must avoid and we will hide the dishes that contain it.', clear: 'Clear', done: 'See menu', without: 'Without', pending: 'Ask about allergens', soon: 'Coming soon', soon_p: 'We are preparing this menu.',
      note: 'If you have any allergy or intolerance, please tell our team before ordering. Traces of other allergens may be present. Allergens in drinks are confirmed by our team.', remove: 'Remove filter', menu: 'Menu' }
  };
  var L = 'es';
  try { L = localStorage.getItem('roce_carta_lang') || (/^en/i.test(navigator.language || '') ? 'en' : 'es'); } catch (e) {}
  var sel = [];
  try { sel = JSON.parse(sessionStorage.getItem('roce_carta_al') || '[]'); } catch (e) {}
  var cur = (location.hash || '').replace('#', '');
  if (!D.sections.some(function (s) { return s.id === cur; })) cur = D.sections[0].id;

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var tx = function (o) { return o == null ? '' : typeof o === 'string' ? o : (o[L] || o.es || ''); };
  var ui = function (k) { return UI[L][k]; };
  function money(p) {
    if (p == null || p === '') return '';
    if (Array.isArray(p)) return p.map(money).join(' / ');
    if (typeof p === 'string') return p;
    return p.toFixed(2).replace('.', ',') + ' €';
  }
  function als(arr) { return arr && arr.length ? '<span class="cv-als" aria-label="' + esc(ui('allergies')) + '">' + arr.map(function (n) { return '<span class="cv-al" title="' + esc(tx(D.allergens[n - 1])) + '">' + n + '</span>'; }).join('') + '</span>' : ''; }
  function attrs(it, blk) { return ' data-al="' + (it.al || []).join(',') + '"' + (blk.alPending ? ' data-pending="1"' : ''); }
  var secById = function (id) { return D.sections.filter(function (s) { return s.id === id; })[0]; };

  /* ── Platos y listas ── */
  function item(it, blk) {
    var dup = it.code && it.code === it.name;
    var h = '<li class="cv-item"' + attrs(it, blk) + '><div class="cv-i-main"><div class="cv-i-top"><span class="cv-i-name">' +
      (it.code && !dup ? '<em>' + esc(it.code) + '</em>' : '') + esc(it.name) + (it.note ? ' <small>' + esc(tx(it.note)) + '</small>' : '') + als(it.al) +
      (blk.alPending ? '<span class="cv-pend">' + esc(ui('pending')) + '</span>' : '') + '</span><span class="cv-price">' + money(it.price) + '</span></div>';
    if (it.es) h += '<p class="cv-i-desc">' + esc(tx({ es: it.es, en: it.en })) + '</p>';
    if (it.tag) h += '<p class="cv-i-desc cv-i-tag">' + esc(tx(it.tag)) + '</p>';
    if (it.variants) h += '<ul class="cv-variants">' + it.variants.map(function (v) { return '<li><b>' + esc(v.name) + '</b><span>' + esc(tx({ es: v.es, en: v.en })) + '</span>' + als(v.al) + '</li>'; }).join('') + '</ul>';
    h += '</div>' + (it.img ? '<img class="cv-thumb" loading="lazy" src="' + esc(it.img) + '" alt="">' : '') + '</li>';
    return h;
  }
  function extras(b) {
    if (!b.extras) return '';
    return '<div class="cv-extras"><h4>' + esc(tx(b.extras.title)) + '</h4><ul>' + b.extras.list.map(function (e) {
      return '<li><span>' + esc(tx(e[0])) + '</span><span class="cv-price">' + esc(money(e[1])) + '</span></li>';
    }).join('') + '</ul></div>';
  }
  function cat(id, b) {
    return '<section class="cv-cat" id="' + id + '"><button type="button" class="cv-cat-h" aria-expanded="true" data-toggle="' + id + '"><span class="cv-cat-t"><h3>' + esc(tx(b.title)) + '</h3>' +
      (b.note ? '<small>' + esc(tx(b.note)) + '</small>' : '') + '</span><svg class="cv-chev" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>' +
      '<div class="cv-cat-body"><ul class="cv-items">' + b.items.map(function (i) { return item(i, b); }).join('') + '</ul>' + extras(b) + '</div></section>';
  }
  function page(s, si) {
    var h = '<article class="cv-paper is-' + s.color + '" id="pg-' + s.id + '" data-sec="' + s.id + '"' + (s.id === cur ? '' : ' hidden') + '><span class="cv-hole" aria-hidden="true"></span><span class="cv-hole is-2" aria-hidden="true"></span><div class="cv-paper-in"><h1 class="cv-sr">' + esc(tx(s.title)) + '</h1>';
    var tabs = [], body = '';
    if (s.soon) body += '<div class="cv-soon"><b>' + esc(ui('soon')) + '</b><p>' + esc(ui('soon_p')) + '</p></div>';
    else s.groups.forEach(function (g, gi) {
      var same = tx(g.title) === tx(s.title);
      body += '<div class="cv-group">';
      if (!same || g.note) body += '<div class="cv-gh">' + (same ? '' : '<h2>' + esc(tx(g.title)) + '</h2>') + (g.note ? '<span>' + esc(tx(g.note)) + '</span>' : '') + '</div>';
      g.blocks.forEach(function (b, bi) { var id = 'c' + si + gi + bi; tabs.push('<a class="cv-tab" href="#' + id + '" data-cat="' + id + '">' + esc(tx(b.title)) + '</a>'); body += cat(id, b); });
      body += '</div>';
    });
    if (tabs.length) h += '<nav class="cv-index" aria-label="' + esc(ui('menu')) + '">' + tabs.join('') + '</nav>';
    return h + body + '</div><div class="cv-spine" aria-hidden="true"><span>' + esc(tx(s.title)) + '</span></div></article>';
  }

  function render() {
    document.documentElement.lang = L;
    $('cvAlLabel').textContent = ui('allergies');
    $('cvDisclaimer').textContent = ui('note');
    $('cvSheetTitle').textContent = ui('al_h'); $('cvSheetText').textContent = ui('al_p'); $('cvAlClear').textContent = ui('clear'); $('cvAlDone').textContent = ui('done');
    [].forEach.call(document.querySelectorAll('.cv-lang button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === L)); });
    $('cvSections').innerHTML = D.sections.map(page).join('');
    $('cvBook').innerHTML = D.sections.map(function (s) {
      return '<button type="button" class="cv-leaf is-' + s.color + '" data-sec="' + s.id + '" style="--c:var(--' + s.color + ')" aria-pressed="' + (s.id === cur) + '"><span>' + esc(tx(s.title)) + '</span>' + (s.soon ? '<i>' + esc(ui('soon')) + '</i>' : '') + '</button>';
    }).join('');
    buildSheet(); applyFilter(); endFlip(); sheetState(); measure(); onScroll();
  }

  /* ── Cambiar de hoja: la hoja se abre / se cierra como en una carpeta ── */
  var flipping = null;
  function endFlip() {
    if (!flipping) return;
    clearTimeout(flipping.t);
    [].forEach.call(document.querySelectorAll('.cv-paper'), function (p) { p.classList.remove('flip-away', 'flip-in'); p.hidden = p.dataset.sec !== cur; });
    flipping = null;
  }
  function sheetState(keep) {
    var s = secById(cur);
    document.documentElement.setAttribute('data-sheet', s.color);
    [].forEach.call(document.querySelectorAll('.cv-paper'), function (p) { p.hidden = p.dataset.sec !== cur && p.dataset.sec !== keep; });
    [].forEach.call(document.querySelectorAll('.cv-leaf'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.sec === cur)); });
    var k = 0;
    [].forEach.call(document.querySelectorAll('.cv-leaf'), function (b) { if (b.dataset.sec !== cur) b.style.setProperty('--o', k++); });
    syncTabs();
  }
  function setSheet(id) {
    endFlip();
    if (id === cur) return;
    var idx = function (x) { return D.sections.map(function (s) { return s.id; }).indexOf(x); };
    var from = $('pg-' + cur), to = $('pg-' + id), forward = idx(id) > idx(cur), old = cur;
    window.scrollTo({ top: 0, behavior: 'instant' });
    cur = id; sheetState(old); measure();
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    current = ''; onScroll();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { endFlip(); return; }
    (forward ? from : to).classList.add(forward ? 'flip-away' : 'flip-in');
    flipping = { t: setTimeout(endFlip, 1000) };
  }

  /* ── Alérgenos ── */
  function buildSheet() {
    $('cvAlList').innerHTML = D.allergens.map(function (a) {
      return '<button type="button" class="cv-pick" data-n="' + a.n + '" aria-pressed="' + (sel.indexOf(a.n) !== -1) + '"><span class="cv-al">' + a.n + '</span>' + esc(tx(a)) + '</button>';
    }).join('');
  }
  function applyFilter() {
    document.body.classList.toggle('has-filter', sel.length > 0);
    [].forEach.call(document.querySelectorAll('.cv-item'), function (el) {
      var al = (el.dataset.al || '').split(',').filter(Boolean).map(Number);
      var bad = sel.length && al.some(function (n) { return sel.indexOf(n) !== -1; });
      el.classList.toggle('is-hidden', !!bad);
      el.classList.toggle('is-pending', !!(sel.length && el.dataset.pending && !bad));
    });
    [].forEach.call(document.querySelectorAll('.cv-cat'), function (b) {
      b.classList.toggle('is-hidden', !!b.querySelector('.cv-item') && !b.querySelector('.cv-item:not(.is-hidden)'));
    });
    [].forEach.call(document.querySelectorAll('.cv-group'), function (g) { g.classList.toggle('is-hidden', !!g.querySelector('.cv-cat') && !g.querySelector('.cv-cat:not(.is-hidden)')); });
    syncTabs();
    var c = $('cvAlCount'); c.textContent = sel.length; c.hidden = !sel.length;
    var f = $('cvFilter');
    if (sel.length) {
      f.hidden = false;
      f.innerHTML = '<span>' + esc(ui('without')) + ': <b>' + sel.map(function (n) { return esc(tx(D.allergens[n - 1])); }).join(', ') + '</b></span><button type="button" id="cvFilterOff">' + esc(ui('remove')) + '</button>';
      $('cvFilterOff').onclick = function () { setSel([]); };
    } else f.hidden = true;
    try { sessionStorage.setItem('roce_carta_al', JSON.stringify(sel)); } catch (e) {}
  }
  function syncTabs() {
    [].forEach.call(document.querySelectorAll('.cv-tab'), function (t) { var c = $(t.dataset.cat); t.classList.toggle('is-hidden', !c || c.classList.contains('is-hidden')); });
  }
  function setSel(a) { sel = a; buildSheet(); applyFilter(); }

  /* ── Altura de la barra fija + pestaña activa según el scroll ── */
  function measure() { document.documentElement.style.setProperty('--bar', document.getElementById('top').offsetHeight + 'px'); }
  var ticking = false, current = '';
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var line = document.getElementById('top').offsetHeight + 80, id = '';
      [].forEach.call(document.querySelectorAll('#pg-' + cur + ' .cv-cat:not(.is-hidden)'), function (s) { if (s.getBoundingClientRect().top <= line) id = s.id; });
      if (!id) { var f = document.querySelector('#pg-' + cur + ' .cv-cat:not(.is-hidden)'); id = f ? f.id : ''; }
      if (id === current) return; current = id;
      var nav = document.querySelector('#pg-' + cur + ' .cv-index'); if (!nav) return;
      [].forEach.call(nav.querySelectorAll('.cv-tab'), function (t) {
        var on = t.dataset.cat === id; t.classList.toggle('is-on', on);
        if (on) nav.scrollTo({ left: t.offsetLeft - (nav.clientWidth - t.offsetWidth) / 2, behavior: 'smooth' });
      });
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); onScroll(); });

  /* ── Eventos ── */
  $('cvBook').addEventListener('click', function (e) { var b = e.target.closest('.cv-leaf'); if (b) setSheet(b.dataset.sec); });
  $('cvSections').addEventListener('click', function (e) {
    var t = e.target.closest('.cv-tab');
    if (t) { var cc = $(t.dataset.cat); if (cc && cc.classList.contains('is-closed')) { cc.classList.remove('is-closed'); cc.querySelector('.cv-cat-h').setAttribute('aria-expanded', 'true'); } return; }
    var b = e.target.closest('[data-toggle]'); if (!b) return;
    var c = $(b.dataset.toggle), open = c.classList.toggle('is-closed') === false;
    b.setAttribute('aria-expanded', String(open));
  });
  $('cvAlBtn').addEventListener('click', function () { var d = $('cvSheet'); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); });
  $('cvAlDone').addEventListener('click', function () { $('cvSheet').close ? $('cvSheet').close() : $('cvSheet').removeAttribute('open'); });
  $('cvAlClear').addEventListener('click', function () { setSel([]); });
  $('cvSheet').addEventListener('click', function (e) { if (e.target === this) this.close(); });
  $('cvAlList').addEventListener('click', function (e) {
    var b = e.target.closest('.cv-pick'); if (!b) return;
    var n = +b.dataset.n, i = sel.indexOf(n);
    setSel(i === -1 ? sel.concat(n) : sel.filter(function (x) { return x !== n; }));
  });
  [].forEach.call(document.querySelectorAll('.cv-lang button'), function (b) {
    b.addEventListener('click', function () { L = b.dataset.lang; try { localStorage.setItem('roce_carta_lang', L); } catch (e) {} current = ''; render(); });
  });
  render();
})();
