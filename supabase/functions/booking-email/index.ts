// Edge Function de Supabase: email de confirmación al cliente (vía Brevo).
// Se dispara con un Database Webhook cuando se inserta una fila en `bookings`
// (ver supabase/LEEME.md). Secretos necesarios:
//   BREVO_API_KEY    clave de la API de Brevo
//   WEBHOOK_SECRET   texto largo cualquiera; el mismo que se pone en la cabecera
//                    x-webhook-secret del webhook
//   MAIL_FROM        (opcional) remitente verificado en Brevo, por defecto no-reply@roce.es
//   MAIL_REPLY_TO    (opcional) a dónde llegan las respuestas, por defecto reservas@roce.es
//   BREVO_LIST_ATTENDEES   ID de la lista de Brevo "Asistentes a eventos" (todos los que reservan)
//   BREVO_LIST_NEWSLETTER  ID de la lista de la newsletter (solo quien marcó la casilla de novedades)
//   BREVO_ATTR_FIRSTNAME / BREVO_ATTR_LASTNAME  (opcional) nombre de los atributos de nombre y apellidos en Brevo
import { createClient } from "npm:@supabase/supabase-js@2";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const FROM = Deno.env.get("MAIL_FROM") ?? "no-reply@roce.es"; // debe ser un remitente verificado en Brevo
const REPLY_TO = Deno.env.get("MAIL_REPLY_TO") ?? "reservas@roce.es";
const LIST_ATTENDEES = Number(Deno.env.get("BREVO_LIST_ATTENDEES") ?? "0");
const LIST_NEWSLETTER = Number(Deno.env.get("BREVO_LIST_NEWSLETTER") ?? "0");

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

const T = {
  es: {
    subject: (t: string) => `Tu plaza en ${t} · ROCE`,
    title: "¡Plaza reservada!",
    intro: "Aquí tienes los datos de tu reserva. Enseña este email o tu número de referencia al llegar.",
    ref: "Referencia", event: "Evento", date: "Fecha", place: "Lugar", tickets: "Entradas",
    free: "Gratis", total: "Total", unpaid: "Pago pendiente: te indicaremos cómo hacerlo.",
    age: "Evento solo para mayores de 18 años.",
    cancel: "Si no puedes venir, escríbenos a reservas@roce.es para liberar tu plaza.",
    locale: "es-ES",
  },
  en: {
    subject: (t: string) => `Your spot at ${t} · ROCE`,
    title: "Spot booked!",
    intro: "Here are your booking details. Show this email or your reference number when you arrive.",
    ref: "Reference", event: "Event", date: "Date", place: "Place", tickets: "Tickets",
    free: "Free", total: "Total", unpaid: "Payment pending: we'll let you know how to pay.",
    age: "Guests must be aged 18 or over.",
    cancel: "If you can't make it, write to reservas@roce.es so we can free your spot.",
    locale: "en-GB",
  },
};

Deno.serve(async (req) => {
  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const payload = await req.json();
  if (payload.type !== "INSERT" || payload.table !== "bookings") return new Response("ignored");
  const b = payload.record;
  if (b.status === "cancelled") return new Response("ignored");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ev, error } = await supabase.from("events").select("*").eq("id", b.event_id).single();
  if (error || !ev) return new Response("event not found", { status: 404 });

  const l = b.lang === "en" ? "en" : "es";
  const t = T[l];
  const title = l === "en" && ev.title_en ? ev.title_en : ev.title_es;
  const place = l === "en" && ev.place_en ? ev.place_en : ev.place_es;
  const when = new Intl.DateTimeFormat(t.locale, {
    timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date(ev.starts_at));
  const money = (c: number) => (c / 100).toLocaleString(t.locale, { style: "currency", currency: "EUR" });
  const total = b.total_cents === 0 ? t.free : money(b.total_cents);

  const rows = [
    [t.ref, b.ref], [t.event, title], [t.date, when], [t.place, place], [t.tickets, String(b.qty)], [t.total, total],
  ].map(([k, v]) =>
    `<tr><td style="padding:10px 0;border-top:1px solid #333;color:#aaa;font:12px Arial,sans-serif;text-transform:uppercase;letter-spacing:1px">${esc(k)}</td>` +
    `<td style="padding:10px 0;border-top:1px solid #333;color:#fff;font:16px Arial,sans-serif;text-align:right">${esc(v)}</td></tr>`
  ).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a0a0a" style="background:#0a0a0a"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
<tr><td><img src="https://roce.es/assets/logo/roce-cabecera-email.png" width="560" alt="ROCE" style="display:block;width:100%;height:auto"></td></tr>
<tr><td style="padding:28px 24px 8px;color:#fff;font:32px Arial,sans-serif;text-transform:uppercase">${esc(t.title)}</td></tr>
<tr><td style="padding:0 24px 20px;color:#ddd;font:16px/1.5 Arial,sans-serif">${esc(t.intro)}</td></tr>
<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
<tr><td style="padding:20px 24px 4px;color:#e5453a;font:14px Arial,sans-serif">${b.payment_status === "pending" ? esc(t.unpaid) : ""}${ev.env === "night" ? " " + esc(t.age) : ""}</td></tr>
<tr><td style="padding:12px 24px 32px;color:#aaa;font:13px/1.5 Arial,sans-serif">${esc(t.cancel)}</td></tr>
</table></td></tr></table></body></html>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "ROCE", email: FROM },
      replyTo: { email: REPLY_TO, name: "ROCE" },
      to: [{ email: b.email, name: b.name }],
      subject: t.subject(title),
      htmlContent: html,
    }),
  });
  if (!res.ok) return new Response("brevo error: " + (await res.text()), { status: 502 });

  // Contacto en Brevo: siempre en la lista de asistentes (comunicación de servicio sobre
  // su evento); en la newsletter solo si marcó la casilla de novedades (consentimiento aparte).
  const listIds = [LIST_ATTENDEES, b.marketing_optin ? LIST_NEWSLETTER : 0].filter((n) => n > 0);
  if (listIds.length) {
    // Los atributos tienen que existir ya en Brevo (en cuentas en español suelen ser
    // NOMBRE y APELLIDOS; en inglés FIRSTNAME y LASTNAME). Solo se envían si se
    // indican en BREVO_ATTR_FIRSTNAME / BREVO_ATTR_LASTNAME.
    const [first, ...rest] = String(b.name).trim().split(/\s+/);
    const attributes: Record<string, string> = {};
    const aFirst = Deno.env.get("BREVO_ATTR_FIRSTNAME");
    const aLast = Deno.env.get("BREVO_ATTR_LASTNAME");
    if (aFirst) attributes[aFirst] = first;
    if (aLast && rest.length) attributes[aLast] = rest.join(" ");
    const contact = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email: b.email,
        updateEnabled: true,
        listIds,
        attributes,
      }),
    });
    if (!contact.ok) return new Response("sent (contact error: " + (await contact.text()) + ")", { status: 200 });
  }
  return new Response("sent");
});
