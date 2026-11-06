(function () {
  var STORAGE_KEY = 'roce_lang';

  // Cada clave lleva es/en. El español es la fuente de verdad (coincide
  // con el HTML tal cual está escrito); el inglés se aplica solo si el
  // idioma detectado o elegido es "en". Términos como "Newsletter" o
  // "WhatsApp" se dejan igual en ambos idiomas a propósito.
  var STRINGS = {
    // Compartido: aviso de cookies
    cookie_text: {
      es: 'Usamos una cookie técnica propia para recordar tu elección. Si aceptas, también activamos el Píxel de Meta (Facebook e Instagram) y Google Tag Manager para medir y mejorar nuestra publicidad y nuestra web. Al reservar o pagar, los servicios de pago (Redsys) y de reservas de terceros (CoverManager) pueden usar las suyas.',
      en: 'We use our own technical cookie to remember your choice. If you accept, we also enable the Meta Pixel (Facebook and Instagram) and Google Tag Manager to measure and improve our advertising and our website. When you book or pay, the payment (Redsys) and third-party booking (CoverManager) services may use their own cookies.',
    },
    gl_loading: { es: 'Cargando…', en: 'Loading…' },
    gl_notfound: { es: 'Este enlace no es válido. Pide uno nuevo a quien te lo envió.', en: 'This link is not valid. Ask whoever sent it for a new one.' },
    gl_title: { es: 'Lista de invitados', en: 'Guest list' },
    gl_rule: { es: 'Puedes apuntar hasta {n} personas. Entran sin pagar entrada.', en: 'You can add up to {n} people. They get in without paying.' },
    gl_until: { es: 'Puedes cambiarla hasta el {date}.', en: 'You can change it until {date}.' },
    gl_night: { es: 'Restaurant & Cocktails es un espacio +18: todos los invitados deben ser mayores de 18 años.', en: 'Restaurant & Cocktails is an 18+ space: all guests must be 18 or older.' },
    gl_closed: { es: 'Esta lista ya está cerrada. Si necesitas cambiar algo, escríbenos a reservas@roce.es.', en: 'This list is now closed. If you need to change anything, write to reservas@roce.es.' },
    gl_you: { es: 'Tus datos', en: 'Your details' },
    gl_host: { es: 'Tu nombre', en: 'Your name' },
    gl_contact: { es: 'Tu teléfono o email', en: 'Your phone or email' },
    gl_guests: { es: 'Tus invitados', en: 'Your guests' },
    gl_guest_n: { es: 'Nombre del invitado {n}', en: 'Guest {n} name' },
    gl_add: { es: '+ Añadir invitado', en: '+ Add guest' },
    gl_remove: { es: 'Quitar', en: 'Remove' },
    gl_count: { es: '{n} de {max} personas', en: '{n} of {max} people' },
    gl_consent: { es: 'Confirmo que mis invitados me han autorizado a facilitar su nombre y email a ROCE para esta lista y para enviarles su entrada con QR. Más información en la <a href="/privacidad.html" target="_blank" rel="noopener">política de privacidad</a>.', en: 'I confirm my guests have authorised me to give their name and email to ROCE for this list and to send them their QR ticket. More information in the <a href="/privacidad.html" target="_blank" rel="noopener">privacy policy</a>.' },
    gl_qr_note: { es: 'Cada invitado recibe su entrada personal con QR en su email cuando la lista se cierra (a la hora indicada) o cuando tú la confirmas. Por eso necesitamos su email.', en: 'Each guest gets their personal QR ticket by email when the list closes (at the time shown) or when you confirm it. That is why we need their email.' },
    gl_email: { es: 'Email del invitado', en: 'Guest email' },
    gl_dni: { es: 'DNI / NIE / pasaporte', en: 'ID / passport number' },
    gl_err_guest: { es: 'Cada invitado necesita nombre y apellido y un email válido.', en: 'Each guest needs a full name and a valid email.' },
    gl_validate: { es: 'Confirmar lista y enviar entradas', en: 'Confirm list and send tickets' },
    gl_validate_confirm: { es: '¿Confirmar la lista? Ya no podrás cambiarla y cada invitado recibirá su entrada con QR en su email ahora mismo.', en: 'Confirm the list? You will not be able to change it and each guest will get their QR ticket by email right now.' },
    gl_validated: { es: 'Lista confirmada. Cada invitado recibe su entrada con QR en su email.', en: 'List confirmed. Each guest receives their QR ticket by email.' },
    gl_validating: { es: 'Enviando entradas…', en: 'Sending tickets…' },
    gl_save: { es: 'Guardar lista', en: 'Save list' },
    gl_update: { es: 'Actualizar lista', en: 'Update list' },
    gl_saving: { es: 'Guardando…', en: 'Saving…' },
    gl_saved: { es: '¡Lista guardada! {n} personas apuntadas. Puedes volver a este mismo enlace para cambiarla.', en: 'List saved! {n} people added. You can come back to this same link to change it.' },
    gl_err_host: { es: 'Escribe tu nombre.', en: 'Enter your name.' },
    gl_err_contact: { es: 'Escribe un teléfono o email para poder contactarte.', en: 'Enter a phone or email so we can reach you.' },
    gl_err_none: { es: 'Apunta al menos un invitado (nombre y apellido).', en: 'Add at least one guest (full name).' },
    gl_err_consent: { es: 'Marca la casilla para confirmar que tus invitados lo autorizan.', en: 'Tick the box to confirm your guests authorise this.' },
    gl_err_many: { es: 'Has superado el máximo de personas de esta lista.', en: 'You have gone over this list\'s maximum.' },
    gl_err_sold: { es: 'Ya no quedan plazas para tantas personas. Escríbenos a reservas@roce.es.', en: 'There are no longer enough spots. Write to reservas@roce.es.' },
    gl_err_data: { es: 'Revisa tus datos y los nombres.', en: 'Check your details and the names.' },
    gl_err_net: { es: 'No se ha podido guardar. Inténtalo de nuevo.', en: 'Could not save. Please try again.' },
    cookie_title: { es: 'Tu privacidad', en: 'Your privacy' },
    age_title: { es: 'Estás entrando en un espacio +18', en: "You're entering an 18+ space" },
    age_text: { es: 'Las reservas de noche son para mayores de 18 años. ¿Tienes 18 años o más?', en: 'Evening bookings are for guests aged 18 and over. Are you 18 or older?' },
    age_yes: { es: 'Sí, tengo 18 o más', en: "Yes, I'm 18 or older" },
    ev_day: { es: 'Día', en: 'Day' },
    ev_night: { es: 'Noche', en: 'Night' },
    floor_ground: { es: 'Planta baja', en: 'Ground floor' },
    floor_first: { es: 'Primera planta', en: 'First floor' },
    home_events_none: { es: 'Próximos eventos', en: 'Upcoming events' },
    age_no: { es: 'No, ir a Coffee, Bakery & Kitchen', en: 'No, take me to Coffee, Bakery & Kitchen' },
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

    // Desplegable de Reservas (home)
    menu_alquiler_link: { es: 'Alquila el espacio', en: 'Rent the space' },
    menu_eventos_title: { es: 'Eventos', en: 'Events' },
    cta_reservar_mesa: { es: 'Reservar mesa', en: 'Book a table' },

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
    rz_label: { es: '1 · Elige dónde quieres reservar', en: '1 · Choose where to book' },
    rz_up: { es: 'Primera planta', en: 'First floor' },
    rz_down: { es: 'Planta baja', en: 'Ground floor' },
    rz_night_desc: { es: 'Comida 13:00–16:00 · Cena 20:00–02:00 (+18)', en: 'Lunch 13:00–16:00 · Dinner 20:00–02:00 (18+)' },
    rz_day_desc: { es: 'Todos los días 10:00–20:00', en: 'Every day 10:00–20:00' },
    rz_pick: { es: 'Elegir', en: 'Choose' },
    rz_on: { es: '✓ Elegido', en: '✓ Chosen' },
    hours_day: { es: 'Coffee, Bakery & Kitchen · Todos los días, de 10:00 a 20:00', en: 'Coffee, Bakery & Kitchen · Every day, 10:00 – 20:00' },
    reservar_night: {
      es: 'Reservas de noche solo para mayores de 18 años',
      en: 'Restaurant & Cocktails bookings are for guests aged 18 and over',
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

    // events/index.html (los eventos en sí están en la propia página)
    events_eyebrow: { es: 'Agenda', en: 'Line-up' },
    events_title: { es: 'Eventos', en: 'Events' },
    ev_back: { es: '← ROCE', en: '← ROCE' },
    ev_all: { es: 'Todos', en: 'All' },
    evd_back: { es: '← Eventos', en: '← Events' },
    evd_share: { es: 'Compartir', en: 'Share' },
    evd_cal: { es: 'Calendario', en: 'Calendar' },
    evd_map: { es: 'Cómo llegar', en: 'Directions' },
    evd_info: { es: 'Información del evento', en: 'Event information' },
    evd_place: { es: 'Lugar', en: 'Venue' },
    evd_poster: { es: 'Ver el cartel', en: 'View the poster' },
    evd_age: { es: 'Evento solo para mayores de 18 años.', en: 'This is an 18+ event.' },
    evd_qr: { es: 'Recibirás tu entrada con QR por email al comprar. Es personal: enséñala en la puerta.', en: 'You will receive your QR ticket by email after buying. It is personal: show it at the door.' },
    evd_refund: { es: 'Las entradas no se devuelven ni se cambian. Solo si el evento se cancela o se aplaza te devolvemos el importe.', en: 'Tickets are non-refundable and non-exchangeable. Only if the event is cancelled or postponed will we refund you.' },
    evd_starts: { es: 'Empieza a las {h}', en: 'Starts at {h}' },
    evd_copy: { es: 'Copiar', en: 'Copy' },
    evd_more: { es: 'Más', en: 'More' },
    evd_free: { es: 'Entrada libre', en: 'Free entry' },
    evd_ig_hint: { es: 'Instagram: elige «Historias» y se abre con la imagen del evento lista.', en: 'Instagram: choose “Stories” and it opens with the event image ready.' },
    evd_ig_making: { es: 'Preparando la imagen…', en: 'Preparing the image…' },
    evd_ig_done: { es: 'Imagen descargada y enlace copiado: súbela a tu historia de Instagram.', en: 'Image downloaded and link copied: upload it to your Instagram story.' },
    evd_ig_err: { es: 'No se ha podido crear la imagen.', en: 'Could not create the image.' },
    evd_copied: { es: 'Enlace copiado', en: 'Link copied' },
    ev_cta: { es: 'Comprar entrada', en: 'Get tickets' },
    ev_empty: { es: 'Muy pronto publicaremos aquí los próximos eventos.', en: 'We will soon publish the upcoming events here.' },
    // Compra de entradas / reserva de plaza (/eventos/entradas/)
    tk_back_events: { es: '← Eventos', en: '← Events' },
    tk_step1: { es: 'Entradas', en: 'Tickets' },
    tk_step2: { es: 'Datos', en: 'Details' },
    tk_h_data: { es: 'Tus datos', en: 'Your details' },
    tk_step3: { es: 'Confirmar', en: 'Confirm' },
    tk_test_banner: { es: 'Modo prueba: de momento no se cobra nada.', en: 'Test mode: nothing is charged for now.' },
    tk_qty_label: { es: 'Nº de entradas', en: 'Number of tickets' },
    tk_soldout: { es: 'Agotado', en: 'Sold out' },
    tk_each: { es: 'Precio por entrada', en: 'Price per ticket' },
    tk_total: { es: 'Total', en: 'Total' },
    tk_free: { es: 'Gratis', en: 'Free' },
    tk_continue: { es: 'Continuar', en: 'Continue' },
    tk_prev: { es: 'Atrás', en: 'Back' },
    tk_name: { es: 'Nombre y apellidos', en: 'Full name' },
    tk_email: { es: 'Email', en: 'Email' },
    tk_phone: { es: 'Teléfono', en: 'Phone' },
    tk_dni: { es: 'DNI / NIE / pasaporte', en: 'ID / passport number' },
    tk_notes: { es: 'Alergias o comentarios (opcional)', en: 'Allergies or comments (optional)' },
    tk_age: { es: 'Confirmo que todos los asistentes son mayores de 18 años.', en: 'I confirm that all guests are aged 18 or over.' },
    tk_review_title: { es: 'Revisa tu compra', en: 'Review your purchase' },
    tk_r_event: { es: 'Evento', en: 'Event' },
    tk_r_date: { es: 'Fecha', en: 'Date' },
    tk_r_place: { es: 'Lugar', en: 'Place' },
    tk_r_floor: { es: 'Planta', en: 'Floor' },
    tk_address: { es: 'ROCE · Marqués del Túria 16, Valencia', en: 'ROCE · Marqués del Túria 16, Valencia' },
    tk_r_tickets: { es: 'Entradas', en: 'Tickets' },
    tk_r_holder: { es: 'A nombre de', en: 'Booked by' },
    tc_loading: { es: 'Cargando tu entrada…', en: 'Loading your ticket…' },
    tc_notfound: { es: 'Este enlace no es válido. Abre la entrada desde el email de tu compra.', en: 'This link is not valid. Open your ticket from your purchase email.' },
    tc_valid: { es: 'Entrada válida', en: 'Valid ticket' },
    tc_some: { es: 'Han entrado {n} de {t}', en: '{n} of {t} already in' },
    tc_used: { es: 'Ya has entrado', en: 'Already used' },
    tc_cancelled: { es: 'Entrada anulada', en: 'Ticket cancelled' },
    tc_unpaid: { es: 'Pago pendiente', en: 'Payment pending' },
    tc_hint: { es: 'Enseña este QR en la puerta. Sirve para entrar todas las personas de la compra: no lo compartas ni lo publiques.', en: 'Show this QR at the door. It admits everyone on the purchase: do not share or post it.' },
    tk_done_qr: { es: 'Tu entrada con QR', en: 'Your QR ticket' },
    tk_done_qr_link: { es: 'Abrir mi entrada', en: 'Open my ticket' },
    tk_done_qr_hint: { es: 'Enseña este QR en la puerta. También te lo enviamos por email.', en: 'Show this QR at the door. We also email it to you.' },
    tk_r_dni: { es: 'DNI / NIE / pasaporte', en: 'ID / passport' },
    tk_r_contact: { es: 'Contacto', en: 'Contact' },
    tk_norefund: { es: 'Las entradas no se devuelven ni se cambian. Solo si el evento se cancela o se aplaza te devolvemos el importe.', en: 'Tickets are non-refundable and non-exchangeable. Only if the event is cancelled or postponed will we refund you.' },
    tk_policy: { es: 'Si no puedes venir, avísanos en reservas@roce.es para liberar tu plaza.', en: "If you can't make it, let us know at reservas@roce.es so we can free your spot." },
    tk_confirm: { es: 'Confirmar compra', en: 'Confirm purchase' },
    tk_pay: { es: 'Pagar {total}', en: 'Pay {total}' },
    tk_pay_note: { es: 'Al continuar te llevamos al banco para pagar con tarjeta de forma segura. Tu plaza queda retenida durante 30 minutos.', en: "When you continue we'll take you to the bank to pay securely by card. Your spot is held for 30 minutes." },
    tk_redirecting: { es: 'Redirigiendo al banco…', en: 'Redirecting to the bank…' },
    tk_pay_wait: { es: 'Confirmando el pago…', en: 'Confirming the payment…' },
    tk_pay_wait_text: { es: 'Estamos esperando la confirmación del banco. No cierres esta página.', en: "We're waiting for the bank's confirmation. Please don't close this page." },
    tk_pay_delay: { es: 'El banco aún no nos ha confirmado el cobro. En cuanto lo haga recibirás el email de confirmación y tu factura.', en: "The bank hasn't confirmed the payment yet. As soon as it does you'll get your confirmation email and invoice." },
    tk_err_expired: { es: 'Tu entrada retenida ha caducado (30 minutos). Vuelve a confirmar la compra.', en: 'Your held ticket has expired (30 minutes). Please confirm the purchase again.' },
    tk_sending: { es: 'Enviando…', en: 'Sending…' },
    tk_error: { es: 'No se ha podido enviar, inténtalo de nuevo.', en: 'Something went wrong, please try again.' },
    tk_ok_title: { es: '¡Entrada comprada!', en: 'Ticket purchased!' },
    tk_ok_sub: { es: 'Hemos recibido tu compra. Te enviaremos la confirmación por email.', en: "We've received your purchase. We'll send you the confirmation by email." },
    tk_ref: { es: 'Nº de referencia', en: 'Reference number' },
    tk_cal: { es: 'Añadir al calendario', en: 'Add to calendar' },
    tk_more: { es: 'Ver más eventos', en: 'See more events' },
    tk_ko_title: { es: 'El pago no se ha completado', en: "The payment wasn't completed" },
    tk_ko_text: { es: 'No se ha hecho ningún cargo. Puedes intentarlo de nuevo.', en: 'You have not been charged. You can try again.' },
    tk_consent: {
      es: 'He leído y acepto la <a href="/privacidad.html" target="_blank" rel="noopener">política de privacidad</a>. ROCE tratará mis datos para gestionar mi reserva y enviarme información sobre el evento.',
      en: 'I have read and accept the <a href="/privacidad.html" target="_blank" rel="noopener">privacy policy</a>. ROCE will process my data to manage my booking and send me information about the event.',
    },
    tk_inv_check: { es: 'Quiero factura completa (con mis datos fiscales o los de mi empresa).', en: 'I want a full invoice (with my tax details or my company\'s).' },
    tk_inv_name: { es: 'Nombre o razón social', en: 'Name or company name' },
    tk_inv_taxid: { es: 'NIF / CIF', en: 'Tax ID (NIF / CIF)' },
    tk_inv_addr: { es: 'Dirección fiscal', en: 'Billing address' },
    tk_inv_note: { es: 'La factura (simplificada, o completa si la pides) te llega por email cuando se confirma el pago.', en: 'Your invoice (simplified, or full if you ask for it) is emailed to you once the payment is confirmed.' },
    tk_v_invoice: { es: 'Rellena nombre, NIF/CIF y dirección fiscal para la factura completa.', en: 'Please fill in name, tax ID and billing address for the full invoice.' },
    tk_r_invoice: { es: 'Factura a', en: 'Invoice to' },
    tk_marketing: { es: 'Quiero recibir novedades y eventos de ROCE por email (opcional).', en: 'I would like to receive news and events from ROCE by email (optional).' },
    tk_err_soldout: { es: 'Lo sentimos, ya no quedan plazas suficientes para este evento.', en: 'Sorry, there are no longer enough spots left for this event.' },
    tk_err_past: { es: 'Este evento ya ha comenzado o ha finalizado.', en: 'This event has already started or ended.' },
    tk_v_name: { es: 'Escribe tu nombre y apellidos.', en: 'Please enter your full name.' },
    tk_v_email: { es: 'Escribe un email válido.', en: 'Please enter a valid email.' },
    tk_v_dni: { es: 'Escribe un DNI, NIE o pasaporte válido.', en: 'Please enter a valid ID or passport number.' },
    tk_v_phone: { es: 'Escribe un teléfono válido.', en: 'Please enter a valid phone number.' },
    tk_v_age: { es: 'Este evento es solo para mayores de 18 años.', en: 'This event is for guests aged 18 and over only.' },
    tk_v_consent: { es: 'Debes aceptar la política de privacidad.', en: 'You must accept the privacy policy.' },
    tk_ticket_one: { es: 'entrada', en: 'ticket' },
    tk_ticket_many: { es: 'entradas', en: 'tickets' },

    // Elegir entre Day (día) y Night (noche)
    choose_now: { es: 'Ahora', en: 'Now' },
    home_w1: { es: 'Todo', en: 'It all' },
    home_w2: { es: 'empieza', en: 'starts' },
    home_w3: { es: 'con', en: 'with' },
    home_w4: { es: 'un', en: 'a' },
    home_w5: { es: 'roce', en: 'roce' },

    // privacidad.html
    privacy_title: { es: 'Política de privacidad', en: 'Privacy Policy' },
    privacy_updated_p: { es: 'Última actualización: noviembre de 2026', en: 'Last updated: November 2026' },
    terms_updated: { es: 'Última actualización: noviembre de 2026', en: 'Last updated: November 2026' },
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
    privacy_li_events: {
      es: '<strong>Eventos y entradas:</strong> cuando reservas una plaza o entrada para un evento de ROCE Coffee, Bakery & Kitchen o ROCE Restaurant & Cocktails, tratamos tu nombre, email, teléfono, DNI, NIE o número de pasaporte, el número de entradas y los comentarios que quieras añadir para gestionar tu reserva, enviarte la confirmación y avisarte si hay cambios o cancelación del evento. El documento de identidad lo pedimos solo para identificar a la persona que compra la entrada y comprobar su acceso al evento. Si el evento es de pago, también los datos necesarios para gestionar el cobro y, si solicitas factura completa, los datos fiscales que nos indiques (nombre o razón social, NIF/CIF y dirección fiscal). No es necesario que nos facilites datos de salud; si indicas alergias u otras necesidades en los comentarios, los usaremos solo para atender tu reserva. Solo te enviaremos novedades y comunicaciones comerciales si marcas la casilla correspondiente.',
      en: '<strong>Events and tickets:</strong> when you book a spot or ticket for a ROCE Coffee, Bakery & Kitchen or ROCE Restaurant & Cocktails event, we process your name, email, phone number, ID card, foreigner ID or passport number, number of tickets and any comments you wish to add in order to manage your booking, send you the confirmation and notify you of changes to or cancellation of the event. We ask for your identity document only to identify the person buying the ticket and to check their access to the event. If the event is paid, we also process the data needed to handle the payment and, if you request a full invoice, the tax details you give us (name or company name, tax ID and billing address). You do not need to give us any health data; if you mention allergies or other needs in the comments, we will use them only to attend to your booking. We will only send you news and commercial communications if you tick the corresponding box.',
    },
    privacy_li_lists: {
      es: '<strong>Listas de invitados:</strong> si alguien te apunta a una lista de invitados de un evento, esa persona nos facilita tu nombre y tu email. Los usamos para enviarte tu entrada personal con QR, controlar el acceso en la puerta y avisarte si hay cambios o cancelación del evento. La persona que te apunta confirma que tiene tu autorización. Puedes pedirnos que te borremos de la lista escribiendo a reservas@roce.es.',
      en: '<strong>Guest lists:</strong> if someone adds you to an event guest list, they give us your name and email. We use them to send you your personal QR ticket, check access at the door and let you know about changes to or cancellation of the event. The person who adds you confirms they have your authorisation. You can ask us to remove you from the list by writing to reservas@roce.es.',
    },
    privacy_li_newsletter: {
      es: '<strong>Newsletter:</strong> si dejas tu email en el formulario de suscripción, lo usamos para enviarte comunicaciones comerciales sobre ROCE (aperturas, eventos, novedades).',
      en: '<strong>Newsletter:</strong> if you leave your email in the subscription form, we use it to send you commercial communications about ROCE (openings, events, news).',
    },
    privacy_p2_cookies: {
      es: 'No realizamos analítica propia. Solo usamos una cookie técnica propia para recordar si has aceptado o rechazado el aviso de cookies, que no requiere consentimiento por ser estrictamente necesaria para el funcionamiento del propio aviso. Si aceptas las cookies, también activamos el Píxel de Meta, que permite medir y mejorar nuestra publicidad en Facebook e Instagram: Meta Platforms Ireland Limited recibe datos de tu navegación en roce.es (por ejemplo, las páginas que visitas y datos del dispositivo) y los trata según su propia política de privacidad. Si aceptas las cookies también cargamos Google Tag Manager (Google Ireland Limited), que gestiona las etiquetas de medición y publicidad que configuramos: Google recibe datos de tu navegación y los trata según su propia política de privacidad. Si rechazas, ni el Píxel ni Google Tag Manager se cargan. Las reservas de mesa las gestiona ROCE con su propio sistema (ver más abajo). Al pagar una fianza o dejar la tarjeta de garantía se te lleva a la página segura de Redsys, que puede instalar sus propias cookies. Como alternativa mantenemos el sistema de reservas de CoverManager que, si lo usas, puede instalar las suyas y trata los datos que introduces según su propia política (ver nuestra política de cookies).',
      en: "We don't run our own analytics. We only use our own technical cookie to remember whether you accepted or rejected the cookie notice, which doesn't require consent as it's strictly necessary for the notice itself to work. If you accept cookies, we also enable the Meta Pixel, which lets us measure and improve our advertising on Facebook and Instagram: Meta Platforms Ireland Limited receives data about your browsing on roce.es (for example, the pages you visit and device data) and processes it under its own privacy policy. If you accept cookies we also load Google Tag Manager (Google Ireland Limited), which manages the measurement and advertising tags we configure: Google receives data about your browsing and processes it under its own privacy policy. If you reject, neither the Pixel nor Google Tag Manager is loaded. Table bookings are managed by ROCE with its own system (see below). When you pay a deposit or leave a guarantee card you are taken to the secure Redsys page, which may set its own cookies. As an alternative we keep the CoverManager booking system which, if you use it, may set its own and processes the data you enter according to its own policy (see our cookie policy).",
    },
    privacy_h3: { es: '3. Legitimación', en: '3. Legal basis' },
    privacy_p3: {
      es: 'La base legal para el tratamiento de tus datos es el consentimiento que nos das al enviarnos tu email o tu mensaje (art. 6.1.a del RGPD), y en el caso de las reservas, la ejecución de medidas precontractuales a petición tuya (art. 6.1.b del RGPD). Para añadirte a nuestra base de datos de clientes y enviarte comunicaciones comerciales, la base legal es el consentimiento expreso que nos das al aceptarlo durante la reserva. Para las reservas de entradas a eventos, la base legal es la ejecución de la reserva que solicitas (art. 6.1.b del RGPD) y, para los avisos sobre tu evento, la necesidad de prestarte ese servicio. Las novedades y comunicaciones comerciales sobre eventos solo se envían con tu consentimiento, que das marcando la casilla opcional del formulario (art. 6.1.a del RGPD). Para las listas de invitados, la base legal es nuestro interés legítimo en gestionar el acceso al evento y su seguridad y aforo (art. 6.1.f del RGPD), además de la autorización que la persona que te apunta declara tener de ti; puedes oponerte escribiendo a reservas@roce.es.',
      en: 'The legal basis for processing your data is the consent you give us when sending your email or message (art. 6.1.a GDPR), and for bookings, the performance of pre-contractual measures at your request (art. 6.1.b GDPR). To add you to our customer database and send you commercial communications, the legal basis is the explicit consent you give by accepting it during the booking. For event ticket bookings, the legal basis is the performance of the booking you request (art. 6.1.b GDPR) and, for notices about your event, the need to provide you with that service. News and commercial communications about events are only sent with your consent, which you give by ticking the optional box in the form (art. 6.1.a GDPR). For guest lists, the legal basis is our legitimate interest in managing access to the event and its safety and capacity (art. 6.1.f GDPR), together with the authorisation the person adding you states they have from you; you can object by writing to reservas@roce.es.',
    },
    privacy_h4: { es: '4. Destinatarios', en: '4. Recipients' },
    privacy_p4: {
      es: 'No cedemos tus datos a terceros, salvo obligación legal. Si aceptas las cookies, Meta Platforms Ireland Limited y Google Ireland Limited reciben los datos de navegación recogidos por el Píxel de Meta y por Google Tag Manager (ver política de cookies). Para gestionar las reservas de mesa utilizamos nuestro propio sistema, alojado en Supabase (servidores en la Unión Europea), y Brevo (emails y listas) y, si usas la alternativa, CoverManager, proveedor del sistema de reservas, que accede a los datos de la reserva para prestarnos ese servicio. Las solicitudes que envías por WhatsApp se tratan a través de dicha aplicación. Para la newsletter utilizamos Brevo, plataforma de email marketing que almacena tu email y envía las comunicaciones; actúa como encargado del tratamiento bajo contrato, cumpliendo con el RGPD. Para gestionar las reservas de entradas a eventos utilizamos Supabase, proveedor de la base de datos donde se guardan las reservas, con servidores en la Unión Europea, y Brevo, que envía el email de confirmación y guarda tu contacto en nuestras listas; el aviso interno de cada reserva puede enviarse a través del servicio de formularios Web3Forms. Si pagas con tarjeta, el cobro lo realiza Redsys, el TPV virtual de nuestra entidad bancaria, en su propia página segura: ROCE no recibe ni guarda los datos de tu tarjeta, solo la confirmación del pago. Las facturas en PDF se guardan en Google Drive (Google Ireland Limited), con acceso restringido al equipo de ROCE. Algunos de estos proveedores (como Google o Meta) pueden tratar datos fuera del Espacio Económico Europeo; en ese caso lo hacen con garantías adecuadas (cláusulas contractuales tipo o el Marco de Privacidad de Datos UE-EE. UU.). Todos actúan como encargados del tratamiento bajo contrato.',
      en: "We don't share your data with third parties, except where legally required. If you accept cookies, Meta Platforms Ireland Limited and Google Ireland Limited receive the browsing data collected by the Meta Pixel and Google Tag Manager (see our cookie policy). To manage table bookings we use our own system, hosted on Supabase (servers in the European Union), and Brevo (emails and lists) and, if you use the alternative, CoverManager, the booking system provider, which accesses the booking data to provide us with that service. Requests you send via WhatsApp are handled through that application. For the newsletter we use Brevo, an email marketing platform that stores your email and sends the communications; it acts as a data processor under contract, complying with GDPR. To manage event ticket bookings we use Supabase, the provider of the database where bookings are stored, with servers in the European Union, and Brevo, which sends the confirmation email and stores your contact in our lists; the internal notice of each booking may be sent through the Web3Forms form service. If you pay by card, the payment is processed by Redsys, our bank's virtual POS, on its own secure page: ROCE does not receive or store your card details, only the payment confirmation. Invoices in PDF are stored in Google Drive (Google Ireland Limited), with access restricted to the ROCE team. Some of these providers (such as Google or Meta) may process data outside the European Economic Area; when they do, they rely on appropriate safeguards (standard contractual clauses or the EU-US Data Privacy Framework). All of them act as data processors under contract.",
    },
    privacy_h5: { es: '5. Conservación', en: '5. Data retention' },
    privacy_p5: {
      es: 'Conservamos tus datos mientras exista una relación con ROCE (por ejemplo, mientras sigas suscrito a la newsletter) y, en todo caso, hasta que solicites su supresión. Los datos de las reservas de eventos (incluido el DNI, NIE o pasaporte) y de las listas de invitados se conservan mientras sea necesario para gestionar el evento y atender posibles reclamaciones, y durante los plazos que exijan las normas fiscales y mercantiles si hubo cobro. En cuanto a las reservas de mesa, tratamos tu nombre, email, teléfono, las alergias o intolerancias y comentarios que nos indiques, y el historial de tus visitas (número de visitas, no presentaciones y notas del equipo) para atenderte mejor, y los conservamos el tiempo necesario para gestionarlas, atender reclamaciones y cumplir los plazos legales; el equipo puede bloquear nuevas reservas de quien incumpla de forma reiterada. Si reservas con tarjeta de garantía, Redsys (el TPV de nuestro banco) guarda una referencia de tu tarjeta: ROCE no ve ni guarda el número ni el CVV, y solo se cobra la penalización indicada en la reserva si no te presentas o anulas fuera de plazo. Con la lista de espera guardamos tu email y tus datos de contacto solo para avisarte si se libera una mesa.',
      en: 'We keep your data for as long as you have a relationship with ROCE (for example, while you remain subscribed to the newsletter) and, in any case, until you request its deletion. Event booking data (including ID or passport numbers) and guest list data is kept for as long as needed to manage the event and handle any claims, and for the periods required by tax and commercial law if a payment was made. As for table bookings, we process your name, email, phone number, any allergies or intolerances and comments you give us, and your visit history (number of visits, no-shows and team notes) to serve you better, and we keep them as long as needed to manage bookings, handle claims and meet legal periods; the team may block new bookings from guests who repeatedly fail to show up. If you book with a guarantee card, Redsys (our bank\'s payment terminal) keeps a reference to your card: ROCE neither sees nor stores the number or CVV, and the penalty stated in the booking is only charged if you do not show up or cancel late. With the waiting list we keep your email and contact details only to let you know if a table opens up.',
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
      es: 'Instalamos una cookie propia, estrictamente técnica, cuando aceptas o rechazas el aviso de cookies que aparece en tu primera visita; y, solo si aceptas, se cargan el Píxel de Meta y Google Tag Manager, que pueden instalar cookies de publicidad y de medición:',
      en: "We install our own, strictly technical cookie when you accept or reject the cookie notice that appears on your first visit; and, only if you accept, the Meta Pixel and Google Tag Manager are loaded, which may install advertising and measurement cookies:",
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
    cookies_td_purpose_gtm: {
      es: 'Google Tag Manager: carga las etiquetas de medición y publicidad que configuramos (por ejemplo, Google Analytics) y estas pueden instalar sus propias cookies. Solo si aceptas.',
      en: 'Google Tag Manager: loads the measurement and advertising tags we configure (for example, Google Analytics), which may set their own cookies. Only if you accept.',
    },
    cookies_td_owner_gtm: { es: 'Tercero (Google Ireland Limited)', en: 'Third-party (Google Ireland Limited)' },
    cookies_td_duration_gtm: { es: 'Según cada etiqueta (ver la política de Google)', en: 'Depends on each tag (see Google’s policy)' },
    cookies_td_owner_fbp: { es: 'Tercero (Meta Platforms Ireland Limited)', en: 'Third-party (Meta Platforms Ireland Limited)' },
    cookies_td_duration_fbp: { es: 'Hasta 90 días', en: 'Up to 90 days' },
    cookies_p2b: {
      es: 'Al ser estrictamente necesaria para el funcionamiento del propio aviso, esta cookie no requiere tu consentimiento previo, conforme al artículo 22.2 de la LSSI-CE.',
      en: 'As it is strictly necessary for the notice itself to work, this cookie does not require your prior consent, in accordance with article 22.2 of the Spanish LSSI-CE.',
    },
    cookies_h_third: { es: '3. Cookies de terceros: reservas y publicidad', en: '3. Third-party cookies: bookings and advertising' },
    cookies_p_third: {
      es: 'Las reservas de mesa funcionan con el sistema propio de ROCE. Cuando pagas una fianza o dejas la tarjeta de garantía, te llevamos a la página segura de Redsys, el TPV de nuestro banco, que puede instalar sus propias cookies para el pago. Además, mantenemos como alternativa el sistema de reservas de CoverManager, que puede instalar las suyas si lo usas. Ni unas ni otras las instalamos ni las controlamos nosotros: las gestionan según sus propias políticas de cookies y privacidad (<a href="https://www.redsys.es" target="_blank" rel="noopener">redsys.es</a> y <a href="https://www.covermanager.com" target="_blank" rel="noopener">covermanager.com</a>).',
      en: 'Table bookings run on ROCE\'s own system. When you pay a deposit or leave a guarantee card, we send you to the secure Redsys page, our bank\'s payment terminal, which may set its own cookies for the payment. We also keep the CoverManager booking system as an alternative, which may set its own if you use it. We neither install nor control any of them: they are managed under their own cookie and privacy policies (<a href="https://www.redsys.es" target="_blank" rel="noopener">redsys.es</a> and <a href="https://www.covermanager.com" target="_blank" rel="noopener">covermanager.com</a>).',
    },
    cookies_p_gtm: {
      es: 'Si aceptas las cookies, cargamos Google Tag Manager (Google Ireland Limited): se carga un script desde googletagmanager.com que activa las etiquetas de medición y publicidad que configuramos, y Google recibe datos de tu navegación en roce.es. Google los trata según su política, que puedes consultar en <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policies.google.com/privacy</a>. Si rechazas las cookies, no se carga.',
      en: 'If you accept cookies, we load Google Tag Manager (Google Ireland Limited): a script is loaded from googletagmanager.com that activates the measurement and advertising tags we configure, and Google receives data about your browsing on roce.es. Google processes it under its own policy, available at <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policies.google.com/privacy</a>. If you reject cookies, it is not loaded.',
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
      es: 'Las reservas de mesa realizadas a través del sistema de reservas del sitio web quedan sujetas a disponibilidad: ROCE las confirma por email o teléfono en cuanto sea posible y se reserva el derecho de proponer un cambio de fecha, hora o número de comensales. Las entradas para eventos se confirman en el momento de completar la compra (y el pago, si el evento es de pago): recibirás un email de confirmación con la referencia de tu compra.',
      en: 'Table bookings made through the website\'s booking system are subject to availability: ROCE confirms them by email or phone as soon as possible and reserves the right to propose a different date, time or number of guests. Event tickets are confirmed when the purchase is completed (and paid, if the event is paid): you will receive a confirmation email with your purchase reference.',
    },
    terms_h3: { es: '3. Modificaciones y cancelaciones', en: '3. Changes and cancellations' },
    terms_p3: {
      es: 'Si necesitas modificar o cancelar tu reserva, escríbenos con la mayor antelación posible a <a href="mailto:reservas@roce.es">reservas@roce.es</a>. ROCE podrá liberar la mesa reservada transcurridos 15 minutos desde la hora acordada sin previo aviso del cliente.',
      en: 'If you need to change or cancel your booking, please write to us as early as possible at <a href="mailto:reservas@roce.es">reservas@roce.es</a>. ROCE may release the reserved table if 15 minutes pass after the agreed time without notice from the customer.',
    },
    terms_h_tk: { es: '4. Entradas para eventos', en: '4. Event tickets' },
    terms_p_tk: {
      es: 'Las entradas se compran para un evento con fecha y hora concretas. No se admiten devoluciones ni cambios una vez realizada la compra. Por tratarse de un servicio de ocio con fecha de celebración específica, no existe derecho de desistimiento (art. 103 del texto refundido de la Ley General para la Defensa de los Consumidores y Usuarios). Solo si ROCE cancela o aplaza el evento, te devolveremos el importe íntegro de la entrada si no puedes asistir a la nueva fecha. En la puerta se puede pedir el documento de identidad de la persona que compró la entrada, y se podrá denegar el acceso, sin devolución, a quien no cumpla la edad mínima del evento.',
      en: 'Tickets are bought for an event on a specific date and time. Refunds and exchanges are not accepted once the purchase is made. As this is a leisure service with a specific date of performance, there is no right of withdrawal (art. 103 of the Spanish Consumer Protection Act). Only if ROCE cancels or postpones the event will we refund the full ticket price if you cannot attend the new date. At the door we may ask for the identity document of the person who bought the ticket, and entry may be refused, without refund, to anyone who does not meet the event\'s minimum age.',
    },
    terms_h4: { es: '5. Eventos privados y grupos', en: '5. Private events and groups' },
    terms_p4: {
      es: 'Las reservas de nuestro espacio privado están sujetas a un consumo mínimo por persona, que se informa por WhatsApp al gestionar la solicitud. Los detalles concretos (aforo, horario y condiciones) se confirman de forma individual con cada grupo.',
      en: 'Bookings for our private space are subject to a minimum spend per person, communicated over WhatsApp when handling the request. Specific details (capacity, timing and conditions) are confirmed individually with each group.',
    },
    terms_h5: { es: '6. Modificación de estas condiciones', en: '6. Changes to these terms' },
    terms_p5: {
      es: 'ROCE puede actualizar estos términos y condiciones en cualquier momento. Te recomendamos consultarlos periódicamente; la versión vigente es siempre la publicada en esta página.',
      en: 'ROCE may update these terms and conditions at any time. We recommend checking them periodically; the version published on this page is always the one in force.',
    },
    terms_h6: { es: '7. Legislación aplicable', en: '7. Governing law' },
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

    // Las páginas que pintan contenido con JS (p. ej. eventos) se repintan.
    document.dispatchEvent(new Event('roce:lang'));
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
