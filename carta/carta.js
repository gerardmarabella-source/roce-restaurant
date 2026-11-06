/* ROCE · Carta digital: pinta la carta de menu.js, filtra por alérgenos y cambia de idioma. Sin cookies ni rastreo. */
(function () {
  'use strict';
  var D = window.CARTA;
  var UI = {
    es: { kicker: 'Carta', allergies: 'Alergias', al_h: '¿Alguna alergia o intolerancia?', al_p: 'Marca lo que debes evitar y ocultamos los platos que lo llevan.', clear: 'Quitar', done: 'Ver carta', without: 'Sin', pending: 'Consulta alérgenos', soon: 'Muy pronto',
      note: 'Si tienes alguna alergia o intolerancia, avisa a nuestro equipo antes de pedir. Pueden existir trazas de otros alérgenos. Los alérgenos de las bebidas los confirma el equipo.', remove: 'Quitar filtro' },
    en: { kicker: 'Menu', allergies: 'Allergies', al_h: 'Any allergy or intolerance?', al_p: 'Tick what you must avoid and we will hide the dishes that contain it.', clear: 'Clear', done: 'See menu', without: 'Without', pending: 'Ask about allergens', soon: 'Coming soon',
      note: 'If you have any allergy or intolerance, please tell our team before ordering. Traces of other allergens may be present. Allergens in drinks are confirmed by our team.', remove: 'Remove filter' }
  };
  var L = 'es';
  try { L = localStorage.getItem('roce_carta_lang') || (/^en/i.test(navigator.language || '') ? 'en' : 'es'); } catch (e) {}
  var sel = [];
  try { sel = JSON.parse(sessionStorage.getItem('roce_carta_al') || '[]'); } catch (e) {}
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

  function card(it, blk) {
    var h = '<article class="cv-card cv-item"' + attrs(it, blk) + '>' + (it.img ? '<img class="cv-card-img" loading="lazy" src="' + esc(it.img) + '" alt="' + esc(it.name) + '">' : '') + '<div class="cv-card-in">';
    h += '<div class="cv-card-top"><span class="cv-code">' + (it.code && it.code !== it.name ? esc(it.code) : '') + '</span>' + als(it.al) + (blk.alPending ? '<span class="cv-pend">' + esc(ui('pending')) + '</span>' : '') + '</div>';
    h += '<div class="cv-card-head"><h4 class="cv-name">' + esc(it.name) + (it.note ? ' <small>' + esc(tx(it.note)) + '</small>' : '') + '</h4>' + (it.price != null ? '<span class="cv-price">' + money(it.price) + '</span>' : '') + '</div>';
    if (it.es) h += '<p class="cv-desc">' + esc(tx({ es: it.es, en: it.en })) + '</p>';
    if (it.tag) h += '<p class="cv-tag">' + esc(tx(it.tag)) + '</p>';
    if (it.variants) h += '<ul class="cv-variants">' + it.variants.map(function (v) { return '<li><b>' + esc(v.name) + '</b><span>' + esc(tx({ es: v.es, en: v.en })) + '</span>' + als(v.al) + '</li>'; }).join('') + '</ul>';
    return h + '</div></article>';
  }
  function row(it, blk) {
    return '<li class="cv-item"' + attrs(it, blk) + '><span class="cv-nm">' + esc(it.name) + als(it.al) + (blk.alPending ? '<span class="cv-pend">' + esc(ui('pending')) + '</span>' : '') + '</span><span class="cv-price">' + money(it.price) + '</span></li>';
  }
  function block(b) {
    var h = '<div class="cv-block"><div class="cv-block-h"><h3>' + esc(tx(b.title)) + '</h3>' + (b.note ? '<span>' + esc(tx(b.note)) + '</span>' : '') + '</div>';
    h += b.compact ? '<ul class="cv-list">' + b.items.map(function (i) { return row(i, b); }).join('') + '</ul>' : '<div class="cv-grid">' + b.items.map(function (i) { return card(i, b); }).join('') + '</div>';
    if (b.extras) h += '<div class="cv-extras"><span class="cv-extras-t">' + esc(tx(b.extras.title)) + '</span>' + b.extras.list.map(function (e) { return '<span class="cv-chip">' + esc(tx(e[0])) + (e[1] !== '' ? ' <b>' + esc(money(e[1])) + '</b>' : '') + '</span>'; }).join('') + '</div>';
    return h + '</div>';
  }
  function micro(sec) {
    var seen = {}, out = [];
    sec.groups.forEach(function (g) { g.blocks.forEach(function (b) { b.items.forEach(function (i) { var k = i.name.toUpperCase(); if (!seen[k] && !/^\d+$/.test(k) && out.length < 26) { seen[k] = 1; out.push(k); } }); }); });
    return out.join(' · ');
  }

  function render() {
    document.documentElement.lang = L;
    $('cvKicker').textContent = ui('kicker');
    $('cvAlLabel').textContent = ui('allergies');
    $('cvDisclaimer').textContent = ui('note');
    $('cvSheetTitle').textContent = ui('al_h'); $('cvSheetText').textContent = ui('al_p'); $('cvAlClear').textContent = ui('clear'); $('cvAlDone').textContent = ui('done');
    [].forEach.call(document.querySelectorAll('.cv-lang button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === L)); });
    $('cvTabs').innerHTML = D.sections.map(function (s) { return '<a class="cv-tab' + (s.soon ? ' is-soon' : '') + '" href="#' + s.id + '" data-sec="' + s.id + '" style="--c:var(--' + s.color + ')"><i></i>' + esc(tx(s.title)) + (s.soon ? ' · ' + esc(ui('soon')) : '') + '</a>'; }).join('');
    $('cvTiles').innerHTML = D.sections.map(function (s) {
      return '<a class="cv-tile is-' + s.color + (s.soon ? ' is-soon' : '') + '" href="#' + s.id + '" style="--c:var(--' + s.color + ')">' + (s.soon ? '<span class="cv-tile-soon">' + esc(ui('soon')) + '</span>' : '<span class="cv-tile-text">' + esc(micro(s)) + '</span>') + '<span class="cv-tile-title">' + esc(tx(s.title)) + '</span></a>';
    }).join('');
    $('cvSections').innerHTML = D.sections.filter(function (s) { return !s.soon; }).map(function (s) {
      return '<section class="cv-sec is-' + s.color + '" id="' + s.id + '" style="--c:var(--' + s.color + ')"><div class="cv-sec-head"><h2 class="cv-sec-title">' + esc(tx(s.title)) + '</h2><span class="cv-sec-mark">ROCE ®</span></div>' +
        s.groups.map(function (g) { return '<div class="cv-group"><h3 class="cv-group-h">' + esc(tx(g.title)) + '</h3>' + (g.note ? '<p class="cv-note">' + esc(tx(g.note)) + '</p>' : '') + g.blocks.map(block).join('') + '</div>'; }).join('') + '</section>';
    }).join('');
    buildSheet(); applyFilter(); observe();
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
    [].forEach.call(document.querySelectorAll('.cv-block'), function (b) { b.classList.toggle('is-hidden', !!b.querySelector('.cv-item') && !b.querySelector('.cv-item:not(.is-hidden)')); });
    [].forEach.call(document.querySelectorAll('.cv-group'), function (g) { g.classList.toggle('is-hidden', !g.querySelector('.cv-block:not(.is-hidden)')); });
    var c = $('cvAlCount'); c.textContent = sel.length; c.hidden = !sel.length;
    var f = $('cvFilter');
    if (sel.length) {
      f.hidden = false;
      f.innerHTML = '<span>' + esc(ui('without')) + ': <b>' + sel.map(function (n) { return esc(tx(D.allergens[n - 1])); }).join(', ') + '</b></span><button type="button" id="cvFilterOff">' + esc(ui('remove')) + '</button>';
      $('cvFilterOff').onclick = function () { setSel([]); };
    } else f.hidden = true;
    try { sessionStorage.setItem('roce_carta_al', JSON.stringify(sel)); } catch (e) {}
  }
  function setSel(a) { sel = a; buildSheet(); applyFilter(); }

  /* ── Pestaña activa según el scroll ── */
  var io;
  function observe() {
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) return;
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) [].forEach.call(document.querySelectorAll('.cv-tab'), function (t) { t.classList.toggle('is-on', t.dataset.sec === e.target.id); }); });
    }, { rootMargin: '-35% 0px -55% 0px' });
    [].forEach.call(document.querySelectorAll('.cv-sec'), function (s) { io.observe(s); });
  }

  /* ── Eventos ── */
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
    b.addEventListener('click', function () { L = b.dataset.lang; try { localStorage.setItem('roce_carta_lang', L); } catch (e) {} render(); });
  });
  render();
})();
