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

  function media(it) {
    return it.img ? '<div class="cv-media"><img loading="lazy" src="' + esc(it.img) + '" alt="' + esc(it.name) + '"></div>' : '<div class="cv-media is-ph" aria-hidden="true"></div>';
  }
  function card(it, blk) {
    var pend = blk.alPending ? '<span class="cv-pend">' + esc(ui('pending')) + '</span>' : '';
    var h = '<article class="cv-card cv-item"' + attrs(it, blk) + '><div class="cv-card-body">';
    if (it.code && it.code !== it.name) h += '<span class="cv-code">' + esc(it.code) + '</span>';
    h += '<h4 class="cv-name">' + esc(it.name) + (it.note ? ' <small>' + esc(tx(it.note)) + '</small>' : '') + '</h4>';
    if (it.es) h += '<p class="cv-desc">' + esc(tx({ es: it.es, en: it.en })) + '</p>';
    if (it.tag) h += '<p class="cv-tag">' + esc(tx(it.tag)) + '</p>';
    if (it.variants) h += '<ul class="cv-variants">' + it.variants.map(function (v) { return '<li><b>' + esc(v.name) + '</b><span>' + esc(tx({ es: v.es, en: v.en })) + '</span>' + als(v.al) + '</li>'; }).join('') + '</ul>';
    h += '<div class="cv-card-foot">' + (it.price != null ? '<span class="cv-price">' + money(it.price) + '</span>' : '') + als(it.al) + pend + '</div>';
    return h + '</div>' + media(it) + '</article>';
  }
  function row(it, blk) {
    return '<li class="cv-item"' + attrs(it, blk) + '><span class="cv-nm">' + esc(it.name) + als(it.al) + (blk.alPending ? '<span class="cv-pend">' + esc(ui('pending')) + '</span>' : '') + '</span><span class="cv-price">' + money(it.price) + '</span></li>';
  }

  /* Categorías planas (cada bloque de la carta), como las pestañas de Honest Greens */
  function cats() {
    var out = [];
    D.sections.forEach(function (s, si) {
      var first = true;
      if (s.soon) { out.push({ soon: true, sec: s, first: true, id: s.id }); return; }
      s.groups.forEach(function (g, gi) {
        g.blocks.forEach(function (b, bi) { out.push({ sec: s, group: g, block: b, id: 'c' + si + gi + bi, first: first, gfirst: bi === 0 }); first = false; });
      });
    });
    return out;
  }
  function catHtml(c) {
    var b = c.block, s = c.sec;
    var h = '<section class="cv-cat is-' + s.color + '" id="' + c.id + '" style="--c:var(--' + s.color + ')"><header class="cv-cat-h"><p class="cv-kicker">' + esc(tx(s.title)) + ' · ' + esc(tx(c.group.title)) + '</p><h2 class="cv-cat-title">' + esc(tx(b.title)) + '</h2>';
    var note = [b.note ? tx(b.note) : (c.gfirst && c.group.note ? tx(c.group.note) : '')].filter(Boolean).join(' · ');
    if (note) h += '<p class="cv-cat-note">' + esc(note) + '</p>';
    h += '</header><div class="cv-cat-body">';
    h += b.compact ? '<ul class="cv-list">' + b.items.map(function (i) { return row(i, b); }).join('') + '</ul>' : '<div class="cv-grid">' + b.items.map(function (i) { return card(i, b); }).join('') + '</div>';
    if (b.extras) h += '<div class="cv-extras"><span class="cv-extras-t">' + esc(tx(b.extras.title)) + '</span>' + b.extras.list.map(function (e) { return '<span class="cv-chip">' + esc(tx(e[0])) + (e[1] !== '' ? ' <b>' + esc(money(e[1])) + '</b>' : '') + '</span>'; }).join('') + '</div>';
    return h + '</div></section>';
  }

  var CATS = [];
  function render() {
    document.documentElement.lang = L;
    $('cvAlLabel').textContent = ui('allergies');
    $('cvDisclaimer').textContent = ui('note');
    $('cvSheetTitle').textContent = ui('al_h'); $('cvSheetText').textContent = ui('al_p'); $('cvAlClear').textContent = ui('clear'); $('cvAlDone').textContent = ui('done');
    [].forEach.call(document.querySelectorAll('.cv-lang button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === L)); });
    CATS = cats();
    $('cvTabs').innerHTML = CATS.map(function (c, i) {
      var cls = 'cv-tab' + (c.first && i ? ' is-split' : '') + (c.soon ? ' is-soon' : '');
      var st = ' style="--c:var(--' + c.sec.color + ')"';
      return c.soon ? '<span class="' + cls + '"' + st + '>' + esc(tx(c.sec.title)) + ' · ' + esc(ui('soon')) + '</span>' : '<a class="' + cls + '" href="#' + c.id + '" data-cat="' + c.id + '"' + st + '>' + esc(tx(c.block.title)) + '</a>';
    }).join('');
    $('cvSections').innerHTML = CATS.filter(function (c) { return !c.soon; }).map(catHtml).join('');
    current = ''; buildSheet(); applyFilter(); measure(); onScroll();
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
      var gone = !!b.querySelector('.cv-item') && !b.querySelector('.cv-item:not(.is-hidden)');
      b.classList.toggle('is-hidden', gone);
      var t = document.querySelector('.cv-tab[data-cat="' + b.id + '"]'); if (t) t.classList.toggle('is-hidden', gone);
    });
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

  /* ── Altura de la barra fija + pestaña activa según el scroll ── */
  function measure() { document.documentElement.style.setProperty('--bar', document.getElementById('top').offsetHeight + 'px'); }
  var ticking = false, current = '';
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var line = document.getElementById('top').offsetHeight + 24, id = '';
      [].forEach.call(document.querySelectorAll('.cv-cat:not(.is-hidden)'), function (s) { if (s.getBoundingClientRect().top <= line) id = s.id; });
      if (!id) { var f = document.querySelector('.cv-cat:not(.is-hidden)'); id = f ? f.id : ''; }
      if (id === current) return; current = id;
      var nav = $('cvTabs');
      [].forEach.call(nav.querySelectorAll('.cv-tab'), function (t) {
        var on = t.dataset.cat === id; t.classList.toggle('is-on', on);
        if (on) nav.scrollTo({ left: t.offsetLeft - (nav.clientWidth - t.offsetWidth) / 2, behavior: 'smooth' });
      });
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); onScroll(); });

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
