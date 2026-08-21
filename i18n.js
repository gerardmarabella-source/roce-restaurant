(function () {
  var STORAGE_KEY = 'roce_lang';

  // Cada clave lleva es/en. El español es la fuente de verdad (coincide
  // con el HTML tal cual está escrito); el inglés se aplica solo si el
  // idioma detectado o elegido es "en". Términos como "Newsletter" o
  // "WhatsApp" se dejan igual en ambos idiomas a propósito.
  var STRINGS = {
    // Compartido: aviso de cookies
    cookie_text: {
      es: 'Usamos una cookie técnica para recordar tu elección. Sin analítica ni publicidad.',
      en: 'We use a technical cookie to remember your choice. No analytics, no advertising.',
    },
    cookie_more_info: { es: 'Más información', en: 'More info' },
    cookie_reject: { es: 'Rechazar', en: 'Reject' },
    cookie_accept: { es: 'Aceptar', en: 'Accept' },

    // Compartido: footer
    footer_privacy: { es: 'Política de privacidad', en: 'Privacy Policy' },
    footer_cookies: { es: 'Política de cookies', en: 'Cookie Policy' },
    nav_reservar: { es: 'Reservar', en: 'Book' },
    back_to_home: { es: '← Volver a ROCE', en: '← Back to ROCE' },

    // Home (index.html)
    home_reservas_btn: { es: 'Reservas', en: 'Book' },
    home_restaurant_title: { es: 'Restaurante', en: 'Restaurant' },
    home_restaurant_sub: { es: 'Reserva tu mesa', en: 'Book your table' },
    home_private_title: { es: 'Privado', en: 'Private' },
    home_private_sub: { es: 'Experiencia íntima', en: 'An intimate experience' },

    // Newsletter (widget compartido, usado en home)
    newsletter_text: { es: 'Entérate antes que nadie de todo.', en: 'Be the first to know.' },
    newsletter_placeholder: { es: 'tu@email.com', en: 'your@email.com' },
    newsletter_submit: { es: 'Enviar', en: 'Subscribe' },
    newsletter_thanks: {
      es: '¡Gracias! Te avisaremos antes de la apertura.',
      en: "Thanks! We'll let you know before opening.",
    },
    newsletter_error: {
      es: 'No se ha podido enviar, inténtalo de nuevo.',
      en: 'Something went wrong, please try again.',
    },

    // reservar.html
    reservar_h1: { es: 'Reserva<br>tu mesa', en: 'Book<br>your table' },
    reservar_intro: {
      es: 'Rellena el formulario y te confirmamos la reserva por email en cuanto lo leamos. Abrimos el 12 de octubre de 2026 — solo aceptamos reservas a partir de esa fecha.',
      en: "Fill in the form and we'll confirm your booking by email as soon as we read it. We open on October 12, 2026 — we only accept bookings from that date.",
    },
    reservar_private_link: { es: 'Reserva nuestro privado ↓', en: 'Book our private space ↓' },
    label_name: { es: 'Nombre', en: 'Name' },
    placeholder_name: { es: 'Tu nombre', en: 'Your name' },
    label_email: { es: 'Email', en: 'Email' },
    placeholder_email: { es: 'tu@email.com', en: 'your@email.com' },
    label_phone: { es: 'Teléfono', en: 'Phone' },
    label_guests_count: { es: 'Personas', en: 'Guests' },
    label_date: { es: 'Fecha', en: 'Date' },
    label_time: { es: 'Hora', en: 'Time' },
    option_choose_time: { es: 'Elige un turno', en: 'Choose a time slot' },
    label_comments: { es: 'Comentarios', en: 'Comments' },
    placeholder_comments: {
      es: 'Alergias, celebraciones, preferencias...',
      en: 'Allergies, celebrations, preferences...',
    },
    submit_booking: { es: 'Enviar reserva', en: 'Send booking' },
    submit_sending: { es: 'Enviando...', en: 'Sending...' },
    status_too_early: {
      es: 'Solo aceptamos reservas a partir del 12 de octubre de 2026 (apertura).',
      en: 'We only accept bookings from October 12, 2026 (opening day).',
    },
    status_success: {
      es: '¡Reserva enviada! Te confirmamos por email en cuanto la leamos.',
      en: "Booking sent! We'll confirm by email as soon as we read it.",
    },
    status_error: {
      es: 'No se ha podido enviar. Escríbenos directamente a booking@roce.es.',
      en: 'Something went wrong. Email us directly at booking@roce.es.',
    },

    // Eventos privados (reservar.html)
    pe_eyebrow: { es: 'Eventos privados', en: 'Private events' },
    pe_title: { es: 'Algo más<br>exclusivo', en: 'Something more<br>exclusive' },
    pe_intro: {
      es: 'Reserva nuestro privado y disfruta de la experiencia de una forma mucho más íntima.',
      en: 'Book our private space and enjoy the experience in a much more intimate way.',
    },
    pe_label_guests: { es: '¿Cuántos sois?', en: 'How many of you?' },
    pe_whatsapp_btn: { es: 'Hablar por WhatsApp', en: 'Message us on WhatsApp' },
    pe_note: {
      es: 'Consumo mínimo por persona. Te contamos los detalles por WhatsApp.',
      en: "Minimum spend per person. We'll share the details over WhatsApp.",
    },
    wa_intro: {
      es: 'Hola! Nos gustaría organizar un evento privado en ROCE.',
      en: "Hi! We'd like to organize a private event at ROCE.",
    },
    wa_guests: { es: 'Seríamos {n} personas.', en: "We'd be {n} people." },
    wa_outro: { es: '¿Nos contáis disponibilidad?', en: 'Could you tell us about availability?' },

    // privacidad.html
    privacy_title: { es: 'Política de privacidad', en: 'Privacy Policy' },
    privacy_updated: { es: 'Última actualización: agosto de 2026', en: 'Last updated: August 2026' },
    privacy_h1: { es: '1. Responsable del tratamiento', en: '1. Data controller' },
    privacy_h2: { es: '2. Datos que tratamos y finalidad', en: '2. Data we process and purpose' },
    privacy_p2_intro: {
      es: 'Tratamos los datos que nos facilitas voluntariamente a través de este sitio web, concretamente:',
      en: 'We process the data you voluntarily provide through this website, specifically:',
    },
    privacy_li_contact: {
      es: '<strong>Contacto y reservas:</strong> cuando nos escribes a booking@roce.es para pedir información o reservar mesa, tratamos tu nombre, email y el contenido del mensaje para gestionar tu solicitud.',
      en: '<strong>Contact and bookings:</strong> when you write to booking@roce.es to ask for information or book a table, we process your name, email and the content of your message to handle your request.',
    },
    privacy_li_newsletter: {
      es: '<strong>Newsletter:</strong> si dejas tu email en el formulario de suscripción, lo usamos para enviarte comunicaciones comerciales sobre ROCE (aperturas, eventos, novedades).',
      en: '<strong>Newsletter:</strong> if you leave your email in the subscription form, we use it to send you commercial communications about ROCE (openings, events, news).',
    },
    privacy_p2_cookies: {
      es: 'No recopilamos datos de navegación, analítica ni cookies de terceros: esta web no utiliza cookies de seguimiento. Solo usamos una cookie técnica propia para recordar si has aceptado o rechazado el aviso de cookies, que no requiere consentimiento por ser estrictamente necesaria para el funcionamiento del propio aviso.',
      en: "We don't collect browsing data, analytics, or third-party cookies: this website doesn't use tracking cookies. We only use our own technical cookie to remember whether you accepted or rejected the cookie notice, which doesn't require consent as it's strictly necessary for the notice itself to work.",
    },
    privacy_h3: { es: '3. Legitimación', en: '3. Legal basis' },
    privacy_p3: {
      es: 'La base legal para el tratamiento de tus datos es el consentimiento que nos das al enviarnos tu email o tu mensaje (art. 6.1.a del RGPD), y en el caso de las reservas, la ejecución de medidas precontractuales a petición tuya (art. 6.1.b del RGPD).',
      en: 'The legal basis for processing your data is the consent you give us when sending your email or message (art. 6.1.a GDPR), and for bookings, the performance of pre-contractual measures at your request (art. 6.1.b GDPR).',
    },
    privacy_h4: { es: '4. Destinatarios', en: '4. Recipients' },
    privacy_p4: {
      es: 'No cedemos tus datos a terceros, salvo obligación legal. Si en el futuro utilizamos un proveedor externo para el envío de la newsletter (por ejemplo, una plataforma de email marketing), este actuará como encargado del tratamiento bajo contrato, cumpliendo con el RGPD.',
      en: "We don't share your data with third parties, except where legally required. If in the future we use an external provider to send the newsletter (for example, an email marketing platform), it will act as a data processor under contract, complying with GDPR.",
    },
    privacy_h5: { es: '5. Conservación', en: '5. Data retention' },
    privacy_p5: {
      es: 'Conservamos tus datos mientras exista una relación con ROCE (por ejemplo, mientras sigas suscrito a la newsletter) y, en todo caso, hasta que solicites su supresión.',
      en: 'We keep your data for as long as you have a relationship with ROCE (for example, while you remain subscribed to the newsletter) and, in any case, until you request its deletion.',
    },
    privacy_h6: { es: '6. Tus derechos', en: '6. Your rights' },
    privacy_p6_intro: {
      es: 'Puedes ejercer en cualquier momento tus derechos de:',
      en: 'You can exercise your rights at any time to:',
    },
    privacy_li_access: { es: 'Acceso a tus datos', en: 'Access your data' },
    privacy_li_rectification: { es: 'Rectificación de datos inexactos', en: 'Rectify inaccurate data' },
    privacy_li_erasure: { es: 'Supresión ("derecho al olvido")', en: 'Erasure ("right to be forgotten")' },
    privacy_li_objection: { es: 'Oposición al tratamiento', en: 'Object to processing' },
    privacy_li_limitation: { es: 'Limitación del tratamiento', en: 'Restrict processing' },
    privacy_li_portability: { es: 'Portabilidad de los datos', en: 'Data portability' },
    privacy_p6_outro: {
      es: 'Para ello, escríbenos a <a href="mailto:booking@roce.es">booking@roce.es</a> indicando el derecho que quieres ejercer, adjuntando copia de tu DNI o documento equivalente. También tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>) si consideras que no hemos tratado tus datos correctamente.',
      en: 'To do so, write to us at <a href="mailto:booking@roce.es">booking@roce.es</a> indicating which right you want to exercise, attaching a copy of your ID or equivalent document. You also have the right to file a complaint with the Spanish Data Protection Agency (<a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>) if you believe we haven’t handled your data correctly.',
    },
    privacy_h7: { es: '7. Menores de edad', en: '7. Minors' },
    privacy_p7: {
      es: 'Este sitio web no está dirigido a menores de 14 años. Si eres menor de esa edad, no debes facilitarnos tus datos sin el consentimiento de tus padres o tutores legales.',
      en: "This website isn't aimed at minors under 14. If you're under that age, you shouldn't provide us with your data without the consent of your parents or legal guardians.",
    },
    privacy_h8: { es: '8. Cambios en esta política', en: '8. Changes to this policy' },
    privacy_p8: {
      es: 'Podemos actualizar esta política de privacidad para adaptarla a novedades legislativas o cambios en nuestros servicios. Te recomendamos revisarla periódicamente.',
      en: 'We may update this privacy policy to adapt it to legislative changes or changes in our services. We recommend reviewing it periodically.',
    },

    // cookies.html
    cookies_title: { es: 'Política de cookies', en: 'Cookie Policy' },
    cookies_h1: { es: '1. Qué son las cookies', en: '1. What are cookies' },
    cookies_p1: {
      es: 'Las cookies son pequeños archivos de texto que un sitio web guarda en tu navegador cuando lo visitas. Sirven para que la web funcione correctamente, recuerde tus preferencias o, en algunos casos, analice cómo la usas.',
      en: 'Cookies are small text files that a website saves in your browser when you visit it. They help the website work properly, remember your preferences, or, in some cases, analyze how you use it.',
    },
    cookies_h2: { es: '2. Qué cookies usa esta web', en: '2. What cookies this website uses' },
    cookies_p2: {
      es: 'roce.es no utiliza cookies de analítica, publicidad ni de terceros. Solo instalamos una cookie propia, estrictamente técnica, cuando aceptas o rechazas el aviso de cookies que aparece en tu primera visita:',
      en: "roce.es doesn't use analytics, advertising, or third-party cookies. We only install our own, strictly technical cookie when you accept or reject the cookie notice that appears on your first visit:",
    },
    cookies_th_name: { es: 'Nombre', en: 'Name' },
    cookies_th_purpose: { es: 'Finalidad', en: 'Purpose' },
    cookies_th_owner: { es: 'Titular', en: 'Owner' },
    cookies_th_duration: { es: 'Duración', en: 'Duration' },
    cookies_td_purpose: {
      es: 'Recordar si has aceptado o rechazado el aviso de cookies, para no volver a mostrártelo.',
      en: "Remember whether you accepted or rejected the cookie notice, so we don't show it to you again.",
    },
    cookies_td_owner: { es: 'Propia (ROCE)', en: 'First-party (ROCE)' },
    cookies_td_duration: {
      es: 'Persistente, hasta que borres los datos de navegación de tu dispositivo',
      en: 'Persistent, until you clear your device’s browsing data',
    },
    cookies_p2b: {
      es: 'Al ser estrictamente necesaria para el funcionamiento del propio aviso, esta cookie no requiere tu consentimiento previo, conforme al artículo 22.2 de la LSSI-CE.',
      en: 'As it is strictly necessary for the notice itself to work, this cookie does not require your prior consent, in accordance with article 22.2 of the Spanish LSSI-CE.',
    },
    cookies_h3: { es: '3. Cómo gestionar las cookies', en: '3. How to manage cookies' },
    cookies_p3: {
      es: 'Puedes eliminar esta cookie en cualquier momento borrando los datos de navegación de tu navegador. Volveremos a mostrarte el aviso en tu siguiente visita. La mayoría de navegadores también te permiten bloquear cookies desde su configuración de privacidad.',
      en: "You can delete this cookie at any time by clearing your browser's browsing data. We'll show you the notice again on your next visit. Most browsers also let you block cookies from their privacy settings.",
    },
    cookies_h4: { es: '4. Más información', en: '4. More information' },
    cookies_p4: {
      es: 'Para saber cómo tratamos tus datos personales, consulta nuestra <a href="privacidad.html">política de privacidad</a>.',
      en: 'To find out how we handle your personal data, see our <a href="privacidad.html">privacy policy</a>.',
    },
  };

  var currentLang = 'es';

  function detectLang() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved === 'en' || saved === 'es') return saved;
    var nav = (navigator.language || (navigator.languages && navigator.languages[0]) || 'es').toLowerCase();
    return nav.indexOf('en') === 0 ? 'en' : 'es';
  }

  function t(key) {
    var entry = STRINGS[key];
    if (!entry) return '';
    return entry[currentLang] || entry.es || '';
  }

  function applyLang(lang) {
    currentLang = lang === 'en' ? 'en' : 'es';
    document.documentElement.lang = currentLang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (val) el.textContent = val;
    });

    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      var val = t(key);
      if (val) el.innerHTML = val;
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var val = t(key);
      if (val) el.setAttribute('placeholder', val);
    });

    document.querySelectorAll('.lang-switch [data-lang]').forEach(function (btn) {
      var isActive = btn.getAttribute('data-lang') === currentLang;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }

  function setLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    applyLang(lang);
  }

  function initI18n() {
    applyLang(detectLang());
    document.querySelectorAll('.lang-switch [data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        setLang(btn.getAttribute('data-lang'));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }

  window.ROCE_I18N = { t: t, setLang: setLang, getLang: function () { return currentLang; } };
})();
