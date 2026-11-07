// Panel · pestaña "Pedidos": pantalla de cocina y barra para los pedidos de la app (app.roce.es).
// Lee app_orders / app_order_items (solo pedidos ya cobrados) y los mueve por estados: pagado → preparando → listo → servido.
// Usa las funciones del panel (window.ROCE_ADMIN). Se actualiza sola cada pocos segundos mientras está a la vista y avisa con un sonido.
(function () {
  'use strict';
  var A = window.ROCE_ADMIN;
  var root = document.getElementById('tabOrders');
  if (!A || !root) return;
  var api = A.api, flash = A.flash, esc = A.esc, TZ = A.TZ || 'Europe/Madrid';
  var can = function (k) { return A.can ? A.can(k) : true; };

  var ALLERGENS = ['Gluten', 'Crustáceos', 'Huevo', 'Pescado', 'Cacahuete', 'Soja', 'Leche', 'Frutos de cáscara', 'Apio', 'Mostaza', 'Sésamo', 'Sulfitos', 'Altramuces', 'Moluscos'];
  var DIETS = { vegetariana: 'Vegetariana', vegana: 'Vegana', pescetariana: 'Pescetariana', sin_gluten: 'Sin gluten', sin_lactosa: 'Sin lactosa', keto: 'Keto' };
  var COLS = [['paid', 'Nuevos', 'Empezar'], ['preparing', 'En preparación', 'Listo'], ['ready', 'Listos', 'Entregado']];
  var NEXT = { paid: 'preparing', preparing: 'ready', ready: 'served' };
  var S = { orders: [], served: [], cust: {}, station: 'all', sound: true, loaded: false, menu: null, showServed: false };
  try { S.sound = localStorage.getItem('roce_orders_sound') !== '0'; } catch (e) {}
  var known = {}, timer = null, tick = null, wake = null, busy = false, lastSig = '';

  function nowIso() { return new Date().toISOString(); }
  function dayStartIso() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  function mins(iso) { return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000)); }
  function ago(iso) { var m = mins(iso); return m < 1 ? 'ahora' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
  function hm(iso) { return new Date(iso).toLocaleTimeString('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }); }
  function eur(c) { return (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }); }

  // ─── Datos ──────────────────────────────────────────────────────────
  function load() {
    if (busy) return Promise.resolve();
    busy = true;
    var q1 = api('app_orders?select=*,app_order_items(*)&payment_status=eq.paid&status=in.(paid,preparing,ready)&order=paid_at.asc&limit=100');
    var q2 = S.showServed ? api('app_orders?select=*,app_order_items(*)&status=eq.served&served_at=gte.' + encodeURIComponent(dayStartIso()) + '&order=served_at.desc&limit=40') : Promise.resolve(S.served);
    return Promise.all([q1, q2]).then(function (r) {
      S.orders = r[0] || []; S.served = r[1] || [];
      var ids = {}; S.orders.concat(S.served).forEach(function (o) { if (o.customer_id && !S.cust[o.customer_id]) ids[o.customer_id] = 1; });
      var list = Object.keys(ids);
      if (!list.length) return null;
      return api('app_customers?select=id,name,phone,allergies,diet&id=in.(' + list.join(',') + ')').then(function (cs) { (cs || []).forEach(function (c) { S.cust[c.id] = c; }); }).catch(function () {});
    }).then(function () {
      var fresh = S.orders.filter(function (o) { return o.status === 'paid' && !known[o.id]; });
      S.orders.concat(S.served).forEach(function (o) { known[o.id] = 1; });
      if (S.loaded && fresh.length && S.sound) beep();
      S.loaded = true; busy = false; paint();
    }).catch(function (e) { busy = false; if (!S.loaded) root.innerHTML = '<p class="ad-msg is-error">No se han podido cargar los pedidos. ' + esc(e && e.message || '') + '</p>'; });
  }
  function setStatus(id, st) {
    return api('rpc/app_order_set_status', { method: 'POST', body: { p_id: id, p_status: st } }).then(function () { return load(); })
      .catch(function (e) { flash('No se ha podido cambiar el estado: ' + (e && e.message || ''), 'error'); });
  }

  // ─── Sonido ─────────────────────────────────────────────────────────
  var ctx = null;
  function beep() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.22, 0.44].forEach(function (d, i) {
        var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = i === 2 ? 1175 : 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.2);
        o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.22);
      });
    } catch (e) { /* el navegador exige un toque antes de sonar */ }
  }

  // ─── Pintado ────────────────────────────────────────────────────────
  function lineHtml(l) {
    var ex = (l.extras && l.extras.length ? l.extras : []).map(function (x) { return '+ ' + esc(x); });
    var bits = [l.variant ? esc(l.variant) : '', ex.join(' · ')].filter(Boolean).join(' · ');
    return '<li><b>' + l.qty + '×</b> <span>' + esc(l.name) + '</span>' + (bits ? '<em>' + bits + '</em>' : '') + (l.note ? '<q>' + esc(l.note) + '</q>' : '') + '</li>';
  }
  function cardHtml(o, col) {
    var items = (o.app_order_items || []).slice().sort(function (a, b) { return a.id - b.id; });
    var st = S.station; if (st !== 'all') items = items.filter(function (l) { return l.station === st; });
    if (!items.length) return '';
    var kitchen = items.filter(function (l) { return l.station === 'kitchen'; }), bar = items.filter(function (l) { return l.station === 'bar'; });
    var c = S.cust[o.customer_id] || {}, al = (c.allergies || []).map(function (n) { return n + ' ' + ALLERGENS[n - 1]; });
    var warn = al.length || c.diet ? '<div class="po-warn"><b>⚠ ' + (al.length ? 'Alergias: ' + esc(al.join(', ')) : '') + (al.length && c.diet ? ' · ' : '') + (c.diet ? 'Dieta: ' + esc(DIETS[c.diet] || c.diet) : '') + '</b></div>' : '';
    var age = mins(o.paid_at || o.created_at), cls = col === 'ready' ? '' : age >= 15 ? ' is-late' : age >= 8 ? ' is-slow' : '';
    var where = o.mode === 'mesa' ? '<span class="po-where">Mesa ' + esc(o.table_name || '?') + '</span>' : '<span class="po-where is-pick">Recoger · ' + esc(o.name || '') + '</span>';
    var grp = function (title, arr) { return arr.length ? (st === 'all' && kitchen.length && bar.length ? '<h5>' + title + '</h5>' : '') + '<ul>' + arr.map(lineHtml).join('') + '</ul>' : ''; };
    var btn = NEXT[col] ? '<button class="po-go" type="button" data-go="' + o.id + '" data-to="' + NEXT[col] + '">' + COLS.filter(function (x) { return x[0] === col; })[0][2] + '</button>' : '';
    return '<article class="po-card' + cls + '" data-id="' + o.id + '"><header>' + where + '<span class="po-ref">' + esc(o.ref) + '</span></header>' +
      '<div class="po-meta"><span>Pagado ' + hm(o.paid_at || o.created_at) + '</span><span class="po-age">' + ago(o.paid_at || o.created_at) + '</span>' + (o.agora_ref ? '<span>Ágora ' + esc(o.agora_ref) + '</span>' : '') + '</div>' +
      warn + grp('Cocina', kitchen) + grp('Barra', bar) + (o.notes ? '<p class="po-note">' + esc(o.notes) + '</p>' : '') + '<footer>' + btn + '<span class="po-total">' + eur(o.total_cents) + '</span></footer></article>';
  }
  function paint() {
    if (root.hidden) return;
    var sig = JSON.stringify([S.station, S.sound, S.showServed, S.orders.map(function (o) { return [o.id, o.status, (o.app_order_items || []).length]; }), S.served.length, Object.keys(S.cust).length, Math.floor(Date.now() / 30000)]);
    if (sig === lastSig) return; lastSig = sig;
    var counts = { all: S.orders.length };
    var html = '<div class="po-bar"><div class="po-st" role="group" aria-label="Puesto">' + [['all', 'Todo'], ['kitchen', 'Cocina'], ['bar', 'Barra']].map(function (x) { return '<button type="button" class="po-stbtn" data-st="' + x[0] + '" aria-pressed="' + (S.station === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="po-tools"><button type="button" class="ad-btn is-small is-ghost" data-act="sound">' + (S.sound ? '🔔 Sonido: sí' : '🔕 Sonido: no') + '</button>' +
      (can('orders_menu') ? '<button type="button" class="ad-btn is-small is-ghost" data-act="menu">Agotados</button>' : '') +
      '<button type="button" class="ad-btn is-small is-ghost" data-act="served">' + (S.showServed ? 'Ocultar servidos' : 'Ver servidos de hoy') + '</button>' +
      '<button type="button" class="ad-btn is-small is-ghost" data-act="full">Pantalla completa</button></div></div>';
    html += '<div class="po-cols">' + COLS.map(function (c) {
      var cards = S.orders.filter(function (o) { return o.status === c[0]; }).map(function (o) { return cardHtml(o, c[0]); }).join('');
      var n = (cards.match(/class="po-card/g) || []).length;
      return '<section class="po-col"><h4>' + c[1] + ' <small>' + n + '</small></h4>' + (cards || '<p class="po-empty">—</p>') + '</section>';
    }).join('') + '</div>';
    if (S.showServed) html += '<section class="po-served"><h4>Servidos hoy <small>' + S.served.length + '</small></h4>' + (S.served.map(function (o) { return '<div class="po-srv"><b>' + (o.mode === 'mesa' ? 'Mesa ' + esc(o.table_name) : 'Recoger') + '</b> · ' + esc(o.ref) + ' · ' + eur(o.total_cents) + ' · ' + hm(o.served_at || o.paid_at) + '</div>'; }).join('') || '<p class="po-empty">Todavía nada.</p>') + '</section>';
    root.innerHTML = html;
  }

  // ─── Agotados ───────────────────────────────────────────────────────
  function openMenu() {
    api('app_menu_items?select=key,cat,name,active,station&order=sort').then(function (rows) {
      S.menu = rows || [];
      var by = {}; S.menu.forEach(function (r) { (by[r.cat] = by[r.cat] || []).push(r); });
      var html = '<div class="po-modal" id="poMenu"><div class="po-modal-in"><header><h3>Agotados</h3><button type="button" class="ad-btn is-small is-ghost" data-act="menu-close">Cerrar</button></header><p class="po-hint">Apaga lo que se haya acabado: deja de poder pedirse en la app al momento. Vuelve a encenderlo cuando haya.</p>' +
        Object.keys(by).map(function (cat) { return '<h5>' + esc(cat) + '</h5><ul class="po-menu">' + by[cat].map(function (r) { return '<li><label><input type="checkbox" data-key="' + esc(r.key) + '"' + (r.active ? ' checked' : '') + '><span>' + esc(r.name) + '</span><em>' + (r.station === 'bar' ? 'barra' : 'cocina') + '</em></label></li>'; }).join('') + '</ul>'; }).join('') + '</div></div>';
      var d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d.firstChild);
    }).catch(function (e) { flash('No se ha podido abrir la carta: ' + (e && e.message || ''), 'error'); });
  }

  // ─── Eventos ────────────────────────────────────────────────────────
  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-go],[data-st],[data-act]'); if (!el) return;
    if (el.dataset.go) { el.disabled = true; setStatus(el.dataset.go, el.dataset.to); }
    else if (el.dataset.st) { S.station = el.dataset.st; lastSig = ''; paint(); }
    else if (el.dataset.act === 'sound') { S.sound = !S.sound; try { localStorage.setItem('roce_orders_sound', S.sound ? '1' : '0'); } catch (x) {} if (S.sound) beep(); lastSig = ''; paint(); }
    else if (el.dataset.act === 'served') { S.showServed = !S.showServed; lastSig = ''; load(); }
    else if (el.dataset.act === 'menu') openMenu();
    else if (el.dataset.act === 'full') { var d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen(); }
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act="menu-close"]'); if (el) { var m = document.getElementById('poMenu'); if (m) m.remove(); }
  });
  document.addEventListener('change', function (e) {
    var cb = e.target.closest('#poMenu input[data-key]'); if (!cb) return;
    cb.disabled = true;
    api('app_menu_items?key=eq.' + encodeURIComponent(cb.dataset.key), { method: 'PATCH', prefer: 'return=minimal', body: { active: cb.checked } })
      .then(function () { cb.disabled = false; flash((cb.checked ? 'Disponible: ' : 'Agotado: ') + cb.parentNode.querySelector('span').textContent); })
      .catch(function (x) { cb.disabled = false; cb.checked = !cb.checked; flash('No se ha podido guardar: ' + (x && x.message || ''), 'error'); });
  });

  // ─── Abrir / cerrar la pestaña ──────────────────────────────────────
  function keepAwake() { try { if (navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {}); } catch (e) {} }
  function start() {
    if (!timer) timer = setInterval(function () { if (!root.hidden && !document.hidden) load(); }, 5000);
    if (!tick) tick = setInterval(function () { if (!root.hidden) { lastSig = ''; paint(); } }, 30000);
    keepAwake(); S.loaded = false; known = {}; lastSig = ''; load();
  }
  A.openOrders = start;
  A.refreshOrders = function () { return load(); };
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !root.hidden) { keepAwake(); load(); } });
})();
