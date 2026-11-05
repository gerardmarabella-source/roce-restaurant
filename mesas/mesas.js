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
      prev: 'Mes anterior', next: 'Mes siguiente',
      pick_date: 'Elige un día para ver las horas disponibles.',
      loading: 'Buscando mesas…', none: 'No quedan mesas ese día para {n}. Prueba otro día o escríbenos por WhatsApp.',
      err_load: 'No hemos podido consultar las mesas. Inténtalo de nuevo en un momento.',
      day: 'Day', night: 'Night',
      deposit_h: 'Fianza de {m}', deposit_free_until: 'Se devuelve si cancelas con al menos {h} h de antelación.',
      free_h: 'Reserva gratuita',
      form_h: 'Tus datos', name: 'Nombre y apellidos', email: 'Email', phone: 'Teléfono', notes: 'Alergias o comentarios (opcional)',
      consent: 'Acepto la <a href="/privacidad.html" target="_blank" rel="noopener">política de privacidad</a> y los <a href="/terminos.html" target="_blank" rel="noopener">términos</a>',
      marketing: 'Quiero recibir novedades de ROCE (opcional)',
      summary: '{date} · {time} · {party}',
      deposit_note: 'Para confirmar la reserva se cobra una fianza de {m} con tarjeta. Si cancelas con al menos {h} h de antelación te la devolvemos; si no, la retenemos. Con tu visita no se cobra nada más: es a cuenta de la consumición.',
      go_free: 'Reservar mesa', go_pay: 'Pagar {m} y reservar', working: 'Un momento…',
      e_bad_data: 'Revisa el nombre, el email y el teléfono.', e_consent: 'Debes aceptar la política de privacidad.',
      e_no_table: 'Esa mesa se acaba de ocupar. Elige otra hora.', e_too_late: 'Esa hora ya no admite reservas. Elige otra.',
      e_closed: 'Ese día no abrimos para reservas.', e_too_many: 'Ya tienes varias reservas activas con este email.',
      e_network: 'No hemos podido completar la reserva. Inténtalo de nuevo.', e_pay: 'No hemos podido abrir el pago. Tu mesa queda retenida unos minutos: vuelve a pulsar el botón.',
      night_tag: 'Solo mayores de 18 años',
      card_h: 'Garantía con tarjeta', card_free: 'No se cobra nada ahora',
      card_note: 'Para confirmar la reserva te pediremos los datos de una tarjeta como garantía. No se cobra nada ahora. Si no te presentas o anulas con menos de {h} h de antelación, cobraremos {m}.',
      card_consent: 'Autorizo a ROCE a cobrar {m} a mi tarjeta si no me presento o anulo con menos de {h} h de antelación',
      go_card: 'Continuar y dar la tarjeta', e_card: 'Debes autorizar la garantía con tarjeta.', day_notice: 'Aviso'
    },
    en: {
      party: 'Guests', date: 'Date', time: 'Time', person: 'guest', people: 'guests',
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      dows: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      prev: 'Previous month', next: 'Next month',
      pick_date: 'Pick a day to see the available times.',
      loading: 'Looking for tables…', none: 'No tables left that day for {n}. Try another day or message us on WhatsApp.',
      err_load: "We couldn't check the tables. Please try again in a moment.",
      day: 'Day', night: 'Night',
      deposit_h: '{m} deposit', deposit_free_until: 'Refunded if you cancel at least {h} h in advance.',
      free_h: 'Free booking',
      form_h: 'Your details', name: 'Full name', email: 'Email', phone: 'Phone', notes: 'Allergies or comments (optional)',
      consent: 'I accept the <a href="/privacidad.html" target="_blank" rel="noopener">privacy policy</a> and the <a href="/terminos.html" target="_blank" rel="noopener">terms</a>',
      marketing: 'I would like to receive news from ROCE (optional)',
      summary: '{date} · {time} · {party}',
      deposit_note: 'To confirm the booking we charge a {m} deposit by card. If you cancel at least {h} h in advance we refund it; otherwise we keep it. Nothing else is charged for your visit: it goes towards your bill.',
      go_free: 'Book table', go_pay: 'Pay {m} and book', working: 'One moment…',
      e_bad_data: 'Please check your name, email and phone.', e_consent: 'You must accept the privacy policy.',
      e_no_table: 'That table was just taken. Please choose another time.', e_too_late: 'That time no longer takes bookings. Choose another.',
      e_closed: "We're not taking bookings that day.", e_too_many: 'You already have several active bookings with this email.',
      e_network: "We couldn't complete the booking. Please try again.", e_pay: "We couldn't open the payment. Your table is held for a few minutes: press the button again.",
      night_tag: 'Over 18s only',
      card_h: 'Card guarantee', card_free: 'Nothing is charged now',
      card_note: "To confirm the booking we will ask for your card details as a guarantee. Nothing is charged now. If you don't show up or cancel less than {h} h in advance, we will charge {m}.",
      card_consent: "I authorise ROCE to charge {m} to my card if I don't show up or cancel less than {h} h in advance",
      go_card: 'Continue and enter card', e_card: 'You must authorise the card guarantee.', day_notice: 'Notice'
    }
  };
  var MAX_PARTY = 8, DAYS_AHEAD = 60;

  var st = { notices: [], pending: '', party: 2, date: '', month: null, ambience: 'all', slots: null, loading: false, loadErr: false, chosen: null, busy: false, error: '' };

  function lang() { return window.ROCE_I18N && window.ROCE_I18N.getLang ? window.ROCE_I18N.getLang() : 'es'; }
  function t(k, v) {
    var s = (STR[lang()] || STR.es)[k]; if (s == null) s = STR.es[k] || k;
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
    rpc('dining_slots', { p_date: st.date, p_party: st.party, p_ambience: st.ambience === 'all' ? null : st.ambience })
      .then(function (rows) { if (my !== seq) return; st.slots = rows || []; st.loading = false; render(); })
      .catch(function () { if (my !== seq) return; st.slots = []; st.loading = false; st.loadErr = true; render(); });
  }

  // ─── Pintado ────────────────────────────────────────────────────────
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
      var s = ymd(m.y, m.m, d), off = s < today || s > last;
      h += '<button type="button" class="mz-day' + (s === st.date ? ' is-on' : '') + (s === today ? ' is-today' : '') + '" data-date="' + s + '"' + (off ? ' disabled' : '') + '>' + d + '</button>';
    }
    return h + '</div></div>';
  }

  function noticeHtml() {
    return (st.notices || []).map(function (n) { return '<p class="mz-notice">' + esc(lang() === 'en' ? n.o_en : n.o_es) + '</p>'; }).join('');
  }
  function slotsHtml() {
    if (!st.date) return '<p class="mz-hint">' + esc(t('pick_date')) + '</p>';
    if (st.loading) return '<p class="mz-hint">' + esc(t('loading')) + '</p>';
    if (st.loadErr) return '<p class="mz-error">' + esc(t('err_load')) + '</p>';
    if (!st.slots || !st.slots.length) return '<p class="mz-hint">' + esc(t('none', { n: partyLabel(st.party) })) + '</p>';
    var groups = {}, order = [];
    st.slots.forEach(function (s) { if (!groups[s.o_ambience]) { groups[s.o_ambience] = []; order.push(s.o_ambience); } groups[s.o_ambience].push(s); });
    var h = '';
    order.forEach(function (a) {
      var rows = groups[a], dep = rows[0].o_deposit_cents, hrs = rows[0].o_free_hours, mode = rows[0].o_payment_mode;
      h += '<div class="mz-group"><div class="mz-group-h"><span class="mz-group-name">' + esc(t(a)) + '</span>' +
        (a === 'night' ? '<span class="mz-tag">+18</span>' : '') +
        '<span class="mz-group-note">' + (dep > 0 && mode === 'card' ? esc(t('card_free')) : dep > 0 ? esc(t('deposit_h', { m: money(dep) })) : esc(t('free_h'))) + '</span></div><div class="mz-slots">';
      rows.forEach(function (s) {
        h += '<button type="button" class="mz-slot' + (st.chosen && st.chosen.o_starts_at === s.o_starts_at ? ' is-on' : '') + '" data-start="' + esc(s.o_starts_at) + '">' + esc(s.o_time) + '</button>';
      });
      h += '</div>' + (dep > 0 && mode === 'card' ? '<p class="mz-note">' + esc(t('card_note', { m: money(dep), h: hrs })) + '</p>' : dep > 0 ? '<p class="mz-note">' + esc(t('deposit_free_until', { h: hrs })) + '</p>' : '') + '</div>';
    });
    return h;
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
      '<textarea class="mz-input" name="notes" rows="1" placeholder="' + esc(t('notes')) + '">' + esc(st.f_notes || '') + '</textarea>' +
      (dep > 0 ? '<p class="mz-deposit">' + esc(card ? t('card_note', { m: money(dep), h: hrs }) : t('deposit_note', { m: money(dep), h: hrs })) + '</p>' : '') +
      (card ? '<label class="mz-check"><input type="checkbox" name="cardok"' + (st.f_cardok ? ' checked' : '') + '><span>' + esc(t('card_consent', { m: money(dep), h: hrs })) + '</span></label>' : '') +
      '<label class="mz-check"><input type="checkbox" name="consent"' + (st.f_consent ? ' checked' : '') + '><span>' + t('consent') + '</span></label>' +
      '<label class="mz-check"><input type="checkbox" name="marketing"' + (st.f_marketing ? ' checked' : '') + '><span>' + esc(t('marketing')) + '</span></label>' +
      '<p class="mz-error" id="mzError"' + (st.error ? '' : ' hidden') + '>' + esc(st.error) + '</p>' +
      '<button type="submit" class="mz-go" id="mzGo"' + (st.busy ? ' disabled' : '') + '>' + esc(st.busy ? t('working') : (card ? t('go_card') : dep > 0 ? t('go_pay', { m: money(dep) }) : t('go_free'))) + '</button></form>';
  }

  function render() {
    var p = '<div class="mz-step"><span class="mz-label">' + esc(t('party')) + '</span><div class="mz-stepper">' +
      '<button type="button" class="mz-pm" data-party="-1" aria-label="-"' + (st.party <= 1 ? ' disabled' : '') + '>&minus;</button>' +
      '<span class="mz-party" aria-live="polite">' + st.party + '</span>' +
      '<button type="button" class="mz-pm" data-party="1" aria-label="+"' + (st.party >= MAX_PARTY ? ' disabled' : '') + '>+</button></div></div>';
    var keepScroll = window.scrollY;
    root.innerHTML = p +
      '<div class="mz-step"><span class="mz-label">' + esc(t('date')) + '</span>' + calendarHtml() + '</div>' +
      '<div class="mz-step"><span class="mz-label">' + esc(t('time')) + '</span>' + (st.date ? noticeHtml() : '') + slotsHtml() + '</div>' + formHtml();
    if (Math.abs(window.scrollY - keepScroll) > 1) window.scrollTo(0, keepScroll);
  }

  function keepForm() {
    var f = document.getElementById('mzForm'); if (!f) return;
    st.f_name = f.elements.name.value; st.f_email = f.elements.email.value; st.f_phone = f.elements.phone.value;
    st.f_notes = f.elements.notes.value; st.f_consent = f.elements.consent.checked; st.f_marketing = f.elements.marketing.checked; st.f_cardok = !!(f.elements.cardok && f.elements.cardok.checked);
  }

  // ─── Eventos ────────────────────────────────────────────────────────
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.party) {
      keepForm(); st.party = Math.min(MAX_PARTY, Math.max(1, st.party + (+b.dataset.party))); loadSlots();
    } else if (b.dataset.nav) {
      var m = st.month, n = new Date(Date.UTC(m.y, m.m + (+b.dataset.nav), 1)); st.month = { y: n.getUTCFullYear(), m: n.getUTCMonth() }; render();
    } else if (b.dataset.date) {
      keepForm(); st.date = b.dataset.date; loadSlots();
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
      p_lang: lang(), p_marketing: !!st.f_marketing
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
      var code = ['no_table', 'too_late', 'closed', 'too_many', 'bad_data', 'bad_slot'].filter(function (x) { return m.indexOf(x) !== -1; })[0];
      var key = code === 'bad_slot' ? 'e_too_late' : code ? 'e_' + code : 'e_network';
      if (code === 'no_table' || code === 'too_late' || code === 'bad_slot') { loadSlots(); }
      st.error = t(key); render();
    });
  });

  function setAmbience(a) {
    if (a !== 'day' && a !== 'night') a = 'all';
    if (st.ambience === a) return;
    st.ambience = a; if (st.date) loadSlots(); else render();
  }

  window.ROCE_MESAS = { setAmbience: setAmbience };
  document.addEventListener('roce:lang', function () { keepForm(); render(); });
  render();
})();
