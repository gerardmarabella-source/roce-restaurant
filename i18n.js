(function () {
  var STORAGE_KEY = 'roce_lang';

  // Cada clave lleva es/en. El español es la fuente de verdad (coincide
  // con el HTML tal cual está escrito); el inglés se aplica solo si el
  // idioma detectado o elegido es "en". Términos como "Newsletter" o
  // "WhatsApp" se dejan igual en ambos idiomas a propósito.
  var STRINGS = {
    // Compartido: aviso de cookies
    cookie_text: {
      es: 'Usamos una cookie técnica propia para recordar tu elección. Si aceptas, también activamos el Píxel de Meta (Facebook e Instagram) para medir y mejorar nuestra publicidad. El sistema de reservas es de un tercero (CoverManager) y puede usar las suyas.',
      en: 'We use our own technical cookie to remember your choice. If you accept, we also enable the Meta Pixel (Facebook and Instagram) to measure and improve our advertising. The booking system is provided by a third party (CoverManager) and may use its own cookies.',
    },
    cookie_more_info: { es: 'Más información', en: 'More info' },
    cookie_reject: { es: 'Rechazar', en: 'Reject' },
    cookie_accept: { es: 'Aceptar', en: 'Accept' },

    // Compartido: footer
    footer_legal: { es: 'Aviso legal', en: 'Legal Disclaimer' },
    footer_terms: { es: 'Términos y condiciones', en: 'Terms & Conditions' },
    footer_privacy: { es: 'Política de privacidad', en: 'Privacy Policy' },
    footer_cookies: { es: 'Cookies', en: 'Cookies' },
    nav_reservar: { es: 'Reservar', en: 'Book' },
    back_to_home: { es: '← Volver a ROCE', en: '← Back to ROCE' },

    // Home (index.html)
    home_reservas_btn: { es: 'Reservas', en: 'Book' },

    // Desplegable de Reservas (home)
    menu_reservar_title: { es: 'Reservar', en: 'Book' },
    menu_reservar_sub: {
      es: 'Reserva de cena en la primera planta, de miércoles a sábado',
      en: 'Dinner bookings on the first floor, Wednesday to Saturday',
    },
    menu_alquiler_link: { es: 'Alquila el espacio', en: 'Rent the space' },
    menu_eventos_title: { es: 'Eventos', en: 'Events' },
    menu_eventos_sub: { es: '*Próximamente', en: '*Coming soon' },

    // Newsletter (widget compartido, usado en home)
    newsletter_text: { es: 'Entérate antes que nadie de todo.', en: 'Be the first to know.' },
    newsletter_placeholder: { es: 'tu@email.com', en: 'your@email.com' },
    newsletter_submit: { es: 'Enviar', en: 'Subscribe' },
    newsletter_thanks: {
      es: '¡Gracias! ¡Todo empieza con un ROCE!',
      en: "Thanks! It all starts with a ROCE!",
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
      es: 'Solo aceptamos reservas para cena en la primera planta, de miércoles a sábado.',
      en: 'We only take dinner bookings on the first floor, Wednesday to Saturday.',
    },
    reservar_brunch: {
      es: 'Nuestro espacio de brunch y cafetería es de acceso libre, sin reserva, todos los días de 10:00 a 20:00.',
      en: 'Our brunch and café area is walk-in only, no reservation needed, every day from 10:00 to 20:00.',
    },
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
      es: 'Solo aceptamos reservas a partir de la segunda semana de diciembre de 2026.',
      en: 'We only accept bookings from the second week of December 2026.',
    },
    status_wrong_day: {
      es: 'Solo aceptamos reservas de miércoles a sábado.',
      en: 'We only accept bookings from Wednesday to Saturday.',
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

    // Aviso de grupos grandes (reservar.html)
    group_notice: {
      es: 'Para grupos de más de 8 personas, <a data-wa href="#" target="_blank" rel="noopener">escríbenos por WhatsApp</a> o envíanos un correo a <a href="mailto:reservas@roce.es">reservas@roce.es</a>.',
      en: 'For groups of more than 8 people, <a data-wa href="#" target="_blank" rel="noopener">message us on WhatsApp</a> or email us at <a href="mailto:reservas@roce.es">reservas@roce.es</a>.',
    },
    group_wa_msg: {
      es: 'Hola! Nos gustaría reservar mesa para un grupo de más de 8 personas en ROCE.',
      en: "Hi! We'd like to book a table for a group of more than 8 people at ROCE.",
    },

    // Alquila el espacio (reservar.html)
    pe_eyebrow: { es: 'Alquila el espacio', en: 'Rent the space' },
    pe_intro: {
      es: 'Cuéntanos tu idea y contactamos contigo.',
      en: "Tell us your idea and we'll get in touch.",
    },
    pe_ph_name: { es: 'Nombre*', en: 'Name*' },
    pe_ph_company: { es: 'Empresa/proyecto', en: 'Company/project' },
    pe_ph_email: { es: 'Email', en: 'Email' },
    pe_ph_type: { es: 'Tipo de evento*', en: 'Event type*' },
    pe_ph_guests: { es: 'Número de personas previsto (aprox)*', en: 'Expected number of guests (approx.)*' },
    pe_ph_date: { es: 'Fecha aproximada*', en: 'Approximate date*' },
    pe_ph_message: { es: 'Mensaje', en: 'Message' },
    pe_type_birthday: { es: 'Cumpleaños', en: 'Birthday' },
    pe_type_corporate: { es: 'Cena de empresa', en: 'Company dinner' },
    pe_type_farewell: { es: 'Despedida', en: 'Farewell' },
    pe_type_other: { es: 'Otro', en: 'Other' },
    pe_consent: {
      es: 'Acepto la <a href="/privacidad.html" target="_blank" rel="noopener">política de privacidad</a>',
      en: 'I accept the <a href="/privacidad.html" target="_blank" rel="noopener">privacy policy</a>',
    },
    pe_send: { es: 'Enviar por WhatsApp', en: 'Send via WhatsApp' },
    pe_note: {
      es: 'Te contamos condiciones y consumo mínimo por WhatsApp.',
      en: "We'll share the conditions and minimum spend over WhatsApp.",
    },
    wa_intro: {
      es: 'Hola! Nos gustaría alquilar el espacio de ROCE para un evento.',
      en: "Hi! We'd like to rent ROCE's space for an event.",
    },

    // eventos.html
    events_eyebrow: { es: 'Agenda', en: 'Line-up' },
    events_title: { es: 'Eventos', en: 'Events' },
    events_intro: {
      es: 'Noches en directo, catas y sesiones especiales en ROCE. Reserva tu plaza — hay sitio limitado.',
      en: 'Live nights, tastings and special sessions at ROCE. Reserve your spot — space is limited.',
    },
    events_soldout_note: {
      es: 'Solicitud, no compra — te confirmamos por email en cuanto la revisamos.',
      en: "This is a request, not a purchase — we'll confirm by email once we review it.",
    },

    event_1_title: { es: 'Noche de Jazz', en: 'Jazz Night' },
    event_1_meta: { es: 'Sala principal', en: 'Main room' },
    event_1_desc: {
      es: 'Trío en directo entre plato y plato — jazz de toda la vida, sin manteles ni silencio.',
      en: 'A live trio between courses — classic jazz, no white tablecloths or hushed silence required.',
    },
    event_1_price: { es: 'Entrada libre con consumición', en: 'Free entry with a drink minimum' },
    event_1_datetime: { es: 'Viernes 20 de noviembre · 21:00', en: 'Friday, November 20 · 21:00' },

    event_2_title: { es: 'Sunset Sessions: DJ Set', en: 'Sunset Sessions: DJ Set' },
    event_2_meta: { es: 'Terraza', en: 'Terrace' },
    event_2_desc: {
      es: 'La barra abierta hasta tarde y un DJ en la terraza. Aforo reducido.',
      en: 'The bar stays open late and a DJ takes over the terrace. Limited capacity.',
    },
    event_2_price: { es: '10€ · incluye primera copa', en: '€10 · includes your first drink' },
    event_2_datetime: { es: 'Sábado 28 de noviembre · 20:00', en: 'Saturday, November 28 · 20:00' },

    event_3_title: { es: 'Cena Maridaje: Vinos de Autor', en: 'Wine Pairing Dinner' },
    event_3_meta: { es: 'Menú especial · 5 platos', en: 'Special menu · 5 courses' },
    event_3_desc: {
      es: 'Menú degustación de cinco platos maridado con vinos de pequeños productores.',
      en: 'A five-course tasting menu paired with wines from small producers.',
    },
    event_3_price: { es: '55€ por persona', en: '€55 per person' },
    event_3_datetime: { es: 'Sábado 5 de diciembre · 21:00', en: 'Saturday, December 5 · 21:00' },

    ticket_modal_eyebrow: { es: 'Reserva tu plaza', en: 'Reserve your spot' },
    ticket_label_count: { es: 'Nº de entradas', en: 'Number of tickets' },
    ticket_submit: { es: 'Enviar solicitud', en: 'Send request' },
    ticket_submit_sending: { es: 'Enviando...', en: 'Sending...' },
    ticket_status_error: {
      es: 'No se ha podido enviar, inténtalo de nuevo.',
      en: 'Something went wrong, please try again.',
    },
    ticket_success_title: { es: '¡Solicitud enviada!', en: 'Request sent!' },
    ticket_success_sub: {
      es: 'Te confirmamos tu plaza por email en cuanto la revisemos.',
      en: "We'll confirm your spot by email once we review it.",
    },
    ticket_ref_label: { es: 'Nº de referencia', en: 'Reference number' },

    // privacidad.html
    privacy_title: { es: 'Política de privacidad', en: 'Privacy Policy' },
    privacy_updated: { es: 'Última actualización: octubre de 2026', en: 'Last updated: October 2026' },
    privacy_h1: { es: '1. Responsable del tratamiento', en: '1. Data controller' },
    privacy_h2: { es: '2. Datos que tratamos y finalidad', en: '2. Data we process and purpose' },
    privacy_p2_intro: {
      es: 'Tratamos los datos que nos facilitas voluntariamente a través de este sitio web, concretamente:',
      en: 'We process the data you voluntarily provide through this website, specifically:',
    },
    privacy_li_contact: {
      es: '<strong>Contacto y reservas:</strong> cuando nos escribes a reservas@roce.es, usas el sistema de reservas de mesa o nos contactas por WhatsApp desde la web (reservas de grupo, alquiler del espacio), tratamos tu nombre, email, teléfono y el contenido del mensaje para gestionar tu solicitud. Si aceptas expresamente recibir comunicaciones al reservar, también te añadimos a nuestra base de datos de clientes (CRM) para contactarte sobre tu reserva y enviarte comunicaciones sobre ROCE (eventos, novedades, ofertas).',
      en: '<strong>Contact and bookings:</strong> when you write to reservas@roce.es, use the table booking system or contact us on WhatsApp from the website (group bookings, space rental), we process your name, email, phone number and the content of your message to handle your request. If you expressly agree to receive communications when booking, we also add you to our customer database (CRM) to contact you about your booking and send you communications about ROCE (events, news, offers).',
    },
    privacy_li_newsletter: {
      es: '<strong>Newsletter:</strong> si dejas tu email en el formulario de suscripción, lo usamos para enviarte comunicaciones comerciales sobre ROCE (aperturas, eventos, novedades).',
      en: '<strong>Newsletter:</strong> if you leave your email in the subscription form, we use it to send you commercial communications about ROCE (openings, events, news).',
    },
    privacy_p2_cookies: {
      es: 'No realizamos analítica propia. Solo usamos una cookie técnica propia para recordar si has aceptado o rechazado el aviso de cookies, que no requiere consentimiento por ser estrictamente necesaria para el funcionamiento del propio aviso. Si aceptas las cookies, también activamos el Píxel de Meta, que permite medir y mejorar nuestra publicidad en Facebook e Instagram: Meta Platforms Ireland Limited recibe datos de tu navegación en roce.es (por ejemplo, las páginas que visitas y datos del dispositivo) y los trata según su propia política de privacidad. Si rechazas, el Píxel no se carga. El sistema de reservas de mesa es un servicio de CoverManager que se carga dentro de nuestra página de reservas: al usarlo, CoverManager puede instalar sus propias cookies y trata los datos que introduces en la reserva según su propia política (ver nuestra política de cookies).',
      en: "We don't run our own analytics. We only use our own technical cookie to remember whether you accepted or rejected the cookie notice, which doesn't require consent as it's strictly necessary for the notice itself to work. If you accept cookies, we also enable the Meta Pixel, which lets us measure and improve our advertising on Facebook and Instagram: Meta Platforms Ireland Limited receives data about your browsing on roce.es (for example, the pages you visit and device data) and processes it under its own privacy policy. If you reject, the Pixel is not loaded. The table booking system is a CoverManager service loaded inside our booking page: when you use it, CoverManager may set its own cookies and processes the data you enter in the booking according to its own policy (see our cookie policy).",
    },
    privacy_h3: { es: '3. Legitimación', en: '3. Legal basis' },
    privacy_p3: {
      es: 'La base legal para el tratamiento de tus datos es el consentimiento que nos das al enviarnos tu email o tu mensaje (art. 6.1.a del RGPD), y en el caso de las reservas, la ejecución de medidas precontractuales a petición tuya (art. 6.1.b del RGPD). Para añadirte a nuestra base de datos de clientes y enviarte comunicaciones comerciales, la base legal es el consentimiento expreso que nos das al aceptarlo durante la reserva.',
      en: 'The legal basis for processing your data is the consent you give us when sending your email or message (art. 6.1.a GDPR), and for bookings, the performance of pre-contractual measures at your request (art. 6.1.b GDPR). To add you to our customer database and send you commercial communications, the legal basis is the explicit consent you give by accepting it during the booking.',
    },
    privacy_h4: { es: '4. Destinatarios', en: '4. Recipients' },
    privacy_p4: {
      es: 'No cedemos tus datos a terceros, salvo obligación legal. Si aceptas las cookies, Meta Platforms Ireland Limited recibe los datos de navegación recogidos por el Píxel de Meta (ver política de cookies). Para gestionar las reservas de mesa utilizamos CoverManager, proveedor del sistema de reservas, que accede a los datos de la reserva para prestarnos ese servicio. Las solicitudes que envías por WhatsApp se tratan a través de dicha aplicación. Para la newsletter utilizamos Brevo, plataforma de email marketing que almacena tu email y envía las comunicaciones; actúa como encargado del tratamiento bajo contrato, cumpliendo con el RGPD.',
      en: "We don't share your data with third parties, except where legally required. If you accept cookies, Meta Platforms Ireland Limited receives the browsing data collected by the Meta Pixel (see our cookie policy). To manage table bookings we use CoverManager, the booking system provider, which accesses the booking data to provide us with that service. Requests you send via WhatsApp are handled through that application. For the newsletter we use Brevo, an email marketing platform that stores your email and sends the communications; it acts as a data processor under contract, complying with GDPR.",
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
      es: 'roce.es no utiliza cookies de analítica. Instalamos una cookie propia, estrictamente técnica, cuando aceptas o rechazas el aviso de cookies que aparece en tu primera visita; y, solo si aceptas, el Píxel de Meta instala una cookie de publicidad:',
      en: "roce.es doesn't use analytics cookies. We install our own, strictly technical cookie when you accept or reject the cookie notice that appears on your first visit; and, only if you accept, the Meta Pixel installs an advertising cookie:",
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
    cookies_td_purpose_fbp: {
      es: 'Píxel de Meta: identifica tu navegador para medir y mejorar nuestra publicidad en Facebook e Instagram. Solo si aceptas.',
      en: 'Meta Pixel: identifies your browser to measure and improve our advertising on Facebook and Instagram. Only if you accept.',
    },
    cookies_td_owner_fbp: { es: 'Tercero (Meta Platforms Ireland Limited)', en: 'Third-party (Meta Platforms Ireland Limited)' },
    cookies_td_duration_fbp: { es: 'Hasta 90 días', en: 'Up to 90 days' },
    cookies_p2b: {
      es: 'Al ser estrictamente necesaria para el funcionamiento del propio aviso, esta cookie no requiere tu consentimiento previo, conforme al artículo 22.2 de la LSSI-CE.',
      en: 'As it is strictly necessary for the notice itself to work, this cookie does not require your prior consent, in accordance with article 22.2 of the Spanish LSSI-CE.',
    },
    cookies_h_third: { es: '3. Cookies de terceros: reservas y publicidad', en: '3. Third-party cookies: bookings and advertising' },
    cookies_p_third: {
      es: 'Nuestro sistema de reservas de mesa es un servicio de CoverManager que se carga dentro de la página de reservas. Al usarlo, CoverManager puede instalar sus propias cookies o tecnologías similares para que el servicio funcione. Esas cookies no las instalamos ni las controlamos nosotros: las gestiona CoverManager según su propia política de cookies y privacidad, que puedes consultar en <a href="https://www.covermanager.com" target="_blank" rel="noopener">covermanager.com</a>.',
      en: 'Our table booking system is a CoverManager service loaded inside the booking page. When you use it, CoverManager may set its own cookies or similar technologies so that the service works. We do not install or control those cookies: they are managed by CoverManager under its own cookie and privacy policy, available at <a href="https://www.covermanager.com" target="_blank" rel="noopener">covermanager.com</a>.',
    },
    cookies_p_meta: {
      es: 'Si aceptas las cookies, activamos el Píxel de Meta (Meta Platforms Ireland Limited): se carga un script desde connect.facebook.net y se envían a Meta datos de tu navegación en roce.es para que podamos medir y mejorar nuestra publicidad en Facebook e Instagram. Meta trata esos datos según su política, que puedes consultar en <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noopener">facebook.com/privacy/policy</a>. Si rechazas las cookies, el Píxel no se carga.',
      en: 'If you accept cookies, we enable the Meta Pixel (Meta Platforms Ireland Limited): a script is loaded from connect.facebook.net and data about your browsing on roce.es is sent to Meta so we can measure and improve our advertising on Facebook and Instagram. Meta processes that data under its own policy, available at <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noopener">facebook.com/privacy/policy</a>. If you reject cookies, the Pixel is not loaded.',
    },
    cookies_h3: { es: '4. Cómo gestionar las cookies', en: '4. How to manage cookies' },
    cookies_p3: {
      es: 'Puedes eliminar la cookie propia y las de terceros en cualquier momento borrando los datos de navegación de tu navegador. Volveremos a mostrarte el aviso en tu siguiente visita. La mayoría de navegadores también te permiten bloquear cookies desde su configuración de privacidad.',
      en: "You can delete our cookie and any third-party cookies at any time by clearing your browser's browsing data. We'll show you the notice again on your next visit. Most browsers also let you block cookies from their privacy settings.",
    },
    cookies_h4: { es: '5. Más información', en: '5. More information' },
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
