# Panel de eventos de ROCE — puesta en marcha

Tres piezas: **Supabase** (base de datos + usuarios del panel), el panel en
`roce.es/admin/` y el **email de confirmación** (función + Brevo).
Todo es gratis para el volumen de un local.

## 1. Crear el proyecto (5 min)
1. Entra en https://supabase.com con tu cuenta y crea un proyecto nuevo.
   Región: **Europa** (Frankfurt o Irlanda), por la protección de datos.
2. Apunta la contraseña de la base de datos (no se vuelve a mostrar).

## 2. Crear las tablas
1. Menú **SQL Editor → New query**.
2. Pega todo el contenido de `supabase/schema.sql` y pulsa **Run**.

## 3. Dar de alta a quien administra
1. **Authentication → Users → Add user → Create new user**: email y contraseña,
   marcando “Auto Confirm User”.
2. **Authentication → Sign In / Providers**: desactiva **“Allow new users to sign up”**
   (para que nadie más pueda crearse una cuenta).
3. En **SQL Editor** ejecuta (con tu email): `insert into admins (email, role) values ('tu@email.com', 'admin');`
   Repite para cada persona del equipo.

   Las siguientes personas se gestionan desde el propio panel (`roce.es/admin/` →
   pestaña **Equipo**): crear cuenta con contraseña, cambiarla o quitar el acceso.
   Hay dos niveles: **Administrador** (gestiona el equipo) y **Equipo** (solo eventos,
   reservas y su propia contraseña).
   Lo hace la Edge Function `admin-team` (despliégala igual que `booking-email`,
   con “Verify JWT” activado; no necesita secretos: Supabase le da la clave de servicio).

## 4. Conectar la web
En **Project Settings → API** copia:
- **Project URL** → `url`
- **anon public** key → `anonKey`

y pégalos en `eventos/config.js`. (Son datos públicos por diseño: la seguridad
está en las reglas de la base de datos. **Nunca** pongas la `service_role`.)

A partir de ahí `roce.es/eventos/` lee los eventos de la base de datos y
`roce.es/admin/` te deja crearlos y ver las reservas.

## 5. Email de confirmación + lista en Brevo
1. En Brevo crea la lista **“Asistentes a eventos”** y apunta su ID
   (Contactos → Listas). Apunta también el ID de la lista de la newsletter.
2. En Supabase: **Edge Functions → Create function** con el nombre `booking-email`
   y pega `supabase/functions/booking-email/index.ts`. Desmarca “Verify JWT”.
3. **Edge Functions → Secrets**: `BREVO_API_KEY`, `WEBHOOK_SECRET` (un texto largo
   inventado), `BREVO_LIST_ATTENDEES`, `BREVO_LIST_NEWSLETTER`. Opcional: `MAIL_FROM`
   (remitente verificado en Brevo; por defecto `no-reply@roce.es`) y, si quieres guardar el nombre en Brevo,
   `BREVO_ATTR_FIRSTNAME` y `BREVO_ATTR_LASTNAME` con el nombre exacto de esos atributos.
4. **Database → Webhooks → Create**: tabla `bookings`, evento **Insert**,
   tipo *Supabase Edge Functions* → `booking-email`, y una cabecera
   `x-webhook-secret` con el mismo valor de `WEBHOOK_SECRET`.

Quién entra en Brevo: **todos** los que reservan van a “Asistentes a eventos”
(comunicación sobre su evento). A la **newsletter** solo van quienes marcan la
casilla opcional “quiero recibir novedades” (consentimiento aparte, exigido por la LSSI/RGPD).

## 6. Facturas (eventos de pago)
Cuando una reserva de pago pasa a **cobrada** (hoy con el botón "Marcar cobrado" del panel;
con Redsys, cuando el TPV confirme el pago), el sistema:
1. emite la factura con numeración correlativa **F-AAAA-NNNN** (el contador está en la base de datos, sin saltos),
2. genera el PDF con los datos fiscales de ROCE,
3. lo envía adjunto por email al cliente (con Brevo),
4. lo sube a la carpeta de Drive.

