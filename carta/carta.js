/* La carta de Restaurant & Cocktails como un libro: las portadas de cuero asoman en la portada y al tocarlas se abre.
   El menú de celebración no asoma fuera: está dentro, en su pestaña.
   Los datos están en carta-data.js y solo se descargan al abrirla. Enlaces directos: /#carta, /#carta-cocteles… */
(function () {
  'use strict';
  var V = '3', BASE = '/carta/', dlg = null, cur = 'menu', loading = null, lastFocus = null;
  /* Medidas de los títulos: reservan su hueco para que la hoja no salte mientras cargan. */
  var DIM = { 't-celebracion': [900, 378], 't-menu': [900, 420], 't-desserts': [676, 329], 't-drinks': [900, 471], 't-cocktails': [900, 424], 't-wines': [769, 377], 't-spirits': [757, 531] };
  var AL = {
    es: { gluten: 'Gluten', sesamo: 'Sésamo', huevo: 'Huevo', altramuces: 'Altramuces', frutos: 'Frutos de cáscara', cacahuete: 'Cacahuete', mostaza: 'Mostaza', leche: 'Leche', crustaceos: 'Crustáceos', soja: 'Soja', pescado: 'Pescado', moluscos: 'Moluscos', apio: 'Apio', sulfitos: 'Sulfitos' },
    en: { gluten: 'Gluten', sesamo: 'Sesame', huevo: 'Egg', altramuces: 'Lupin', frutos: 'Tree nuts', cacahuete: 'Peanut', mostaza: 'Mustard', leche: 'Milk', crustaceos: 'Crustaceans', soja: 'Soy', pescado: 'Fish', moluscos: 'Molluscs', apio: 'Celery', sulfitos: 'Sulphites' }
  };
  var TX = {
    es: { title: 'La carta', close: 'Cerrar', book: 'Reservar mesa', al: 'Alérgenos', copa: 'Copa', chupito: 'Chupito', err: 'No se ha podido abrir la carta. Revisa la conexión.' },
    en: { title: 'Menu', close: 'Close', book: 'Book a table', al: 'Allergens', copa: 'Glass', chupito: 'Shot', err: 'The menu could not be opened. Check your connection.' }
  };
  function lang() { return window.ROCE_I18N && window.ROCE_I18N.getLang && window.ROCE_I18N.getLang() === 'en' ? 'en' : 'es'; }
  function t(k) { return TX[lang()][k]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function loadData() {
    if (window.ROCE_CARTA) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (ok, ko) {
      var s = document.createElement('script'); s.src = BASE + 'carta-data.js?v=' + V; s.onload = ok;
      s.onerror = function () { loading = null; s.remove(); ko(); }; document.head.appendChild(s);
    });
    return loading;
  }

  /* ── Pintar ── */
  function row(it, sec) {
    if (it.g) return '<li class="cm-grape">' + esc(it.g) + '</li>';
    if (sec.cols) return '<li class="cm-spirit"><span class="cm-n">' + esc(it.n) + '</span>' + sec.cols.map(function (c) { var v = c === 'chupito' && sec.cols.length > 1 ? it.p2 : it.p; return '<span class="cm-p">' + (v || '—') + '</span>'; }).join('') + '</li>';
    var desc = lang() === 'en' ? (it.en || it.es) : it.es;
    return '<li class="cm-item"><div class="cm-line"><span class="cm-n">' + esc(it.n) + (it.q ? ' <small>' + esc(lang() === 'en' ? it.q.replace('para 4 personas', 'serves 4').replace('ud.', 'pc.') : it.q) + '</small>' : '') + '</span>' + (it.p ? '<span class="cm-p">' + esc(it.p) + '</span>' : '') + '</div>' +
      (desc ? '<p class="cm-d">' + esc(desc) + '</p>' : '') + (it.sub ? '<p class="cm-d">' + esc(it.sub) + '</p>' : '') +
      (it.al && it.al.length ? '<p class="cm-al"><span class="cm-sr">' + t('al') + ': </span>' + it.al.map(function (a) { return '<span>' + AL[lang()][a] + '</span>'; }).join('') + '</p>' : '') + '</li>';
  }
  function pageHtml(tab) {
    var d = DIM[tab.title], h = '<img class="cm-script" src="' + BASE + 'img/' + tab.title + '.webp" width="' + d[0] + '" height="' + d[1] + '" alt="' + esc(tab.label[lang()]) + '">';
    tab.sections.forEach(function (s) {
      h += '<section class="cm-sec"><h3><img src="' + BASE + 'img/h-' + s.h + '.webp" alt="' + esc(s.t) + '" data-h="' + s.h + '"></h3>' + (s.lead ? '<p class="cm-lead">' + esc(s.lead) + '</p>' : '') +
        (s.cols ? '<div class="cm-cols"><span></span>' + s.cols.map(function (c) { return '<span>' + t(c) + '</span>'; }).join('') + '</div>' : '') +
        '<ul class="cm-list' + (s.cols && s.cols.length > 1 ? ' is-two' : '') + '">' + s.items.map(function (it) { return row(it, s); }).join('') + '</ul></section>';
    });
    if (tab.foot) h += '<p class="cm-foot-note">' + esc(tab.foot[lang()]) + '</p>';
    if (tab.note) h += '<p class="cm-small-note">' + esc(tab.note[lang()]) + '</p>';
    return h;
  }
  function tabOf(id) { return window.ROCE_CARTA.filter(function (x) { return x.id === id; })[0] || window.ROCE_CARTA.filter(function (x) { return x.id === 'menu'; })[0]; }
  function paint() {
    if (!dlg || !window.ROCE_CARTA) return;
    var tab = tabOf(cur); cur = tab.id;
    dlg.setAttribute('aria-label', t('title'));
    dlg.querySelector('.cm-tabs').innerHTML = window.ROCE_CARTA.map(function (x) { return '<button type="button" role="tab" data-tab="' + x.id + '" data-tone="' + x.tone + '" aria-selected="' + (x.id === cur) + '">' + esc(x.label[lang()]) + '</button>'; }).join('');
    dlg.querySelector('.cm-close').setAttribute('aria-label', t('close'));
    dlg.querySelector('.cm-book-cta').textContent = t('book');
    var body = dlg.querySelector('.cm-body'); body.innerHTML = pageHtml(tab); body.scrollTop = 0;
    dlg.querySelector('.cm-paper').dataset.tone = tab.tone;
    var on = dlg.querySelector('[data-tab="' + cur + '"]'), bar = dlg.querySelector('.cm-tabs');
    if (on) bar.scrollLeft = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;
  }
  function go(id, dir) {
    cur = id; paint();
    var body = dlg.querySelector('.cm-body'); body.classList.remove('is-next', 'is-prev'); void body.offsetWidth; if (dir) body.classList.add(dir > 0 ? 'is-next' : 'is-prev');
    try { history.replaceState(history.state, '', '#carta-' + id); } catch (e) { /* sin historial */ }
  }
  function step(d) { var ids = window.ROCE_CARTA.map(function (x) { return x.id; }), i = ids.indexOf(cur) + d; if (i >= 0 && i < ids.length) go(ids[i], d); }

  /* ── Abrir y cerrar ── */
  function build() {
    dlg = document.createElement('dialog'); dlg.className = 'cm-dlg';
    dlg.innerHTML = '<div class="cm-stage"><div class="cm-paper"><header class="cm-head"><div class="cm-tabs" role="tablist"></div><button type="button" class="cm-close">✕</button></header>' +
      '<div class="cm-body" tabindex="0"></div><footer class="cm-cta"><a class="cm-book-cta" href="/reservas/"></a></footer></div><div class="cm-flip" aria-hidden="true"><img alt=""></div></div>';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', function (e) {
      var tb = e.target.closest('[data-tab]'); if (tb) return void go(tb.dataset.tab);
      if (e.target.closest('.cm-close') || e.target === dlg || e.target.classList.contains('cm-stage')) close();
    });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    dlg.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); });
    // Pasar de hoja deslizando el dedo
    var x0 = 0, y0 = 0, on = false, body = dlg.querySelector('.cm-body');
    body.addEventListener('touchstart', function (e) { on = e.touches.length === 1; if (on) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
    body.addEventListener('touchend', function (e) { if (!on) return; var p = e.changedTouches[0], dx = p.clientX - x0, dy = p.clientY - y0; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) step(dx < 0 ? 1 : -1); }, { passive: true });
    document.addEventListener('roce:lang', function () { if (dlg.open) paint(); });
  }
  function open(id, cover) {
    if (!dlg) build();
    if (dlg.open) { if (id) go(id); return; }
    cur = id || 'menu'; lastFocus = document.activeElement;
    var flip = dlg.querySelector('.cm-flip');
    flip.querySelector('img').src = BASE + 'img/' + (cover || (cur === 'celebracion' ? 'cover-fiesta' : ['cocteles', 'vinos', 'destilados'].indexOf(cur) !== -1 ? 'cover-bar' : 'cover-menu')) + '.webp?v=2';
    flip.classList.remove('is-open');
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    document.documentElement.classList.add('cm-on');
    if (!history.state || !history.state.carta) { try { history.pushState({ carta: 1 }, '', '#carta' + (cur === 'menu' ? '' : '-' + cur)); } catch (e) { /* sin historial */ } }
    var body = dlg.querySelector('.cm-body'); body.innerHTML = '';
    loadData().then(function () { paint(); requestAnimationFrame(function () { requestAnimationFrame(function () { flip.classList.add('is-open'); }); }); })
      .catch(function () { body.innerHTML = '<p class="cm-foot-note">' + t('err') + '</p>'; flip.classList.add('is-open'); });
  }
  function hide() {
    if (!dlg || !dlg.open) return;
    dlg.close ? dlg.close() : dlg.removeAttribute('open');
    document.documentElement.classList.remove('cm-on');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function close() {
    hide();
    if (history.state && history.state.carta) history.back();                                   // quita la entrada que se añadió al abrir
    else if (/^#carta/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }
  window.addEventListener('popstate', function () { if (!/^#carta/.test(location.hash)) hide(); });
  function fromHash() { var m = /^#carta(?:-([a-z]+))?$/.exec(location.hash); if (m) open(m[1] || 'menu'); }
  window.addEventListener('hashchange', fromHash);

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-carta]'); if (!b) return;
    e.preventDefault();
    var c = e.target.closest('[data-book]');                       // la portada verde abre directamente en cócteles
    open(c ? c.dataset.book : 'menu');
  });
  /* Con el dedo o el ratón encima se va adelantando la descarga */
  document.addEventListener('pointerenter', function (e) { if (e.target && e.target.matches && e.target.matches('[data-carta]')) loadData().catch(function () {}); }, true);
  window.ROCE_OPEN_CARTA = open;
  fromHash();
})();
