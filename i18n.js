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
    footer_legal: { es: 'Aviso legal', en: 'Legal Disclaimer' },
    footer_terms: { es: 'Términos y condiciones', en: 'Terms & Conditions' },
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
    newsletter_confirm_close: {
      es: '¿Seguro que quieres abandonar?',
      en: 'Are you sure you want to leave?',
    },
    newsletter_confirm_stay: { es: 'No, quedarme', en: 'No, stay' },
    newsletter_confirm_yes: { es: 'Sí, cerrar', en: 'Yes, close' },

    // reservar.html
    reservar_h1: { es: 'Reserva<br>tu mesa', en: 'Book<br>your table' },
    reservar_intro: {
      es: 'Rellena el formulario y te confirmamos la reserva por email en cuanto lo leamos. Abrimos pronto — solo aceptamos reservas viernes y sábados.',
      en: "Fill in the form and we'll confirm your booking by email as soon as we read it. We're opening soon — we only accept bookings on Fridays and Saturdays.",
    },
    reservar_private_link: { es: 'Reserva nuestro privado ↓', en: 'Book our private space ↓' },
    consent_text: {
      es: 'He leído y acepto la <a href="/privacidad.html" target="_blank" rel="noopener">política de privacidad</a>. ROCE podrá contactarme por email o teléfono sobre mi reserva y añadirme a su base de datos de clientes para futuras comunicaciones.',
      en: 'I have read and accept the <a href="/privacidad.html" target="_blank" rel="noopener">privacy policy</a>. ROCE may contact me by email or phone about my booking and add me to its customer database for future communications.',
    },
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
      es: 'Solo aceptamos reservas a partir del 1 de noviembre de 2026.',
      en: 'We only accept bookings from November 1, 2026.',
    },
    status_wrong_day: {
      es: 'Solo aceptamos reservas los viernes y sábados.',
      en: 'We only accept bookings on Fridays and Saturdays.',
    },
    status_success: { es: '¡Reserva enviada!', en: 'Booking sent!' },
    status_success_sub: {
      es: 'Te contactaremos pronto para confirmar.',
      en: "We'll contact you soon to confirm.",
    },
    status_error: {
      es: 'No se ha podido enviar. Escríbenos directamente a reservas@roce.es.',
      en: 'Something went wrong. Email us directly at reservas@roce.es.',
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
      es: '<strong>Contacto y reservas:</strong> cuando nos escribes a reservas@roce.es o rellenas el formulario de reservas, tratamos tu nombre, email, teléfono y el contenido del mensaje para gestionar tu solicitud. Si marcas la casilla de aceptación al reservar, también te añadimos a nuestra base de datos de clientes (CRM) para contactarte sobre tu reserva y enviarte comunicaciones sobre ROCE (eventos, novedades, ofertas).',
      en: '<strong>Contact and bookings:</strong> when you write to reservas@roce.es or fill in the booking form, we process your name, email, phone number and the content of your message to handle your request. If you check the consent box when booking, we also add you to our customer database (CRM) to contact you about your booking and send you communications about ROCE (events, news, offers).',
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
      es: 'La base legal para el tratamiento de tus datos es el consentimiento que nos das al enviarnos tu email o tu mensaje (art. 6.1.a del RGPD), y en el caso de las reservas, la ejecución de medidas precontractuales a petición tuya (art. 6.1.b del RGPD). Para añadirte a nuestra base de datos de clientes y enviarte comunicaciones comerciales, la base legal es el consentimiento expreso que nos das al marcar la casilla correspondiente en el formulario de reservas.',
      en: 'The legal basis for processing your data is the consent you give us when sending your email or message (art. 6.1.a GDPR), and for bookings, the performance of pre-contractual measures at your request (art. 6.1.b GDPR). To add you to our customer database and send you commercial communications, the legal basis is the explicit consent you give by checking the corresponding box on the booking form.',
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
      es: 'Para ello, escríbenos a <a href="mailto:reservas@roce.es">reservas@roce.es</a> indicando el derecho que quieres ejercer, adjuntando copia de tu DNI o documento equivalente. También tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>) si consideras que no hemos tratado tus datos correctamente.',
      en: 'To do so, write to us at <a href="mailto:reservas@roce.es">reservas@roce.es</a> indicating which right you want to exercise, attaching a copy of your ID or equivalent document. You also have the right to file a complaint with the Spanish Data Protection Agency (<a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>) if you believe we haven’t handled your data correctly.',
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

    // aviso-legal.html
    legal_title: { es: 'Aviso legal', en: 'Legal Disclaimer' },
    legal_h1: { es: '1. Datos identificativos', en: '1. Identification details' },
    legal_h2: { es: '2. Objeto', en: '2. Purpose' },
    legal_p2: {
      es: 'Este aviso legal regula el acceso y uso del sitio web roce.es (en adelante, "el sitio web"), del que es titular ROCE. El acceso y uso del sitio web atribuye la condición de usuario e implica la aceptación de las condiciones aquí recogidas.',
      en: 'This legal disclaimer governs access to and use of the website roce.es (the "website"), owned by ROCE. Accessing and using the website makes you a user and implies acceptance of the conditions set out here.',
    },
    legal_h3: { es: '3. Condiciones de uso', en: '3. Terms of use' },
    legal_p3: {
      es: 'El sitio web tiene como finalidad informar sobre ROCE y permitir la solicitud de reservas de mesa o de nuestro espacio privado. El usuario se compromete a hacer un uso adecuado y lícito del sitio web, así como a facilitar información veraz al rellenar cualquier formulario, en particular el de reservas.',
      en: 'The website is intended to provide information about ROCE and to allow requests for table or private-space bookings. Users agree to make appropriate and lawful use of the website, and to provide truthful information when filling in any form, in particular the booking form.',
    },
    legal_h4: { es: '4. Propiedad intelectual e industrial', en: '4. Intellectual and industrial property' },
    legal_p4: {
      es: 'Los contenidos del sitio web (textos, imágenes, logotipos, diseño y demás elementos) son propiedad de ROCE o de terceros que han autorizado su uso, y están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su reproducción, distribución o modificación sin autorización expresa.',
      en: "The website's contents (text, images, logos, design and other elements) are owned by ROCE or by third parties who have authorized their use, and are protected under intellectual and industrial property law. Reproducing, distributing or modifying them without express authorization is prohibited.",
    },
    legal_h5: { es: '5. Exclusión de responsabilidad', en: '5. Disclaimer of liability' },
    legal_p5: {
      es: 'ROCE no garantiza la disponibilidad y continuidad del funcionamiento del sitio web, ni se hace responsable de los daños que pudieran derivarse de la falta de disponibilidad o de errores en su contenido. La información sobre disponibilidad de mesas y horarios está sujeta a confirmación por parte de ROCE.',
      en: 'ROCE does not guarantee the availability or continuity of the website, and is not liable for any damages arising from its unavailability or from errors in its content. Information about table availability and time slots is subject to confirmation by ROCE.',
    },
    legal_h6: { es: '6. Legislación aplicable', en: '6. Governing law' },
    legal_p6: {
      es: 'Las presentes condiciones se rigen por la legislación española. Para cualquier controversia derivada del acceso o uso del sitio web, las partes se someten a los juzgados y tribunales de Valencia, salvo que la normativa de consumidores establezca otro fuero.',
      en: 'These terms are governed by Spanish law. For any dispute arising from access to or use of the website, the parties submit to the courts of Valencia, unless consumer protection law establishes a different jurisdiction.',
    },

    // terminos.html
    terms_title: { es: 'Términos y condiciones', en: 'Terms & Conditions' },
    terms_h1: { es: '1. Objeto', en: '1. Purpose' },
    terms_p1: {
      es: 'Estos términos y condiciones regulan la solicitud de reservas de mesa y de nuestro espacio privado a través de roce.es. Al enviar el formulario de reservas, aceptas estas condiciones.',
      en: 'These terms and conditions govern requests for table or private-space bookings made through roce.es. By submitting the booking form, you accept these conditions.',
    },
    terms_h2: { es: '2. Reservas', en: '2. Bookings' },
    terms_p2: {
      es: 'Las reservas realizadas a través del formulario del sitio web son solicitudes, no confirmaciones automáticas: ROCE las revisa y las confirma por email o teléfono en cuanto sea posible. ROCE se reserva el derecho de proponer un cambio de fecha, hora o número de comensales según disponibilidad.',
      en: "Bookings made through the website form are requests, not automatic confirmations: ROCE reviews them and confirms by email or phone as soon as possible. ROCE reserves the right to propose a different date, time or number of guests based on availability.",
    },
    terms_h3: { es: '3. Modificaciones y cancelaciones', en: '3. Changes and cancellations' },
    terms_p3: {
      es: 'Si necesitas modificar o cancelar tu reserva, escríbenos con la mayor antelación posible a <a href="mailto:reservas@roce.es">reservas@roce.es</a>. ROCE podrá liberar la mesa reservada transcurridos 15 minutos desde la hora acordada sin previo aviso del cliente.',
      en: 'If you need to change or cancel your booking, please write to us as early as possible at <a href="mailto:reservas@roce.es">reservas@roce.es</a>. ROCE may release the reserved table if 15 minutes pass after the agreed time without notice from the customer.',
    },
    terms_h4: { es: '4. Eventos privados y grupos', en: '4. Private events and groups' },
    terms_p4: {
      es: 'Las reservas de nuestro espacio privado están sujetas a un consumo mínimo por persona, que se informa por WhatsApp al gestionar la solicitud. Los detalles concretos (aforo, horario y condiciones) se confirman de forma individual con cada grupo.',
      en: 'Bookings for our private space are subject to a minimum spend per person, communicated over WhatsApp when handling the request. Specific details (capacity, timing and conditions) are confirmed individually with each group.',
    },
    terms_h5: { es: '5. Modificación de estas condiciones', en: '5. Changes to these terms' },
    terms_p5: {
      es: 'ROCE puede actualizar estos términos y condiciones en cualquier momento. Te recomendamos consultarlos periódicamente; la versión vigente es siempre la publicada en esta página.',
      en: 'ROCE may update these terms and conditions at any time. We recommend checking them periodically; the version published on this page is always the one in force.',
    },
    terms_h6: { es: '6. Legislación aplicable', en: '6. Governing law' },
    terms_p6: {
      es: 'Estas condiciones se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales de Valencia, salvo que la normativa de consumidores establezca otro fuero.',
      en: 'These terms are governed by Spanish law. For any dispute, the parties submit to the courts of Valencia, unless consumer protection law establishes a different jurisdiction.',
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

    // Etiquetas como "Reservas"/"Newsletter" son imágenes (tipografía
    // exacta pedida por el usuario), no texto — hace falta cambiar el
    // src entero por idioma, no solo el texto.
    document.querySelectorAll('[data-i18n-src]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-src');
      var val = t(key);
      if (val) el.setAttribute('src', val);
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