- **IVA:** cada evento lleva su porcentaje (campo "IVA incluido" del panel). Confírmalo con la gestoría.
- **Cliente:** por defecto factura **simplificada**; si en la compra marca "factura completa", lleva su nombre, NIF y dirección.
- **Webhook:** `booking_email` debe estar activo para **Insert y Update**.
- **Drive:** `supabase/drive-script.gs` se despliega como aplicación web de Apps Script (propiedad `DRIVE_TOKEN`);
  su URL y ese texto van a los secretos `DRIVE_SCRIPT_URL` y `DRIVE_SCRIPT_TOKEN` de Supabase.
- **Datos del emisor:** por defecto BRUNCH DINNER ETC. SL, B25943804 y la dirección de la política de privacidad;
  se pueden cambiar con los secretos `ISSUER_NAME`, `ISSUER_TAX_ID` e `ISSUER_ADDRESS`.
- Las facturas no se borran ni se editan desde el panel. Si hay que anular una, hace falta una factura rectificativa (a hacer con la gestoría).

## 7. Cobro con tarjeta (Redsys)
El cliente paga en la página segura del banco (redirección); ROCE nunca ve los datos de la tarjeta.

**Cómo funciona**
1. En el paso 3 del embudo, si el evento es de pago, la web guarda la reserva como *pendiente*
   (la plaza queda retenida **30 minutos**) y pide a la función `redsys` los datos firmados.
2. El navegador envía el formulario a Redsys; el cliente paga.
3. Redsys avisa a la función `redsys` (URL de notificación). Ella comprueba la **firma**, el **importe**
   y el comercio, y marca la reserva como cobrada.
4. Eso dispara `booking-email`: sale el **email de reserva**, el **aviso a ROCE** y la **factura** (PDF + Drive).
5. El cliente vuelve a la web (`?status=ok`) y ve la confirmación en cuanto el banco ha avisado.

**Puesta en marcha**
1. Ejecuta `supabase/schema.sql` (o solo las partes nuevas: tabla `payments`, `confirm_payment`, `booking_status`, `book_event` con `p_online`).
2. **Edge Functions → Create function** `redsys` con `supabase/functions/redsys/index.ts`
   y **desactiva “Verify JWT”** (Redsys no envía token; la seguridad es la firma).
3. Vuelve a desplegar `booking-email` (ahora sabe esperar al pago antes de enviar el email).
4. **Edge Functions → Secrets**:
   - `REDSYS_MERCHANT_CODE` (código de comercio / FUC)
   - `REDSYS_TERMINAL` (normalmente `1`)
   - `REDSYS_SECRET_KEY` (clave secreta de firma SHA-256, la que te da el banco)
   - `REDSYS_ENV`: `test` (entorno de pruebas) o `live` (real)
   - opcional: `SITE_URL` (por defecto `https://roce.es`), `REDSYS_EXTRA_ORIGINS`, `REDSYS_MERCHANT_NAME`
5. En el portal del banco (Canales de Redsys) activa el envío de notificación HTTP; la URL la manda la propia función:
   `https://<proyecto>.supabase.co/functions/v1/redsys`.

**Pruebas (entorno `test`)**: datos públicos de la documentación de Redsys para su entorno de pruebas
(comercio 999008881, terminal 1) y las tarjetas de prueba de su documentación. Con `REDSYS_ENV=live`
y los datos reales del contrato se cobra de verdad: antes de pasar a `live`, haz un pago de prueba de importe pequeño.

**Importante**
- Sin los secretos, la función responde “disabled” y la web sigue como antes (reserva sin cobro online).
- Una reserva pendiente que no paga en 30 minutos deja de ocupar plaza (sigue apareciendo como “Pendiente de pago” en el panel).
- Si el banco cobra una reserva ya cancelada, el pago queda registrado en `payments` y hay que devolverlo desde el portal de Redsys.
- Las **devoluciones** se hacen desde el panel (ver sección 9): botón **Devolver** en Reservas.
- Redsys pide mostrar en la web las condiciones de venta y la política de cancelación/devolución. Revisa `terminos.html` con la gestoría.

