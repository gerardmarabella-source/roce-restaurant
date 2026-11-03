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
3. En **SQL Editor** ejecuta (con tu email): `insert into admins (email) values ('tu@email.com');`
   Repite para cada persona del equipo.

   Las siguientes personas se gestionan desde el propio panel (`roce.es/admin/` →
   pestaña **Equipo**): crear cuenta con contraseña, cambiarla o quitar el acceso.
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

## 7. Cobro con Redsys (más adelante)
Hace falta un servidor que firme los datos del pago: otra función de Supabase.
La web ya tiene el hueco (`ROCE_PAYMENTS` en `eventos/entradas/index.html`).

## Dónde se guardan los datos
- Reservas: tabla `bookings` de Supabase (nombre, email, teléfono, comentarios, entradas, estado).
- Contactos de marketing: Brevo (solo email y, si se configura, nombre).
- Aviso a ROCE: email de Web3Forms (respaldo, se puede quitar cuando todo esté probado).
- Hay que reflejarlo en la **política de privacidad** (encargados del tratamiento:
  Supabase y Brevo) antes de abrir las reservas al público.
