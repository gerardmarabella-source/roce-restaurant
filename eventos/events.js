// Agenda de eventos de ROCE: una sola fuente para la lista (/eventos/) y para
// la compra de entradas (/eventos/entradas/).
//
// Con el panel conectado (eventos/config.js) los eventos salen de la base de
// datos; si no, se usan los de ejemplo de abajo. Las páginas esperan a
// ROCE_EVENTS_READY (una promesa con la lista) antes de pintar.
//
// Forma de cada evento:
//   id, env ('day'|'night'), date (AAAA-MM-DD) y time (HH:MM) en hora de Valencia,
//   duration_h, price_cents (0 = gratis), left (plazas libres), max_per_order,
//   place/title/desc/price → { es, en }
(function () {
  var TZ = 'Europe/Madrid';
  var cfg = window.ROCE_BACKEND || {};
  var backend = !!(cfg.url && cfg.anonKey);

  // Datos de ejemplo — solo se usan si el panel no está conectado.
  var SAMPLE = [
    {
      id: 'brunch-vinilos', env: 'day', date: '2026-12-12', time: '11:00', duration_h: 4, price_cents: 0, left: 40, max_per_order: 6,
      place: { es: 'Planta baja', en: 'Ground floor' },
      title: { es: 'Brunch con vinilos', en: 'Brunch with vinyl' },
      desc: { es: 'Sábado de brunch con una selección de vinilos de la casa y café de especialidad.', en: 'Saturday brunch with a selection of house vinyl and specialty coffee.' },
      price: { es: 'Entrada libre', en: 'Free entry' }
    },
    {
      id: 'taller-cafe', env: 'day', date: '2026-12-13', time: '12:00', duration_h: 2, price_cents: 2500, left: 12, max_per_order: 4,
      place: { es: 'Planta baja · aforo 12', en: 'Ground floor · 12 seats' },
      title: { es: 'Taller de café de especialidad', en: 'Specialty coffee workshop' },
      desc: { es: 'Cata guiada y práctica de métodos de filtrado con nuestro equipo de barra.', en: 'Guided tasting and hands-on brewing methods with our bar team.' },
      price: { es: '25 € por persona', en: '€25 per person' }
    },
    {
      id: 'noche-jazz', env: 'night', date: '2026-12-17', time: '21:30', duration_h: 3, price_cents: 0, left: 30, max_per_order: 6,
      place: { es: 'Primera planta', en: 'First floor' },
      title: { es: 'Noche de jazz', en: 'Jazz night' },
      desc: { es: 'Trío en directo entre plato y plato: jazz de toda la vida, sin manteles ni silencio.', en: 'A live trio between courses: classic jazz, no tablecloths, no hushed silence.' },
      price: { es: 'Libre con consumición', en: 'Free with a drink' }
    },
    {
      id: 'dj-primera-planta', env: 'night', date: '2026-12-18', time: '22:30', duration_h: 4, price_cents: 1000, left: 50, max_per_order: 6,
      place: { es: 'Primera planta', en: 'First floor' },
      title: { es: 'DJ set en la primera planta', en: 'DJ set upstairs' },
      desc: { es: 'La barra abierta hasta tarde y un DJ invitado. Aforo reducido.', en: 'The bar stays open late with a guest DJ. Limited capacity.' },
      price: { es: '10 € · incluye primera copa', en: '€10 · includes first drink' }
    },
    {
      id: 'cena-maridaje', env: 'night', date: '2026-12-19', time: '21:00', duration_h: 3, price_cents: 5500, left: 4, max_per_order: 4,
      place: { es: 'Primera planta', en: 'First floor' },
      title: { es: 'Cena maridaje: vinos de autor', en: 'Pairing dinner: author wines' },
      desc: { es: 'Menú degustación de cinco platos maridado con vinos de pequeños productores.', en: 'Five-course tasting menu paired with wines from small producers.' },
      price: { es: '55 € por persona', en: '€55 per person' }
    }
  ];

  function money(cents, lang) {
    return (cents / 100).toLocaleString(lang === 'en' ? 'en-GB' : 'es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 });
  }

  // Fila de la vista events_public → evento de la web.
  function fromRow(r) {
    var d = new Date(r.starts_at);
    var parts = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
    function label(es, en) {
      if (es || en) return { es: es || en, en: en || es };
      if (r.price_cents === 0) return { es: 'Entrada libre', en: 'Free entry' };
      return { es: money(r.price_cents, 'es') + ' por persona', en: money(r.price_cents, 'en') + ' per person' };
    }
    return {
      id: r.id, env: r.env, starts_at: r.starts_at, image: r.image_url || '',
      date: parts.year + '-' + parts.month + '-' + parts.day, time: parts.hour + ':' + parts.minute,
      duration_h: Number(r.duration_h), price_cents: r.price_cents, left: r.spots_left, max_per_order: r.max_per_order,
      place: { es: r.place_es, en: r.place_en || r.place_es },
      title: { es: r.title_es, en: r.title_en || r.title_es },
      desc: { es: r.desc_es, en: r.desc_en || r.desc_es },
      price: label(r.price_label_es, r.price_label_en)
    };
  }

  var list = [];
  var ready;
  if (backend) {
    ready = fetch(cfg.url + '/rest/v1/events_public?select=*&order=starts_at.asc', {
      headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey }
    }).then(function (r) { if (!r.ok) throw new Error('events ' + r.status); return r.json(); })
      .then(function (rows) { list = rows.map(fromRow); return list; })
      .catch(function () { list = []; window.ROCE_EVENTS_ERROR = true; return list; });
  } else {
    list = SAMPLE;
    ready = Promise.resolve(list);
  }

  window.ROCE_EVENTS_READY = ready;
  window.ROCE_EVENT_UTIL = {
    backend: backend,
    find: function (id) { return list.filter(function (e) { return e.id === id; })[0] || null; },
    today: function () { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); },
    // Mediodía de Valencia de la fecha del evento (solo para formatear el día).
    day: function (e) { return new Date(e.date + 'T12:00:00+01:00'); },
    fmt: function (e, lang, opts) { return new Intl.DateTimeFormat(lang, Object.assign({ timeZone: TZ }, opts)).format(this.day(e)); },
    money: money,

    // Cartel del evento a pantalla completa (se cierra tocando o con Esc).
    poster: function (src) {
      if (!src) return;
      if (!document.getElementById('rocePosterCss')) {
        var st = document.createElement('style'); st.id = 'rocePosterCss';
        st.textContent = '.roce-lightbox{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88);cursor:zoom-out;padding:1rem}.roce-lightbox img{max-width:min(94vw,900px);max-height:92vh;object-fit:contain;box-shadow:0 0 0 1px rgba(255,255,255,.2)}';
        document.head.appendChild(st);
      }
      var box = document.createElement('div'); box.className = 'roce-lightbox'; box.setAttribute('role', 'dialog');
      var img = document.createElement('img'); img.src = src; img.alt = '';
      box.appendChild(img);
      function close() { box.remove(); document.removeEventListener('keydown', onKey); }
      function onKey(e) { if (e.key === 'Escape') close(); }
      box.addEventListener('click', close); document.addEventListener('keydown', onKey);
      document.body.appendChild(box);
    },

    // Inicio y fin del evento (ms). Los de ejemplo no traen starts_at: se
    // calculan con la fecha y la hora de Valencia.
    bounds: function (e) {
      var s = e.starts_at ? Date.parse(e.starts_at) : Date.parse(e.date + 'T' + e.time + ':00+01:00');
      return [s, s + e.duration_h * 3600000];
    },
    // "09:00 – 11:00" (hora de Valencia), a partir del inicio y la duración.
    range: function (e) {
      var b = this.bounds(e), f = new Intl.DateTimeFormat('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      return f.format(b[0]) + ' – ' + f.format(b[1]);
    },
    // ¿Está en marcha ahora mismo?
    isLive: function (e) {
      var b = this.bounds(e), now = Date.now();
      return now >= b[0] && now < b[1];
    },

    // Estado de pago de una reserva (free | pending | paid | …) para la vuelta del banco.
    paymentStatus: function (ref) {
      return fetch(cfg.url + '/rest/v1/rpc/booking_status', {
        method: 'POST',
        headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_ref: ref })
      }).then(function (r) { return r.json(); }).catch(function () { return 'unknown'; });
    },

    // Reserva real en la base de datos (función book_event). Devuelve la
    // referencia, las plazas que quedan y el total, o rechaza con un código:
    // sold_out, event_past, event_not_found, bad_qty, bad_data o network.
    book: function (ev, o) {
      return fetch(cfg.url + '/rest/v1/rpc/book_event', {
        method: 'POST',
        headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_event: ev.id, p_qty: o.qty, p_name: o.name, p_email: o.email, p_phone: o.phone, p_notes: o.notes || '', p_lang: o.lang, p_marketing: !!o.marketing, p_invoice_name: o.invoiceName || '', p_invoice_tax_id: o.invoiceTaxId || '', p_invoice_address: o.invoiceAddress || '', p_online: !!o.online })
      }).then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok) {
            var m = (body && (body.message || body.hint || '')) + '';
            var code = ['sold_out', 'event_past', 'event_not_found', 'bad_qty', 'bad_data'].filter(function (c) { return m.indexOf(c) !== -1; })[0];
            throw new Error(code || 'network');
          }
          var row = Array.isArray(body) ? body[0] : body;
          return { ref: row.o_ref, left: row.o_spots_left, total_cents: row.o_total_cents };
        });
      }, function () { throw new Error('network'); });
    }
  };
})();
