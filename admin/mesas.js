// Panel · pestaña "Mesas": reservas de mesa del día, mapa de mesas, bloqueos y configuración.
// Usa las funciones del panel (window.ROCE_ADMIN) y la base de datos de Supabase (tablas dining_* y table_bookings).
(function () {
  'use strict';
  var A = window.ROCE_ADMIN;
  var root = document.getElementById('tabTables');
  if (!A || !root) return;
  var api = A.api, flash = A.flash, esc = A.esc, TZ = A.TZ;

  var ST = { pending: 'Pendiente de pago', confirmed: 'Confirmada', seated: 'En mesa', completed: 'Completada', cancelled: 'Anulada', no_show: 'No vino' };
  var SHAPE = { bench: [2.1, 2.3], square: [4.4, 4.4], rect: [6.2, 4.4], long: [10, 4.4], bar: [8, 3.2], sofa: [7, 5], round: [5.4, 5.4] };
  var PLAN_RATIO = 1660 / 1175;
  var ZONE_NAME = { baja: 'Planta baja', alta: 'Planta alta', prive: 'Sala privé' };

  var S = { view: 'day', date: '', zone: 'baja', time: '', zones: [], tables: [], services: [], loadedCfg: false, bookings: [], blocks: [], closures: [], busy: false, join: false, sel: [], zoom: 1, px: 0, py: 0, justMoved: false };

  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); }
  function addDays(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function hm(iso) { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)); }
  function dayLabel(d) { return new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00Z')); }
  function eur(c) { return (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: c % 100 ? 2 : 0 }); }
  // Fecha del servicio + hora "HH:MM" → ISO. De madrugada (antes de las 06:00) es ya el día siguiente.
  function at(date, time) { var h = +time.slice(0, 2), d = h < 6 ? addDays(date, 1) : date; return A.madridToISO(d + 'T' + time); }
  function zoneName(id) { var z = S.zones.filter(function (x) { return x.id === id; })[0]; return z ? z.name_es : (ZONE_NAME[id] || id || ''); }
  function holds(b) { return b.status === 'confirmed' || b.status === 'seated' || (b.status === 'pending' && new Date(b.hold_until).getTime() > Date.now()); }
  function errText(e) {
    var m = String((e && e.message) || e);
    var map = { table_busy: 'Alguna de esas mesas ya está ocupada a esa hora.', no_table: 'No hay mesa libre para ese grupo a esa hora en esa zona.', bad_data: 'Revisa los datos (nombre y personas).', email_required: 'Para pedir la fianza hace falta el email del cliente.', forbidden: 'No tienes permiso.', zone_not_found: 'Zona no válida.', not_editable: 'Esa reserva ya no se puede editar.', service_not_found: 'Turno no válido.' };
    var k = Object.keys(map).filter(function (x) { return m.indexOf(x) !== -1; })[0];
    return k ? map[k] : m;
  }

  // ─── Carga ──────────────────────────────────────────────────────────
  function loadConfig(force) {
    if (S.loadedCfg && !force) return Promise.resolve();
    return Promise.all([
      api('dining_zones?select=*&order=sort,id'),
      api('dining_tables?select=*&order=zone_id,sort,name'),
      api('dining_services?select=*&order=start_min')
    ]).then(function (r) { S.zones = r[0] || []; S.tables = r[1] || []; S.services = r[2] || []; S.loadedCfg = true; });
  }
  function loadDay() {
    var from = A.madridToISO(S.date + 'T05:00'), to = A.madridToISO(addDays(S.date, 1) + 'T05:00');
    return Promise.all([
      api('table_bookings?select=*,table_booking_tables(table_id)&starts_at=gte.' + encodeURIComponent(from) + '&starts_at=lt.' + encodeURIComponent(to) + '&order=starts_at'),
      api('dining_blocks?select=*&starts_at=lt.' + encodeURIComponent(to) + '&ends_at=gt.' + encodeURIComponent(from) + '&order=starts_at')
    ]).then(function (r) { S.bookings = r[0] || []; S.blocks = r[1] || []; });
  }
  function tableById(id) { return S.tables.filter(function (t) { return t.id === id; })[0]; }
  function bookingTables(b) { return (b.table_booking_tables || []).map(function (x) { return tableById(x.table_id); }).filter(Boolean); }

  // ─── Estructura ─────────────────────────────────────────────────────
  function shell() {
    root.innerHTML =
      '<div class="mt-nav" role="group" aria-label="Mesas">' +
      [['day', 'Día'], ['blocks', 'Bloqueos'], ['config', 'Configuración']].map(function (v) { return '<button type="button" class="ck-chip" data-view="' + v[0] + '" aria-pressed="' + (S.view === v[0]) + '">' + v[1] + '</button>'; }).join('') +
      '</div><div id="mtBody"></div>';
  }
  function render() {
    if (!document.getElementById('mtBody')) shell();
    [].forEach.call(root.querySelectorAll('[data-view]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === S.view)); });
    var body = document.getElementById('mtBody');
    if (S.view === 'day') { renderDay(body); applyView(); } else if (S.view === 'blocks') renderBlocks(body); else renderConfig(body);
  }
  root.addEventListener('click', function (e) {
    var v = e.target.closest('[data-view]');
    if (v) { S.view = v.dataset.view; enter(); }
  });

  function enter() {
    if (!S.date) S.date = today();
    var b = document.getElementById('mtBody'); if (b) b.innerHTML = '<p class="ad-empty">Cargando…</p>';
    return loadConfig().then(function () {
      if (S.view === 'day') return loadDay();
      if (S.view === 'blocks') return api('dining_blocks?select=*&ends_at=gt.' + encodeURIComponent(new Date().toISOString()) + '&order=starts_at').then(function (r) { S.blocks = r || []; });
      return api('dining_closures?select=*&date_to=gte.' + today() + '&order=date_from').then(function (r) { S.closures = r || []; });
    }).then(render).catch(function (e) { flash('No se han podido cargar las mesas: ' + e.message, 'error'); });
  }
  A.openTables = function () { shell(); enter(); };

  // ─── Día ────────────────────────────────────────────────────────────
  function timeOptions() {
    var set = {};
    S.services.filter(function (s) { return s.active; }).forEach(function (s) {
      for (var m = s.start_min; m <= s.last_min; m += s.slot_min) { var h = Math.floor(m / 60) % 24; set[('0' + h).slice(-2) + ':' + ('0' + (m % 60)).slice(-2)] = m; }
    });
    return Object.keys(set).sort(function (a, b) { return set[a] - set[b]; });
  }
  function defaultTime(opts) {
    if (S.date === today()) {
      var now = hm(new Date().toISOString()), pick = opts.filter(function (t) { return t >= now; })[0];
      if (pick) return pick;
    }
    return opts[0] || '13:00';
  }
  function occupancy(t, iso) {
    var ts = new Date(iso).getTime(), r = { state: 'free', booking: null, block: null };
    S.bookings.forEach(function (b) {
      if (!holds(b) || !(b.table_booking_tables || []).some(function (x) { return x.table_id === t.id; })) return;
      if (new Date(b.starts_at).getTime() <= ts && ts < new Date(b.ends_at).getTime()) { r.state = b.status === 'seated' ? 'seated' : b.status === 'pending' ? 'pending' : 'booked'; r.booking = b; }
    });
    if (r.state === 'free') S.blocks.forEach(function (k) {
      if (k.zone_id === t.zone_id && (!k.table_ids || k.table_ids.indexOf(t.id) !== -1) && new Date(k.starts_at).getTime() <= ts && ts < new Date(k.ends_at).getTime()) { r.state = 'blocked'; r.block = k; }
    });
    return r;
  }
  function renderDay(body) {
    var opts = timeOptions(); if (!S.time || opts.indexOf(S.time) === -1) S.time = defaultTime(opts);
    var iso = at(S.date, S.time);
    var live = S.bookings.filter(function (b) { return b.status !== 'cancelled'; });
    var covers = live.filter(holds).reduce(function (n, b) { return n + b.party; }, 0);
    var deposits = S.bookings.filter(function (b) { return b.payment_status === 'paid'; }).reduce(function (n, b) { return n + b.deposit_cents; }, 0);

    var zones = S.zones.filter(function (z) { return S.tables.some(function (t) { return t.zone_id === z.id; }); });
    // El plano se recorta a donde hay mesas (con un margen) para que se vean grandes.
    var PW = 1660, PH = 1175, PAD = 45;
    var zt = S.tables.filter(function (t) { return t.zone_id === S.zone && t.pos_x != null; });
    var boxes = zt.map(function (t) { var sz = SHAPE[t.shape] || SHAPE.square; return { t: t, cx: t.pos_x / 100 * PW, cy: t.pos_y / 100 * PH, w: sz[0] / 100 * PW, h: sz[1] / 100 * PW }; });
    var minx = Math.min.apply(null, boxes.map(function (b) { return b.cx - b.w / 2; })), maxx = Math.max.apply(null, boxes.map(function (b) { return b.cx + b.w / 2; }));
    var miny = Math.min.apply(null, boxes.map(function (b) { return b.cy - b.h / 2; })), maxy = Math.max.apply(null, boxes.map(function (b) { return b.cy + b.h / 2; }));
    if (!boxes.length) { minx = 0; maxx = PW; miny = 0; maxy = PH; }
    var bw = maxx - minx + 2 * PAD, bh = Math.max(maxy - miny + 2 * PAD, bw / 2.4), oy = miny - PAD - (bh - (maxy - miny + 2 * PAD)) / 2;
    var map = '<div class="mt-map-wrap"><div class="mt-viewport" style="aspect-ratio:' + (bw / bh).toFixed(3) + '"><div class="mt-zoom"><button type="button" data-zoom="1" aria-label="Acercar">+</button><button type="button" data-zoom="-1" aria-label="Alejar">−</button><button type="button" data-zoom="0" aria-label="Ver todo">⤢</button></div><div class="mt-map">' +
      boxes.map(function (b) {
        var t = b.t, o = occupancy(t, iso);
        var tip = t.name + ' · ' + t.seats_max + ' p.' + (o.booking ? ' · ' + o.booking.name + ' (' + o.booking.party + ')' : o.block ? ' · bloqueada' + (o.block.note ? ': ' + o.block.note : '') : '');
        return '<button type="button" class="mt-t is-' + o.state + (S.sel.indexOf(t.id) !== -1 ? ' is-sel' : '') + ' sh-' + esc(t.shape) + '" data-table="' + t.id + '" title="' + esc(tip) + '" style="left:' + ((b.cx - minx + PAD) / bw * 100).toFixed(2) + '%;top:' + ((b.cy - oy) / bh * 100).toFixed(2) + '%;width:' + (b.w / bw * 100).toFixed(2) + '%;height:' + (b.h / bh * 100).toFixed(2) + '%">' +
          '<b>' + esc(t.name) + '</b>' + (o.booking ? '<i>' + esc(o.booking.name.split(' ')[0]) + '</i>' : '') + '</button>';
      }).join('') + '</div></div>' +
      '<p class="ad-meta mt-legend"><span class="mt-dot is-free"></span>Libre <span class="mt-dot is-booked"></span>Reservada <span class="mt-dot is-pending"></span>Pendiente de pago <span class="mt-dot is-seated"></span>En mesa <span class="mt-dot is-blocked"></span>Bloqueada</p></div>';

    var list = S.bookings.length ? S.bookings.map(function (b) {
      var tn = bookingTables(b).map(function (t) { return t.name; }).join(' + ');
      var cancelled = b.status === 'cancelled' || b.status === 'no_show';
      var pay = b.deposit_cents > 0 ? '<span class="ad-tag ' + (b.payment_status === 'paid' ? 'is-green' : b.payment_status === 'refunded' || b.payment_status === 'retained' ? '' : 'is-red') + '">' + eur(b.deposit_cents) + ' · ' + ({ paid: 'pagada', pending: 'sin pagar', refunded: 'devuelta', retained: 'retenida' }[b.payment_status] || b.payment_status) + '</span>' : '';
      var a = [];
      if (b.status === 'confirmed' || b.status === 'pending') a.push('<button class="ad-btn is-small" data-act="seat" data-id="' + b.id + '">Sentar</button>');
      if (b.status === 'seated') a.push('<button class="ad-btn is-small" data-act="done" data-id="' + b.id + '">Terminada</button>');
      if (b.status === 'confirmed') a.push('<button class="ad-btn is-small is-ghost" data-act="noshow" data-id="' + b.id + '">No vino</button>');
      if (!cancelled && b.status !== 'completed') a.push('<button class="ad-btn is-small is-ghost" data-act="edit" data-id="' + b.id + '">Editar / ampliar</button>');
      if (!cancelled && b.status !== 'completed') a.push('<button class="ad-btn is-small is-danger" data-act="cancel" data-id="' + b.id + '">Anular</button>');
      if ((b.payment_status === 'paid' || b.payment_status === 'retained') && b.deposit_cents > 0) a.push('<button class="ad-btn is-small is-ghost" data-act="refund" data-id="' + b.id + '">Devolver fianza</button>');
      return '<li class="ad-card mt-bk' + (cancelled ? ' is-past' : '') + '"><div class="ad-date"><b>' + hm(b.starts_at) + '</b><span>' + b.party + ' p.</span></div>' +
        '<div><div class="ad-name">' + esc(b.name) + ' <span class="ad-tag ' + (b.status === 'seated' ? 'is-green' : b.status === 'cancelled' || b.status === 'no_show' ? 'is-red' : '') + '">' + esc(ST[b.status] || b.status) + '</span>' + pay + '</div>' +
        '<div class="ad-meta">' + esc(zoneName(b.zone_id)) + (tn ? ' · mesa ' + esc(tn) : '') + ' · ' + esc(b.ambience === 'night' ? 'Night' : 'Day') + (b.source === 'admin' ? ' · creada en el panel' : '') + '</div>' +
        '<div class="ad-meta">' + esc(b.phone) + (b.email ? ' · ' + esc(b.email) : '') + ' · ' + esc(b.ref) + '</div>' +
        (b.notes ? '<div class="ad-meta">“' + esc(b.notes) + '”</div>' : '') + '</div>' +
        '<div class="ad-actions">' + a.join('') + '</div></li>';
    }).join('') : '<li class="ad-empty">No hay reservas este día.</li>';

    body.innerHTML =
      '<div class="ad-bar"><div class="mt-day"><button class="ad-btn is-ghost is-small" data-dayn="-1" aria-label="Día anterior">←</button>' +
      '<input type="date" id="mtDate" value="' + S.date + '"><button class="ad-btn is-ghost is-small" data-dayn="1" aria-label="Día siguiente">→</button>' +
      '<button class="ad-btn is-ghost is-small" data-dayn="0">Hoy</button></div>' +
      '<button class="ad-btn" id="mtNew" type="button">+ Nueva reserva</button></div>' +
      '<p class="ad-meta mt-sum"><b>' + esc(dayLabel(S.date)) + '</b> · ' + live.length + ' reservas · ' + covers + ' comensales' + (deposits ? ' · fianzas cobradas ' + eur(deposits) : '') + '</p>' +
      '<div class="ad-bar mt-mapbar"><div class="mt-zones" role="group">' + zones.map(function (z) { return '<button type="button" class="ck-chip" data-zone="' + z.id + '" aria-pressed="' + (z.id === S.zone) + '">' + esc(z.name_es) + '</button>'; }).join('') + '</div>' +
      '<button type="button" class="ad-btn is-small ' + (S.join ? '' : 'is-ghost') + '" id="mtJoin">' + (S.join ? 'Terminar de juntar' : 'Juntar mesas') + '</button>' +
      '<span class="mt-time"><button type="button" class="ad-btn is-ghost is-small" data-tstep="-1" aria-label="Hora anterior">‹</button><label>Mapa a las <select id="mtTime">' + opts.map(function (t) { return '<option' + (t === S.time ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label><button type="button" class="ad-btn is-ghost is-small" data-tstep="1" aria-label="Hora siguiente">›</button></span></div>' +
      (S.join ? joinBar() : '') + map + '<h2 class="ad-sub">Reservas del día</h2><ul class="ad-list" id="mtList">' + list + '</ul>';
  }

  function joinBar() {
    var ts = S.sel.map(tableById).filter(Boolean), seats = ts.reduce(function (n, t) { return n + t.seats_max; }, 0);
    return '<div class="mt-joinbar"><span>' + (ts.length ? '<b>' + ts.map(function (t) { return esc(t.name); }).join(' + ') + '</b> · ' + seats + ' plazas' : 'Toca las mesas libres que quieras juntar (pueden ser cualquiera de la misma planta).') + '</span>' +
      '<button type="button" class="ad-btn is-small" id="mtJoinGo"' + (ts.length < 1 ? ' disabled' : '') + '>Reservar ' + (ts.length > 1 ? 'estas mesas juntas' : 'esta mesa') + '</button>' +
      (ts.length ? '<button type="button" class="ad-btn is-small is-ghost" id="mtJoinClear">Vaciar</button>' : '') + '</div>';
  }
  root.addEventListener('change', function (e) {
    if (e.target.id === 'mtDate' && e.target.value) { S.date = e.target.value; S.time = ''; enter(); }
    else if (e.target.id === 'mtTime') { S.time = e.target.value; render(); }
  });


  // ─── Navegar el mapa: acercar, alejar y arrastrar ──────────────────
  // Rueda con Ctrl/⌘ (o pellizco en el trackpad), botones + − ⤢, arrastrar para moverse y pellizcar en el móvil.
  function viewport() { return root.querySelector('.mt-viewport'); }
  function clampView() {
    var v = viewport(); if (!v) return;
    var w = v.clientWidth, h = v.clientHeight;
    S.zoom = Math.min(4, Math.max(1, S.zoom));
    S.px = Math.min(0, Math.max(w - w * S.zoom, S.px)); S.py = Math.min(0, Math.max(h - h * S.zoom, S.py));
  }
  function applyView() {
    clampView();
    var m = root.querySelector('.mt-map'); if (m) m.style.transform = 'translate(' + S.px + 'px,' + S.py + 'px) scale(' + S.zoom + ')';
    var v = viewport(); if (v) v.classList.toggle('is-zoomed', S.zoom > 1.01);
  }
  function zoomAt(cx, cy, nz) {
    var old = S.zoom; nz = Math.min(4, Math.max(1, nz));
    S.px = cx - (cx - S.px) * nz / old; S.py = cy - (cy - S.py) * nz / old; S.zoom = nz; applyView();
  }
  function localPt(v, e) { var r = v.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  root.addEventListener('wheel', function (e) {
    var v = e.target.closest && e.target.closest('.mt-viewport'); if (!v || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); var p = localPt(v, e); zoomAt(p[0], p[1], S.zoom * Math.exp(-e.deltaY * 0.01));
  }, { passive: false });
  var pts = {}, drag = null, pinch = null;
  root.addEventListener('pointerdown', function (e) {
    var v = e.target.closest && e.target.closest('.mt-viewport'); if (!v || e.target.closest('.mt-zoom')) return;
    pts[e.pointerId] = [e.clientX, e.clientY];
    var ids = Object.keys(pts);
    if (ids.length === 2) { var a = pts[ids[0]], b = pts[ids[1]]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: S.zoom }; drag = null; }
    else drag = { x: e.clientX, y: e.clientY, px: S.px, py: S.py, moved: false };
  });
  document.addEventListener('pointermove', function (e) {
    if (!pts[e.pointerId]) return;
    pts[e.pointerId] = [e.clientX, e.clientY];
    var v = viewport(); if (!v) return;
    var ids = Object.keys(pts);
    if (pinch && ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]], r = v.getBoundingClientRect();
      S.justMoved = true; zoomAt((a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top, pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d);
    } else if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved && S.zoom > 1) { S.justMoved = true; S.px = drag.px + dx; S.py = drag.py + dy; applyView(); }
    }
  });
  function endPtr(e) {
    delete pts[e.pointerId]; if (Object.keys(pts).length < 2) pinch = null; if (!Object.keys(pts).length) drag = null;
    if (S.justMoved) setTimeout(function () { S.justMoved = false; }, 60);
  }
  document.addEventListener('pointerup', endPtr); document.addEventListener('pointercancel', endPtr);
  root.addEventListener('click', function (e) {
    var z = e.target.closest('[data-zoom]');
    if (z) {
      var v = viewport(), k = +z.dataset.zoom;
      if (k === 0) { S.zoom = 1; S.px = 0; S.py = 0; applyView(); }
      else zoomAt(v.clientWidth / 2, v.clientHeight / 2, S.zoom * (k > 0 ? 1.5 : 1 / 1.5));
      return;
    }
    var st = e.target.closest('[data-tstep]');
    if (st) { var o = timeOptions(), i = o.indexOf(S.time) + (+st.dataset.tstep); if (i >= 0 && i < o.length) { S.time = o[i]; render(); } }
  });

  // Acciones sobre las reservas
  function patch(id, body) { return api('table_bookings?id=eq.' + id, { method: 'PATCH', body: body, prefer: 'return=minimal' }); }
  function bk(id) { return S.bookings.filter(function (b) { return b.id === id; })[0]; }
  function refund(id, manual) {
    var s = A.session();
    return fetch(A.cfg.url + '/functions/v1/redsys', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: A.cfg.anonKey, Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action: 'table_refund', booking_id: id, manual: !!manual }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.detail || d.error || ('Error ' + r.status)); throw e; } return d; }); });
  }
  function done(msg) { return loadDay().then(function () { render(); if (msg) flash(msg, 'ok'); }); }

  root.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (S.justMoved && t.dataset.table) return;
    if (t.dataset.dayn != null) { S.date = t.dataset.dayn === '0' ? today() : addDays(S.date, +t.dataset.dayn); S.time = ''; return void enter(); }
    if (t.dataset.zone) { S.zone = t.dataset.zone; S.sel = []; return void render(); }
    if (t.id === 'mtJoin') { S.join = !S.join; S.sel = []; return void render(); }
    if (t.id === 'mtJoinClear') { S.sel = []; return void render(); }
    if (t.id === 'mtJoinGo') { var picked = S.sel.map(tableById).filter(Boolean); S.join = false; S.sel = []; render(); return void openNew({ tables: picked }); }
    if (t.id === 'mtNew') return void openNew({});
    if (t.dataset.table) {
      var tb = tableById(t.dataset.table), o = occupancy(tb, at(S.date, S.time));
      if (S.join) {
        if (o.state !== 'free') return void flash('Esa mesa no está libre a esa hora.', 'error');
        var ix = S.sel.indexOf(tb.id); if (ix === -1) S.sel.push(tb.id); else S.sel.splice(ix, 1);
        return void render();
      }
      if (o.state === 'free') return void openNew({ table: tb });
      if (o.booking) return void openEdit(o.booking);
      if (o.block) flash('Mesa bloqueada: ' + (o.block.note || 'sin motivo') + '. Quita el bloqueo en la pestaña Bloqueos.', 'error');
      return;
    }
    var id = t.dataset.id, act = t.dataset.act; if (!act) return;
    var b = bk(id); if (!b) return;
    if (act === 'seat') {
      if (b.status === 'pending' && b.deposit_cents > 0 && !confirm('La fianza de ' + eur(b.deposit_cents) + ' no está pagada. ¿Sentarlos igualmente? Se confirma la reserva sin fianza.')) return;
      patch(id, { status: 'seated', hold_until: new Date(Date.now() + 864e5).toISOString() }).then(function () { return done(); }).catch(fail);
    }
    else if (act === 'edit') openEdit(b);
    else if (act === 'done') patch(id, { status: 'completed' }).then(function () { return done(); }).catch(fail);
    else if (act === 'noshow') { if (confirm('¿Marcar como "no vino"?' + (b.payment_status === 'paid' ? ' La fianza se queda retenida.' : ''))) patch(id, { status: 'no_show', payment_status: b.payment_status === 'paid' ? 'retained' : b.payment_status }).then(function () { return done(); }).catch(fail); }
    else if (act === 'cancel') cancelBooking(b);
    else if (act === 'refund') {
      if (!confirm('¿Devolver la fianza de ' + eur(b.deposit_cents) + ' a ' + b.name + '? Se devuelve a su tarjeta por Redsys.')) return;
      t.disabled = true;
      refund(id, false).then(function () { return done('Fianza devuelta.'); }).catch(function (x) {
        t.disabled = false;
        if (confirm('El banco no ha podido devolverla: ' + x.message + '\n\n¿La has devuelto ya a mano en el portal del banco? Acepta para registrarla como devuelta.')) refund(id, true).then(function () { return done('Registrada como devuelta.'); }).catch(fail);
      });
    }
  });
  function fail(e) { flash(errText(e), 'error'); }
  function cancelBooking(b) {
    var paid = b.payment_status === 'paid' && b.deposit_cents > 0;
    if (!confirm('¿Anular la reserva de ' + b.name + ' (' + b.party + ' p., ' + hm(b.starts_at) + ')?' + (paid ? '\n\nPaga ' + eur(b.deposit_cents) + ' de fianza: a continuación te pregunto si se la devuelves.' : ''))) return;
    if (!paid) return void patch(b.id, { status: 'cancelled', cancelled_at: new Date().toISOString() }).then(function () { return done('Reserva anulada.'); }).catch(fail);
    if (confirm('¿Devolverle la fianza de ' + eur(b.deposit_cents) + '? Aceptar = se devuelve a su tarjeta. Cancelar = la fianza se retiene.')) {
      refund(b.id, false).then(function () { return done('Reserva anulada y fianza devuelta.'); }).catch(function (x) { flash('No se ha podido devolver la fianza: ' + x.message, 'error'); });
    } else {
      patch(b.id, { status: 'cancelled', cancelled_at: new Date().toISOString(), payment_status: 'retained' }).then(function () { return done('Reserva anulada. La fianza queda retenida.'); }).catch(fail);
    }
  }

  // ─── Modales ────────────────────────────────────────────────────────
  function modal(html, onReady) {
    var m = document.createElement('div'); m.className = 'ad-modal'; m.innerHTML = '<div class="ad-sheet">' + html + '</div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
    onReady(m); return m;
  }
  function tablesPicker(zone, selected, busyIds) {
    var ts = S.tables.filter(function (t) { return t.zone_id === zone && t.active; });
    return ts.map(function (t) {
      var busy = busyIds && busyIds.indexOf(t.id) !== -1;
      return '<label class="mt-pick' + (busy ? ' is-busy' : '') + '"><input type="checkbox" value="' + t.id + '"' + (selected && selected.indexOf(t.id) !== -1 ? ' checked' : '') + '> ' + esc(t.name) + ' <small>' + t.seats_max + 'p' + (busy ? ' · ocupada' : '') + '</small></label>';
    }).join('');
  }

  function openNew(pre) {
    if (pre.tables && pre.tables.length) pre.table = pre.tables[0];
    var preIds = pre.tables && pre.tables.length ? pre.tables.map(function (t) { return t.id; }) : (pre.table ? [pre.table.id] : []);
    var svc = S.services.filter(function (s) { return s.active; });
    var zone = pre.table ? pre.table.zone_id : S.zone;
    var optsT = timeOptions();
    var html = '<h2>Nueva reserva</h2><p class="ad-msg is-error" id="nwMsg" hidden></p><form id="nwForm"><div class="ad-grid">' +
      '<label class="ad-field"><span>Día</span><input type="date" id="nwDate" value="' + S.date + '" required></label>' +
      '<label class="ad-field"><span>Hora</span><input type="time" id="nwTime" step="300" value="' + esc(S.time || optsT[0] || '13:00') + '" required></label>' +
      '<label class="ad-field"><span>Personas</span><input type="number" id="nwParty" min="1" max="60" value="' + (pre.tables && pre.tables.length > 1 ? pre.tables.reduce(function (n, t) { return n + t.seats_max; }, 0) : pre.table ? Math.min(pre.table.seats_max, 2) : 2) + '" required></label>' +
      '<label class="ad-field"><span>Zona</span><select id="nwZone">' + S.zones.map(function (z) { return '<option value="' + z.id + '"' + (z.id === zone ? ' selected' : '') + '>' + esc(z.name_es) + (z.deposit_cents ? ' · fianza ' + eur(z.deposit_cents) : '') + '</option>'; }).join('') + '</select></label>' +
      '<label class="ad-field"><span>Turno</span><select id="nwSvc">' + svc.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name_es) + '</option>'; }).join('') + '</select></label>' +
      '<label class="ad-field"><span>Nombre</span><input type="text" id="nwName" required maxlength="80"></label>' +
      '<label class="ad-field"><span>Teléfono</span><input type="tel" id="nwPhone"></label>' +
      '<label class="ad-field"><span>Email</span><input type="email" id="nwEmail" placeholder="para enviarle la confirmación"></label>' +
      '<label class="ad-field full"><span>Notas</span><textarea id="nwNotes" maxlength="500" placeholder="Alergias, ocasión…"></textarea></label></div>' +
      '<div class="ad-field"><span>Mesas</span><label class="mt-pick"><input type="radio" name="nwAuto" value="auto" checked> Asignar automáticamente</label>' +
      '<label class="mt-pick"><input type="radio" name="nwAuto" value="manual"' + (pre.table ? ' checked' : '') + '> Elegir mesas</label><div class="mt-picks" id="nwPicks"></div></div>' +
      '<label class="mt-check" id="nwPayRow"><input type="checkbox" id="nwPay" checked> Pedir fianza por email (enlace para pagar con tarjeta; la mesa se guarda 24 h)</label>' +
      '<label class="mt-check"><input type="checkbox" id="nwSeated"> Sentar ahora (cliente que ya está aquí)</label>' +
      '<div class="mt-foot"><button type="button" class="ad-btn is-ghost" data-close>Cancelar</button><button type="submit" class="ad-btn" id="nwGo">Crear reserva</button></div></form>';
    modal(html, function (m) {
      var q = function (id) { return m.querySelector('#' + id); };
      function pickSvc() {
        var h = +q('nwTime').value.slice(0, 2), want = h >= 17 || h < 6 ? 'night' : 'day';
        var s = svc.filter(function (x) { return x.ambience === want; })[0] || svc[0]; if (s) q('nwSvc').value = s.id;
      }
      function pickZoneFromSvc() { /* la zona se elige a mano */ }
      function depRow() { var z = S.zones.filter(function (x) { return x.id === q('nwZone').value; })[0]; q('nwPayRow').hidden = !(z && z.deposit_cents > 0); }
      function refreshPicks() {
        var auto = m.querySelector('input[name="nwAuto"]:checked').value === 'auto';
        q('nwPicks').hidden = auto; if (auto) return;
        var starts = at(q('nwDate').value, q('nwTime').value), sv = S.services.filter(function (x) { return x.id === q('nwSvc').value; })[0], ends = new Date(new Date(starts).getTime() + (sv ? sv.duration_min : 90) * 60000).toISOString();
        // Ocupadas: según las reservas y bloqueos ya cargados del día (si es otro día, el servidor lo comprueba al crear).
        var busy = S.tables.filter(function (t) { return S.bookings.some(function (b) { return holds(b) && (b.table_booking_tables || []).some(function (x) { return x.table_id === t.id; }) && b.starts_at < ends && b.ends_at > starts; }); }).map(function (t) { return t.id; });
        var keep = [].map.call(q('nwPicks').querySelectorAll('input:checked'), function (i) { return i.value; });
        if (!keep.length) keep = preIds;
        q('nwPicks').innerHTML = tablesPicker(q('nwZone').value, keep, busy);
      }
      pickSvc(); depRow(); refreshPicks();
      ['nwTime', 'nwDate'].forEach(function (id) { q(id).addEventListener('change', function () { pickSvc(); refreshPicks(); }); });
      q('nwZone').addEventListener('change', function () { depRow(); q('nwPicks').innerHTML = ''; refreshPicks(); });
      q('nwSvc').addEventListener('change', refreshPicks);
      [].forEach.call(m.querySelectorAll('input[name="nwAuto"]'), function (r) { r.addEventListener('change', refreshPicks); });
      q('nwForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var zoneRow = S.zones.filter(function (x) { return x.id === q('nwZone').value; })[0];
        var manual = m.querySelector('input[name="nwAuto"]:checked').value === 'manual';
        var tables = manual ? [].map.call(q('nwPicks').querySelectorAll('input:checked'), function (i) { return i.value; }) : null;
        var msg = q('nwMsg'); msg.hidden = true;
        if (manual && !tables.length) { msg.textContent = 'Elige al menos una mesa o deja la asignación automática.'; msg.hidden = false; return; }
        var wantPay = !q('nwPayRow').hidden && q('nwPay').checked;
        if (wantPay && !q('nwEmail').value.trim()) { msg.textContent = 'Para pedir la fianza hace falta el email del cliente.'; msg.hidden = false; return; }
        q('nwGo').disabled = true;
        api('rpc/dining_admin_create', { method: 'POST', body: {
          p_service: q('nwSvc').value, p_starts: at(q('nwDate').value, q('nwTime').value), p_zone: q('nwZone').value, p_party: +q('nwParty').value,
          p_name: q('nwName').value.trim(), p_email: q('nwEmail').value.trim(), p_phone: q('nwPhone').value.trim(), p_notes: q('nwNotes').value.trim(),
          p_tables: tables, p_seated: q('nwSeated').checked, p_request_payment: wantPay, p_hold_hours: 24
        } }).then(function (r) {
          m.remove(); S.date = q('nwDate').value; S.time = '';
          var word = r.status === 'pending' ? 'Reserva creada. Hemos enviado un email a ' + q('nwEmail').value.trim() + ' para que pague la fianza de ' + eur(r.deposit_cents) + ' y la confirme.' :
            q('nwEmail').value.trim() ? 'Reserva creada y confirmación enviada por email.' : 'Reserva creada.';
          enter().then(function () { flash(word, 'ok'); });
        }).catch(function (x) { q('nwGo').disabled = false; msg.textContent = errText(x); msg.hidden = false; });
        void zoneRow;
      });
    });
  }


  function openEdit(b) {
    var cur = (b.table_booking_tables || []).map(function (x) { return x.table_id; });
    var busyFor = function (starts, ends) {
      return S.tables.filter(function (t) { return S.bookings.some(function (o) { return o.id !== b.id && holds(o) && (o.table_booking_tables || []).some(function (x) { return x.table_id === t.id; }) && o.starts_at < ends && o.ends_at > starts; }); }).map(function (t) { return t.id; });
    };
    var dur = new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime();
    var dateV = S.date, timeV = hm(b.starts_at);
    var canSeat = b.status !== 'seated';
    modal('<h2>Editar reserva</h2><p class="ad-meta">' + esc(b.ref) + ' · ' + esc(zoneName(b.zone_id)) + ' · ' + esc(ST[b.status] || b.status) + '</p><p class="ad-msg is-error" id="edMsg" hidden></p>' +
      '<div class="ad-grid">' +
      '<label class="ad-field"><span>Personas</span><input type="number" id="edParty" min="1" max="60" value="' + b.party + '"></label>' +
      '<label class="ad-field"><span>Hora</span><input type="time" id="edTime" step="300" value="' + timeV + '"></label>' +
      '<label class="ad-field"><span>Día</span><input type="date" id="edDate" value="' + dateV + '"></label>' +
      '<label class="ad-field"><span>Nombre</span><input type="text" id="edName" value="' + esc(b.name) + '" maxlength="80"></label>' +
      '<label class="ad-field"><span>Teléfono</span><input type="tel" id="edPhone" value="' + esc(b.phone) + '"></label>' +
      '<label class="ad-field"><span>Email</span><input type="email" id="edEmail" value="' + esc(b.email) + '"></label>' +
      '<label class="ad-field full"><span>Notas</span><textarea id="edNotes" maxlength="500">' + esc(b.notes) + '</textarea></label></div>' +
      '<div class="ad-field"><span>Mesas · <b id="edCap"></b></span><div class="mt-picks" id="edPicks"></div></div>' +
      '<div class="mt-foot"><button type="button" class="ad-btn is-ghost" data-close>Cerrar</button>' +
      '<button type="button" class="ad-btn is-ghost" id="edSave">Guardar</button>' + (canSeat ? '<button type="button" class="ad-btn" id="edSeat">Guardar y sentar</button>' : '') + '</div>',
      function (m) {
        var q = function (id) { return m.querySelector('#' + id); };
        function starts() { return at(q('edDate').value, q('edTime').value); }
        function picks(keepSel) {
          var st = starts(), en = new Date(new Date(st).getTime() + dur).toISOString();
          var sel = keepSel ? [].map.call(q('edPicks').querySelectorAll('input:checked'), function (i) { return i.value; }) : cur;
          q('edPicks').innerHTML = tablesPicker(b.zone_id, sel, busyFor(st, en));
          cap();
        }
        function cap() {
          var ids = [].map.call(q('edPicks').querySelectorAll('input:checked'), function (i) { return i.value; });
          var seats = ids.map(tableById).filter(Boolean).reduce(function (n, t) { return n + t.seats_max; }, 0), party = +q('edParty').value || 0;
          q('edCap').textContent = ids.length ? ids.map(function (i) { return tableById(i).name; }).join(' + ') + ' · ' + seats + ' plazas' + (party > seats ? ' · faltan ' + (party - seats) + ': junta otra mesa' : '') : 'ninguna elegida';
          q('edCap').style.color = party > seats && ids.length ? 'var(--red)' : '';
        }
        picks(false);
        q('edPicks').addEventListener('change', cap); q('edParty').addEventListener('input', cap);
        ['edTime', 'edDate'].forEach(function (id) { q(id).addEventListener('change', function () { picks(true); }); });
        function save(seat) {
          var msg = q('edMsg'); msg.hidden = true;
          var ids = [].map.call(q('edPicks').querySelectorAll('input:checked'), function (i) { return i.value; });
          if (!ids.length) { msg.textContent = 'Elige al menos una mesa.'; msg.hidden = false; return; }
          var newStart = starts(), same = new Date(newStart).getTime() === new Date(b.starts_at).getTime();
          [q('edSave'), q('edSeat')].forEach(function (x) { if (x) x.disabled = true; });
          api('rpc/dining_admin_update', { method: 'POST', body: { p_booking: b.id, p_party: +q('edParty').value, p_starts: same ? null : newStart, p_name: q('edName').value.trim(), p_phone: q('edPhone').value.trim(), p_email: q('edEmail').value.trim(), p_notes: q('edNotes').value.trim(), p_tables: ids } })
            .then(function () { return seat ? patch(b.id, { status: 'seated', hold_until: new Date(Date.now() + 864e5).toISOString() }) : null; })
            .then(function () { m.remove(); S.date = q('edDate').value; return enter().then(function () { flash(seat ? 'Reserva guardada y sentada.' : 'Reserva guardada.', 'ok'); }); })
            .catch(function (x) { [q('edSave'), q('edSeat')].forEach(function (y) { if (y) y.disabled = false; }); msg.textContent = errText(x); msg.hidden = false; });
        }
        q('edSave').addEventListener('click', function () { save(false); });
        if (q('edSeat')) q('edSeat').addEventListener('click', function () { save(true); });
      });
  }

  function openMove(b) {
    var cur = (b.table_booking_tables || []).map(function (x) { return x.table_id; });
    var busy = S.tables.filter(function (t) { return S.bookings.some(function (o) { return o.id !== b.id && holds(o) && (o.table_booking_tables || []).some(function (x) { return x.table_id === t.id; }) && o.starts_at < b.ends_at && o.ends_at > b.starts_at; }); }).map(function (t) { return t.id; });
    modal('<h2>Cambiar de mesa</h2><p class="ad-meta">' + esc(b.name) + ' · ' + b.party + ' personas · ' + hm(b.starts_at) + '</p><p class="ad-msg is-error" id="mvMsg" hidden></p>' +
      '<div class="mt-picks" id="mvPicks">' + tablesPicker(b.zone_id, cur, busy) + '</div>' +
      '<div class="ad-field"><span>Otra zona</span><select id="mvZone">' + S.zones.map(function (z) { return '<option value="' + z.id + '"' + (z.id === b.zone_id ? ' selected' : '') + '>' + esc(z.name_es) + '</option>'; }).join('') + '</select></div>' +
      '<div class="mt-foot"><button type="button" class="ad-btn is-ghost" data-close>Cancelar</button><button type="button" class="ad-btn" id="mvGo">Guardar</button></div>',
      function (m) {
        var zone = b.zone_id;
        m.querySelector('#mvZone').addEventListener('change', function () { zone = this.value; m.querySelector('#mvPicks').innerHTML = tablesPicker(zone, [], busy); });
        m.querySelector('#mvGo').addEventListener('click', function () {
          var ids = [].map.call(m.querySelectorAll('#mvPicks input:checked'), function (i) { return i.value; });
          var msg = m.querySelector('#mvMsg'); msg.hidden = true;
          if (!ids.length) { msg.textContent = 'Elige al menos una mesa.'; msg.hidden = false; return; }
          api('rpc/dining_admin_move', { method: 'POST', body: { p_booking: b.id, p_tables: ids } })
            .then(function () { return zone !== b.zone_id ? patch(b.id, { zone_id: zone }) : null; })
            .then(function () { m.remove(); return done('Mesa cambiada.'); })
            .catch(function (x) { msg.textContent = errText(x); msg.hidden = false; });
        });
      });
  }

  // ─── Bloqueos ───────────────────────────────────────────────────────
  function renderBlocks(body) {
    body.innerHTML =
      '<p class="ad-meta" style="margin-bottom:0.9rem">Un bloqueo cierra una planta (o solo algunas mesas) en una franja horaria: la web no ofrece esas mesas. Úsalo para comidas privadas, eventos o mesas fuera de servicio. No anula reservas que ya existan.</p>' +
      '<form class="ad-sheet-inline mt-blockform" id="bkForm"><h2 class="ad-sub">Nuevo bloqueo</h2><p class="ad-msg is-error" id="bkMsg" hidden></p><div class="ad-grid">' +
      '<label class="ad-field"><span>Zona</span><select id="bkZone">' + S.zones.map(function (z) { return '<option value="' + z.id + '">' + esc(z.name_es) + '</option>'; }).join('') + '</select></label>' +
      '<label class="ad-field"><span>Día</span><input type="date" id="bkDate" value="' + (S.date || today()) + '" required></label>' +
      '<label class="ad-field"><span>Desde</span><input type="time" id="bkFrom" value="12:00" required></label>' +
      '<label class="ad-field"><span>Hasta</span><input type="time" id="bkTo" value="17:00" required></label>' +
      '<label class="ad-field full"><span>Motivo</span><input type="text" id="bkNote" maxlength="120" placeholder="p. ej. Comida privada empresa"></label></div>' +
      '<div class="ad-field"><span>Mesas</span><label class="mt-pick"><input type="radio" name="bkAll" value="all" checked> Toda la zona</label><label class="mt-pick"><input type="radio" name="bkAll" value="some"> Solo algunas mesas</label><div class="mt-picks" id="bkPicks" hidden></div></div>' +
      '<button class="ad-btn" type="submit" id="bkGo">Bloquear</button></form>' +
      '<h2 class="ad-sub" style="margin-top:1.75rem">Bloqueos activos y próximos</h2><ul class="ad-list" id="bkList">' + (S.blocks.length ? S.blocks.map(function (k) {
        var n = k.table_ids ? k.table_ids.map(function (id) { var t = tableById(id); return t ? t.name : ''; }).join(', ') : 'toda la zona';
        return '<li class="ad-card"><div class="ad-date"><b>' + hm(k.starts_at) + '</b><span>' + hm(k.ends_at) + '</span></div><div><div class="ad-name">' + esc(zoneName(k.zone_id)) + ' · ' + esc(n) + '</div><div class="ad-meta">' +
          esc(new Intl.DateTimeFormat('es-ES', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(k.starts_at))) + (k.note ? ' · ' + esc(k.note) : '') + '</div></div><div class="ad-actions"><button class="ad-btn is-small is-danger" data-delblock="' + k.id + '">Quitar</button></div></li>';
      }).join('') : '<li class="ad-empty">No hay bloqueos.</li>') + '</ul>';
    var f = document.getElementById('bkForm');
    function picks() {
      var some = f.querySelector('input[name="bkAll"]:checked').value === 'some', box = document.getElementById('bkPicks');
      box.hidden = !some; if (some) box.innerHTML = tablesPicker(document.getElementById('bkZone').value, [], []);
    }
    f.querySelectorAll('input[name="bkAll"]').forEach(function (r) { r.addEventListener('change', picks); });
    document.getElementById('bkZone').addEventListener('change', picks);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var date = document.getElementById('bkDate').value, from = document.getElementById('bkFrom').value, to = document.getElementById('bkTo').value;
      var starts = at(date, from), ends = at(to <= from && +to.slice(0, 2) >= 6 ? addDays(date, 1) : date, to);
      if (new Date(ends) <= new Date(starts)) ends = A.madridToISO(addDays(date, 1) + 'T' + to);
      var some = f.querySelector('input[name="bkAll"]:checked').value === 'some';
      var ids = some ? [].map.call(document.querySelectorAll('#bkPicks input:checked'), function (i) { return i.value; }) : null;
      var msg = document.getElementById('bkMsg'); msg.hidden = true;
      if (some && !ids.length) { msg.textContent = 'Elige al menos una mesa o bloquea toda la zona.'; msg.hidden = false; return; }
      document.getElementById('bkGo').disabled = true;
      // Aviso si ya hay reservas en esa franja (no se anulan solas).
      api('table_bookings?select=id,name,party,starts_at,status,hold_until&starts_at=lt.' + encodeURIComponent(ends) + '&ends_at=gt.' + encodeURIComponent(starts) + '&zone_id=eq.' + document.getElementById('bkZone').value + '&status=in.(confirmed,seated,pending)')
        .then(function (rows) {
          var live = (rows || []).filter(holds);
          if (live.length && !confirm('Ya hay ' + live.length + ' reserva(s) en esa franja (' + live.slice(0, 4).map(function (b) { return b.name + ' ' + hm(b.starts_at); }).join(', ') + '). El bloqueo no las anula. ¿Bloquear igualmente?')) { document.getElementById('bkGo').disabled = false; return null; }
          return api('dining_blocks', { method: 'POST', body: { zone_id: document.getElementById('bkZone').value, table_ids: ids, starts_at: starts, ends_at: ends, note: document.getElementById('bkNote').value.trim(), created_by: A.session().email || '' }, prefer: 'return=minimal' })
            .then(function () { flash('Bloqueo creado.', 'ok'); return enter(); });
        }).catch(function (x) { document.getElementById('bkGo').disabled = false; msg.textContent = errText(x); msg.hidden = false; });
    });
  }
  root.addEventListener('click', function (e) {
    var d = e.target.closest('[data-delblock]'); if (!d) return;
    if (!confirm('¿Quitar este bloqueo? Esas mesas volverán a poder reservarse.')) return;
    api('dining_blocks?id=eq.' + d.dataset.delblock, { method: 'DELETE', prefer: 'return=minimal' }).then(function () { flash('Bloqueo quitado.', 'ok'); return enter(); }).catch(fail);
  });

  // ─── Configuración ──────────────────────────────────────────────────
  var DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  function mm(min) { var h = Math.floor(min / 60) % 24; return ('0' + h).slice(-2) + ':' + ('0' + (min % 60)).slice(-2); }
  function toMin(v, ref) { var m = +v.slice(0, 2) * 60 + +v.slice(3, 5); return m < (ref || 0) && +v.slice(0, 2) < 6 ? m + 1440 : m; }
  function renderConfig(body) {
    var zones = S.zones.map(function (z) {
      return '<li class="ad-card mt-cfg" data-zone-row="' + z.id + '"><div class="ad-grid">' +
        '<label class="ad-field"><span>Nombre</span><input data-f="name_es" value="' + esc(z.name_es) + '"></label>' +
        '<label class="ad-field"><span>Fianza (€)</span><input data-f="deposit" type="number" min="0" step="0.5" value="' + z.deposit_cents / 100 + '"></label>' +
        '<label class="ad-field"><span>Se devuelve si anula con (h)</span><input data-f="free_cancel_hours" type="number" min="0" value="' + z.free_cancel_hours + '"></label>' +
        '<label class="mt-check"><input data-f="deposit_per_person" type="checkbox"' + (z.deposit_per_person ? ' checked' : '') + '> Fianza por persona</label>' +
        '<label class="mt-check"><input data-f="active" type="checkbox"' + (z.active ? ' checked' : '') + '> Visible en la web</label></div></li>';
    }).join('');
    var services = S.services.map(function (s) {
      return '<li class="ad-card mt-cfg" data-svc-row="' + s.id + '"><div class="ad-grid">' +
        '<div class="ad-field full"><span>' + esc(s.name_es) + ' · días</span><div class="mt-days">' + DOW.map(function (d, i) { return '<label><input type="checkbox" data-day="' + (i + 1) + '"' + (s.days.indexOf(i + 1) !== -1 ? ' checked' : '') + '> ' + d + '</label>'; }).join('') + '</div></div>' +
        '<label class="ad-field"><span>Primera mesa</span><input data-f="start" type="time" value="' + mm(s.start_min) + '"></label>' +
        '<label class="ad-field"><span>Última mesa</span><input data-f="last" type="time" value="' + mm(s.last_min) + '"></label>' +
        '<label class="ad-field"><span>Cada (min)</span><input data-f="slot_min" type="number" min="5" step="5" value="' + s.slot_min + '"></label>' +
        '<label class="ad-field"><span>La mesa se ocupa (min)</span><input data-f="duration_min" type="number" min="15" step="5" value="' + s.duration_min + '"></label>' +
        '<label class="ad-field"><span>Máx. personas</span><input data-f="max_party" type="number" min="1" value="' + s.max_party + '"></label>' +
        '<label class="ad-field"><span>Antelación mínima (min)</span><input data-f="notice_min" type="number" min="0" step="15" value="' + s.notice_min + '"></label>' +
        '<label class="ad-field"><span>Días vista</span><input data-f="days_ahead" type="number" min="1" value="' + s.days_ahead + '"></label>' +
        '<div class="ad-field"><span>Zonas que usa</span><div class="mt-days">' + S.zones.map(function (z) { return '<label><input type="checkbox" data-szone="' + z.id + '"' + (!s.zone_ids || s.zone_ids.indexOf(z.id) !== -1 ? ' checked' : '') + '> ' + esc(z.name_es) + '</label>'; }).join('') + '</div></div>' +
        '<label class="mt-check"><input data-f="active" type="checkbox"' + (s.active ? ' checked' : '') + '> Aceptar reservas web</label></div></li>';
    }).join('');
    var tables = S.zones.map(function (z) {
      var ts = S.tables.filter(function (t) { return t.zone_id === z.id; });
      return '<h3 class="mt-h3">' + esc(z.name_es) + ' · ' + ts.filter(function (t) { return t.active; }).reduce(function (n, t) { return n + t.seats_max; }, 0) + ' plazas</h3><div class="ad-table-wrap"><table class="ad-table mt-tbl"><thead><tr><th>Mesa</th><th>Mín</th><th>Máx</th><th>Grupo de unión</th><th>Activa</th><th></th></tr></thead><tbody>' +
        ts.map(function (t) {
          return '<tr data-table-row="' + t.id + '"><td><input data-f="name" value="' + esc(t.name) + '" size="6"></td><td><input data-f="seats_min" type="number" min="1" value="' + t.seats_min + '"></td><td><input data-f="seats_max" type="number" min="1" value="' + t.seats_max + '"></td>' +
            '<td><input data-f="combine_group" value="' + esc(t.combine_group) + '" placeholder="vacío = no se une"></td><td><input data-f="active" type="checkbox"' + (t.active ? ' checked' : '') + '></td><td><button class="ad-btn is-small is-danger" data-deltable="' + t.id + '">Borrar</button></td></tr>';
        }).join('') + '</tbody></table></div><button class="ad-btn is-small is-ghost" data-addtable="' + z.id + '" style="margin-top:0.5rem">+ Añadir mesa a ' + esc(z.name_es) + '</button>';
    }).join('');
    var closures = '<ul class="ad-list">' + (S.closures.length ? S.closures.map(function (c) {
      return '<li class="ad-card"><div><div class="ad-name">' + esc(c.date_from === c.date_to ? c.date_from : c.date_from + ' → ' + c.date_to) + '</div><div class="ad-meta">' + esc(c.service_id ? (S.services.filter(function (s) { return s.id === c.service_id; })[0] || {}).name_es || c.service_id : 'Todos los turnos') + ' · ' + esc(c.zone_id ? zoneName(c.zone_id) : 'Todas las zonas') + (c.note ? ' · ' + esc(c.note) : '') + '</div></div><div class="ad-actions"><button class="ad-btn is-small is-danger" data-delclosure="' + c.id + '">Quitar</button></div></li>';
    }).join('') : '<li class="ad-empty">Sin cierres programados.</li>') + '</ul>' +
      '<form class="ad-sheet-inline" id="clForm"><div class="ad-grid">' +
      '<label class="ad-field"><span>Desde</span><input type="date" id="clFrom" required></label><label class="ad-field"><span>Hasta</span><input type="date" id="clTo" required></label>' +
      '<label class="ad-field"><span>Turno</span><select id="clSvc"><option value="">Todos</option>' + S.services.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name_es) + '</option>'; }).join('') + '</select></label>' +
      '<label class="ad-field"><span>Zona</span><select id="clZone"><option value="">Todas</option>' + S.zones.map(function (z) { return '<option value="' + z.id + '">' + esc(z.name_es) + '</option>'; }).join('') + '</select></label>' +
      '<label class="ad-field full"><span>Motivo</span><input id="clNote" maxlength="120" placeholder="p. ej. Festivo, cerrado por vacaciones"></label></div><button class="ad-btn" type="submit">Cerrar esos días</button></form>';
    body.innerHTML = '<p class="ad-meta" style="margin-bottom:1rem">Los cambios se guardan al momento. Afectan solo a reservas nuevas.</p>' +
      '<h2 class="ad-sub">Zonas y fianzas</h2><ul class="ad-list">' + zones + '</ul>' +
      '<h2 class="ad-sub" style="margin-top:1.75rem">Turnos y horarios</h2><ul class="ad-list">' + services + '</ul>' +
      '<h2 class="ad-sub" style="margin-top:1.75rem">Mesas</h2><p class="ad-meta" style="margin-bottom:0.6rem">Las mesas con el mismo “grupo de unión” (en la misma zona) se pueden juntar para grupos grandes.</p>' + tables +
      '<h2 class="ad-sub" style="margin-top:1.75rem">Cierres por día</h2>' + closures;
    var cf = document.getElementById('clForm');
    if (cf) cf.addEventListener('submit', function (e) {
      e.preventDefault();
      api('dining_closures', { method: 'POST', body: { date_from: document.getElementById('clFrom').value, date_to: document.getElementById('clTo').value, service_id: document.getElementById('clSvc').value || null, zone_id: document.getElementById('clZone').value || null, note: document.getElementById('clNote').value.trim() }, prefer: 'return=minimal' })
        .then(function () { flash('Cierre añadido.', 'ok'); return enter(); }).catch(fail);
    });
  }
  function saved() { flash('Guardado.', 'ok'); }
  root.addEventListener('change', function (e) {
    var el = e.target, f = el.dataset.f;
    var zr = el.closest('[data-zone-row]'), sr = el.closest('[data-svc-row]'), tr = el.closest('[data-table-row]');
    if (zr && f) {
      var row = zr.dataset.zoneRow, body = {};
      if (f === 'deposit') body.deposit_cents = Math.round(+el.value * 100); else if (el.type === 'checkbox') body[f] = el.checked; else if (f === 'free_cancel_hours') body[f] = +el.value; else body[f] = el.value;
      api('dining_zones?id=eq.' + row, { method: 'PATCH', body: body, prefer: 'return=minimal' }).then(function () { return loadConfig(true); }).then(saved).catch(fail);
    } else if (sr && (f || el.dataset.day || el.dataset.szone)) {
      var sid = sr.dataset.svcRow, b = {};
      if (el.dataset.day) b.days = [].map.call(sr.querySelectorAll('[data-day]:checked'), function (i) { return +i.dataset.day; });
      else if (el.dataset.szone) { var zs = [].map.call(sr.querySelectorAll('[data-szone]:checked'), function (i) { return i.dataset.szone; }); b.zone_ids = zs.length === S.zones.length ? null : zs; }
      else if (f === 'start') b.start_min = toMin(el.value);
      else if (f === 'last') b.last_min = toMin(el.value, +sr.querySelector('[data-f="start"]').value.slice(0, 2) * 60 + 1);
      else if (el.type === 'checkbox') b[f] = el.checked; else b[f] = +el.value;
      if (b.last_min != null && sr.querySelector('[data-f="start"]')) { var st = toMin(sr.querySelector('[data-f="start"]').value); if (b.last_min < st) b.last_min += 1440; }
      api('dining_services?id=eq.' + sid, { method: 'PATCH', body: b, prefer: 'return=minimal' }).then(function () { return loadConfig(true); }).then(saved).catch(fail);
    } else if (tr && f) {
      var tb = {};
      if (el.type === 'checkbox') tb[f] = el.checked; else if (f === 'seats_min' || f === 'seats_max') tb[f] = +el.value; else tb[f] = el.value.trim();
      api('dining_tables?id=eq.' + tr.dataset.tableRow, { method: 'PATCH', body: tb, prefer: 'return=minimal' }).then(function () { return loadConfig(true); }).then(saved).catch(fail);
    }
  });
  root.addEventListener('click', function (e) {
    var a = e.target.closest('[data-addtable]'), d = e.target.closest('[data-deltable]'), c = e.target.closest('[data-delclosure]');
    if (a) {
      var name = prompt('Nombre de la mesa nueva (p. ej. M9):'); if (!name) return;
      var seats = +prompt('¿Cuántas personas caben como máximo?', '4'); if (!seats) return;
      api('dining_tables', { method: 'POST', body: { zone_id: a.dataset.addtable, name: name.trim(), seats_max: seats, sort: 100 }, prefer: 'return=minimal' }).then(function () { return loadConfig(true); }).then(render).catch(fail);
    } else if (d) {
      if (!confirm('¿Borrar esta mesa? Si tiene reservas, mejor desactívala.')) return;
      api('dining_tables?id=eq.' + d.dataset.deltable, { method: 'DELETE', prefer: 'return=minimal' }).then(function () { return loadConfig(true); }).then(render).catch(function () { flash('No se puede borrar: tiene reservas. Desactívala con la casilla “Activa”.', 'error'); });
    } else if (c) {
      api('dining_closures?id=eq.' + c.dataset.delclosure, { method: 'DELETE', prefer: 'return=minimal' }).then(function () { return enter(); }).catch(fail);
    }
  });
})();
