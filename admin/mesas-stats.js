/* RoceCover · Estadísticas y actividad.
   Todo se calcula en el navegador con las reservas del periodo elegido (nada que configurar). */
(function () {
  'use strict';
  var A = window.ROCE_ADMIN; if (!A) return;
  var esc = A.esc, api = A.api, flash = A.flash, TZ = A.TZ;
  var H = function () { return A.mesasHelpers || {}; };
  var X = { preset: '30', from: '', to: '', amb: 'all', data: null, loading: false, err: '' };

  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); }
  function addDays(d, n) { var t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function eur(c) { return (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }); }
  function pct(a, b) { return b ? Math.round(a / b * 1000) / 10 + ' %' : '—'; }
  function num(n) { return (Math.round(n * 10) / 10).toLocaleString('es-ES'); }
  var DOW = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  var DFMT = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' });
  var WD = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  function parts(iso) {
    var o = {}; DFMT.formatToParts(new Date(iso)).forEach(function (p) { o[p.type] = p.value; });
    return { date: o.year + '-' + o.month + '-' + o.day, h: Number(o.hour), dow: WD[o.weekday] || 1 };
  }

  function range() {
    var t = today();
    if (X.preset === 'custom') return { from: X.from || addDays(t, -29), to: X.to || t };
    if (X.preset === 'month') return { from: t.slice(0, 8) + '01', to: t };
    if (X.preset === 'year') return { from: t.slice(0, 4) + '-01-01', to: t };
    var n = Number(X.preset) || 30; return { from: addDays(t, -(n - 1)), to: t };
  }

  function load(body) {
    var r = range(); X.loading = true; X.err = '';
    var from = A.madridToISO(r.from + 'T00:00'), to = A.madridToISO(addDays(r.to, 1) + 'T00:00');
    var cols = 'id,ref,name,email,phone,starts_at,created_at,party,status,source,ambience,zone_id,service_id,kind,prescriber,spend_cents,late_cancel,payment_status,allergy_tags,reconfirmed_at,reminder_sent_at,review_sent_at,arrived_at,finished_at';
    return Promise.all([
      api('table_bookings?select=' + cols + '&starts_at=gte.' + encodeURIComponent(from) + '&starts_at=lt.' + encodeURIComponent(to) + '&order=starts_at&limit=5000'),
      api('dining_waitlist?select=status,created_at,want_date&created_at=gte.' + encodeURIComponent(from) + '&created_at=lt.' + encodeURIComponent(to) + '&limit=5000').catch(function () { return []; }),
      api('dining_booking_log?select=*,table_bookings(ref,name)&order=at.desc&limit=80').catch(function () { return null; })
    ]).then(function (res) { X.data = { rows: res[0] || [], wait: res[1] || [], log: res[2], r: r }; X.loading = false; render(body); })
      .catch(function (e) { X.loading = false; X.err = (e && e.message) || 'error'; render(body); });
  }

  // ─── Cálculo ────────────────────────────────────────────────────────
  function compute() {
    var d = X.data, rows = d.rows.filter(function (b) { return X.amb === 'all' || b.ambience === X.amb; });
    var S = (A.mesasState && A.mesasState()) || { zones: [], services: [], prescribers: [] };
    var c = { rows: rows, n: rows.length };
    var live = rows.filter(function (b) { return ['confirmed', 'seated', 'completed'].indexOf(b.status) !== -1; });
    var att = rows.filter(function (b) { return b.status === 'seated' || b.status === 'completed'; });
    var ns = rows.filter(function (b) { return b.status === 'no_show'; });
    var cx = rows.filter(function (b) { return b.status === 'cancelled'; });
    c.live = live.length; c.pax = live.reduce(function (n, b) { return n + b.party; }, 0);
    c.avgParty = live.length ? c.pax / live.length : 0;
    c.att = att.length; c.noshow = ns.length; c.noshowRate = pct(ns.length, att.length + ns.length);
    c.cancelled = cx.length; c.cancelRate = pct(cx.length, rows.length); c.lateCancel = rows.filter(function (b) { return b.late_cancel; }).length;
    var sp = att.filter(function (b) { return b.spend_cents != null; });
    c.spend = sp.reduce(function (n, b) { return n + b.spend_cents; }, 0); c.spendPax = sp.reduce(function (n, b) { return n + b.party; }, 0);
    c.ticketPax = c.spendPax ? c.spend / c.spendPax : 0; c.ticketRes = sp.length ? c.spend / sp.length : 0; c.spendN = sp.length;
    var lead = live.filter(function (b) { return b.kind !== 'walkin' && b.created_at; }).map(function (b) { return (Date.parse(b.starts_at) - Date.parse(b.created_at)) / 86400e3; }).filter(function (x) { return x >= 0; });
    c.lead = lead.length ? lead.reduce(function (a, b) { return a + b; }, 0) / lead.length : 0;
    var rem = rows.filter(function (b) { return b.reminder_sent_at; });
    c.reminded = rem.length; c.reconf = rem.filter(function (b) { return b.reconfirmed_at; }).length; c.reviewMails = rows.filter(function (b) { return b.review_sent_at && Date.parse(b.review_sent_at) > 1e10; }).length;
    c.wait = d.wait.length; c.waitDone = d.wait.filter(function (w) { return w.status && w.status !== 'waiting'; }).length;
    // por día, día de la semana y hora
    var byDay = {}, byDow = {}, byHour = {};
    live.forEach(function (b) { var p = parts(b.starts_at); byDay[p.date] = (byDay[p.date] || 0) + b.party; byDow[p.dow] = (byDow[p.dow] || 0) + b.party; byHour[p.h] = (byHour[p.h] || 0) + b.party; });
    c.byDay = []; for (var t = d.r.from; t <= d.r.to; t = addDays(t, 1)) c.byDay.push([t, byDay[t] || 0]);
    c.byDow = [1, 2, 3, 4, 5, 6, 7].map(function (k) { return [DOW[k], byDow[k] || 0]; });
    c.byHour = []; for (var h = 0; h < 24; h++) if (byHour[h]) c.byHour.push([('0' + h).slice(-2) + ':00', byHour[h]]);
    // desgloses
    var group = function (arr, key, val) { var o = {}; arr.forEach(function (b) { var k = key(b); if (k == null || k === '') return; o[k] = (o[k] || 0) + val(b); }); return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; }); };
    var svcName = function (id) { var s = (S.services || []).filter(function (x) { return x.id === id; })[0]; return s ? s.name_es : id; };
    var zName = function (id) { var z = (S.zones || []).filter(function (x) { return x.id === id; })[0]; return z ? z.name_es : id; };
    var pName = function (code) { var p = (S.prescribers || []).filter(function (x) { return x.code === code; })[0]; return p ? p.name : code; };
    var pax = function (b) { return b.party; };
    c.bySvc = group(live, function (b) { return svcName(b.service_id); }, pax);
    c.byZone = group(live, function (b) { return zName(b.zone_id); }, pax);
    c.bySource = group(live, function (b) { return b.prescriber ? 'Prescriptor: ' + pName(b.prescriber) : b.kind === 'walkin' ? 'Walk-in' : b.source === 'admin' ? 'Creadas en el panel' : 'Web'; }, pax);
    c.byKind = group(live, function (b) { var K = H().BK_KIND || {}; return K[b.kind || 'normal'] || b.kind; }, pax);
    c.bySize = (function () { var o = { '1': 0, '2': 0, '3-4': 0, '5-6': 0, '7-8': 0, '9 o más': 0 }; live.forEach(function (b) { var p = b.party; o[p === 1 ? '1' : p === 2 ? '2' : p <= 4 ? '3-4' : p <= 6 ? '5-6' : p <= 8 ? '7-8' : '9 o más']++; }); return Object.keys(o).map(function (k) { return [k, o[k]]; }); })();
    var ST_ = H().ST || {};
    c.byStatus = group(rows, function (b) { return ST_[b.status] || b.status; }, function () { return 1; });
    var tagN = {}; var LB = H().LBL ? H().LBL() : {}, AL = H().AL || {};
    live.forEach(function (b) { (b.allergy_tags || []).forEach(function (k) { var n = AL[k] || LB[k] || k; tagN[n] = (tagN[n] || 0) + 1; }); });
    c.byTag = Object.keys(tagN).map(function (k) { return [k, tagN[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    // clientes
    var cl = {};
    att.forEach(function (b) { var k = (b.email || b.phone || '').toLowerCase(); if (!k) return; var o = cl[k] || (cl[k] = { name: b.name, v: 0, s: 0, pax: 0 }); o.v++; o.s += Number(b.spend_cents || 0); o.pax += b.party; });
    c.top = Object.keys(cl).map(function (k) { return cl[k]; }).sort(function (a, b) { return b.s - a.s || b.v - a.v; }).slice(0, 10);
    c.repeat = Object.keys(cl).filter(function (k) { return cl[k].v > 1; }).length; c.clients = Object.keys(cl).length;
    return c;
  }

  // ─── Pintado ────────────────────────────────────────────────────────
  function kpi(label, value, sub) { return '<div class="st-kpi"><span>' + esc(label) + '</span><b>' + esc(String(value)) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>'; }
  function hbars(rows, unit, title) {
    if (!rows.length) return '<div class="st-card"><h3>' + esc(title) + '</h3><p class="ad-meta">Sin datos en este periodo.</p></div>';
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; })) || 1;
    return '<div class="st-card"><h3>' + esc(title) + '</h3>' + rows.map(function (r) {
      return '<div class="st-h"><span class="st-hl" title="' + esc(r[0]) + '">' + esc(r[0]) + '</span><span class="st-hb"><i style="width:' + Math.max(2, Math.round(r[1] / max * 100)) + '%"></i></span><b>' + esc(num(r[1])) + (unit || '') + '</b></div>';
    }).join('') + '</div>';
  }
  function cols(rows, title, small) {
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; })) || 1, many = rows.length > 16;
    return '<div class="st-card st-wide"><h3>' + esc(title) + '</h3><div class="st-cols' + (many ? ' is-dense' : '') + '">' + rows.map(function (r, i) {
      var lbl = small ? String(r[0]).slice(8) : r[0];
      return '<div class="st-c" title="' + esc(r[0] + ': ' + r[1]) + '"><b>' + (many && i % 3 ? '' : r[1] || '') + '</b><i style="height:' + Math.round(r[1] / max * 100) + '%"></i><span>' + esc(many && i % 3 ? '' : lbl) + '</span></div>';
    }).join('') + '</div></div>';
  }
  function render(body) {
    var r = range(), pre = [['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['month', 'Este mes'], ['year', 'Este año'], ['custom', 'Fechas']];
    var head = '<div class="ad-bar st-bar"><div class="st-presets">' + pre.map(function (p) { return '<button type="button" class="ck-chip" data-stp="' + p[0] + '" aria-pressed="' + (X.preset === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div>' +
      '<div class="st-dates"><input type="date" id="stFrom" value="' + r.from + '"><span>→</span><input type="date" id="stTo" value="' + r.to + '"></div>' +
      '<select id="stAmb"><option value="all">Todo</option><option value="day"' + (X.amb === 'day' ? ' selected' : '') + '>Coffee, Bakery & Kitchen</option><option value="night"' + (X.amb === 'night' ? ' selected' : '') + '>Restaurant & Cocktails</option></select>' +
      '<button type="button" class="ad-btn is-small is-ghost" id="stCsv">Descargar CSV</button></div>';
    if (X.loading && !X.data) { body.innerHTML = head + '<p class="ad-empty">Calculando…</p>'; bind(body); return; }
    if (X.err) { body.innerHTML = head + '<p class="ad-msg is-error">No se han podido cargar los datos: ' + esc(X.err) + '</p>'; bind(body); return; }
    if (!X.data) { body.innerHTML = head; bind(body); return; }
    var c = compute();
    var html = head + (X.loading ? '<p class="ad-meta">Actualizando…</p>' : '') +
      '<div class="st-kpis">' +
      kpi('Reservas', c.live, c.n - c.live + ' anuladas, no vino o pendientes') + kpi('Comensales', c.pax, 'media ' + num(c.avgParty) + ' por reserva') +
      kpi('No-shows', c.noshow, c.noshowRate + ' de las que debían venir') + kpi('Anulaciones', c.cancelled, c.cancelRate + ' · ' + c.lateCancel + ' tardías') +
      kpi('Gasto anotado', eur(c.spend), c.spendN + ' reservas con gasto') + kpi('Ticket medio por persona', c.spendPax ? eur(Math.round(c.ticketPax)) : '—', c.spendPax ? eur(Math.round(c.ticketRes)) + ' por reserva' : 'anota el gasto en cada reserva') +
      kpi('Antelación media', c.lead ? num(c.lead) + ' días' : '—', 'desde que reservan hasta la visita') + kpi('Lista de espera', c.wait, c.waitDone + ' avisadas o resueltas') +
      kpi('Reconfirmaciones', c.reminded ? pct(c.reconf, c.reminded) : '—', c.reconf + ' de ' + c.reminded + ' recordatorios') + kpi('Clientes que repiten', c.clients ? pct(c.repeat, c.clients) : '—', c.repeat + ' de ' + c.clients + ' con visita') +
      '</div>' +
      cols(c.byDay, 'Comensales por día', true) +
      '<div class="st-grid">' + cols(c.byDow, 'Comensales por día de la semana') + cols(c.byHour, 'Comensales por hora de llegada') + '</div>' +
      '<div class="st-grid">' + hbars(c.bySvc, '', 'Comensales por turno') + hbars(c.byZone, '', 'Comensales por zona') + hbars(c.bySource, '', 'De dónde vienen') + hbars(c.byKind, '', 'Tipo de reserva') + hbars(c.bySize, '', 'Tamaño del grupo (reservas)') + hbars(c.byStatus, '', 'Estado de las reservas') + hbars(c.byTag, '', 'Alergias y etiquetas (reservas)') + '</div>' +
      '<div class="st-card st-wide"><h3>Mejores clientes del periodo</h3>' + (c.top.length ? '<table class="ad-table"><thead><tr><th>Cliente</th><th>Visitas</th><th>Comensales</th><th>Gasto</th></tr></thead><tbody>' + c.top.map(function (t) { return '<tr><td>' + esc(t.name || 'Sin nombre') + '</td><td>' + t.v + '</td><td>' + t.pax + '</td><td>' + eur(t.s) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="ad-meta">Sin visitas en este periodo.</p>') + '</div>' +
      '<div class="st-card st-wide"><h3>Actividad reciente</h3>' + (X.data.log == null ? '<p class="ad-meta">El historial se activa al ejecutar mesas_servicio2.sql en Supabase.</p>' : A.logHtml ? '<div class="mt-log">' + A.logHtml(X.data.log, true) + '</div>' : '') + '</div>';
    body.innerHTML = html; bind(body);
  }
  function bind(body) {
    var again = function () { X.data = null; render(body); load(body); };
    [].forEach.call(body.querySelectorAll('[data-stp]'), function (b) { b.addEventListener('click', function () { X.preset = b.dataset.stp; if (X.preset !== 'custom') { X.from = ''; X.to = ''; } again(); }); });
    var f = body.querySelector('#stFrom'), t = body.querySelector('#stTo');
    [f, t].forEach(function (el) { if (el) el.addEventListener('change', function () { X.preset = 'custom'; X.from = f.value; X.to = t.value; if (X.from && X.to && X.from <= X.to) again(); }); });
    var am = body.querySelector('#stAmb'); if (am) am.addEventListener('change', function () { X.amb = am.value; render(body); });
    var csv = body.querySelector('#stCsv'); if (csv) csv.addEventListener('click', function () {
      if (!X.data) return;
      var rows = X.data.rows.filter(function (b) { return X.amb === 'all' || b.ambience === X.amb; });
      var head = ['Ref', 'Fecha', 'Hora', 'Nombre', 'Email', 'Teléfono', 'Personas', 'Estado', 'Turno', 'Zona', 'Tipo', 'Origen', 'Prescriptor', 'Gasto (€)', 'Creada', 'Reconfirmada'];
      var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
      var lines = [head.join(';')].concat(rows.map(function (b) { var p = parts(b.starts_at); return [b.ref, p.date, ('0' + p.h).slice(-2), b.name, b.email, b.phone, b.party, b.status, b.ambience, b.zone_id, b.kind, b.source, b.prescriber, b.spend_cents != null ? (b.spend_cents / 100).toFixed(2).replace('.', ',') : '', b.created_at, b.reconfirmed_at || ''].map(q).join(';'); })).join('\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines], { type: 'text/csv;charset=utf-8' })); a.download = 'reservas-' + X.data.r.from + '_' + X.data.r.to + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    });
  }
  A.renderStats = function (body) { render(body); if (!X.data && !X.loading) load(body); };
})();
