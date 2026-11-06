// Reservas de mesa de ROCE (sustituyen al widget de CoverManager).
//
// Se monta dentro de <div id="mesasApp">. Flujo: personas → fecha → hora → datos → reservar.
// La disponibilidad sale de la función dining_slots (mesas reales) y la reserva de book_table,
// las dos en Supabase. Si la planta pide fianza (Night), después se va al TPV de Redsys
// con la función "redsys" (acción pay_table) y se vuelve a /reserva/?t=<código>.
//
//   ROCE_MESAS.setAmbience('day' | 'night' | 'all')   filtra los turnos que se ven
(function () {
  'use strict';
  var TZ = 'Europe/Madrid';
  var B = window.ROCE_BACKEND || {};
  var root = document.getElementById('mesasApp');
  if (!root) return;

  var STR = {
    es: {
      party: 'Personas', date: 'Fecha', time: 'Hora', person: 'persona', people: 'personas',
      months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
      dows: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
      prev: 'Mes anterior', next: 'Mes siguiente', meal_lunch: 'Comida', meal_dinner: 'Cena', cal_closed: 'Cerrado', cal_full: 'Completo', cal_partial: 'Algún turno completo o cerrado', cal_full_in: 'Completo: {n}', cal_closed_in: 'Cerrado: {n}',
      pick_date: 'Elige un día para ver las horas disponibles.',
      loading: 'Buscando mesas…', none: 'No quedan mesas ese día para {n}. Prueba otro día o escríbenos por {wa}.', wa_msg: 'Hola, quería reservar mesa para {n} el {date}.',
      err_load: 'No hemos podido consultar las mesas. Inténtalo de nuevo en un momento.',
      day: 'Coffee, Bakery & Kitchen', night: 'Restaurant & Cocktails',
      deposit_h: 'Fianza de {m}', deposit_free_until: 'Se devuelve si cancelas con al menos {h} h de antelación.',
      free_h: 'Reserva gratuita',
      form_h: 'Tus datos', name: 'Nombre y apellidos', email: 'Email', phone: 'Teléfono', notes: 'Comentarios (opcional)',
      consent: 'Acepto la <a href="/privacidad.html" target="_blank" rel="noopener">política de privacidad</a> y los <a href="/terminos.html" target="_blank" rel="noopener">términos</a>',
      marketing: 'Quiero recibir novedades de ROCE (opcional)',
      summary: '{date} · {time} · {party}',
      deposit_note: 'Para confirmar la reserva se cobra una fianza de {m} con tarjeta. Si cancelas con al menos {h} h de antelación te la devolvemos; si no, la retenemos. Con tu visita no se cobra nada más: es a cuenta de la consumición.',
      go_free: 'Reservar mesa', go_pay: 'Pagar {m} y reservar', working: 'Un momento…',
      e_bad_data: 'Revisa el nombre, el email y el teléfono.', e_consent: 'Debes aceptar la política de privacidad.',
      e_no_table: 'Esa mesa se acaba de ocupar. Elige otra hora.', e_too_late: 'Esa hora ya no admite reservas. Elige otra.',
      e_blocked: 'No podemos aceptar esta reserva. Escríbenos a reservas@roce.es.',
      e_closed: 'Ese día no abrimos para reservas.', e_too_many: 'Has llegado al máximo de 10 reservas activas con este email.',
      e_network: 'No hemos podido completar la reserva. Inténtalo de nuevo.', e_pay: 'No hemos podido abrir el pago. Tu mesa queda retenida unos minutos: vuelve a pulsar el botón.',
      night_tag: 'Solo mayores de 18 años',
      allergies: 'Alergias o intolerancias', al: { gluten: 'Gluten', lactosa: 'Lácteos / lactosa', 'frutos-secos': 'Frutos secos', cacahuetes: 'Cacahuetes', huevo: 'Huevo', pescado: 'Pescado', marisco: 'Crustáceos', moluscos: 'Moluscos', soja: 'Soja', sesamo: 'Sésamo', apio: 'Apio', mostaza: 'Mostaza', altramuz: 'Altramuz', sulfitos: 'Sulfitos', vegetariano: 'Vegetariano', vegano: 'Vegano', otras: 'Otras' }, yes: 'Sí', no: 'No', al_hint: 'Si es otra, cuéntanosla en comentarios.',
      info_dur: 'Tu mesa estará disponible {d}.', info_grace: 'La mantenemos {g} min desde la hora reservada: pasado ese tiempo la damos por no presentada.',
      full: 'Completo', wl_cta: 'No encuentro hora: avisadme si se libera una mesa', wl_h: 'Lista de espera',
      wl_intro: 'Déjanos tus datos y te escribiremos si se libera una mesa para {n} el {date}.', wl_time: 'Hora preferida', wl_any: 'Cualquier hora',
      wl_go: 'Apuntarme a la lista de espera', wl_ok: 'Listo, estás en la lista de espera. Te hemos enviado un email y te avisaremos si se libera una mesa.',
      wl_err: 'No hemos podido apuntarte. Revisa el nombre y el email.', wl_close: 'Cerrar', alt_h: 'Prueba con…', alt_days: 'Otros días con mesa', alt_space: 'Ese día sí hay mesa en {space}',
      alt_from: 'desde las {t}', alt_wait: 'Si prefieres este día, apúntate a la lista de espera.',
      card_h: 'Garantía con tarjeta', card_free: 'No se cobra nada ahora',
      card_note: 'Para confirmar la reserva te pediremos los datos de una tarjeta como garantía. Si no te presentas o anulas con menos de {h} h de antelación, se cobrarán {m} automáticamente a esa tarjeta.',
      card_consent: 'Autorizo a ROCE a cobrar automáticamente {m} a mi tarjeta si no me presento o anulo con menos de {h} h de antelación',
      go_card: 'Continuar y dar la tarjeta', e_card: 'Debes autorizar la garantía con tarjeta.', day_notice: 'Aviso'
    },
    en: {
      party: 'Guests', date: 'Date', time: 'Time', person: 'guest', people: 'guests',
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      dows: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      prev: 'Previous month', next: 'Next month', meal_lunch: 'Lunch', meal_dinner: 'Dinner', cal_closed: 'Closed', cal_full: 'Fully booked', cal_partial: 'A service is full or closed', cal_full_in: 'Fully booked: {n}', cal_closed_in: 'Closed: {n}',
      pick_date: 'Pick a day to see the available times.',
      loading: 'Looking for tables…', none: 'No tables left that day for {n}. Try another day or message us on {wa}.', wa_msg: 'Hi, I would like to book a table for {n} on {date}.',
      err_load: "We couldn't check the tables. Please try again in a moment.",
      day: 'Coffee, Bakery & Kitchen', night: 'Restaurant & Cocktails',
      deposit_h: '{m} deposit', deposit_free_until: 'Refunded if you cancel at least {h} h in advance.',
      free_h: 'Free booking',
      form_h: 'Your details', name: 'Full name', email: 'Email', phone: 'Phone', notes: 'Comments (optional)',
      consent: 'I accept the <a href="/privacidad.html" target="_blank" rel="noopener">privacy policy</a> and the <a href="/terminos.html" target="_blank" rel="noopener">terms</a>',
      marketing: 'I would like to receive news from ROCE (optional)',
      summary: '{date} · {time} · {party}',
      deposit_note: 'To confirm the booking we charge a {m} deposit by card. If you cancel at least {h} h in advance we refund it; otherwise we keep it. Nothing else is charged for your visit: it goes towards your bill.',
      go_free: 'Book table', go_pay: 'Pay {m} and book', working: 'One moment…',
      e_bad_data: 'Please check your name, email and phone.', e_consent: 'You must accept the privacy policy.',
      e_no_table: 'That table was just taken. Please choose another time.', e_too_late: 'That time no longer takes bookings. Choose another.',
      e_blocked: 'We cannot accept this booking. Please write to reservas@roce.es.',
      e_closed: "We're not taking bookings that day.", e_too_many: 'You have reached the maximum of 10 active bookings with this email.',
      e_network: "We couldn't complete the booking. Please try again.", e_pay: "We couldn't open the payment. Your table is held for a few minutes: press the button again.",
      night_tag: 'Over 18s only',
      allergies: 'Allergies or intolerances', al: { gluten: 'Gluten', lactosa: 'Dairy / lactose', 'frutos-secos': 'Tree nuts', cacahuetes: 'Peanuts', huevo: 'Egg', pescado: 'Fish', marisco: 'Crustaceans', moluscos: 'Molluscs', soja: 'Soy', sesamo: 'Sesame', apio: 'Celery', mostaza: 'Mustard', altramuz: 'Lupin', sulfitos: 'Sulphites', vegetariano: 'Vegetarian', vegano: 'Vegan', otras: 'Other' }, yes: 'Yes', no: 'No', al_hint: 'If it is something else, tell us in the comments.',
      info_dur: 'Your table will be available for {d}.', info_grace: 'We hold it for {g} min after the booked time: after that we treat it as a no-show.',
      full: 'Full', wl_cta: "Can't find a time: let me know if a table opens up", wl_h: 'Waiting list',
      wl_intro: 'Leave your details and we will write to you if a table opens up for {n} on {date}.', wl_time: 'Preferred time', wl_any: 'Any time',
      wl_go: 'Join the waiting list', wl_ok: 'Done, you are on the waiting list. We have emailed you and will let you know if a table opens up.',
      wl_err: "We couldn't add you. Please check your name and email.", wl_close: 'Close', alt_h: 'Try…', alt_days: 'Other days with tables', alt_space: 'That day there is a table at {space}',
      alt_from: 'from {t}', alt_wait: 'If you prefer this day, join the waiting list.',
      card_h: 'Card guarantee', card_free: 'Nothing is charged now',
      card_note: "To confirm the booking we will ask for your card details as a guarantee. If you don't show up or cancel less than {h} h in advance, {m} will be charged automatically to that card.",
      card_consent: "I authorise ROCE to automatically charge {m} to my card if I don't show up or cancel less than {h} h in advance",
      go_card: 'Continue and enter card', e_card: 'You must authorise the card guarantee.', day_notice: 'Notice'
    }
  };
  var MAX_PARTY = 8, DAYS_AHEAD = 60;

  var st = { cal: {}, calBusy: '', alt: null, wait: null, waitDone: false, grid: [], pr: '', notices: [], pending: '', party: 2, date: '', month: null, ambience: 'all', slots: null, loading: false, loadErr: false, chosen: null, busy: false, error: '' };

  function lang() { return window.ROCE_I18N && window.ROCE_I18N.getLang ? window.ROCE_I18N.getLang() : 'es'; }
  var WA_NUMBER = '34614073163'; // WhatsApp de ROCE (el mismo que el de grupos)
  function t(k, v) {
    var s = (STR[lang()] || STR.es)[k]; if (s == null) s = STR.es[k] || k;
    if (typeof s !== 'string') return s;
    if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); });
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(c) { return (c / 100).toLocaleString(lang() === 'en' ? 'en-GB' : 'es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: c % 100 ? 2 : 0 }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function todayStr() { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function partyLabel(n) { return n + ' ' + (n === 1 ? t('person') : t('people')); }
  function dateLabel(s) {
    return new Intl.DateTimeFormat(lang() === 'en' ? 'en-GB' : 'es-ES', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(s + 'T12:00:00Z'));
  }

  function rpc(name, body) {
    return fetch(B.url + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: B.anonKey, Authorization: 'Bearer ' + B.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().then(function (d) { if (!r.ok) { var e = new Error((d && (d.message || d.hint)) || 'network'); e.body = d; throw e; } return d; }); });
  }
  function fn(body) {
    return fetch(B.url + '/functions/v1/redsys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: B.anonKey, Authorization: 'Bearer ' + B.anonKey },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'network'); return d; }); });
  }

  // ─── Datos ──────────────────────────────────────────────────────────
  var seq = 0;
  function loadSlots() {
    st.chosen = null; st.error = ''; st.pending = '';
    if (!st.date) { st.slots = null; render(); return; }
    var my = ++seq; st.loading = true; st.loadErr = false; render();
    rpc('dining_day_notice', { p_date: st.date }).then(function (n) { if (my === seq) { st.notices = n || []; render(); } }).catch(function () { st.notices = []; });
    st.alt = null; st.wait = null; st.waitDone = false;
    rpc('dining_grid', { p_date: st.date, p_party: st.party, p_ambience: st.ambience === 'all' ? null : st.ambience })
      .then(function (rows) {
        if (my !== seq) return;
        st.grid = rows || []; st.slots = st.grid.filter(function (r) { return r.o_free; }); st.loading = false; render();
        if (!st.slots.length) loadAlt(my);
      })
      .catch(function () { if (my !== seq) return; st.grid = []; st.slots = []; st.loading = false; st.loadErr = true; render(); });
  }
  // Sin mesa ese día: otros días con hueco y, si miras un solo espacio, el otro espacio ese mismo día.
  function loadAlt(my) {
    var amb = st.ambience === 'all' ? null : st.ambience, other = amb ? (amb === 'day' ? 'night' : 'day') : null;
    var p1 = rpc('dining_next_days', { p_from: st.date, p_party: st.party, p_ambience: amb }).catch(function () { return []; });
    var p2 = other ? rpc('dining_slots', { p_date: st.date, p_party: st.party, p_ambience: other }).catch(function () { return []; }) : Promise.resolve([]);
    Promise.all([p1, p2]).then(function (r) {
      if (my !== seq) return;
      st.alt = { days: (r[0] || []).filter(function (d) { return d.o_date !== st.date; }), other: r[1] || [], otherAmb: other }; render();
    });
  }

  // ─── Pintado ────────────────────────────────────────────────────────
  // Estado de cada día del mes que se ve (cerrado / completo / algún turno completo); si la función aún no existe, el calendario se ve como siempre.
  function calKey() { var m = st.month || { y: 0, m: 0 }; return st.party + '|' + st.ambience + '|' + m.y + '-' + m.m; }
  function loadCal() {
    var m = st.month || (function () { var td = todayStr(); return { y: +td.slice(0, 4), m: +td.slice(5, 7) - 1 }; })();
    st.month = m;
    var key = calKey(); if (st.cal[key] || st.calBusy === key) return;
    st.calBusy = key;
    var from = ymd(m.y, m.m, 1), to = ymd(m.y, m.m, new Date(Date.UTC(m.y, m.m + 1, 0)).getUTCDate());
    rpc('dining_calendar', { p_from: from, p_to: to, p_party: st.party, p_ambience: st.ambience === 'all' ? null : st.ambience })
      .then(function (rows) { var o = {}; (rows || []).forEach(function (r) { o[r.o_date] = r; }); st.cal[key] = o; st.calBusy = ''; render(); })
      .catch(function () { st.cal[key] = {}; st.calBusy = ''; });
  }
  function calendarHtml() {
    var today = todayStr(), last = addDays(today, DAYS_AHEAD);
    var m = st.month || { y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 };
    st.month = m;
    var first = new Date(Date.UTC(m.y, m.m, 1)), startDow = (first.getUTCDay() + 6) % 7, dim = new Date(Date.UTC(m.y, m.m + 1, 0)).getUTCDate();
    var canPrev = ymd(m.y, m.m, 1) > today.slice(0, 8) + '01', canNext = ymd(m.y, m.m, dim) < last;
    var h = '<div class="mz-cal"><div class="mz-cal-head"><button type="button" class="mz-nav" data-nav="-1" aria-label="' + esc(t('prev')) + '"' + (canPrev ? '' : ' disabled') + '>&larr;</button>' +
      '<span class="mz-cal-title">' + esc(t('months')[m.m]) + ' ' + m.y + '</span>' +
      '<button type="button" class="mz-nav" data-nav="1" aria-label="' + esc(t('next')) + '"' + (canNext ? '' : ' disabled') + '>&rarr;</button></div><div class="mz-cal-grid">';
    t('dows').forEach(function (d) { h += '<span class="mz-dow">' + d + '</span>'; });
    for (var i = 0; i < startDow; i++) h += '<span></span>';
    for (var d = 1; d <= dim; d++) {
      var s = ymd(m.y, m.m, d), off = s < today || s > last, cs = (st.cal[calKey()] || {})[s], stt = cs ? cs.o_state : '';
      var tip = stt === 'closed' ? t('cal_closed') : stt === 'full' ? t('cal_full') : stt === 'partial' ? [(lang() === 'en' ? cs.o_full_en : cs.o_full_es) || [], (lang() === 'en' ? cs.o_closed_en : cs.o_closed_es) || []].map(function (l, i) { return l.length ? t(i ? 'cal_closed_in' : 'cal_full_in', { n: l.join(', ') }) : ''; }).filter(Boolean).join(' · ') : '';
      h += '<button type="button" class="mz-day' + (s === st.date ? ' is-on' : '') + (s === today ? ' is-today' : '') + (stt === 'closed' ? ' is-closed' : stt === 'full' ? ' is-full' : stt === 'partial' ? ' is-partial' : '') + '" data-date="' + s + '"' + (tip ? ' title="' + esc(tip) + '" aria-label="' + d + ' · ' + esc(tip) + '"' : '') + (off || stt === 'closed' ? ' disabled' : '') + '>' + d + '</button>';
    }
    var seen = st.cal[calKey()] || {}, kinds = {};
    Object.keys(seen).forEach(function (k) { kinds[seen[k].o_state] = 1; });
    var lg = (kinds.closed ? '<span class="mz-lg"><i class="mz-lg-c"></i>' + esc(t('cal_closed')) + '</span>' : '') + (kinds.full ? '<span class="mz-lg"><i class="mz-lg-f"></i>' + esc(t('cal_full')) + '</span>' : '') + (kinds.partial ? '<span class="mz-lg"><i class="mz-lg-p"></i>' + esc(t('cal_partial')) + '</span>' : '');
    return h + '</div>' + (lg ? '<div class="mz-legend">' + lg + '</div>' : '') + '</div>';
  }

  function noticeHtml() {
    return (st.notices || []).map(function (n) { return '<p class="mz-notice">' + esc(lang() === 'en' ? n.o_en : n.o_es) + '</p>'; }).join('');
  }
  function slotsHtml() {
    if (!st.date) return '<p class="mz-hint">' + esc(t('pick_date')) + '</p>';
    if (st.loading) return '<p class="mz-hint">' + esc(t('loading')) + '</p>';
    if (st.loadErr) return '<p class="mz-error">' + esc(t('err_load')) + '</p>';
    var h = '';
    if (!st.slots || !st.slots.length) {
      var waUrl = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(t('wa_msg', { n: partyLabel(st.party), date: dateLabel(st.date) }));
      h += '<p class="mz-hint">' + esc(t('none', { n: partyLabel(st.party), wa: '@@WA@@' })).replace('@@WA@@', '<a class="mz-wa" href="' + esc(waUrl) + '" target="_blank" rel="noopener">WhatsApp</a>') + '</p>';
    }
    var groups = {}, order = [];
    (st.grid || []).forEach(function (s) { if (!groups[s.o_ambience]) { groups[s.o_ambience] = []; order.push(s.o_ambience); } groups[s.o_ambience].push(s); });
    order.forEach(function (a) {
      var rows = groups[a], dep = rows[0].o_deposit_cents, hrs = rows[0].o_free_hours, mode = rows[0].o_payment_mode;
      if (!rows.some(function (r) { return r.o_free; }) && st.slots.length === 0 && order.length > 1) { /* se muestra igualmente para poder apuntarse */ }
      h += '<div class="mz-group"><div class="mz-group-h"><span class="mz-group-name">' + esc(t(a)) + '</span>' +
        (a === 'night' ? '<span class="mz-tag">+18</span>' : '') +
        '<span class="mz-group-note">' + (dep > 0 && mode === 'card' ? '' : dep > 0 ? esc(t('deposit_h', { m: money(dep) })) : esc(t('free_h'))) + '</span></div><div class="mz-slots">';
      // En Restaurant & Cocktails las horas se separan en Comida y Cena (cada turno tiene su cuadrícula).
      var svcs = []; rows.forEach(function (r) { if (svcs.indexOf(r.o_service) === -1) svcs.push(r.o_service); });
      var split = a === 'night';
      svcs.forEach(function (sv) {
        if (split) h += '</div><p class="mz-meal">' + esc(t(sv === 'night-lunch' ? 'meal_lunch' : 'meal_dinner')) + '</p><div class="mz-slots">';
        rows.filter(function (r) { return r.o_service === sv; }).forEach(function (s) {
          if (s.o_free) h += '<button type="button" class="mz-slot' + (st.chosen && st.chosen.o_starts_at === s.o_starts_at ? ' is-on' : '') + '" data-start="' + esc(s.o_starts_at) + '">' + esc(s.o_time) + '</button>';
          else h += '<button type="button" class="mz-slot is-full" data-wl="' + esc(s.o_time) + '" data-amb="' + esc(s.o_ambience) + '" title="' + esc(t('wl_cta')) + '"><span>' + esc(s.o_time) + '</span><small>' + esc(t('full')) + '</small></button>';
        });
      });
      h += '</div>' + (dep > 0 && mode === 'card' ? '' : dep > 0 ? '<p class="mz-note">' + esc(t('deposit_free_until', { h: hrs })) + '</p>' : '') + '</div>';
    });
    // Alternativas cuando no hay nada libre
    if (st.slots && !st.slots.length && st.alt) {
      var alt = '';
      if (st.alt.other && st.alt.other.length) {
        var o = st.alt.other, times = o.slice(0, 6).map(function (x) { return x.o_time; });
        alt += '<div class="mz-alt"><p class="mz-alt-h">' + esc(t('alt_space', { space: t(st.alt.otherAmb) })) + '</p><div class="mz-chips">' +
          '<button type="button" class="mz-chip mz-chip-wide" data-altamb="' + esc(st.alt.otherAmb) + '"><span>' + esc(t(st.alt.otherAmb)) + '</span><small>' + esc(times.join(' · ')) + '</small></button></div></div>';
      }
      if (st.alt.days && st.alt.days.length) {
        alt += '<div class="mz-alt"><p class="mz-alt-h">' + esc(t('alt_days')) + '</p><div class="mz-chips">' + st.alt.days.map(function (d) {
          var lbl = new Intl.DateTimeFormat(lang() === 'en' ? 'en-GB' : 'es-ES', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d.o_date + 'T12:00:00Z'));
          return '<button type="button" class="mz-chip" data-altdate="' + esc(d.o_date) + '"><span>' + esc(lbl) + '</span><small>' + esc(t('alt_from', { t: d.o_first })) + '</small></button>';
        }).join('') + '</div></div>';
      }
      h += alt;
    }
    // Lista de espera
    if (st.grid && st.grid.length) h += '<p class="mz-wl-cta"><button type="button" class="mz-link" data-wl="">' + esc(t('wl_cta')) + '</button></p>';
    if (st.waitDone) h += '<p class="mz-ok">' + esc(t('wl_ok')) + '</p>';
    else if (st.wait) h += waitFormHtml();
    return h;
  }

  function waitFormHtml() {
    var w = st.wait;
    var times = ['', '13:00', '14:00', '15:00', '20:00', '21:00', '22:00', '23:00'];
    return '<form class="mz-form mz-wait" id="mzWait" novalidate><h3 class="mz-h">' + esc(t('wl_h')) + '</h3>' +
      '<p class="mz-summary">' + esc(t('wl_intro', { n: partyLabel(st.party), date: dateLabel(st.date) })) + '</p>' +
      '<label class="mz-sel"><span>' + esc(t('wl_time')) + '</span><select name="time">' + times.map(function (x) { return '<option value="' + x + '"' + (x === (w.time || '') ? ' selected' : '') + '>' + (x || esc(t('wl_any'))) + '</option>'; }).join('') +
      (w.time && times.indexOf(w.time) === -1 ? '<option value="' + esc(w.time) + '" selected>' + esc(w.time) + '</option>' : '') + '</select></label>' +
      '<input class="mz-input" name="name" type="text" autocomplete="name" placeholder="' + esc(t('name')) + '" value="' + esc(st.f_name || '') + '" required>' +
      '<input class="mz-input" name="email" type="email" autocomplete="email" inputmode="email" placeholder="' + esc(t('email')) + '" value="' + esc(st.f_email || '') + '" required>' +
      '<input class="mz-input" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="' + esc(t('phone')) + '" value="' + esc(st.f_phone || '') + '">' +
      '<label class="mz-check"><input type="checkbox" name="consent"><span>' + t('consent') + '</span></label>' +
      '<p class="mz-error" id="mzWaitErr"' + (st.error ? '' : ' hidden') + '>' + esc(st.error) + '</p>' +
      '<button type="submit" class="mz-go" id="mzWaitGo">' + esc(t('wl_go')) + '</button></form>';
  }

  function fmtDur(m) { var h = Math.floor(m / 60), r = m % 60; return (h ? h + ' h' : '') + (h && r ? ' ' : '') + (r ? r + ' min' : ''); }
  function infoHtml(c) {
    if (!c.o_duration) return '';
    var end = lang() === 'en' ? c.o_end_en : c.o_end_es;
    return '<p class="mz-info">' + esc(t('info_dur', { d: fmtDur(c.o_duration) })) + ' ' + esc(t('info_grace', { g: c.o_grace || 15 })) + (end ? ' ' + esc(end) : '') + '</p>';
  }
  function formHtml() {
    var c = st.chosen; if (!c) return '';
    var dep = c.o_deposit_cents, hrs = c.o_free_hours, card = c.o_payment_mode === 'card' && dep > 0;
    var sum = t('summary', { date: dateLabel(st.date), time: c.o_time, party: partyLabel(st.party) });
    var keep = (document.getElementById('mzForm') ? {} : {});
    return '<form class="mz-form" id="mzForm" novalidate><h3 class="mz-h">' + esc(t('form_h')) + '</h3>' +
      '<p class="mz-summary">' + esc(sum) + ' · ' + esc(t(c.o_ambience)) + '</p>' +
      '<input class="mz-input" name="name" type="text" autocomplete="name" placeholder="' + esc(t('name')) + '" value="' + esc(st.f_name || '') + '" required>' +
      '<input class="mz-input" name="email" type="email" autocomplete="email" inputmode="email" placeholder="' + esc(t('email')) + '" value="' + esc(st.f_email || '') + '" required>' +
      '<input class="mz-input" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="' + esc(t('phone')) + '" value="' + esc(st.f_phone || '') + '" required>' +
      '<div class="mz-allergies"><span class="mz-label">' + esc(t('allergies')) + '</span>' +
        '<div class="mz-yn"><button type="button" class="mz-yn-b' + (st.f_alyes ? ' is-on' : '') + '" data-alyes="1" aria-pressed="' + (st.f_alyes ? 'true' : 'false') + '">' + esc(t('yes')) + '</button>' +
        '<button type="button" class="mz-yn-b' + (st.f_alyes ? '' : ' is-on') + '" data-alyes="0" aria-pressed="' + (st.f_alyes ? 'false' : 'true') + '">' + esc(t('no')) + '</button></div>' +
        '<div class="mz-al-wrap"' + (st.f_alyes ? '' : ' hidden') + '><div class="mz-al-list">' + Object.keys(t('al')).map(function (k) {
          return '<label class="mz-al"><input type="checkbox" name="al" value="' + k + '"' + ((st.f_al || []).indexOf(k) !== -1 ? ' checked' : '') + '><span>' + esc(t('al')[k]) + '</span></label>';
        }).join('') + '</div><p class="mz-al-hint">' + esc(t('al_hint')) + '</p></div></div>' +
      '<textarea class="mz-input" name="notes" rows="1" placeholder="' + esc(t('notes')) + '">' + esc(st.f_notes || '') + '</textarea>' +
      infoHtml(c) +
      (dep > 0 ? '<p class="mz-deposit">' + esc(card ? t('card_note', { m: money(dep), h: hrs }) : t('deposit_note', { m: money(dep), h: hrs })) + '</p>' : '') +
      (card ? '<label class="mz-check"><input type="checkbox" name="cardok"' + (st.f_cardok ? ' checked' : '') + '><span>' + esc(t('card_consent', { m: money(dep), h: hrs })) + '</span></label>' : '') +
      '<label class="mz-check"><input type="checkbox" name="consent"' + (st.f_consent ? ' checked' : '') + '><span>' + t('consent') + '</span></label>' +
      '<label class="mz-check"><input type="checkbox" name="marketing"' + (st.f_marketing ? ' checked' : '') + '><span>' + esc(t('marketing')) + '</span></label>' +
      '<p class="mz-error" id="mzError"' + (st.error ? '' : ' hidden') + '>' + esc(st.error) + '</p>' +
      '<button type="submit" class="mz-go" id="mzGo"' + (st.busy ? ' disabled' : '') + '>' + esc(st.busy ? t('working') : (card ? t('go_card') : dep > 0 ? t('go_pay', { m: money(dep) }) : t('go_free'))) + '</button></form>';
  }

  function render() {
    var p = '<div class="mz-step mz-step-party"><span class="mz-label">' + esc(t('party')) + '</span><div class="mz-stepper">' +
      '<button type="button" class="mz-pm" data-party="-1" aria-label="-"' + (st.party <= 1 ? ' disabled' : '') + '>&minus;</button>' +
      '<span class="mz-party" aria-live="polite">' + st.party + '</span>' +
      '<button type="button" class="mz-pm' + (st.party >= MAX_PARTY ? ' is-max' : '') + '" data-party="1" aria-label="+">+</button></div></div>';
    var keepScroll = window.scrollY;
    root.innerHTML = p +
      '<div class="mz-step"><span class="mz-label">' + esc(t('date')) + '</span>' + calendarHtml() + '</div>' +
      '<div class="mz-step"><span class="mz-label">' + esc(t('time')) + '</span>' + (st.date ? noticeHtml() : '') + slotsHtml() + '</div>' + formHtml();
    if (Math.abs(window.scrollY - keepScroll) > 1) window.scrollTo(0, keepScroll);
    loadCal();
  }

  function keepForm() {
    var f = document.getElementById('mzForm'); if (!f) return;
    st.f_name = f.elements.name.value; st.f_email = f.elements.email.value; st.f_phone = f.elements.phone.value;
    st.f_notes = f.elements.notes.value; st.f_consent = f.elements.consent.checked; st.f_marketing = f.elements.marketing.checked; st.f_cardok = !!(f.elements.cardok && f.elements.cardok.checked);
    st.f_al = [].map.call(f.querySelectorAll('input[name="al"]:checked'), function (i) { return i.value; });
  }

  // ─── Eventos ────────────────────────────────────────────────────────
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.alyes != null) {
      st.f_alyes = b.dataset.alyes === '1';
      var fm = b.closest('.mz-allergies');
      [].forEach.call(fm.querySelectorAll('.mz-yn-b'), function (x) { var on = (x.dataset.alyes === '1') === st.f_alyes; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      fm.querySelector('.mz-al-wrap').hidden = !st.f_alyes;
      return;
    }
    if (b.dataset.party) {
      // Más de 8 personas no se reserva por la web: se hace vibrar el aviso de grupos para que lo vean.
      if (+b.dataset.party > 0 && st.party >= MAX_PARTY) { nudgeGroups(); return; }
      keepForm(); st.party = Math.min(MAX_PARTY, Math.max(1, st.party + (+b.dataset.party))); loadSlots();
    } else if (b.dataset.nav) {
      var m = st.month, n = new Date(Date.UTC(m.y, m.m + (+b.dataset.nav), 1)); st.month = { y: n.getUTCFullYear(), m: n.getUTCMonth() }; render();
    } else if (b.dataset.date) {
      keepForm(); st.date = b.dataset.date; loadSlots();
    } else if (b.dataset.wl != null && b.dataset.wl !== undefined && (b.hasAttribute('data-wl'))) {
      keepForm(); st.wait = { time: b.dataset.wl || '', amb: b.dataset.amb || (st.ambience === 'all' ? '' : st.ambience) }; st.waitDone = false; st.error = ''; st.chosen = null; render();
      var wf = document.getElementById('mzWait'); if (wf) wf.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (b.dataset.altdate) {
      keepForm(); st.date = b.dataset.altdate; var dd = new Date(st.date + 'T12:00:00Z'); st.month = { y: dd.getUTCFullYear(), m: dd.getUTCMonth() }; loadSlots();
    } else if (b.dataset.altamb) {
      document.dispatchEvent(new CustomEvent('mesas:ambience', { detail: b.dataset.altamb }));
    } else if (b.dataset.start) {
      keepForm(); st.pending = '';
      var row = (st.slots || []).filter(function (s) { return s.o_starts_at === b.dataset.start; })[0]; if (!row) return;
      var choose = function () {
        st.chosen = row; st.error = ''; render();
        var f = document.getElementById('mzForm'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      if (row.o_ambience === 'night' && window.ROCE_AGE) window.ROCE_AGE.ask(choose, function () { setAmbience('day'); });
      else choose();
    }
  });

  root.addEventListener('submit', function (e) {
    if (e.target.id === 'mzWait') {
      e.preventDefault();
      var f = e.target, name = f.elements.name.value.trim(), email = f.elements.email.value.trim(), phone = f.elements.phone.value.trim();
      st.f_name = name; st.f_email = email; st.f_phone = phone;
      var err = document.getElementById('mzWaitErr'), bad = function (k) { st.error = t(k); err.textContent = st.error; err.hidden = false; };
      if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return bad('wl_err');
      if (!f.elements.consent.checked) return bad('e_consent');
      document.getElementById('mzWaitGo').disabled = true;
      rpc('waitlist_join', { p_date: st.date, p_ambience: st.wait.amb || null, p_time: f.elements.time.value, p_party: st.party, p_name: name, p_email: email, p_phone: phone, p_notes: '', p_lang: lang() })
        .then(function () { st.wait = null; st.waitDone = true; st.error = ''; render(); })
        .catch(function () { document.getElementById('mzWaitGo').disabled = false; bad('wl_err'); });
      return;
    }
    if (e.target.id !== 'mzForm') return;
    e.preventDefault(); keepForm();
    var c = st.chosen; if (!c || st.busy) return;
    var show = function (k) { st.error = t(k); var el = document.getElementById('mzError'); if (el) { el.textContent = st.error; el.hidden = false; } };
    if (st.f_name.trim().length < 3 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(st.f_email.trim()) || st.f_phone.replace(/\D/g, '').length < 9) return show('e_bad_data');
    if (!st.f_consent) return show('e_consent');
    if (c.o_payment_mode === 'card' && c.o_deposit_cents > 0 && !st.f_cardok) return show('e_card');
    st.busy = true; st.error = ''; render();
    // Si el pago falló después de crear la reserva, se reintenta el pago de esa misma reserva (no se crea otra).
    var go = st.pending ? Promise.resolve({ o_status: 'pending', o_token: st.pending }) : rpc('book_table', {
      p_service: c.o_service, p_starts: c.o_starts_at, p_zone: c.o_zone, p_party: st.party,
      p_name: st.f_name.trim(), p_email: st.f_email.trim(), p_phone: st.f_phone.trim(), p_notes: (st.f_notes || '').trim(),
      p_lang: lang(), p_marketing: !!st.f_marketing, p_prescriber: st.pr || '', p_allergies: st.f_alyes ? (st.f_al || []) : []
    }).then(function (d) { return Array.isArray(d) ? d[0] : d; });
    go.then(function (row) {
      if (row.o_status === 'confirmed') { location.href = '/reserva/?t=' + encodeURIComponent(row.o_token) + '&new=1'; return; }
      st.pending = row.o_token;
      return fn({ action: 'pay_table', token: row.o_token, lang: lang(), return_base: location.origin }).then(function (p) {
        var f = document.createElement('form');
        f.method = 'POST'; f.action = p.url; f.style.display = 'none';
        ['Ds_SignatureVersion', 'Ds_MerchantParameters', 'Ds_Signature'].forEach(function (k) {
          var i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = p[k]; f.appendChild(i);
        });
        document.body.appendChild(f); f.submit();
      }).catch(function () { st.busy = false; st.error = t('e_pay'); render(); });
    }).catch(function (err) {
      st.busy = false;
      var m = String(err && err.message || '');
      var code = ['no_table', 'too_late', 'closed', 'too_many', 'bad_data', 'bad_slot', 'blocked'].filter(function (x) { return m.indexOf(x) !== -1; })[0];
      var key = code === 'bad_slot' ? 'e_too_late' : code ? 'e_' + code : 'e_network';
      if (code === 'no_table' || code === 'too_late' || code === 'bad_slot') { loadSlots(); }
      st.error = t(key); render();
    });
  });

  function nudgeGroups() {
    var el = document.getElementById('groupNotice'); if (!el) return;
    var r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > window.innerHeight) window.scrollTo({ top: window.scrollY + r.top - 110, behavior: 'smooth' });
    el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake');
    if (navigator.vibrate) { try { navigator.vibrate([60, 40, 60]); } catch (x) {} }
    clearTimeout(nudgeGroups.t); nudgeGroups.t = setTimeout(function () { el.classList.remove('is-shake'); }, 1800);
  }
  function setAmbience(a) {
    if (a !== 'day' && a !== 'night') a = 'all';
    if (st.ambience === a) return;
    st.ambience = a; if (st.date) loadSlots(); else render();
  }

  window.ROCE_MESAS = { setAmbience: setAmbience };
  // Enlaces: ?d=2026-12-24 (día), ?p=4 (personas) y ?pr=codigo (prescriptor que trae la reserva).
  try {
    var qp = new URLSearchParams(location.search);
    if (/^[a-z0-9-]{2,30}$/.test(qp.get('pr') || '')) { st.pr = qp.get('pr'); try { sessionStorage.setItem('roce_pr', st.pr); } catch (x) {} }
    else { try { st.pr = sessionStorage.getItem('roce_pr') || ''; } catch (x) {} }
    var qd = qp.get('d'), qn = parseInt(qp.get('p') || '', 10);
    if (qn >= 1 && qn <= MAX_PARTY) st.party = qn;
    if (/^\d{4}-\d{2}-\d{2}$/.test(qd || '') && qd >= todayStr() && qd <= addDays(todayStr(), DAYS_AHEAD)) {
      st.date = qd; var qdd = new Date(qd + 'T12:00:00Z'); st.month = { y: qdd.getUTCFullYear(), m: qdd.getUTCMonth() };
      setTimeout(loadSlots, 0);
    }
  } catch (x) {}
  document.addEventListener('roce:lang', function () { keepForm(); render(); });
  render();
  // Hasta dónde se puede reservar lo decide la configuración (días vista de los turnos), no un número fijo en la web.
  rpc('dining_horizon', {}).then(function (n) { n = parseInt(n, 10); if (n >= 1 && n <= 400 && n !== DAYS_AHEAD) { DAYS_AHEAD = n; st.cal = {}; render(); } }).catch(function () {});
})();
