// Panel · pestaña "Mesas": reservas de mesa del día, mapa de mesas, bloqueos y configuración.
// Usa las funciones del panel (window.ROCE_ADMIN) y la base de datos de Supabase (tablas dining_* y table_bookings).
(function () {
  'use strict';
  var A = window.ROCE_ADMIN;
  var root = document.getElementById('tabTables');
  if (!A || !root) return;
  var api = A.api, flash = A.flash, esc = A.esc, TZ = A.TZ;
  var can = function (k) { return A.can ? A.can(k) : true; };

  var ST = { pending: 'Pendiente de pago', confirmed: 'Confirmada', seated: 'En mesa', completed: 'Completada', cancelled: 'Anulada', no_show: 'No vino' };
  var SHAPE = { bench: [2.1, 2.3], square: [4.4, 4.4], rect: [6.2, 4.4], long: [10, 4.4], bar: [8, 3.2], sofa: [7, 5], round: [5.4, 5.4] };
  var PLAN_RATIO = 1660 / 1175;

  // Elementos fijos del local (barras, cocina, escaleras, aseos, columnas…) en gris claro, solo para situarse.
  // Coordenadas en el mismo plano de referencia que las mesas (1660 × 1175).
  var CTX_ALTA = [
    { k: 'room', x0: 255, y0: 250, x1: 1500, y1: 740, l: 'Comedor', dash: 1 },
    { k: 'room', x0: 740, y0: 250, x1: 1015, y1: 400, l: 'Cocina' },
    { k: 'room', x0: 1045, y0: 455, x1: 1290, y1: 545, l: 'Barra', round: 1 },
    { k: 'room', x0: 630, y0: 545, x1: 830, y1: 670, l: 'Aseos' },
    { k: 'room', x0: 915, y0: 565, x1: 1100, y1: 640, l: 'Escalera', hatch: 1 },
    { k: 'room', x0: 255, y0: 735, x1: 470, y1: 800, l: 'Office' },
    { k: 'room', x0: 255, y0: 850, x1: 545, y1: 960, l: 'Almacén' },
    { k: 'room', x0: 15, y0: 185, x1: 225, y1: 720, l: 'Terraza cubierta', dash: 1 },
    { k: 'room', x0: 40, y0: 800, x1: 215, y1: 945, l: 'Sala privé', dash: 1 },
    { k: 'col', x: 448, y: 488, s: 30 }, { k: 'col', x: 710, y: 488, s: 30 }, { k: 'col', x: 1030, y: 488, s: 30 }
  ];
  var CTX = {
    baja: [
      { k: 'room', x0: 300, y0: 60, x1: 1510, y1: 470, l: 'Comedor', dash: 1 },
      { k: 'room', x0: 155, y0: 55, x1: 300, y1: 655, l: 'Cocina' },
      { k: 'room', x0: 310, y0: 110, x1: 500, y1: 345, l: 'Barra', round: 1 },
      { k: 'room', x0: 735, y0: 345, x1: 990, y1: 380, l: 'Barra público' },
      { k: 'room', x0: 735, y0: 425, x1: 850, y1: 465, l: 'Barra' },
      { k: 'room', x0: 1075, y0: 400, x1: 1255, y1: 470, l: 'Escalera', hatch: 1 },
      { k: 'room', x0: 1350, y0: 140, x1: 1500, y1: 300, l: 'Acceso' },
      { k: 'room', x0: 1360, y0: 330, x1: 1500, y1: 430, l: 'Salida emergencia' },
      { k: 'room', x0: 1375, y0: 440, x1: 1500, y1: 570, l: 'Bollería' },
      { k: 'room', x0: 465, y0: 440, x1: 590, y1: 620, l: 'Aseos' },
      { k: 'room', x0: 790, y0: 480, x1: 980, y1: 830, l: 'Patio', hatch: 1 },
      { k: 'col', x: 480, y: 340, s: 34 }, { k: 'col', x: 725, y: 335, s: 34 }, { k: 'col', x: 1000, y: 335, s: 34 }, { k: 'col', x: 1260, y: 335, s: 34 }
    ],
    alta: CTX_ALTA,
    prive: CTX_ALTA.filter(function (c) { return c.l === 'Terraza cubierta' || c.l === 'Sala privé' || c.l === 'Office' || c.l === 'Almacén'; })
  };

  var ZONE_NAME = { baja: 'Planta baja', alta: 'Planta alta', prive: 'Sala privé' };

  var S = { view: 'day', date: '', zone: 'baja', time: '', zones: [], tables: [], services: [], loadedCfg: false, bookings: [], blocks: [], closures: [], busy: false, join: false, sel: [], zoom: 1, px: 0, py: 0, justMoved: false, mode: 'timeline', joinTime: '', prescribers: [], notes: {}, waitlist: [], crm: [], crmQ: '', crmSort: 'last', crmType: '' };

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
    var map = { table_busy: 'Alguna de esas mesas ya está ocupada a esa hora.', no_table: 'No hay mesa libre para ese grupo a esa hora en esa zona.', bad_data: 'Revisa los datos (nombre y personas).', email_required: 'Para pedir la fianza hace falta el email del cliente.', forbidden: 'No tienes permiso.', zone_not_found: 'Zona no válida.', not_editable: 'Esa reserva ya no se puede editar.', customer_blocked: 'Este cliente está bloqueado. Quita el bloqueo en Clientes si quieres reservarle.', amount_required: 'Pon el importe a cobrar.', service_not_found: 'Turno no válido.' };
    var k = Object.keys(map).filter(function (x) { return m.indexOf(x) !== -1; })[0];
    return k ? map[k] : m;
  }

  // ─── Carga ──────────────────────────────────────────────────────────
  function loadConfig(force) {
    if (S.loadedCfg && !force) return Promise.resolve();
    return Promise.all([
      api('dining_zones?select=*&order=sort,id'),
      api('dining_tables?select=*&order=zone_id,sort,name'),
      api('dining_services?select=*&order=start_min'),
      api('dining_prescribers?select=*&order=name').catch(function () { return []; }),
      api('rpc/dining_team_people', { method: 'POST', body: {} }).catch(function () { return []; }),
      api('dining_tags?select=*&order=name').catch(function () { return []; }),
      api('dining_accounts?select=*&order=name').catch(function () { return []; }),
      api('dining_account_moves?select=*&order=created_at.desc&limit=2000').catch(function () { return []; })
    ]).then(function (r) { S.tags = r[5] || []; S.accounts = r[6] || []; S.accMoves = r[7] || []; S.zones = r[0] || []; S.tables = r[1] || []; S.services = r[2] || []; S.prescribers = r[3] || []; S.team = r[4] || []; S.loadedCfg = true; });
  }
  function loadDay() {
    var from = A.madridToISO(S.date + 'T05:00'), to = A.madridToISO(addDays(S.date, 1) + 'T05:00');
    return Promise.all([
      api('table_bookings?select=*,table_booking_tables(table_id)&starts_at=gte.' + encodeURIComponent(from) + '&starts_at=lt.' + encodeURIComponent(to) + '&order=starts_at'),
      api('dining_blocks?select=*&starts_at=lt.' + encodeURIComponent(to) + '&ends_at=gt.' + encodeURIComponent(from) + '&order=starts_at'),
      api('dining_customer_notes?select=*').catch(function () { return []; })
    ]).then(function (r) { S.bookings = r[0] || []; S.blocks = r[1] || []; S.notes = {}; (r[2] || []).forEach(function (n) { S.notes[n.customer_key] = n; }); });
  }
  function tableById(id) { return S.tables.filter(function (t) { return t.id === id; })[0]; }
  // Clave del cliente (la misma que usa el CRM): su email o, si no tiene, su teléfono.
  function ckey(b) { var e = String(b.email || '').trim().toLowerCase(); return e || String(b.phone || '').replace(/\D/g, ''); }
  function noteOf(b) { return S.notes[ckey(b)] || null; }
  function personName(p) { return ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || p.email; }
  function slugCode(nm) { return nm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 26); }
  // Gente del equipo que todavía no es prescriptor.
  function teamFree() { return (S.team || []).filter(function (m) { return !S.prescribers.some(function (x) { return (x.email || '').toLowerCase() === String(m.email).toLowerCase(); }); }); }
  // Opciones del desplegable de prescriptor: los de la lista, la gente del equipo y crear uno nuevo a mano.
  function presOptions(sel) {
    var h = '<option value="">—</option>' + S.prescribers.filter(function (x) { return x.active || x.code === sel; }).map(function (x) { return '<option value="' + esc(x.code) + '"' + (x.code === sel ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('');
    var tf = teamFree();
    if (tf.length) h += '<optgroup label="Equipo ROCE">' + tf.map(function (m) { return '<option value="team:' + esc(m.email) + '">' + esc(personName(m)) + '</option>'; }).join('') + '</optgroup>';
    return h + '<option value="__new">＋ Crear prescriptor a mano…</option>';
  }
  // Crea el prescriptor (del equipo o a mano) y devuelve su código.
  function addPrescriber(name, email) {
    var base = slugCode(name); if (base.length < 2) return Promise.reject(new Error('bad_name'));
    var code = base, n = 2; while (S.prescribers.some(function (x) { return x.code === code; })) code = base + '-' + (n++);
    var body = { code: code, name: name }; if (email) body.email = email.toLowerCase();
    return api('dining_prescribers', { method: 'POST', body: body, prefer: 'return=minimal' }).then(function () { return loadConfig(true); }).then(function () { return code; });
  }
  document.addEventListener('change', function (e) {
    var el = e.target; if (!el || (el.id !== 'nwPres' && el.id !== 'edPres')) return;
    var v = el.value; if (v !== '__new' && v.indexOf('team:') !== 0) return;
    var job;
    if (v === '__new') {
      var nm = prompt('Nombre del prescriptor (persona, hotel, agencia…):'); nm = nm && nm.trim();
      if (!nm) { el.value = ''; return; }
      job = addPrescriber(nm, '');
    } else {
      var email = v.slice(5), m = (S.team || []).filter(function (x) { return String(x.email).toLowerCase() === email.toLowerCase(); })[0];
      job = addPrescriber(m ? personName(m) : email, email);
    }
    job.then(function (code) { el.innerHTML = presOptions(code); el.value = code; flash('Prescriptor añadido.', 'ok'); }).catch(function () { el.value = ''; flash('No se ha podido crear el prescriptor (¿ya existe?).', 'error'); });
  });
  // "＋ Nueva etiqueta" en cualquier lista de etiquetas: se crea al momento y queda marcada.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-newtag]'); if (!b) return;
    e.preventDefault();
    var nm = prompt('Nombre de la etiqueta nueva (p. ej. VIP, Prensa, Amigo de la casa):'); nm = nm && nm.trim(); if (!nm) return;
    var base = slugCode(nm); if (base.length < 2) return flash('Ese nombre no es válido.', 'error');
    var existing = (S.tags || []).filter(function (t) { return t.code === base; })[0];
    var code = base, name = nm, job = Promise.resolve();
    if (!existing && !AL[base] && !LB[base]) job = api('dining_tags', { method: 'POST', body: { code: code, name: name }, prefer: 'return=minimal' }).then(function () { return loadConfig(true); });
    job.then(function () {
      var list = b.closest('.mt-al-list'), nameAttr = b.dataset.newtag;
      var on = [].map.call(list.querySelectorAll('input:checked'), function (i) { return i.value; });
      if (on.indexOf(code) === -1) on.push(code);
      var tmp = document.createElement('div'); tmp.innerHTML = chips(nameAttr, on); list.replaceWith(tmp.firstChild);
    }).catch(function () { flash('No se ha podido crear la etiqueta: ejecuta primero mesas_etiquetas.sql en Supabase.', 'error'); });
  });
  // ─── Cuentas de empresa / grupo (saldo) ───
  function accBal(id) { return (S.accMoves || []).reduce(function (n, m) { return m.account_id === id ? n + m.amount_cents : n; }, 0); }
  function accOptions(sel) {
    var act = (S.accounts || []).filter(function (a) { return a.active || a.id === sel; });
    return '<option value="">Sin cuenta</option>' + act.map(function (a) { return '<option value="' + a.id + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.name) + (a.kind === 'contado' ? ' · pago contado' : ' · ' + eur(accBal(a.id))) + '</option>'; }).join('');
  }
  var AK = { grupo: 'Grupo · bote prepagado', empresa: 'Empresa · factura final de mes', contado: 'Pago contado' };
  function accAddr(a) { return [a.address, [a.postal_code, a.city].filter(Boolean).join(' '), a.region, a.country].filter(Boolean).join(', '); }
  // Campos de datos fiscales (se usan al crear y al editar).
  function accFields(a, pre) {
    a = a || {};
    return '<label class="ad-field"><span>Nombre comercial / grupo</span><input id="' + pre + 'Name" maxlength="80" required value="' + esc(a.name || '') + '" placeholder="p. ej. Grupo Marqués"></label>' +
      '<label class="ad-field"><span>Tipo / forma de pago</span><select id="' + pre + 'Kind">' + Object.keys(AK).map(function (k) { return '<option value="' + k + '"' + ((a.kind || 'grupo') === k ? ' selected' : '') + '>' + AK[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="ad-field"><span>Razón social</span><input id="' + pre + 'Legal" maxlength="120" value="' + esc(a.legal_name || '') + '"></label>' +
      '<label class="ad-field"><span>CIF / NIF</span><input id="' + pre + 'Tax" maxlength="20" value="' + esc(a.tax_id || '') + '"></label>' +
      '<label class="ad-field full"><span>Dirección fiscal</span><input id="' + pre + 'Addr" maxlength="160" value="' + esc(a.address || '') + '" placeholder="Calle, número, piso"></label>' +
      '<label class="ad-field"><span>Código postal</span><input id="' + pre + 'Zip" maxlength="10" inputmode="numeric" value="' + esc(a.postal_code || '') + '"></label>' +
      '<label class="ad-field"><span>Ciudad</span><input id="' + pre + 'City" maxlength="80" value="' + esc(a.city || '') + '"></label>' +
      '<label class="ad-field"><span>Provincia / región</span><input id="' + pre + 'Region" maxlength="80" value="' + esc(a.region || '') + '"></label>' +
      '<label class="ad-field"><span>País</span><input id="' + pre + 'Country" maxlength="60" value="' + esc(a.country || 'España') + '"></label>';
  }
  function accRead(root_, pre) {
    var v = function (id) { return root_.querySelector('#' + pre + id).value.trim(); };
    return { name: v('Name'), kind: root_.querySelector('#' + pre + 'Kind').value, legal_name: v('Legal'), tax_id: v('Tax'), address: v('Addr'), postal_code: v('Zip'), city: v('City'), region: v('Region'), country: v('Country') || 'España' };
  }
  function accVal(el) { return el && !el.disabled ? (el.value || null) : undefined; }   // sin permiso o sin cuentas: no se toca
  function accField(id, sel) {
    var none = !(S.accounts || []).length;
    return '<label class="ad-field"><span>Cuenta de empresa / grupo (saldo)</span><select id="' + id + '"' + (none ? ' disabled' : '') + '>' + (none ? '<option value="">Sin cuentas: créalas en RoceCover → Cuentas</option>' : accOptions(sel)) + '</select></label>';
  }
  function presName(code) { var p = S.prescribers.filter(function (x) { return x.code === code; })[0]; return p ? p.name : code; }
  var AL = { gluten: 'Gluten / celiaquía', lactosa: 'Lactosa', 'frutos-secos': 'Frutos secos', marisco: 'Marisco', pescado: 'Pescado', huevo: 'Huevo', soja: 'Soja', sesamo: 'Sésamo', vegetariano: 'Vegetariano', vegano: 'Vegano', otras: 'Otras alergias' };
  var LB = { transferencia: 'Pago por transferencia' };   // etiquetas que no son alergias
  // Etiquetas que no son alergias: las de siempre más las que crea el equipo (VIP…).
  function LBL() { var o = Object.assign({}, LB); (S.tags || []).forEach(function (t) { o[t.code] = t.name; }); return o; }
  var CT = { particular: 'Particular', empresa: 'Empresa', grupo: 'Grupo empresarial (consumo interno)' };
  function chips(name, sel) {
    var one = function (k, txt, cls) { return '<label class="mt-al' + (cls ? ' ' + cls : '') + '"><input type="checkbox" name="' + name + '" value="' + k + '"' + ((sel || []).indexOf(k) !== -1 ? ' checked' : '') + '><span>' + esc(txt) + '</span></label>'; };
    return '<div class="mt-al-list">' + Object.keys(AL).map(function (k) { return one(k, AL[k]); }).join('') + Object.keys(LBL()).map(function (k) { return one(k, LBL()[k], 'is-label'); }).join('') + '<button type="button" class="mt-al-new" data-newtag="' + name + '">＋ Nueva etiqueta</button></div>';
  }
  function picked(root_, name) { return [].map.call(root_.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; }); }
  function tagsOf(b) { var set = {}; (b.allergy_tags || []).concat((noteOf(b) || {}).tags || []).forEach(function (k) { set[k] = 1; }); return Object.keys(set); }
  function allergiesOf(b) { return tagsOf(b).filter(function (k) { return AL[k]; }); }
  function labelsOf(b) { return tagsOf(b).filter(function (k) { return LBL()[k]; }); }
  function alText(b) { return allergiesOf(b).map(function (k) { return AL[k]; }).join(', '); }
  function tagHtml(k) { return AL[k] ? '<span class="ad-tag is-red">⚠ ' + esc(AL[k]) + '</span>' : '<span class="ad-tag">' + esc(LBL()[k] || k) + '</span>'; }
  function saveCust(key, o) {
    if (!key) return Promise.resolve();
    var cur = S.notes[key] || { note: '', blocked: false, blocked_reason: '', tags: [], customer_type: 'particular', company: '', tax_id: '', balance_cents: 0 };
    var n = Object.assign({}, cur, o, { customer_key: key });
    if (!n.blocked) n.blocked_reason = '';
    var body = { customer_key: key, note: n.note || '', blocked: !!n.blocked, blocked_reason: n.blocked_reason || '', tags: n.tags || [], customer_type: n.customer_type || 'particular', company: n.company || '', tax_id: n.tax_id || '', balance_cents: n.balance_cents || 0, updated_by: A.session().email || '', updated_at: new Date().toISOString() };
    if (n.account_id !== undefined) body.account_id = n.account_id || null;   // solo si la columna existe (mesas_cuentas.sql)
    return api('dining_customer_notes?on_conflict=customer_key', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: body })
      .then(function () { S.notes[key] = n; });
  }
  function saveNote(key, note, blocked, why) { return saveCust(key, { note: note, blocked: blocked, blocked_reason: why }); }
  function saveNoteOld(key, note, blocked, why) {
    if (!key) return Promise.resolve();
    return api('dining_customer_notes?on_conflict=customer_key', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { customer_key: key, note: note || '', blocked: !!blocked, blocked_reason: blocked ? (why || '') : '', updated_by: A.session().email || '', updated_at: new Date().toISOString() } })
      .then(function () { S.notes[key] = { customer_key: key, note: note || '', blocked: !!blocked, blocked_reason: blocked ? (why || '') : '' }; });
  }
  function seatsOf(b) { return bookingTables(b).reduce(function (n, t) { return n + t.seats_max; }, 0); }
  function bookingTables(b) { return (b.table_booking_tables || []).map(function (x) { return tableById(x.table_id); }).filter(Boolean); }

  // ─── Estructura ─────────────────────────────────────────────────────
  function shell() {
    root.innerHTML =
      '<div class="mt-nav" role="group" aria-label="Mesas">' +
      [['day', 'Día', 'tables'], ['wait', 'Lista de espera', 'tables_wait'], ['crm', 'Clientes', 'tables_crm'], ['accounts', 'Cuentas', 'tables_accounts'], ['blocks', 'Bloqueos', 'tables_blocks'], ['config', 'Configuración', 'tables_config']].filter(function (v) { return can(v[2]); }).map(function (v) { return '<button type="button" class="ck-chip" data-view="' + v[0] + '" aria-pressed="' + (S.view === v[0]) + '">' + v[1] + '</button>'; }).join('') +
      '</div><div id="mtBody"></div>';
  }
  function render() {
    if (!document.getElementById('mtBody')) shell();
    [].forEach.call(root.querySelectorAll('[data-view]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === S.view)); });
    var body = document.getElementById('mtBody');
    if (S.view === 'day') { renderDay(body); applyView(); } else if (S.view === 'wait') renderWait(body); else if (S.view === 'crm') renderCrm(body); else if (S.view === 'accounts') renderAccounts(body); else if (S.view === 'blocks') renderBlocks(body); else renderConfig(body);
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
      if (S.view === 'wait') return api('dining_waitlist?select=*&status=in.(waiting,notified)&want_date=gte.' + today() + '&order=want_date,created_at').then(function (r) { S.waitlist = r || []; });
      if (S.view === 'crm') return Promise.all([A.api('rpc/dining_crm', { method: 'POST', body: {} }), api('dining_customer_notes?select=*').catch(function () { return []; })]).then(function (r) { S.crm = r[0] || []; (r[1] || []).forEach(function (n) { S.notes[n.customer_key] = n; }); });
      if (S.view === 'accounts') return loadConfig(true);
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

  // ─── Línea de tiempo: una fila por mesa, las horas en columnas ──────
  var PXMIN = 1.7; // píxeles por minuto (≈ 100 px por hora)
  function hhmm(min) { var h = Math.floor(min / 60) % 24; return ('0' + h).slice(-2) + ':' + ('0' + (min % 60)).slice(-2); }
  function timeline() {
    var base = new Date(A.madridToISO(S.date + 'T00:00')).getTime();
    var svcs = S.services.filter(function (x) { return x.active && (!x.zone_ids || x.zone_ids.indexOf(S.zone) !== -1); });
    var t0 = svcs.length ? Math.min.apply(null, svcs.map(function (x) { return x.start_min; })) : 600;
    var t1 = svcs.length ? Math.max.apply(null, svcs.map(function (x) { return x.last_min + x.duration_min; })) : 1560;
    var rows = S.tables.filter(function (t) { return t.zone_id === S.zone && t.active; });
    var mins = function (iso) { return (new Date(iso).getTime() - base) / 60000; };
    S.bookings.forEach(function (b) { if (b.zone_id === S.zone && b.status !== 'cancelled') { t0 = Math.min(t0, Math.floor(mins(b.starts_at) / 60) * 60); t1 = Math.max(t1, Math.ceil(mins(b.ends_at) / 60) * 60); } });
    t0 = Math.floor(t0 / 60) * 60; t1 = Math.ceil(t1 / 60) * 60;
    var W = Math.round((t1 - t0) * PXMIN);
    var ticks = '';
    for (var m = t0; m < t1; m += 60) ticks += '<span class="mt-tick" style="left:' + Math.round((m - t0) * PXMIN) + 'px">' + hhmm(m) + '</span>';
    var nowMin = S.date === today() ? mins(new Date().toISOString()) : null;
    var nowLine = nowMin != null && nowMin >= t0 && nowMin <= t1 ? '<i class="mt-now" style="left:' + Math.round((nowMin - t0) * PXMIN) + 'px"></i>' : '';
    var rowsHtml = rows.map(function (t) {
      var bars = '';
      S.bookings.forEach(function (b) {
        if (b.status === 'cancelled' || !(b.table_booking_tables || []).some(function (x) { return x.table_id === t.id; })) return;
        var l = Math.round((mins(b.starts_at) - t0) * PXMIN), w = Math.max(24, Math.round((mins(b.ends_at) - mins(b.starts_at)) * PXMIN)) - 2;
        var st = b.status === 'no_show' ? 'noshow' : b.status === 'seated' ? (b.dessert_at ? 'dessert' : 'seated') : b.status === 'completed' ? 'done' : b.status === 'pending' ? 'pending' : 'booked';
        var many = (b.table_booking_tables || []).length > 1, seats = seatsOf(b), over = b.party > seats;
        var arrived = b.status === 'confirmed' && !!b.arrived_at;
        var late = b.status === 'confirmed' && !b.arrived_at && S.date === today() && Date.now() - Date.parse(b.starts_at) > 15 * 60000;
        var al = allergiesOf(b).length ? ' ⚠' : '', lb = labelsOf(b).length ? ' · ' + labelsOf(b).map(function (k) { return LBL()[k]; }).join(', ') : '';
        var flags = al + lb + (arrived ? ' · llegó ' + hm(b.arrived_at) : '') + (b.status === 'seated' && b.dessert_at ? ' · postre' : '') + (late ? ' · ¿llega?' : '') + (b.status === 'no_show' ? ' · no vino' : '');
        bars += '<button type="button" class="mt-bar is-' + st + (arrived ? ' is-arrived' : '') + (late ? ' is-late' : '') + (over ? ' is-over' : '') + '" data-bid="' + b.id + '" style="left:' + l + 'px;width:' + w + 'px" title="' + esc((b.name || 'Sin nombre') + ' · ' + b.party + ' personas en ' + seats + ' plazas · ' + hm(b.starts_at) + '–' + hm(b.ends_at) + flags + (alText(b) ? ' · ALERGIAS: ' + alText(b) : '') + (b.notes ? ' · ' + b.notes : '')) + '"><b>' + esc(b.name || 'Sin nombre') + '</b> <span>' + b.party + '/' + seats + (many ? ' · juntas' : '') + flags + '</span></button>';
      });
      S.blocks.forEach(function (k) {
        if (k.zone_id !== t.zone_id || (k.table_ids && k.table_ids.indexOf(t.id) === -1)) return;
        var l = Math.max(0, Math.round((mins(k.starts_at) - t0) * PXMIN)), r = Math.min(W, Math.round((mins(k.ends_at) - t0) * PXMIN));
        if (r > l) bars += '<span class="mt-bar is-blocked" style="left:' + l + 'px;width:' + (r - l) + 'px" title="' + esc('Bloqueada' + (k.note ? ': ' + k.note : '')) + '"><b>' + esc(k.note || 'Bloqueada') + '</b></span>';
      });
      return '<div class="mt-row"><button type="button" class="mt-rl' + (S.sel.indexOf(t.id) !== -1 ? ' is-sel' : '') + '" data-rowtable="' + t.id + '"><b>' + esc(t.name) + '</b><small>' + t.seats_max + ' plazas</small></button>' +
        '<div class="mt-track" data-track="' + t.id + '" data-t0="' + t0 + '" style="width:' + W + 'px">' + bars + '</div></div>';
    }).join('');
    if (!rows.length) return '<p class="ad-empty">Esta zona no tiene mesas activas.</p>';
    return '<div class="mt-tl"><div class="mt-tl-in" style="min-width:' + (W + 78) + 'px"><div class="mt-row mt-head"><span class="mt-rl"></span><div class="mt-ticks" style="width:' + W + 'px">' + ticks + '</div></div>' +
      '<div class="mt-body" style="--w:' + W + 'px">' + nowLine + rowsHtml + '</div></div></div>' +
      '<p class="ad-meta mt-legend"><span class="mt-dot is-booked"></span>Reservada <span class="mt-dot is-pending"></span>Pendiente <span class="mt-dot is-seated"></span>En mesa <span class="mt-dot is-blocked"></span>Bloqueada · en cada barra: personas/plazas de la mesa. Toca un hueco para reservar, una barra para editarla.</p>';
  }

  function renderDay(body) {
    var prevEl = root.querySelector('.mt-tl'), prevScroll = prevEl ? prevEl.scrollLeft : null;
    var opts = timeOptions(); if (!S.time || opts.indexOf(S.time) === -1) S.time = defaultTime(opts);
    var iso = at(S.date, S.time);
    var live = S.bookings.filter(function (b) { return b.status !== 'cancelled'; });
    var covers = live.filter(holds).reduce(function (n, b) { return n + b.party; }, 0);
    var deposits = S.bookings.filter(function (b) { return b.payment_status === 'paid'; }).reduce(function (n, b) { return n + b.deposit_cents; }, 0);

    var zones = S.zones.filter(function (z) { return S.tables.some(function (t) { return t.zone_id === z.id; }); });
    // El plano se recorta a donde hay mesas (con un margen) para que se vean grandes.
    var PW = 1660, PH = 1175, PAD = (CTX[S.zone] || []).length ? 110 : 45;
    var zt = S.tables.filter(function (t) { return t.zone_id === S.zone && t.pos_x != null; });
    var boxes = zt.map(function (t) { var sz = SHAPE[t.shape] || SHAPE.square; return { t: t, cx: t.pos_x / 100 * PW, cy: t.pos_y / 100 * PH, w: sz[0] / 100 * PW, h: sz[1] / 100 * PW }; });
    var minx = Math.min.apply(null, boxes.map(function (b) { return b.cx - b.w / 2; })), maxx = Math.max.apply(null, boxes.map(function (b) { return b.cx + b.w / 2; }));
    var miny = Math.min.apply(null, boxes.map(function (b) { return b.cy - b.h / 2; })), maxy = Math.max.apply(null, boxes.map(function (b) { return b.cy + b.h / 2; }));
    if (!boxes.length) { minx = 0; maxx = PW; miny = 0; maxy = PH; }
    var bw = maxx - minx + 2 * PAD, bh = Math.max(maxy - miny + 2 * PAD, bw / 2.4), oy = miny - PAD - (bh - (maxy - miny + 2 * PAD)) / 2;
    var map = '<div class="mt-map-wrap"><div class="mt-viewport" style="aspect-ratio:' + (bw / bh).toFixed(3) + '"><div class="mt-zoom"><button type="button" data-zoom="1" aria-label="Acercar">+</button><button type="button" data-zoom="-1" aria-label="Alejar">−</button><button type="button" data-zoom="0" aria-label="Ver todo">⤢</button></div><div class="mt-map">' +
      (CTX[S.zone] || []).map(function (c) {
        if (c.k === 'col') { var cl = ((c.x - c.s / 2 - minx + PAD) / bw * 100).toFixed(2), ct = ((c.y - c.s / 2 - oy) / bh * 100).toFixed(2); return '<i class="mt-ctx is-col" style="left:' + cl + '%;top:' + ct + '%;width:' + (c.s / bw * 100).toFixed(2) + '%;height:' + (c.s / bh * 100).toFixed(2) + '%"></i>'; }
        return '<div class="mt-ctx' + (c.dash ? ' is-dash' : '') + (c.hatch ? ' is-hatch' : '') + (c.round ? ' is-round' : '') + '" style="left:' + ((c.x0 - minx + PAD) / bw * 100).toFixed(2) + '%;top:' + ((c.y0 - oy) / bh * 100).toFixed(2) + '%;width:' + ((c.x1 - c.x0) / bw * 100).toFixed(2) + '%;height:' + ((c.y1 - c.y0) / bh * 100).toFixed(2) + '%"><span>' + esc(c.l) + '</span></div>';
      }).join('') +
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
      var PSL = { paid: 'pagada', pending: 'sin pagar', refunded: 'devuelta', retained: 'retenida', guaranteed: 'tarjeta guardada', charging: 'cobrando…', charged: 'cobrada', released: 'tarjeta liberada' };
      var pay = b.card_last4 && b.payment_status === 'guaranteed' ? '<span class="ad-tag is-green">Tarjeta ' + esc(b.card_brand || '') + ' ····' + esc(b.card_last4) + ' · garantía ' + eur(b.deposit_cents) + '</span>' :
        b.deposit_cents > 0 && b.payment_status !== 'free' ? '<span class="ad-tag ' + (b.payment_status === 'paid' || b.payment_status === 'charged' ? 'is-green' : b.payment_status === 'pending' ? 'is-red' : '') + '">' + eur(b.deposit_cents) + ' · ' + (PSL[b.payment_status] || b.payment_status) + (b.late_cancel && b.payment_status === 'guaranteed' ? ' · anulada tarde' : '') + '</span>' : '';
      var a = [];
      if (b.status === 'confirmed' && !b.arrived_at) a.push('<button class="ad-btn is-small is-ghost" data-act="arrive" data-id="' + b.id + '">Ha llegado</button>');
      if (b.status === 'confirmed' || b.status === 'pending') a.push('<button class="ad-btn is-small" data-act="seat" data-id="' + b.id + '">Sentar</button>');
      if (b.status === 'seated' && !b.dessert_at) a.push('<button class="ad-btn is-small is-ghost" data-act="dessert" data-id="' + b.id + '">Postre</button>');
      if (b.status === 'seated') a.push('<button class="ad-btn is-small" data-act="done" data-id="' + b.id + '">Terminada</button>');
      if (b.status === 'confirmed') a.push('<button class="ad-btn is-small is-ghost" data-act="noshow" data-id="' + b.id + '">No vino</button>');
      if (!cancelled && b.status !== 'completed') a.push('<button class="ad-btn is-small is-ghost" data-act="edit" data-id="' + b.id + '">Editar / ampliar</button>');
      if (!cancelled && b.status !== 'completed') a.push('<button class="ad-btn is-small is-danger" data-act="cancel" data-id="' + b.id + '">Anular</button>');
      if (can('tables_charge') && b.payment_status === 'guaranteed' && (b.status === 'no_show' || b.late_cancel || (b.status === 'confirmed' && new Date(b.starts_at).getTime() < Date.now()))) a.push('<button class="ad-btn is-small is-danger" data-act="charge" data-id="' + b.id + '">Cobrar ' + eur(b.deposit_cents) + ' a la tarjeta</button>');
      if ((b.payment_status === 'paid' || b.payment_status === 'retained' || b.payment_status === 'charged') && b.deposit_cents > 0) a.push('<button class="ad-btn is-small is-ghost" data-act="refund" data-id="' + b.id + '">Devolver fianza</button>');
      return '<li class="ad-card mt-bk' + (cancelled ? ' is-past' : '') + '"><div class="ad-date"><b>' + hm(b.starts_at) + '</b><span>' + b.party + ' p.</span></div>' +
        '<div><div class="ad-name">' + (b.name ? esc(b.name) : '<i>Sin nombre</i>') + ' <span class="ad-tag ' + (b.status === 'seated' ? 'is-green' : b.status === 'cancelled' || b.status === 'no_show' ? 'is-red' : '') + '">' + esc(ST[b.status] || b.status) + '</span>' + (b.arrived_at && b.status !== 'cancelled' ? '<span class="ad-tag is-green">Llegó ' + hm(b.arrived_at) + '</span>' : '') + (b.dessert_at && b.status === 'seated' ? '<span class="ad-tag">Postre ' + hm(b.dessert_at) + '</span>' : '') + (b.prescriber ? '<span class="ad-tag">Prescriptor: ' + esc(presName(b.prescriber)) + '</span>' : '') + (b.spend_cents != null ? '<span class="ad-tag">Gasto ' + eur(b.spend_cents) + '</span>' : '') + (noteOf(b) && noteOf(b).blocked ? '<span class="ad-tag is-red">Cliente bloqueado</span>' : '') + (noteOf(b) && noteOf(b).customer_type === 'empresa' ? '<span class="ad-tag">Empresa' + (noteOf(b).company ? ': ' + esc(noteOf(b).company) : '') + (noteOf(b).balance_cents ? ' · saldo ' + eur(noteOf(b).balance_cents) : '') + '</span>' : '') + (noteOf(b) && noteOf(b).customer_type === 'grupo' ? '<span class="ad-tag">Consumo interno</span>' : '') + tagsOf(b).map(tagHtml).join('') + pay + '</div>' +
        '<div class="ad-meta">' + esc(zoneName(b.zone_id)) + (tn ? ' · mesa ' + esc(tn) + ' (' + seatsOf(b) + ' plazas' + (b.party > seatsOf(b) ? ' · faltan ' + (b.party - seatsOf(b)) : '') + ')' : '') + ' · ' + esc(b.ambience === 'night' ? 'Restaurant & Cocktails' : 'Coffee, Bakery & Kitchen') + (b.source === 'admin' ? ' · creada en el panel' : '') + '</div>' +
        '<div class="ad-meta">' + esc(b.phone) + (b.email ? ' · ' + esc(b.email) : '') + ' · ' + esc(b.ref) + '</div>' +
        (b.notes ? '<div class="ad-meta">“' + esc(b.notes) + '”</div>' : '') + (noteOf(b) && noteOf(b).note ? '<div class="ad-meta">Nota del cliente: ' + esc(noteOf(b).note) + '</div>' : '') + '</div>' +
        '<div class="ad-actions">' + a.join('') + '</div></li>';
    }).join('') : '<li class="ad-empty">No hay reservas este día.</li>';

    body.innerHTML =
      '<div class="ad-bar"><div class="mt-day"><button class="ad-btn is-ghost is-small" data-dayn="-1" aria-label="Día anterior">←</button>' +
      '<input type="date" id="mtDate" value="' + S.date + '"><button class="ad-btn is-ghost is-small" data-dayn="1" aria-label="Día siguiente">→</button>' +
      '<button class="ad-btn is-ghost is-small" data-dayn="0">Hoy</button></div>' +
      '<span class="mt-topbtns"><button class="ad-btn is-ghost" id="mtPrint" type="button">Imprimir día</button><button class="ad-btn" id="mtNew" type="button">+ Nueva reserva</button></span></div>' +
      '<p class="ad-meta mt-sum"><b>' + esc(dayLabel(S.date)) + '</b> · ' + live.length + ' reservas · ' + covers + ' comensales' + (deposits ? ' · fianzas cobradas ' + eur(deposits) : '') + '</p>' +
      '<div class="mt-vtoggle" role="group"><button type="button" class="ck-chip" data-mode="timeline" aria-pressed="' + (S.mode === 'timeline') + '">Línea de tiempo</button><button type="button" class="ck-chip" data-mode="map" aria-pressed="' + (S.mode === 'map') + '">Mapa</button></div>' +
      '<div class="ad-bar mt-mapbar"><div class="mt-zones" role="group">' + zones.map(function (z) { return '<button type="button" class="ck-chip" data-zone="' + z.id + '" aria-pressed="' + (z.id === S.zone) + '">' + esc(z.name_es) + '</button>'; }).join('') + '</div>' +
      '<button type="button" class="ad-btn is-small ' + (S.join ? '' : 'is-ghost') + '" id="mtJoin">' + (S.join ? 'Terminar de juntar' : 'Juntar mesas') + '</button>' +
      (S.mode === 'map' ? '<span class="mt-time"><button type="button" class="ad-btn is-ghost is-small" data-tstep="-1" aria-label="Hora anterior">‹</button><label>Mapa a las <select id="mtTime">' + opts.map(function (t) { return '<option' + (t === S.time ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label><button type="button" class="ad-btn is-ghost is-small" data-tstep="1" aria-label="Hora siguiente">›</button></span>' : '') + '</div>' +
      (S.join ? joinBar() : '') + (S.mode === 'map' ? map : timeline()) + '<h2 class="ad-sub">Reservas del día</h2><ul class="ad-list" id="mtList">' + list + '</ul>';
    var tlEl = body.querySelector('.mt-tl');
    if (tlEl) {
      var key = S.date + S.zone;
      if (prevScroll != null && S.tlKey === key) tlEl.scrollLeft = prevScroll;
      else {
        // Al abrir el día: se centra en la hora actual (si es hoy) o en la primera reserva.
        var anchor = tlEl.querySelector('.mt-now'), first = [].slice.call(tlEl.querySelectorAll('.mt-bar:not(.is-blocked)')).sort(function (a, b) { return a.offsetLeft - b.offsetLeft; })[0];
        var target = anchor ? parseFloat(anchor.style.left) : first ? first.offsetLeft : 0;
        tlEl.scrollLeft = Math.max(0, target - 60); S.tlKey = key;
      }
    }
  }

  function joinBar() {
    var ts = S.sel.map(tableById).filter(Boolean), seats = ts.reduce(function (n, t) { return n + t.seats_max; }, 0);
    return '<div class="mt-joinbar"><span>' + (ts.length ? '<b>' + ts.map(function (t) { return esc(t.name); }).join(' + ') + '</b> · ' + seats + ' plazas' : 'Toca las mesas que quieras juntar (las filas o los huecos de la línea de tiempo; pueden ser cualquiera de la misma planta).') + '</span>' +
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
  function chargeFee(b, btn) {
    var s = A.session();
    if (btn) btn.disabled = true;
    return fetch(A.cfg.url + '/functions/v1/redsys', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: A.cfg.anonKey, Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify({ action: 'table_charge', booking_id: b.id, no_show: true }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error((d.detail || d.error || ('Error ' + r.status)) + (d.code ? ' (código ' + d.code + ')' : '')); return d; }); })
      .then(function () { return done('Cobrados ' + eur(b.deposit_cents) + ' a la tarjeta.'); })
      .catch(function (x) { if (btn) btn.disabled = false; flash('No se ha podido cobrar: ' + x.message, 'error'); return loadDay().then(render); });
  }
  function done(msg) { return loadDay().then(function () { render(); if (msg) flash(msg, 'ok'); }); }

  root.addEventListener('click', function (e) {
    var tr = e.target.closest('.mt-track');
    if (tr && !e.target.closest('.mt-bar')) {
      var x = e.clientX - tr.getBoundingClientRect().left, mm0 = +tr.dataset.t0 + Math.round(x / PXMIN / 15) * 15, tv = hhmm(mm0);
      if (S.join) {
        var id0 = tr.dataset.track, i0 = S.sel.indexOf(id0); if (i0 === -1) S.sel.push(id0); else S.sel.splice(i0, 1);
        S.joinTime = tv; return void render();
      }
      return void openNew({ table: tableById(tr.dataset.track), time: tv });
    }
    var t = e.target.closest('button'); if (!t) return;
    if (S.justMoved && t.dataset.table) return;
    if (t.dataset.dayn != null) { S.date = t.dataset.dayn === '0' ? today() : addDays(S.date, +t.dataset.dayn); S.time = ''; return void enter(); }
    if (t.dataset.zone) { S.zone = t.dataset.zone; S.sel = []; return void render(); }
    if (t.dataset.mode) { S.mode = t.dataset.mode; return void render(); }
    if (t.dataset.bid) { if (S.justMoved) return; var bb = bk(t.dataset.bid); if (bb) openEdit(bb); return; }
    if (t.dataset.rowtable) {
      if (!S.join) return;
      var rid = t.dataset.rowtable, ri = S.sel.indexOf(rid); if (ri === -1) S.sel.push(rid); else S.sel.splice(ri, 1);
      return void render();
    }
    if (t.id === 'mtJoin') { S.join = !S.join; S.sel = []; return void render(); }
    if (t.id === 'mtJoinClear') { S.sel = []; return void render(); }
    if (t.id === 'mtJoinGo') { var picked = S.sel.map(tableById).filter(Boolean), jt = S.joinTime; S.join = false; S.sel = []; S.joinTime = ''; render(); return void openNew({ tables: picked, time: jt }); }
    if (t.id === 'mtNew') return void openNew({});
    if (t.id === 'mtPrint') return void printDay();
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
      patch(id, { status: 'seated', arrived_at: b.arrived_at || new Date().toISOString(), hold_until: new Date(Date.now() + 864e5).toISOString() }).then(function () { return done(); }).catch(fail);
    }
    else if (act === 'arrive') patch(id, { arrived_at: new Date().toISOString() }).then(function () { return done('Llegada anotada.'); }).catch(fail);
    else if (act === 'dessert') patch(id, { dessert_at: new Date().toISOString() }).then(function () { return done('Anotado: van por el postre.'); }).catch(fail);
    else if (act === 'edit') openEdit(b);
    else if (act === 'done') patch(id, { status: 'completed' }).then(function () { return done(); }).catch(fail);
    else if (act === 'noshow') {
      if (b.payment_status === 'guaranteed' && !can('tables_charge')) {
        if (confirm('¿Marcar como "no vino"? No tienes permiso para cobrar tarjetas: el cobro de la penalización lo hará alguien con ese permiso.')) patch(id, { status: 'no_show' }).then(function () { return done(); }).catch(fail);
        return;
      }
      if (b.payment_status === 'guaranteed') {
        // "No vino" con tarjeta de garantía: se cobra la penalización automáticamente.
        if (!confirm('Marcar como "no vino" y cobrar ' + eur(b.deposit_cents) + ' a la tarjeta ' + (b.card_brand || '') + ' ····' + (b.card_last4 || '') + ' automáticamente. ¿Continuar?')) return;
        return void chargeFee(b, t);
      }
      if (confirm('¿Marcar como "no vino"?' + (b.payment_status === 'paid' ? ' La fianza se queda retenida.' : ''))) patch(id, { status: 'no_show', payment_status: b.payment_status === 'paid' ? 'retained' : b.payment_status }).then(function () { return done(); }).catch(fail);
    }
    else if (act === 'charge') {
      if (!confirm('¿Cobrar ' + eur(b.deposit_cents) + ' a la tarjeta ' + (b.card_brand || '') + ' ····' + (b.card_last4 || '') + ' de ' + (b.name || 'esta reserva') + '? Es un cobro real.')) return;
      chargeFee(b, t);
    }
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
    if (b.payment_status === 'guaranteed') {
      if (!confirm('¿Anular la reserva de ' + (b.name || 'esta reserva') + ' (' + b.party + ' p., ' + hm(b.starts_at) + ')?')) return;
      var late = confirm('¿Se anula con poca antelación (menos de ' + (((S.zones.filter(function (z) { return z.id === b.zone_id; })[0]) || {}).free_cancel_hours || 12) + ' h)?\n\nAceptar = se cobran ' + eur(b.deposit_cents) + ' a la tarjeta automáticamente.\nCancelar = se anula sin coste y la tarjeta se libera.');
      return void patch(b.id, { status: 'cancelled', cancelled_at: new Date().toISOString(), late_cancel: late }).then(function () { return late && can('tables_charge') ? chargeFee(b, null) : done(late ? 'Reserva anulada con poca antelación: queda pendiente de cobro (lo hace alguien con permiso de cobro).' : 'Reserva anulada. Tarjeta liberada: no se cobra nada.'); }).catch(fail);
    }
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
      '<label class="ad-field"><span>Hora</span><input type="time" id="nwTime" step="300" value="' + esc(pre.time || S.time || optsT[0] || '13:00') + '" required></label>' +
      '<label class="ad-field"><span>Personas</span><input type="number" id="nwParty" min="1" max="60" value="' + (pre.tables && pre.tables.length > 1 ? pre.tables.reduce(function (n, t) { return n + t.seats_max; }, 0) : pre.table ? Math.min(pre.table.seats_max, 2) : 2) + '" required></label>' +
      '<label class="ad-field"><span>Zona</span><select id="nwZone">' + S.zones.map(function (z) { return '<option value="' + z.id + '"' + (z.id === zone ? ' selected' : '') + '>' + esc(z.name_es) + (z.deposit_cents && z.payment_mode !== 'none' ? (z.payment_mode === 'card' ? ' · garantía ' : ' · fianza ') + eur(z.deposit_cents) : '') + '</option>'; }).join('') + '</select></label>' +
      '<div class="ad-field"><span>Turno (según zona y hora)</span><div class="mt-svcname" id="nwSvcName">—</div><input type="hidden" id="nwSvc"></div>' +
      '<label class="ad-field"><span>Nombre (opcional)</span><input type="text" id="nwName" maxlength="80" placeholder="Sin nombre"></label>' +
      '<label class="ad-field"><span>Teléfono</span><input type="tel" id="nwPhone"></label>' +
      '<label class="ad-field"><span>Email</span><input type="email" id="nwEmail" placeholder="para enviarle la confirmación"></label>' +
      '</div>' +
      '<div class="ad-field"><span>Mesas</span><label class="mt-pick"><input type="radio" name="nwAuto" value="auto" checked> Asignar automáticamente</label>' +
      '<label class="mt-pick"><input type="radio" name="nwAuto" value="manual"' + (pre.table ? ' checked' : '') + '> Elegir mesas</label><div class="mt-picks" id="nwPicks"></div></div>' +
      '<details class="mt-more"><summary>Tipo de reserva y cobro</summary><div class="ad-grid">' +
      '<label class="ad-field"><span>Tipo de reserva</span><select id="nwType"><option value="free">Gratuita (queda confirmada al momento)</option><option value="card">Con tarjeta de garantía (no se cobra; se le envía un email)</option><option value="deposit">Con cobro / fianza (se le envía un email para pagar)</option></select></label>' +
      '<label class="ad-field" id="nwAmtRow"><span>Importe (€)</span><input type="number" id="nwAmt" min="1" step="0.5" value="20"></label>' +
      '</div><p class="ad-hint" id="nwTypeNote" style="margin:0.2rem 0 0.8rem"></p></details>' +
      '<details class="mt-more"><summary>Alergias, etiquetas y notas</summary>' +
      '<div class="ad-field"><span>Alergias, intolerancias y etiquetas</span>' + chips('nwAl', []) + '</div>' +
      '<label class="ad-field"><span>Notas</span><textarea id="nwNotes" maxlength="500" placeholder="Ocasión, detalles…"></textarea></label>' +
      '</details>' +
      '<details class="mt-more"><summary>Duración y prescriptor</summary><div class="ad-grid">' +
      '<label class="ad-field"><span>Duración de la mesa (min)</span><input type="number" id="nwDur" min="15" max="600" step="5" placeholder="la del turno"></label>' +
      '<label class="ad-field"><span>Prescriptor</span><select id="nwPres">' + presOptions('') + '</select></label></div></details>' +
      '<label class="mt-check"><input type="checkbox" id="nwSeated"> Sentar ahora (cliente que ya está aquí)</label>' +
      '<div class="mt-foot"><button type="button" class="ad-btn is-ghost" data-close>Cancelar</button><button type="submit" class="ad-btn" id="nwGo">Crear reserva</button></div></form>';
    modal(html, function (m) {
      var q = function (id) { return m.querySelector('#' + id); };
      function pickSvc() {
        // El turno viene dado: la zona decide el espacio (alta = Restaurant & Cocktails, baja = Coffee, Bakery & Kitchen)
        // y la hora el servicio (mediodía = comida, el resto = cena).
        var zid = q('nwZone').value, tv = q('nwTime').value, mn = +tv.slice(0, 2) * 60 + +tv.slice(3, 5); if (+tv.slice(0, 2) < 6) mn += 1440;
        var ofZone = svc.filter(function (x) { return !x.zone_ids || x.zone_ids.indexOf(zid) !== -1; }).sort(function (a, b) { return a.start_min - b.start_min; });
        var s = !ofZone.length ? svc[0] : mn < 17 * 60 ? ofZone[0] : ofZone[ofZone.length - 1];
        q('nwSvc').value = s ? s.id : ''; q('nwSvcName').textContent = s ? s.name_es : '—';
      }
      function pickZoneFromSvc() { /* la zona se elige a mano */ }
      function depRow() {
        var z = S.zones.filter(function (x) { return x.id === q('nwZone').value; })[0] || {};
        q('nwType').value = z.payment_mode === 'card' ? 'card' : z.payment_mode === 'deposit' ? 'deposit' : 'free';
        q('nwAmt').value = z.deposit_cents > 0 ? z.deposit_cents / 100 : 20; typeUi();
      }
      function typeUi() {
        var ty = q('nwType').value; q('nwAmtRow').hidden = ty === 'free';
        q('nwTypeNote').textContent = ty === 'card' ? 'Se enviará un email al cliente (obligatorio) con un enlace para dar los datos de su tarjeta como garantía. No se cobra nada salvo no show o anulación tardía. La mesa se le guarda 24 h.'
          : ty === 'deposit' ? 'Se enviará un email al cliente (obligatorio) con un enlace para pagar el importe con tarjeta y confirmar la reserva. La mesa se le guarda 24 h.' : 'Queda confirmada ya; si pones email, se le envía la confirmación.';
      }
      function refreshPicks() {
        var auto = m.querySelector('input[name="nwAuto"]:checked').value === 'auto';
        q('nwPicks').hidden = auto; if (auto) return;
        var starts = at(q('nwDate').value, q('nwTime').value), sv = S.services.filter(function (x) { return x.id === q('nwSvc').value; })[0], ends = new Date(new Date(starts).getTime() + (+q('nwDur').value || (sv ? sv.duration_min : 90)) * 60000).toISOString();
        // Ocupadas: según las reservas y bloqueos ya cargados del día (si es otro día, el servidor lo comprueba al crear).
        var busy = S.tables.filter(function (t) { return S.bookings.some(function (b) { return holds(b) && (b.table_booking_tables || []).some(function (x) { return x.table_id === t.id; }) && b.starts_at < ends && b.ends_at > starts; }); }).map(function (t) { return t.id; });
        var keep = [].map.call(q('nwPicks').querySelectorAll('input:checked'), function (i) { return i.value; });
        if (!keep.length) keep = preIds;
        q('nwPicks').innerHTML = tablesPicker(q('nwZone').value, keep, busy);
      }
      pickSvc(); depRow(); refreshPicks();
      if (pre.prefill) { q('nwName').value = pre.prefill.name || ''; q('nwEmail').value = pre.prefill.email || ''; q('nwPhone').value = pre.prefill.phone || ''; q('nwParty').value = pre.prefill.party || 2; }
      ['nwTime', 'nwDate'].forEach(function (id) { q(id).addEventListener('change', function () { pickSvc(); refreshPicks(); }); });
      q('nwZone').addEventListener('change', function () { pickSvc(); depRow(); q('nwPicks').innerHTML = ''; refreshPicks(); });
      q('nwType').addEventListener('change', typeUi);
      [].forEach.call(m.querySelectorAll('input[name="nwAuto"]'), function (r) { r.addEventListener('change', refreshPicks); });
      q('nwForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var zoneRow = S.zones.filter(function (x) { return x.id === q('nwZone').value; })[0];
        var manual = m.querySelector('input[name="nwAuto"]:checked').value === 'manual';
        var tables = manual ? [].map.call(q('nwPicks').querySelectorAll('input:checked'), function (i) { return i.value; }) : null;
        var msg = q('nwMsg'); msg.hidden = true;
        if (manual && !tables.length) { msg.textContent = 'Elige al menos una mesa o deja la asignación automática.'; msg.hidden = false; return; }
        var ty = q('nwType').value, wantPay = ty !== 'free';
        if (wantPay && !q('nwEmail').value.trim()) { msg.textContent = 'Para pedir la tarjeta o el cobro hace falta el email del cliente.'; msg.hidden = false; return; }
        q('nwGo').disabled = true;
        api('rpc/dining_admin_create', { method: 'POST', body: {
          p_service: q('nwSvc').value, p_starts: at(q('nwDate').value, q('nwTime').value), p_zone: q('nwZone').value, p_party: +q('nwParty').value,
          p_name: q('nwName').value.trim(), p_email: q('nwEmail').value.trim(), p_phone: q('nwPhone').value.trim(), p_notes: q('nwNotes').value.trim(),
          p_tables: tables, p_seated: q('nwSeated').checked, p_request_payment: wantPay, p_hold_hours: 24,
          p_mode: ty, p_amount_cents: wantPay ? Math.round((+q('nwAmt').value || 0) * 100) : null, p_duration: +q('nwDur').value || null, p_prescriber: q('nwPres').value
        } }).then(function (r) {
          var als = picked(m, 'nwAl');
          return als.length ? patch(r.id, { allergy_tags: als }).then(function () { return r; }, function () { return r; }) : r;
        }).then(function (r) {
          m.remove(); S.date = q('nwDate').value; S.time = '';
          var word = r.status === 'pending' ? 'Reserva creada. Hemos enviado un email a ' + q('nwEmail').value.trim() + ' para que confirme la reserva con su tarjeta (' + eur(r.deposit_cents) + ').' :
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
      '<label class="ad-field"><span>Día</span><input type="date" id="edDate" value="' + dateV + '"></label>' +
      '<label class="ad-field"><span>Hora</span><input type="time" id="edTime" step="300" value="' + timeV + '"></label>' +
      '<label class="ad-field"><span>Personas</span><input type="number" id="edParty" min="1" max="60" value="' + b.party + '"></label>' +
      '<label class="ad-field"><span>Nombre</span><input type="text" id="edName" value="' + esc(b.name) + '" maxlength="80"></label>' +
      '<label class="ad-field"><span>Teléfono</span><input type="tel" id="edPhone" value="' + esc(b.phone) + '"></label>' +
      '<label class="ad-field"><span>Email</span><input type="email" id="edEmail" value="' + esc(b.email) + '"></label>' +
      '<label class="ad-field full"><span>Notas de la reserva</span><textarea id="edNotes" maxlength="500">' + esc(b.notes) + '</textarea></label>' +
      '</div>' +
      '<div class="ad-field"><span>Mesas · <b id="edCap"></b></span><div class="mt-picks" id="edPicks"></div></div>' +
      '<details class="mt-more"><summary>Alergias y etiquetas</summary>' +
      '<div class="ad-field"><span>Alergias, intolerancias y etiquetas de esta reserva</span>' + chips('edAl', b.allergy_tags) + (can('tables_crm') ? '<label class="mt-check"><input type="checkbox" id="edAlKeep"> Guardarlas también en la ficha del cliente (para próximas reservas)</label>' : '') + '</div>' +
      '</details>' +
      (can('tables_crm') ? '<details class="mt-more"><summary>Ficha del cliente (empresa, cuenta, bloqueo)</summary>' +
      '<div class="ad-field mt-cust"><span>Ficha del cliente' + (ckey(b) ? '' : ' (sin email ni teléfono: no se puede guardar)') + '</span>' +
      '<div class="mt-two"><select id="edType">' + Object.keys(CT).map(function (k) { return '<option value="' + k + '"' + (((noteOf(b) || {}).customer_type || 'particular') === k ? ' selected' : '') + '>' + esc(CT[k]) + '</option>'; }).join('') + '</select>' +
      '<input type="text" id="edCompany" maxlength="80" placeholder="Empresa / grupo" value="' + esc((noteOf(b) || {}).company || '') + '"></div>' +
      '<div class="mt-two"><input type="text" id="edTax" maxlength="20" placeholder="CIF (para facturar)" value="' + esc((noteOf(b) || {}).tax_id || '') + '">' + (can('tables_accounts') ? accField('edAcc', (noteOf(b) || {}).account_id) : '<div></div>') + '</div>' +
      '<div class="mt-accrow" id="edAccRow"></div>' +
      '<textarea id="edCNote" maxlength="500" placeholder="Comentarios sobre este cliente (alergias, trato, preferencias…)">' + esc((noteOf(b) || {}).note || '') + '</textarea>' +
      '<label class="mt-check"><input type="checkbox" id="edBlock"' + ((noteOf(b) || {}).blocked ? ' checked' : '') + '> Bloquear: que no pueda volver a reservar</label>' +
      '<input type="text" id="edBlockWhy" maxlength="200" placeholder="Motivo del bloqueo (solo lo ve el equipo)" value="' + esc((noteOf(b) || {}).blocked_reason || '') + '"></div>' +
      '</details>' : '') +
      '<details class="mt-more"><summary>Duración, prescriptor y gasto</summary><div class="ad-grid">' +
      '<label class="ad-field"><span>Duración de la mesa (min)</span><input type="number" id="edDur" min="15" max="600" step="5" value="' + Math.round(dur / 60000) + '"></label>' +
      '<label class="ad-field"><span>Prescriptor</span><select id="edPres">' + presOptions(b.prescriber) + '</select></label>' +
      '<label class="ad-field"><span>Gasto de la visita (€)</span><input type="number" id="edSpend" min="0" step="0.01" value="' + (b.spend_cents != null ? b.spend_cents / 100 : '') + '" placeholder="se rellenará con el TPV"></label></div></details>' +
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
        // Cargar el gasto de la visita al saldo de la cuenta de empresa / grupo.
        var charged = null;
        function accRow() {
          var sel = q('edAcc'), row = q('edAccRow'); if (!sel || sel.disabled || !sel.value) { row.innerHTML = ''; return; }
          var a = (S.accounts || []).filter(function (x) { return x.id === sel.value; })[0]; if (!a) { row.innerHTML = ''; return; }
          var sp = Math.round((+q('edSpend').value || 0) * 100);
          if (a.kind === 'contado') { row.innerHTML = '<p class="ad-meta">' + esc(a.name) + ' paga al contado: no usa saldo.</p>'; return; }
          row.innerHTML = charged ? '<p class="ad-meta">✓ Ya cargado a ' + esc(a.name) + ': ' + eur(-charged.amount_cents) + ' (' + esc(fmtShort(charged.created_at)) + '). Saldo: ' + eur(accBal(a.id)) + '.</p>'
            : sp > 0 ? '<button type="button" class="ad-btn is-small" id="edCharge">Cargar ' + eur(sp) + ' al saldo de ' + esc(a.name) + ' (' + eur(accBal(a.id)) + ')</button>'
            : '<p class="ad-meta">Saldo de ' + esc(a.name) + ': ' + eur(accBal(a.id)) + '. Anota el gasto de la visita (abajo) para cargarlo al saldo.</p>';
        }
        if (q('edAcc')) {
          api('dining_account_moves?booking_id=eq.' + b.id + '&kind=eq.spend&select=*&limit=1').then(function (r) { charged = (r || [])[0] || null; accRow(); }).catch(function () {});
          q('edAcc').addEventListener('change', accRow); q('edSpend').addEventListener('input', accRow); accRow();
          q('edAccRow').addEventListener('click', function (ev) {
            var btn = ev.target.closest('#edCharge'); if (!btn) return;
            var a = (S.accounts || []).filter(function (x) { return x.id === q('edAcc').value; })[0], sp = Math.round((+q('edSpend').value || 0) * 100); if (!a || sp <= 0) return;
            var after = accBal(a.id) - sp;
            if (!confirm('¿Cargar ' + eur(sp) + ' al saldo de ' + a.name + '? Quedará en ' + eur(after) + (after < 0 ? ' (por encima del saldo: pendiente de facturar)' : '') + '.')) return;
            btn.disabled = true;
            addMove(a.id, -sp, 'spend', 'Reserva ' + b.ref + (b.name ? ' · ' + b.name : ''), b.id, ckey(b))
              .then(function () { return b.spend_cents !== sp ? patch(b.id, { spend_cents: sp }) : null; })
              .then(function () { b.spend_cents = sp; return loadConfig(true); })
              .then(function () { return api('dining_account_moves?booking_id=eq.' + b.id + '&kind=eq.spend&select=*&limit=1'); })
              .then(function (r) { charged = (r || [])[0] || null; flash('Cargado al saldo de ' + a.name + '. Saldo ahora: ' + eur(accBal(a.id)) + '.', 'ok'); accRow(); })
              .catch(function (x) { btn.disabled = false; fail(x); });
          });
        }
        q('edPicks').addEventListener('change', cap); q('edParty').addEventListener('input', cap);
        ['edTime', 'edDate'].forEach(function (id) { q(id).addEventListener('change', function () { picks(true); }); });
        function save(seat) {
          var msg = q('edMsg'); msg.hidden = true;
          var ids = [].map.call(q('edPicks').querySelectorAll('input:checked'), function (i) { return i.value; });
          if (!ids.length) { msg.textContent = 'Elige al menos una mesa.'; msg.hidden = false; return; }
          var newStart = starts(), same = new Date(newStart).getTime() === new Date(b.starts_at).getTime();
          [q('edSave'), q('edSeat')].forEach(function (x) { if (x) x.disabled = true; });
          api('rpc/dining_admin_update', { method: 'POST', body: { p_booking: b.id, p_party: +q('edParty').value, p_starts: same ? null : newStart, p_name: q('edName').value.trim(), p_phone: q('edPhone').value.trim(), p_email: q('edEmail').value.trim(), p_notes: q('edNotes').value.trim(), p_tables: ids, p_duration: +q('edDur').value || null, p_prescriber: q('edPres').value } })
            .then(function () { var sp = q('edSpend').value; var cents = sp === '' ? null : Math.round(+sp * 100); return cents !== b.spend_cents ? patch(b.id, { spend_cents: cents }) : null; })
            .then(function () { return patch(b.id, { allergy_tags: picked(m, 'edAl') }); })
            .then(function () {
              if (!can('tables_crm')) return null;   // sin permiso de clientes no se toca la ficha
              var key = ckey({ email: q('edEmail').value, phone: q('edPhone').value }), cur = S.notes[key] || {}, tags = (cur.tags || []).slice();
              if (q('edAlKeep').checked) picked(m, 'edAl').forEach(function (k) { if (tags.indexOf(k) === -1) tags.push(k); });
              return saveCust(key, { note: q('edCNote').value.trim(), blocked: q('edBlock').checked, blocked_reason: q('edBlockWhy').value.trim(), customer_type: q('edType').value, company: q('edCompany').value.trim(), tax_id: q('edTax').value.trim(), account_id: accVal(q('edAcc')), tags: tags });
            })
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



  // ─── Imprimir el día ────────────────────────────────────────────────
  // Hoja para llevar al servicio: reservas del día por espacio y hora, con mesa, contacto, notas, garantía y una casilla para marcar la llegada.
  function printDay() {
    var live = S.bookings.filter(function (b) { return b.status !== 'cancelled'; }).sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); });
    var gone = S.bookings.filter(function (b) { return b.status === 'cancelled'; });
    var amb = { day: 'Coffee, Bakery & Kitchen', night: 'Restaurant & Cocktails' };
    var payTxt = function (b) {
      if (b.payment_status === 'guaranteed') return 'Tarjeta ' + (b.card_brand || '') + ' ····' + (b.card_last4 || '') + ' · garantía ' + eur(b.deposit_cents);
      if (b.payment_status === 'paid') return 'Fianza ' + eur(b.deposit_cents) + ' pagada';
      if (b.payment_status === 'pending' && b.deposit_cents > 0) return 'PENDIENTE de pago (' + eur(b.deposit_cents) + ')';
      if (b.payment_status === 'charged') return 'Penalización cobrada ' + eur(b.deposit_cents);
      return '';
    };
    var sections = ['day', 'night'].map(function (a) {
      var rows = live.filter(function (b) { return b.ambience === a; }); if (!rows.length) return '';
      var cov = rows.reduce(function (n, b) { return n + b.party; }, 0);
      return '<h2>' + esc(amb[a]) + ' <small>' + rows.length + ' reservas · ' + cov + ' comensales</small></h2><table><thead><tr><th>Hora</th><th>Mesa</th><th>Pers.</th><th>Nombre</th><th>Teléfono</th><th>Notas / alergias</th><th>Garantía / pago</th><th>Prescriptor</th><th>Llegó</th></tr></thead><tbody>' + rows.map(function (b) {
        var cn = noteOf(b), tn = bookingTables(b).map(function (t) { return t.name; }).join(' + ');
        var notes = [alText(b) ? '⚠ ALERGIAS/INTOLERANCIAS: ' + alText(b).toUpperCase() : '', labelsOf(b).map(function (k) { return LBL()[k]; }).join(', '), b.notes, cn && cn.note ? 'Cliente: ' + cn.note : '', cn && cn.customer_type === 'empresa' ? 'EMPRESA' + (cn.company ? ': ' + cn.company : '') + (cn.balance_cents ? ' (saldo pendiente ' + eur(cn.balance_cents) + ')' : '') : '', cn && cn.customer_type === 'grupo' ? 'CONSUMO INTERNO' : '', cn && cn.blocked ? 'CLIENTE BLOQUEADO' : '', b.status === 'pending' ? 'Reserva pendiente de confirmar' : ''].filter(Boolean).join(' · ');
        return '<tr><td><b>' + esc(hm(b.starts_at)) + '</b><br><small>hasta ' + esc(hm(b.ends_at)) + '</small></td><td><b>' + esc(tn) + '</b><br><small>' + esc(zoneName(b.zone_id)) + ' · ' + seatsOf(b) + ' plazas</small></td><td class="c"><b>' + b.party + '</b></td><td>' + esc(b.name || '—') + '</td><td>' + esc(b.phone || '') + (b.email ? '<br><small>' + esc(b.email) + '</small>' : '') + '</td><td>' + esc(notes) + '</td><td>' + esc(payTxt(b)) + '</td><td>' + esc(b.prescriber ? presName(b.prescriber) : '') + '</td><td class="c"><span class="box">' + (b.arrived_at || b.status === 'seated' || b.status === 'completed' ? '✓' : '') + '</span></td></tr>';
      }).join('') + '</tbody></table>';
    }).join('');
    var total = live.reduce(function (n, b) { return n + b.party; }, 0);
    var html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reservas · ' + esc(dayLabel(S.date)) + '</title><style>' +
      '@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font:11px/1.35 Helvetica,Arial,sans-serif;color:#000;margin:0}' +
      'h1{font-size:18px;margin:0 0 2px;text-transform:uppercase}h1 small{font-size:12px;font-weight:400;text-transform:none;margin-left:8px}h2{font-size:14px;margin:14px 0 6px;text-transform:uppercase}h2 small{font-size:11px;font-weight:400;text-transform:none;margin-left:6px}' +
      'table{width:100%;border-collapse:collapse}th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #000;padding:3px 5px}td{border-bottom:1px solid #999;padding:4px 5px;vertical-align:top}tr{page-break-inside:avoid}td.c,th.c{text-align:center}small{color:#444;font-size:9px}' +
      '.box{display:inline-block;width:16px;height:16px;border:1.5px solid #000;line-height:13px;text-align:center;font-size:13px}.gone{margin-top:14px;font-size:10px;color:#444}' +
      '</style></head><body><h1>ROCE · Reservas del día<small>' + esc(dayLabel(S.date)) + ' · ' + live.length + ' reservas · ' + total + ' comensales · impreso ' + esc(fmtShort(new Date().toISOString())) + ' ' + esc(hm(new Date().toISOString())) + '</small></h1>' +
      (sections || '<p>No hay reservas este día.</p>') +
      (gone.length ? '<p class="gone"><b>Anuladas:</b> ' + gone.map(function (b) { return esc(hm(b.starts_at) + ' ' + (b.name || 'sin nombre') + ' (' + b.party + ')'); }).join(' · ') + '</p>' : '') + '</body></html>';
    var w = window.open('', '_blank');
    if (!w) return flash('El navegador ha bloqueado la ventana de impresión: permítela y vuelve a pulsar.', 'error');
    w.document.open(); w.document.write(html); w.document.close(); w.focus(); setTimeout(function () { try { w.print(); } catch (x) {} }, 350);
  }

  // ─── Lista de espera ────────────────────────────────────────────────
  function renderWait(body) {
    var rows = S.waitlist;
    body.innerHTML = '<p class="ad-meta" style="margin-bottom:0.9rem">Personas que han pedido que se les avise si se libera una mesa. Cuando se anula una reserva se avisa solo a las primeras que ya tengan sitio; también puedes avisarlas tú.</p><ul class="ad-list">' + (rows.length ? rows.map(function (w) {
      var amb = w.ambience === 'night' ? 'Restaurant & Cocktails' : w.ambience === 'day' ? 'Coffee, Bakery & Kitchen' : 'Cualquier espacio';
      return '<li class="ad-card"><div class="ad-date"><b>' + esc(w.want_date.slice(8, 10)) + '/' + esc(w.want_date.slice(5, 7)) + '</b><span>' + w.party + ' p.</span></div><div><div class="ad-name">' + (w.name ? esc(w.name) : '<i>Sin nombre</i>') + ' <span class="ad-tag ' + (w.status === 'notified' ? 'is-green' : '') + '">' + (w.status === 'notified' ? 'Avisado ' + hm(w.notified_at) : 'En espera') + '</span></div>' +
        '<div class="ad-meta">' + esc(amb) + ' · ' + (w.want_time ? 'hora preferida ' + esc(w.want_time) : 'cualquier hora') + '</div><div class="ad-meta">' + esc(w.email) + (w.phone ? ' · ' + esc(w.phone) : '') + '</div></div>' +
        '<div class="ad-actions"><button class="ad-btn is-small" data-wl-book="' + w.id + '">Reservar</button>' + (w.status === 'waiting' ? '<button class="ad-btn is-small is-ghost" data-wl-notify="' + w.id + '">Avisar ya</button>' : '') + '<button class="ad-btn is-small is-ghost" data-wl-done="' + w.id + '">Quitar</button></div></li>';
    }).join('') : '<li class="ad-empty">No hay nadie en lista de espera.</li>') + '</ul>';
  }
  root.addEventListener('click', function (e) {
    var bt = e.target.closest('[data-wl-book],[data-wl-notify],[data-wl-done]'); if (!bt) return;
    var id = bt.dataset.wlBook || bt.dataset.wlNotify || bt.dataset.wlDone, w = S.waitlist.filter(function (x) { return x.id === id; })[0]; if (!w) return;
    var upd = function (body, msg) { return api('dining_waitlist?id=eq.' + id, { method: 'PATCH', body: body, prefer: 'return=minimal' }).then(enter).then(function () { if (msg) flash(msg, 'ok'); }).catch(fail); };
    if (bt.dataset.wlNotify) { if (confirm('¿Avisar ahora a ' + (w.name || w.email) + ' de que hay mesa?')) upd({ status: 'notified', notified_at: new Date().toISOString() }, 'Aviso enviado por email.'); }
    else if (bt.dataset.wlDone) { if (confirm('¿Quitar de la lista de espera?')) upd({ status: 'removed' }); }
    else {
      S.date = w.want_date; S.view = 'day'; S.time = '';
      enter().then(function () {
        openNew({ time: w.want_time || '', prefill: { name: w.name, email: w.email, phone: w.phone, party: w.party } });
        api('dining_waitlist?id=eq.' + id, { method: 'PATCH', body: { status: 'booked' }, prefer: 'return=minimal' }).catch(function () {});
      });
    }
  });

  // ─── Clientes (CRM) ─────────────────────────────────────────────────
  function renderCrm(body) {
    var q = S.crmQ.toLowerCase(), ty = S.crmType, rows = S.crm.filter(function (c) { var tg = c.tags || []; if (ty === 'empresa' && c.customer_type !== 'empresa') return false; if (ty === 'grupo' && c.customer_type !== 'grupo') return false; if (ty === 'alergias' && !tg.some(function (k) { return AL[k]; })) return false; if (ty === 'transferencia' && tg.indexOf('transferencia') === -1) return false; if (ty === 'saldo' && !c.balance_cents) return false; if (ty === 'bloqueados' && !c.blocked) return false; return !q || ((c.name || '') + ' ' + (c.email || '') + ' ' + (c.phone || '') + ' ' + (c.note || '')).toLowerCase().indexOf(q) !== -1; });
    var by = { last: function (a, b) { return String(b.last_visit || '').localeCompare(String(a.last_visit || '')); }, visits: function (a, b) { return b.visits - a.visits; }, spend: function (a, b) { return b.spend_cents - a.spend_cents; }, noshows: function (a, b) { return b.no_shows - a.no_shows; } };
    rows = rows.slice().sort(by[S.crmSort] || by.last);
    var tot = rows.reduce(function (n, c) { return n + Number(c.spend_cents || 0); }, 0);
    body.innerHTML = '<div class="ad-bar"><input type="search" id="crmQ" placeholder="Buscar nombre, email, teléfono o nota" value="' + esc(S.crmQ) + '" style="flex:1 1 16rem">' +
      '<select id="crmType"><option value="">Todos</option><option value="empresa"' + (S.crmType === 'empresa' ? ' selected' : '') + '>Empresas</option><option value="grupo"' + (S.crmType === 'grupo' ? ' selected' : '') + '>Grupo / consumo interno</option><option value="alergias"' + (S.crmType === 'alergias' ? ' selected' : '') + '>Con alergias</option><option value="transferencia"' + (S.crmType === 'transferencia' ? ' selected' : '') + '>Pagan por transferencia</option><option value="saldo"' + (S.crmType === 'saldo' ? ' selected' : '') + '>Con saldo pendiente</option><option value="bloqueados"' + (S.crmType === 'bloqueados' ? ' selected' : '') + '>Bloqueados</option></select>' +
      '<select id="crmSort"><option value="last"' + (S.crmSort === 'last' ? ' selected' : '') + '>Última visita</option><option value="visits"' + (S.crmSort === 'visits' ? ' selected' : '') + '>Más visitas</option><option value="spend"' + (S.crmSort === 'spend' ? ' selected' : '') + '>Más gasto</option><option value="noshows"' + (S.crmSort === 'noshows' ? ' selected' : '') + '>Más no shows</option></select>' +
      '<button class="ad-btn is-ghost is-small" id="crmCsv" type="button">Descargar CSV</button></div>' +
      '<p class="ad-meta" style="margin-bottom:0.7rem">' + rows.length + ' clientes · gasto total anotado ' + eur(tot) + '. El gasto de cada visita se anota en la ficha de la reserva; cuando se conecte el TPV (Ágora) se rellenará solo.</p>' +
      '<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Cliente</th><th>Visitas</th><th>No shows</th><th>Gasto</th><th>Última visita</th><th>Próximas</th><th>Eventos</th><th></th></tr></thead><tbody>' + rows.map(function (c) {
        return '<tr' + (c.blocked ? ' class="is-cancelled"' : '') + '><td><b>' + esc(c.name || 'Sin nombre') + '</b>' + (c.blocked ? ' <span class="ad-tag is-red">bloqueado</span>' : '') + (c.customer_type === 'empresa' ? ' <span class="ad-tag">Empresa' + (c.company ? ': ' + esc(c.company) : '') + '</span>' : '') + (c.customer_type === 'grupo' ? ' <span class="ad-tag">Consumo interno' + (c.company ? ': ' + esc(c.company) : '') + '</span>' : '') + (c.balance_cents ? ' <span class="ad-tag is-red">Saldo ' + eur(c.balance_cents) + '</span>' : '') + (c.tags || []).map(function (k) { return ' ' + tagHtml(k); }).join('') + '<br><span class="ad-meta">' + esc(c.email || '') + (c.phone ? ' · ' + esc(c.phone) : '') + '</span>' + (c.note ? '<br><span class="ad-meta">“' + esc(c.note) + '”</span>' : '') + '</td>' +
          '<td>' + c.visits + '</td><td>' + (c.no_shows ? '<b style="color:var(--red)">' + c.no_shows + '</b>' : '0') + '</td><td class="nowrap">' + eur(Number(c.spend_cents || 0)) + (c.visits && Number(c.spend_cents) ? '<br><span class="ad-meta">' + eur(Math.round(Number(c.spend_cents) / c.visits)) + ' / visita</span>' : '') + '</td>' +
          '<td class="nowrap">' + (c.last_visit ? esc(fmtShort(c.last_visit)) : '—') + '</td><td>' + c.upcoming + '</td><td>' + (c.event_visits || 0) + (Number(c.tickets_cents) ? '<br><span class="ad-meta">' + eur(Number(c.tickets_cents)) + '</span>' : '') + '</td>' +
          '<td><button class="ad-btn is-small is-ghost" data-crm="' + esc(c.customer_key) + '">Ficha</button></td></tr>';
      }).join('') + '</tbody></table></div>' + (rows.length ? '' : '<p class="ad-empty">Todavía no hay clientes con reservas.</p>');
  }
  function fmtShort(iso) { return new Intl.DateTimeFormat('es-ES', { timeZone: TZ, day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(iso)); }
  root.addEventListener('input', function (e) { if (e.target.id === 'crmQ') { S.crmQ = e.target.value; var pos = e.target.selectionStart; render(); var el = document.getElementById('crmQ'); if (el) { el.focus(); el.setSelectionRange(pos, pos); } } });
  root.addEventListener('change', function (e) { if (e.target.id === 'crmSort') { S.crmSort = e.target.value; render(); } if (e.target.id === 'crmType') { S.crmType = e.target.value; render(); } });
  root.addEventListener('click', function (e) {
    if (e.target.closest('#crmCsv')) {
      var head = ['Cliente', 'Email', 'Teléfono', 'Visitas', 'No shows', 'Anulaciones', 'Gasto (€)', 'Última visita', 'Próximas', 'Visitas a eventos', 'Prescriptores', 'Bloqueado', 'Nota'];
      var lines = [head].concat(S.crm.map(function (c) { return [c.name, c.email, c.phone, c.visits, c.no_shows, c.cancellations, (Number(c.spend_cents || 0) / 100).toFixed(2).replace('.', ','), c.last_visit ? fmtShort(c.last_visit) : '', c.upcoming, c.event_visits, c.prescribers || '', c.blocked ? 'sí' : '', c.note || '']; }))
        .map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8' })); a.download = 'clientes-roce.csv'; document.body.appendChild(a); a.click(); a.remove(); return;
    }
    var f = e.target.closest('[data-crm]'); if (!f) return;
    var c = S.crm.filter(function (x) { return x.customer_key === f.dataset.crm; })[0]; if (!c) return;
    modal('<h2>' + esc(c.name || 'Cliente') + '</h2><p class="ad-meta">' + esc(c.email || '') + (c.phone ? ' · ' + esc(c.phone) : '') + '</p>' +
      '<div class="mt-crmstats"><div><b>' + c.visits + '</b><span>visitas</span></div><div><b>' + c.no_shows + '</b><span>no shows</span></div><div><b>' + c.cancellations + '</b><span>anulaciones</span></div><div><b>' + eur(Number(c.spend_cents || 0)) + '</b><span>gasto</span></div></div>' +
      '<p class="ad-msg is-error" id="cuMsg" hidden></p>' +
      '<div class="mt-two"><label class="ad-field"><span>Tipo de cliente</span><select id="cuType">' + Object.keys(CT).map(function (k) { return '<option value="' + k + '"' + (c.customer_type === k ? ' selected' : '') + '>' + esc(CT[k]) + '</option>'; }).join('') + '</select></label>' +
      '<label class="ad-field"><span>Empresa / grupo</span><input type="text" id="cuCompany" maxlength="80" value="' + esc(c.company || '') + '"></label></div>' +
      '<div class="mt-two"><label class="ad-field"><span>CIF (para facturar)</span><input type="text" id="cuTax" maxlength="20" value="' + esc(c.tax_id || '') + '"></label>' +
      ''+ accField('cuAcc', (S.notes[c.customer_key] || {}).account_id) + '</div>' +
      '<div class="ad-field"><span>Alergias, intolerancias y etiquetas</span>' + chips('cuAl', c.tags) + '</div>' +
      '<div class="ad-field"><span>Comentarios sobre el cliente</span><textarea id="cuNote" maxlength="500">' + esc(c.note || '') + '</textarea></div>' +
      '<label class="mt-check"><input type="checkbox" id="cuBlock"' + (c.blocked ? ' checked' : '') + '> Bloquear: que no pueda volver a reservar (web ni lista de espera)</label>' +
      '<div class="ad-field"><span>Motivo del bloqueo</span><input type="text" id="cuWhy" maxlength="200" value="' + esc(c.blocked_reason || '') + '"></div>' +
      '<div class="mt-foot"><button type="button" class="ad-btn is-ghost" data-close>Cerrar</button><button type="button" class="ad-btn" id="cuSave">Guardar</button></div>', function (m) {
        m.querySelector('#cuSave').addEventListener('click', function () {
          saveCust(c.customer_key, { note: m.querySelector('#cuNote').value.trim(), blocked: m.querySelector('#cuBlock').checked, blocked_reason: m.querySelector('#cuWhy').value.trim(), customer_type: m.querySelector('#cuType').value, company: m.querySelector('#cuCompany').value.trim(), tax_id: m.querySelector('#cuTax').value.trim(), account_id: accVal(m.querySelector('#cuAcc')), tags: picked(m, 'cuAl') })
            .then(function () { m.remove(); return enter(); }).then(function () { flash('Ficha del cliente guardada.', 'ok'); })
            .catch(function (x) { var el = m.querySelector('#cuMsg'); el.textContent = errText(x); el.hidden = false; });
        });
      });
  });

  // ─── Cuentas de empresa / grupo ─────────────────────────────────────
  function cents(str) { var v = Math.round(parseFloat(String(str).replace(',', '.')) * 100); return isFinite(v) ? v : 0; }
  function addMove(accId, amount, kind, note, bookingId, ckeyV) {
    return api('dining_account_moves', { method: 'POST', prefer: 'return=minimal', body: { account_id: accId, amount_cents: amount, kind: kind, note: note || '', booking_id: bookingId || null, customer_key: ckeyV || '', created_by: A.session().email || '' } });
  }
  function renderAccounts(body) {
    var accs = S.accounts || [];
    body.innerHTML = '<p class="ad-meta" style="margin-bottom:0.9rem">Una cuenta guarda el dinero que una empresa o grupo ha entregado a cuenta (<b>bote</b>) para que sus clientes consuman contra él, o lo que se les ha consumido y toca <b>facturar</b>. Vincula a cada cliente a su cuenta en su ficha, y al editar una reserva con gasto puedes cargarlo al saldo. Saldo positivo = a favor del grupo; negativo = pendiente de facturar.</p>' +
      '<form class="ad-sheet-inline" id="acForm"><h2 class="ad-sub">Nueva cuenta</h2><p class="ad-msg is-error" id="acMsg" hidden></p><div class="ad-grid">' + accFields(null, 'ac') +
      '<label class="ad-field"><span>Saldo inicial entregado (€, opcional)</span><input type="number" id="acInit" min="0" step="0.01"></label></div>' +
      '<button class="ad-btn" type="submit">Crear cuenta</button></form>' +
      '<h2 class="ad-sub" style="margin-top:1.75rem">Cuentas</h2><ul class="ad-list">' + (accs.length ? accs.map(function (a) {
        var bal = accBal(a.id), mv = (S.accMoves || []).filter(function (m) { return m.account_id === a.id; }), open = S.accOpen === a.id;
        var linked = Object.keys(S.notes || {}).filter(function (k) { return (S.notes[k] || {}).account_id === a.id; }).length;
        return '<li class="ad-card mt-acc' + (a.active ? '' : ' is-past') + '"><div class="mt-acc-main"><div class="ad-name">' + esc(a.name) + ' <span class="ad-tag">' + esc(AK[a.kind] || a.kind) + '</span>' + (a.active ? '' : ' <span class="ad-tag is-red">cerrada</span>') + '</div>' +
          '<div class="ad-meta">' + (a.legal_name ? esc(a.legal_name) + ' · ' : '') + (a.tax_id ? 'CIF ' + esc(a.tax_id) + ' · ' : '') + linked + ' cliente' + (linked === 1 ? '' : 's') + ' vinculado' + (linked === 1 ? '' : 's') + ' · ' + mv.length + ' movimiento' + (mv.length === 1 ? '' : 's') + '</div>' + (accAddr(a) ? '<div class="ad-meta">Dirección fiscal: ' + esc(accAddr(a)) + '</div>' : '') + '</div>' +
          (a.kind === 'contado' ? '<div class="mt-acc-bal"><b>Contado</b><span>sin saldo</span></div>' : '<div class="mt-acc-bal ' + (bal < 0 ? 'is-neg' : 'is-pos') + '"><b>' + eur(bal) + '</b><span>' + (bal < 0 ? (a.kind === 'empresa' ? 'a facturar a fin de mes' : 'por encima del saldo') : 'saldo a favor') + '</span></div>') +
          '<div class="ad-actions">' + (a.kind === 'contado' ? '' : '<button class="ad-btn is-small" data-acc-top="' + a.id + '">Ingresar saldo</button> <button class="ad-btn is-small is-ghost" data-acc-adj="' + a.id + '">Ajuste</button> ') + '<button class="ad-btn is-small is-ghost" data-acc-edit="' + a.id + '">Datos fiscales</button> <button class="ad-btn is-small is-ghost" data-acc-open="' + a.id + '">' + (open ? 'Ocultar movimientos' : 'Movimientos') + '</button> <button class="ad-btn is-small is-ghost" data-acc-toggle="' + a.id + '">' + (a.active ? 'Cerrar' : 'Reabrir') + '</button></div>' +
          (open ? '<div class="mt-acc-ledger">' + (mv.length ? '<table class="ad-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th></tr></thead><tbody>' + mv.map(function (m) { return '<tr><td class="nowrap">' + esc(fmtShort(m.created_at)) + '</td><td>' + esc(({ topup: 'Ingreso', spend: 'Consumo', adjust: 'Ajuste' })[m.kind] || m.kind) + (m.note ? ' · ' + esc(m.note) : '') + '<br><small>' + esc(m.created_by || '') + '</small></td><td class="nowrap"><b style="color:' + (m.amount_cents < 0 ? 'var(--red)' : 'var(--ok)') + '">' + (m.amount_cents > 0 ? '+' : '') + eur(m.amount_cents) + '</b></td></tr>'; }).join('') + '</tbody></table>' : '<p class="ad-meta">Sin movimientos todavía.</p>') + '</div>' : '') + '</li>';
      }).join('') : '<li class="ad-empty">Todavía no hay cuentas. Crea la primera arriba.</li>') + '</ul>';
    var f = document.getElementById('acForm');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var init = cents(document.getElementById('acInit').value || 0), msg = document.getElementById('acMsg'); msg.hidden = true;
      api('dining_accounts', { method: 'POST', prefer: 'return=representation', body: accRead(document, 'ac') })
        .then(function (r) { var id = (Array.isArray(r) ? r[0] : r).id; return init > 0 ? addMove(id, init, 'topup', 'Saldo inicial') : null; })
        .then(function () { return loadConfig(true); }).then(function () { flash('Cuenta creada.', 'ok'); render(); })
        .catch(function (x) { msg.textContent = 'No se ha podido crear la cuenta' + (/relation|dining_accounts/.test(String(x && x.message)) ? ': ejecuta primero mesas_cuentas.sql en Supabase.' : '.'); msg.hidden = false; });
    });
  }
  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-acc-top],[data-acc-adj],[data-acc-open],[data-acc-toggle],[data-acc-edit]'); if (!t) return;
    var id = t.dataset.accTop || t.dataset.accAdj || t.dataset.accOpen || t.dataset.accToggle || t.dataset.accEdit, a = (S.accounts || []).filter(function (x) { return x.id === id; })[0]; if (!a) return;
    if (t.dataset.accEdit) {
      return void modal('<h2>Datos de ' + esc(a.name) + '</h2><p class="ad-msg is-error" id="aeMsg" hidden></p><div class="ad-grid">' + accFields(a, 'ae') + '</div><div class="mt-foot"><button type="button" class="ad-btn is-ghost" data-close>Cerrar</button><button type="button" class="ad-btn" id="aeSave">Guardar</button></div>', function (m) {
        m.querySelector('#aeSave').addEventListener('click', function () {
          var body = accRead(m, 'ae'); if (!body.name) return;
          api('dining_accounts?id=eq.' + id, { method: 'PATCH', body: body, prefer: 'return=minimal' }).then(function () { m.remove(); return loadConfig(true); }).then(function () { flash('Datos guardados.', 'ok'); render(); })
            .catch(function (x) { var el = m.querySelector('#aeMsg'); el.textContent = errText(x); el.hidden = false; });
        });
      });
    }
    if (t.dataset.accOpen) { S.accOpen = S.accOpen === id ? '' : id; return render(); }
    if (t.dataset.accToggle) return void api('dining_accounts?id=eq.' + id, { method: 'PATCH', body: { active: !a.active }, prefer: 'return=minimal' }).then(function () { return loadConfig(true); }).then(render).catch(fail);
    var top = !!t.dataset.accTop;
    var amt = prompt(top ? 'Importe entregado a cuenta por ' + a.name + ' (€):' : 'Ajuste de saldo de ' + a.name + ' (€; negativo para restar):'); if (amt == null || !String(amt).trim()) return;
    var c = cents(amt); if (!c || (top && c < 0)) return flash('Importe no válido.', 'error');
    var note = prompt(top ? 'Concepto (p. ej. transferencia del 12/11):' : 'Motivo del ajuste:', ''); if (note == null) return;
    addMove(id, c, top ? 'topup' : 'adjust', note.trim()).then(function () { return loadConfig(true); }).then(function () { flash((top ? 'Saldo ingresado: ' : 'Ajuste aplicado: ') + eur(c) + '. Saldo ahora: ' + eur(accBal(id)) + '.', 'ok'); render(); }).catch(fail);
  });

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
        '<label class="ad-field"><span>Cómo se garantiza</span><select data-f="payment_mode"><option value="none"' + (z.payment_mode === 'none' ? ' selected' : '') + '>Sin pago</option><option value="card"' + (z.payment_mode === 'card' ? ' selected' : '') + '>Tarjeta de garantía (no se cobra, solo si no viene)</option><option value="deposit"' + (z.payment_mode === 'deposit' ? ' selected' : '') + '>Fianza cobrada al reservar</option></select></label>' +
        '<label class="ad-field"><span>Importe (€)</span><input data-f="deposit" type="number" min="0" step="0.5" value="' + z.deposit_cents / 100 + '"></label>' +
        '<label class="ad-field"><span>Sin coste si anula con (h) de antelación</span><input data-f="free_cancel_hours" type="number" min="0" value="' + z.free_cancel_hours + '"></label>' +
        '<label class="mt-check"><input data-f="deposit_per_person" type="checkbox"' + (z.deposit_per_person ? ' checked' : '') + '> Importe por persona</label>' +
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
        '<label class="ad-field"><span>Cortesía de llegada (min)</span><input data-f="grace_min" type="number" min="0" step="5" value="' + s.grace_min + '"></label>' +
        '<label class="ad-field"><span>Grupos grandes desde (personas; 0 = no)</span><input data-f="big_party_from" type="number" min="0" value="' + s.big_party_from + '"></label>' +
        '<label class="ad-field"><span>…minutos extra de mesa</span><input data-f="big_party_extra_min" type="number" min="0" step="5" value="' + s.big_party_extra_min + '"></label>' +
        '<label class="ad-field full"><span>Aviso final en el email (ES)</span><input data-f="end_note_es" maxlength="200" value="' + esc(s.end_note_es) + '" placeholder="p. ej. A las 00:30 te invitamos a bajar a la planta baja…"></label>' +
        '<label class="ad-field full"><span>Aviso final en el email (EN)</span><input data-f="end_note_en" maxlength="200" value="' + esc(s.end_note_en) + '"></label>' +
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
    var closures = '<p class="ad-meta" style="margin-bottom:0.7rem">Un cierre apaga las reservas de la <b>web</b> para esos días (o solo unas horas); desde aquí seguís pudiendo reservar a mano. Ejemplos: Fallas (todos los días, sin horas) o Nochebuena (solo por la tarde).</p><ul class="ad-list">' + (S.closures.length ? S.closures.map(function (c) {
      var hours = c.start_min == null && c.end_min == null ? 'todo el día' : mm(c.start_min || 0) + '–' + mm(c.end_min || 1440);
      return '<li class="ad-card"><div><div class="ad-name">' + esc(c.date_from === c.date_to ? c.date_from : c.date_from + ' → ' + c.date_to) + ' · ' + esc(hours) + '</div><div class="ad-meta">' + esc(c.service_id ? (S.services.filter(function (s) { return s.id === c.service_id; })[0] || {}).name_es || c.service_id : 'Todos los turnos') + ' · ' + esc(c.zone_id ? zoneName(c.zone_id) : 'Todas las zonas') + (c.note ? ' · ' + esc(c.note) : '') + '</div>' + (c.message_es ? '<div class="ad-meta">Aviso en la web: “' + esc(c.message_es) + '”</div>' : '') + '</div><div class="ad-actions"><button class="ad-btn is-small is-danger" data-delclosure="' + c.id + '">Quitar</button></div></li>';
    }).join('') : '<li class="ad-empty">Sin cierres programados.</li>') + '</ul>' +
      '<form class="ad-sheet-inline" id="clForm"><h3 class="mt-h3">Nuevo cierre de la web</h3><div class="ad-grid">' +
      '<label class="ad-field"><span>Desde el día</span><input type="date" id="clFrom" required></label><label class="ad-field"><span>Hasta el día (incluido)</span><input type="date" id="clTo" required></label>' +
      '<label class="ad-field"><span>Desde las (opcional)</span><input type="time" id="clT0"></label><label class="ad-field"><span>Hasta las (opcional)</span><input type="time" id="clT1"></label>' +
      '<label class="ad-field"><span>Turno</span><select id="clSvc"><option value="">Todos</option>' + S.services.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name_es) + '</option>'; }).join('') + '</select></label>' +
      '<label class="ad-field"><span>Zona</span><select id="clZone"><option value="">Todas</option>' + S.zones.map(function (z) { return '<option value="' + z.id + '">' + esc(z.name_es) + '</option>'; }).join('') + '</select></label>' +
      '<label class="ad-field full"><span>Aviso para el público (opcional)</span><input id="clMsg" maxlength="200" placeholder="p. ej. Por Fallas las reservas son solo por WhatsApp: 614 07 31 63"></label>' +
      '<label class="ad-field full"><span>Motivo interno (opcional)</span><input id="clNote" maxlength="120" placeholder="p. ej. Fallas"></label></div><button class="ad-btn" type="submit">Cerrar la web esos días</button></form>';
    body.innerHTML = '<p class="ad-meta" style="margin-bottom:1rem">Los cambios se guardan al momento. Afectan solo a reservas nuevas.</p>' +
      '<h2 class="ad-sub">Zonas y fianzas</h2><ul class="ad-list">' + zones + '</ul>' +
      '<h2 class="ad-sub" style="margin-top:1.75rem">Turnos y horarios</h2><ul class="ad-list">' + services + '</ul>' +
      '<h2 class="ad-sub" style="margin-top:1.75rem">Mesas</h2><p class="ad-meta" style="margin-bottom:0.6rem">Las mesas con el mismo “grupo de unión” (en la misma zona) se pueden juntar para grupos grandes.</p>' + tables +
      '<h2 class="ad-sub" style="margin-top:1.75rem">Prescriptores</h2>' + prescribersHtml() +
      '<h2 class="ad-sub" style="margin-top:1.75rem">Etiquetas de cliente</h2>' + tagsCfgHtml() +
      '<h2 class="ad-sub" style="margin-top:1.75rem">Cierres por día</h2>' + closures;
    var pf = document.getElementById('prForm');
    if (pf) pf.addEventListener('submit', function (e) {
      e.preventDefault();
      addPrescriber(document.getElementById('prName').value.trim(), '').then(function () { flash('Prescriptor añadido.', 'ok'); render(); }).catch(function () { flash('No se ha podido añadir (¿nombre no válido o ya existe?).', 'error'); });
    });
    var ptf = document.getElementById('prTeamForm');
    if (ptf) ptf.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = document.getElementById('prTeam').value; if (!em) return;
      var m = (S.team || []).filter(function (x) { return String(x.email).toLowerCase() === em.toLowerCase(); })[0];
      addPrescriber(m ? personName(m) : em, em).then(function () { flash('Prescriptor añadido.', 'ok'); render(); }).catch(function () { flash('No se ha podido añadir (¿ya existe?).', 'error'); });
    });
    var cf = document.getElementById('clForm');
    if (cf) cf.addEventListener('submit', function (e) {
      e.preventDefault();
      api('dining_closures', { method: 'POST', body: closureBody(), prefer: 'return=minimal' })
        .then(function () { flash('Cierre añadido.', 'ok'); return enter(); }).catch(fail);
    });
  }
  function tagsCfgHtml() {
    return '<p class="ad-meta" style="margin-bottom:0.6rem">Alergias y “Pago por transferencia” vienen de serie. Aquí están las que has creado tú (VIP, prensa…); también puedes crearlas con “＋ Nueva etiqueta” al editar una reserva o un cliente.</p><div class="mt-al-list">' +
      ((S.tags || []).length ? S.tags.map(function (t) { return '<span class="mt-tagcfg">' + esc(t.name) + ' <button type="button" class="mt-x" data-deltag="' + esc(t.code) + '" aria-label="Quitar etiqueta ' + esc(t.name) + '">×</button></span>'; }).join('') : '<span class="ad-meta">Todavía no has creado ninguna.</span>') + '</div>';
  }
  function prescribersHtml() {
    var base = location.origin + "/fuck-who-doesn't-like-this-place/";
    return '<p class="ad-meta" style="margin-bottom:0.6rem">Un prescriptor es quien trae o recomienda reservas (RR. PP., conserjes, agencias). Cada uno tiene su enlace: las reservas que entren por él quedan marcadas con su nombre.</p><ul class="ad-list">' +
      (S.prescribers.length ? S.prescribers.map(function (p) {
        return '<li class="ad-card mt-cfg" data-pres-row="' + esc(p.code) + '"><div><div class="ad-name">' + esc(p.name) + (p.email ? ' <span class="ad-tag">Equipo</span>' : '') + (p.active ? '' : ' <span class="ad-tag is-red">inactivo</span>') + '</div><div class="ad-meta">Enlace: <input class="mt-linkin" readonly value="' + esc(base + '?pr=' + p.code) + '" onclick="this.select()"></div></div>' +
          '<div class="ad-actions"><button class="ad-btn is-small is-ghost" data-pres-toggle="' + esc(p.code) + '">' + (p.active ? 'Desactivar' : 'Activar') + '</button></div></li>';
      }).join('') : '<li class="ad-empty">Todavía no hay prescriptores.</li>') + '</ul>' +
      '<form class="ad-sheet-inline" id="prTeamForm"><div class="ad-grid"><label class="ad-field"><span>Añadir a alguien del equipo</span><select id="prTeam"><option value="">' + (teamFree().length ? 'Elige una persona…' : (S.team && S.team.length ? 'Todo el equipo ya está en la lista' : 'Sin equipo (ejecuta equipo_nombres.sql)')) + '</option>' + teamFree().map(function (m) { return '<option value="' + esc(m.email) + '">' + esc(personName(m)) + '</option>'; }).join('') + '</select></label></div><button class="ad-btn" type="submit">Añadir del equipo</button></form>' +
      '<form class="ad-sheet-inline" id="prForm"><div class="ad-grid"><label class="ad-field"><span>O crear a mano (quien no tiene cuenta)</span><input id="prName" maxlength="60" required placeholder="Nombre y apellidos, o hotel / agencia"></label></div><button class="ad-btn" type="submit">Crear prescriptor</button></form>';
  }
  function closureBody() {
    var v = function (id) { return document.getElementById(id).value; };
    var t0 = v('clT0'), t1 = v('clT1');
    var m0 = t0 ? toMin(t0) : null, m1 = t1 ? toMin(t1, m0 || 0) : null;
    if (m0 != null && m1 == null) m1 = 2880;
    if (m1 != null && m0 == null) m0 = 0;
    return { date_from: v('clFrom'), date_to: v('clTo'), service_id: v('clSvc') || null, zone_id: v('clZone') || null, start_min: m0, end_min: m1, message_es: v('clMsg').trim(), note: v('clNote').trim() };
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
      else if (el.type === 'checkbox') b[f] = el.checked; else if (f === 'end_note_es' || f === 'end_note_en') b[f] = el.value.trim(); else b[f] = +el.value;
      if (b.last_min != null && sr.querySelector('[data-f="start"]')) { var st = toMin(sr.querySelector('[data-f="start"]').value); if (b.last_min < st) b.last_min += 1440; }
      api('dining_services?id=eq.' + sid, { method: 'PATCH', body: b, prefer: 'return=minimal' }).then(function () { return loadConfig(true); }).then(saved).catch(fail);
    } else if (tr && f) {
      var tb = {};
      if (el.type === 'checkbox') tb[f] = el.checked; else if (f === 'seats_min' || f === 'seats_max') tb[f] = +el.value; else tb[f] = el.value.trim();
      api('dining_tables?id=eq.' + tr.dataset.tableRow, { method: 'PATCH', body: tb, prefer: 'return=minimal' }).then(function () { return loadConfig(true); }).then(saved).catch(fail);
    }
  });
  root.addEventListener('click', function (e) {
    var dt = e.target.closest('[data-deltag]');
    if (dt) {
      if (!confirm('¿Quitar la etiqueta “' + dt.dataset.deltag + '”? Dejará de poder elegirse (las reservas que ya la tienen no se tocan).')) return;
      return void api('dining_tags?code=eq.' + encodeURIComponent(dt.dataset.deltag), { method: 'DELETE', prefer: 'return=minimal' }).then(function () { return loadConfig(true); }).then(render).catch(fail);
    }
    var pt = e.target.closest('[data-pres-toggle]');
    if (pt) {
      var pr = S.prescribers.filter(function (x) { return x.code === pt.dataset.presToggle; })[0];
      return void api('dining_prescribers?code=eq.' + encodeURIComponent(pt.dataset.presToggle), { method: 'PATCH', body: { active: !(pr && pr.active) }, prefer: 'return=minimal' }).then(function () { return loadConfig(true); }).then(render).catch(fail);
    }
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
