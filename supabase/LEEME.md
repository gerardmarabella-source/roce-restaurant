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
- Las **devoluciones** se hacen desde el portal de Redsys; de momento el panel no las gestiona (ni las facturas rectificativas).
- Redsys pide mostrar en la web las condiciones de venta y la política de cancelación/devolución. Revisa `terminos.html` con la gestoría.

## Dónde se guardan los datos
- Reservas: tabla `bookings` de Supabase (nombre, email, teléfono, comentarios, entradas, estado).
- Contactos de marketing: Brevo (solo email y, si se configura, nombre).
- Aviso a ROCE: email de Web3Forms (respaldo, se puede quitar cuando todo esté probado).
- Hay que reflejarlo en la **política de privacidad** (encargados del tratamiento:
  Supabase y Brevo) antes de abrir las reservas al público.