## 8. Listas de invitados
Para invitar a alguien (RR. PP., un amigo, un artista) a apuntar a su gente sin pasar por la pasarela:
1. En el panel, pestaña **Listas → + Nueva lista**: eliges evento, nombre de la lista, **máximo de personas** y **fecha de cierre**
   (por defecto, la hora de inicio del evento). Opcional: un mensaje para quien la rellena.
2. Copias el enlace (`roce.es/lista/?t=…`) o lo mandas por WhatsApp desde el propio panel. El enlace es secreto: quien lo tiene puede rellenarla.
3. Esa persona pone su nombre y contacto y **un nombre por invitado**. Hasta el cierre puede volver al mismo enlace para añadir o quitar.
4. Los invitados **entran gratis**, **cuentan en el aforo** (si se llena el evento, la lista no deja apuntar más) y salen en **Asistencia**, marcados como "Lista", para tacharlos en la puerta.
- Después del cierre solo se puede cambiar desde el panel (Ver nombres → añadir / quitar). Se puede cerrar o reabrir a mano.
- Un evento con listas no se puede borrar hasta borrar sus listas (o despublicarlo).
- Las tablas `guest_lists` y `guest_list_entries` solo las lee el panel; el público solo puede usar su propio enlace.
- Quien rellena la lista confirma con una casilla que sus invitados le han autorizado a dar su nombre (RGPD).

## 9. Devoluciones y abonos
En **Reservas**, cada reserva cobrada tiene el botón **Devolver** (solo cuentas con rol *Admin*). Al pulsarlo y confirmar:
1. La función `redsys` pide al banco la **devolución total** del cobro (servicio REST de Redsys, operación tipo 3, con el mismo pedido del cobro).
2. Se emite el **abono** (factura rectificativa, serie **A**, importes en negativo, con referencia a la factura original y el motivo) y se numera sin saltos (`A-2026-0001`…).
3. La reserva queda **Cancelada / Devuelto** y la plaza se libera.
4. La función `booking-email` manda el abono en PDF al cliente (con copia a reservas@roce.es) y lo sube a Drive.

- Una devolución por reserva: un candado en la tabla `refunds` evita devolver dos veces con un doble clic.
- Si el banco no acepta la devolución (por ejemplo, porque el terminal no tiene activadas las devoluciones por API), el panel muestra el código del banco y ofrece **registrarla a mano**: se hace la devolución en el portal del banco (Consultas → operación → Devolución) y, ya hecha, se pulsa Aceptar para emitir el abono y enviarlo. Desde el panel no se mueve dinero en ese caso.
- Las reservas cobradas a mano con *Marcar cobrado* no tienen cobro online: solo se pueden registrar como devueltas a mano.
- Reservas gratuitas o sin factura: se pueden devolver, pero sin abono.
- **Cambiar email** (botón por reserva): si te equivocas al escribirlo, al corregirlo se reenvía al email bueno la confirmación (y la factura, si está cobrada), el contacto pasa a las mismas listas de Brevo (asistentes y, si lo marcó, newsletter) y se saca de ellas el email equivocado (el contacto en sí no se borra de Brevo).
- Hay que ejecutar antes `schema.sql` (tabla `refunds`, columnas de `invoices` y función `issue_credit_note`) y volver a desplegar las funciones `redsys` y `booking-email`.

