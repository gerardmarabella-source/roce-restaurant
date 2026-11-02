// Agenda de eventos de ROCE: una sola fuente para la lista (/eventos/) y para
// la compra de entradas (/eventos/entradas/).
//
// Campos de cada evento:
//   id            identificador en la URL (?e=id)
//   env           'day' | 'night' (Night es solo para mayores de 18)
//   date, time    AAAA-MM-DD y HH:MM, hora de Valencia
//   duration_h    duración en horas (para el calendario)
//   price_cents   precio por entrada en céntimos (0 = gratis)
//   left          plazas que quedan (0 = agotado). Con la pasarela/backend
//                 esto saldrá del servidor; de momento es un dato fijo.
//   max_per_order máximo de entradas por reserva
//
// Datos de ejemplo — sustituir por la agenda real.
(function () {
  var EVENTS = [
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

  var TZ = 'Europe/Madrid';
  window.ROCE_EVENT_DATA = EVENTS;
  window.ROCE_EVENT_UTIL = {
    find: function (id) { return EVENTS.filter(function (e) { return e.id === id; })[0] || null; },
    today: function () { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); },
    // Fecha del evento como Date (mediodía de Valencia, solo para formatear el día).
    day: function (e) { return new Date(e.date + 'T12:00:00+01:00'); },
    fmt: function (e, lang, opts) { return new Intl.DateTimeFormat(lang, Object.assign({ timeZone: TZ }, opts)).format(this.day(e)); },
    money: function (cents, lang) { return (cents / 100).toLocaleString(lang === 'en' ? 'en-GB' : 'es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 }); }
  };
})();