## 10. Entrada con QR y escáner de admisiones
Cada compra tiene un **código secreto** (`bookings.ticket_token`, 32 caracteres aleatorios; no se puede deducir de la referencia).
- **Página de la entrada:** `roce.es/entrada/?t=<código>` (no se indexa) muestra el QR, el evento, la planta, el nombre y las entradas, y avisa si la compra está anulada o ya se ha usado. Se llega desde el email de confirmación y desde la pantalla de "Plaza reservada".
- **Un QR por compra:** vale para todas las personas de la reserva; el escáner permite admitirlas de una en una o todas a la vez.
- **Email:** la confirmación lleva el QR como imagen (la sirve la función `redsys` con `GET ?qr=<código>`) y un enlace a la página de la entrada.
- **Escáner:** en el panel, pestaña **Asistencia → Escanear entradas** (abre la cámara; en el móvil, con permiso de cámara). Resultados: *Admitida* (verde), *Ya admitida*, *Entrada anulada* o *Sin pagar* (rojo), *Otro evento* o *Por cobrar* (naranja). Si falta una sola persona por entrar, se admite al escanear; si faltan varias, pregunta cuántas. Si el QR no se lee, hay un cuadro para pegar el código y siempre queda la lista para marcar a mano.
- **Seguridad:** la admisión la hace la función `scan_ticket` de la base de datos (solo cuentas del panel) en una sola operación con la reserva bloqueada, así que dos escáneres a la vez no pueden admitir dos veces la misma entrada. Cada admisión queda registrada en `admissions` (quién, cuántas, cuándo).
- Las reservas anteriores a esta función reciben su código al ejecutar `schema.sql`; sus emails antiguos no llevan QR, pero la página de la entrada se puede abrir con el código desde el panel si hiciera falta.
- Hay que ejecutar antes `schema.sql` y volver a desplegar las funciones `redsys` y `booking-email`.
- Librerías incluidas en la web (no se cargan de terceros): `qrcode-generator` 1.4.4 (MIT) para dibujar el QR y `jsQR` 1.4.0 (Apache-2.0) para leerlo en navegadores sin detector nativo (iPhone).

## 11. Listas con entrada QR por invitado y permisos por pestaña
**Listas:** quien rellena el enlace de una lista apunta, por cada invitado, **nombre, email y DNI/NIE/pasaporte**.
- Cada invitado tiene su **QR personal** (`guest_list_entries.ticket_token`) y su página `roce.es/entrada/?t=…`.
- Su entrada **se envía por email cuando la lista se cierra**: a la hora marcada, al pulsar **Cerrar** en el panel o cuando el propietario pulsa **Confirmar lista y enviar entradas** (la lista se cierra en ese momento y salen los emails).
- El envío lo hace la función `booking-email` (`{"action":"list_sweep"}`): la llama la propia página al confirmar y un programador cada 5 minutos (`supabase/cron_listas.sql`, se ejecuta una vez; usa `pg_cron` y `pg_net`). Cada invitado recibe un único email.
- El invitado entra en la puerta con el **escáner** (el mismo de las compras): *Admitida* / *Ya admitida*. En Asistencia salen con su DNI.
- Los invitados añadidos a mano desde el panel (Listas → Ver nombres) pueden llevar email y DNI (`Nombre, email, DNI`); sin email no reciben QR, pero se pueden marcar a mano.

**Permisos por pestaña (Equipo):** a cada persona de nivel *Equipo* se le marcan las pestañas que ve: **Eventos, Reservas, Asistencia, Listas**. Los administradores lo ven todo. Quien tiene `tabs = NULL` (cuentas anteriores) ve las cuatro.
- Se aplica también en la base de datos (RLS, función `has_tab`): sin la pestaña Eventos no se pueden editar eventos ni imágenes; para leer o tocar reservas hace falta Reservas **o** Asistencia (la puerta necesita ver y marcar llegadas); para listas, Listas **o** Asistencia; facturas y pagos, Reservas. Escanear entradas exige Asistencia.
- Limitación: quien solo tiene Asistencia ve los datos de las reservas que necesita la puerta (nombre, DNI, referencia).
- Ejecuta `schema.sql` y, una vez, `cron_listas.sql`; vuelve a desplegar `booking-email`.

## Dónde se guardan los datos
- Reservas: tabla `bookings` de Supabase (nombre, email, teléfono, comentarios, entradas, estado).
- Contactos de marketing: Brevo (solo email y, si se configura, nombre).
- Aviso a ROCE: email de Web3Forms (respaldo, se puede quitar cuando todo esté probado).
- Hay que reflejarlo en la **política de privacidad** (encargados del tratamiento:
  Supabase y Brevo) antes de abrir las reservas al público.
