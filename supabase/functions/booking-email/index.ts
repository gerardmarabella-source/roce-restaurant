// Edge Function de Supabase de ROCE: emails de reservas y facturas (vía Brevo).
// La llama el Database Webhook `booking_email` sobre la tabla `bookings`:
//   · INSERT  → email de confirmación + contacto en las listas de Brevo.
//   · UPDATE  → si payment_status pasa a "refunded": emite el abono (factura rectificativa
//               de la serie A, importes en negativo), la envía adjunta al cliente y la sube a Drive.
//   · UPDATE  → si payment_status pasa a "paid": emite la factura (numeración
//               correlativa en la base de datos), la genera en PDF, la envía
//               adjunta por email y la sube a la carpeta de Drive (Apps Script).
//   · POST {action:"list_sweep"} (lo llaman la página de la lista y un programador cada 5 min): a cada
//     invitado de una lista ya cerrada o validada le envía su entrada con QR. Es público porque solo
//     envía lo que ya tocaba enviar y cada invitado recibe un único email.
// Secretos: BREVO_API_KEY, WEBHOOK_SECRET (= cabecera x-webhook-secret del webhook),
// BREVO_LIST_ATTENDEES, BREVO_LIST_NEWSLETTER, BREVO_ATTR_FIRSTNAME/LASTNAME,
// DRIVE_SCRIPT_URL, DRIVE_SCRIPT_TOKEN; opcionales: MAIL_FROM, MAIL_REPLY_TO,
// ISSUER_NAME, ISSUER_TAX_ID, ISSUER_ADDRESS.
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const FROM = Deno.env.get("MAIL_FROM") ?? "no-reply@roce.es"; // debe ser un remitente verificado en Brevo
const REPLY_TO = Deno.env.get("MAIL_REPLY_TO") ?? "reservas@roce.es";
const LIST_ATTENDEES = Number(Deno.env.get("BREVO_LIST_ATTENDEES") ?? "0");
const LIST_NEWSLETTER = Number(Deno.env.get("BREVO_LIST_NEWSLETTER") ?? "0");
const DRIVE_SCRIPT_URL = Deno.env.get("DRIVE_SCRIPT_URL") ?? "";
const DRIVE_SCRIPT_TOKEN = Deno.env.get("DRIVE_SCRIPT_TOKEN") ?? "";

// Datos fiscales del emisor de las facturas (revisar con la gestoría).
const ISSUER = {
  name: Deno.env.get("ISSUER_NAME") ?? "BRUNCH DINNER ETC. SL",
  taxId: Deno.env.get("ISSUER_TAX_ID") ?? "B25943804",
  address: Deno.env.get("ISSUER_ADDRESS") ?? "Gran Vía Marqués del Túria, 16, Bajo, Dcha, 46005 Valencia (España)",
  email: "reservas@roce.es",
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const brevoHeaders = { "api-key": BREVO_API_KEY, "content-type": "application/json", accept: "application/json" };

const T = {
  es: {
    subject: (t: string) => `Tu plaza en ${t} · ROCE`,
    title: "¡Plaza reservada!",
    intro: "Aquí tienes los datos de tu reserva. Enseña este email o tu número de referencia al llegar.",
    ref: "Referencia", event: "Evento", date: "Fecha", place: "Lugar", floor: "Planta", tickets: "Entradas",
    free: "Gratis", total: "Total", unpaid: "Pago pendiente: te indicaremos cómo hacerlo.",
    age: "Evento solo para mayores de 18 años.",
    cancel: "Si no puedes venir, escríbenos a reservas@roce.es para liberar tu plaza.",
    qrHint: "Enseña este QR en la puerta. Una compra, un QR: sirve para entrar todas las personas de la reserva.",
    qrLink: "Ver mi entrada",
    doc: "Documento",
    privacy: "BRUNCH DINNER ETC. SL (ROCE) trata tus datos para gestionar tu entrada y el acceso al evento. Más información y tus derechos en https://roce.es/privacidad.html o escribiendo a reservas@roce.es.",
    locale: "es-ES",
    invSubject: (n: string) => `Tu factura ${n} · ROCE`,
    invTitle: "Pago recibido",
    invIntro: "Gracias. Adjuntamos la factura de tu compra en formato PDF.",
    crSubject: (n: string) => `Devolución y abono ${n} · ROCE`,
    crTitle: "Devolución realizada",
    crIntro: "Te hemos devuelto el importe de tu compra a la tarjeta con la que pagaste. Según tu banco, puede tardar unos días en verse reflejado. Adjuntamos el abono (factura rectificativa) en PDF.",
    crRefund: "Importe devuelto",
  },
  en: {
    subject: (t: string) => `Your spot at ${t} · ROCE`,
    title: "Spot booked!",
    intro: "Here are your booking details. Show this email or your reference number when you arrive.",
    ref: "Reference", event: "Event", date: "Date", place: "Place", floor: "Floor", tickets: "Tickets",
    free: "Free", total: "Total", unpaid: "Payment pending: we'll let you know how to pay.",
    age: "Guests must be aged 18 or over.",
    cancel: "If you can't make it, write to reservas@roce.es so we can free your spot.",
    qrHint: "Show this QR at the door. One purchase, one QR: it admits everyone on the booking.",
    qrLink: "View my ticket",
    doc: "ID",
    privacy: "BRUNCH DINNER ETC. SL (ROCE) processes your data to manage your ticket and entry to the event. More information and your rights at https://roce.es/privacidad.html or by writing to reservas@roce.es.",
    locale: "en-GB",
    invSubject: (n: string) => `Your invoice ${n} · ROCE`,
    invTitle: "Payment received",
    invIntro: "Thank you. Your invoice is attached as a PDF.",
    crSubject: (n: string) => `Refund and credit note ${n} · ROCE`,
    crTitle: "Refund issued",
    crIntro: "We have refunded your purchase to the card you paid with. Depending on your bank, it can take a few days to show up. The credit note (corrective invoice) is attached as a PDF.",
    crRefund: "Amount refunded",
  },
};

const mailShell = (inner: string) => `<!doctype html><html><body style="margin:0;background:#0a0a0a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0a0a0a" style="background:#0a0a0a"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
<tr><td><img src="https://roce.es/assets/logo/roce-cabecera-email.png" width="560" alt="ROCE" style="display:block;width:100%;height:auto"></td></tr>
${inner}
</table></td></tr></table></body></html>`;

const rowsHtml = (rows: string[][]) => rows.map(([k, v]) =>
  `<tr><td style="padding:10px 0;border-top:1px solid #333;color:#aaa;font:12px Arial,sans-serif;text-transform:uppercase;letter-spacing:1px">${esc(k)}</td>` +
  `<td style="padding:10px 0;border-top:1px solid #333;color:#fff;font:16px Arial,sans-serif;text-align:right">${esc(v)}</td></tr>`).join("");

const serviceClient = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// DNI/NIE/pasaporte tapado salvo los 4 últimos caracteres.
const maskDni = (d: string) => (d.length <= 4 ? d : "•".repeat(d.length - 4) + d.slice(-4));

// QR de la entrada: imagen (la sirve la función "redsys") y enlace a la página de la entrada.
const SITE = (Deno.env.get("SITE_URL") ?? "https://roce.es").replace(/\/+$/, "");
function ticketBlock(b: any, t: any, hint?: string): string {
  const tok = String(b.ticket_token ?? "");
  if (!/^[a-f0-9]{32}$/.test(tok)) return "";
  const page = `${SITE}/entrada/?t=${tok}`;
  const img = `${Deno.env.get("SUPABASE_URL")}/functions/v1/redsys?qr=${tok}`;
  return `<tr><td align="center" style="padding:24px 24px 4px">
<a href="${page}"><img src="${img}" width="200" height="200" alt="QR" style="display:block;width:200px;height:200px;background:#fff;border:10px solid #fff"></a>
<p style="margin:12px 0 0;color:#ddd;font:14px/1.5 Arial,sans-serif">${esc(hint ?? t.qrHint)}</p>
<p style="margin:12px 0 0"><a href="${page}" style="color:#fff;font:bold 14px Arial,sans-serif;text-transform:uppercase;letter-spacing:1px">${esc(t.qrLink)} →</a></p>
</td></tr>`;
}

// ─── INSERT: confirmación de la reserva ──────────────────────────────────
async function sendBookingEmail(b: any): Promise<Response> {
  if (b.status === "cancelled") return new Response("ignored");
  const supabase = serviceClient();
  const { data: ev, error } = await supabase.from("events").select("*").eq("id", b.event_id).single();
  if (error || !ev) return new Response("event not found", { status: 404 });

  const l = b.lang === "en" ? "en" : "es";
  const t = T[l];
  const title = l === "en" && ev.title_en ? ev.title_en : ev.title_es;
  // El lugar es siempre ROCE; la planta se normaliza a "Planta baja" / "Primera planta".
  const address = "ROCE · Marqués del Túria 16, Valencia";
  const floorRaw = ev.place_es || ev.place_en || "";
  const firstFloor = /primera|first|alta|upper/i.test(floorRaw);
  const floor = !floorRaw ? "" : l === "en" ? (firstFloor ? "First floor" : "Ground floor") : (firstFloor ? "Primera planta" : "Planta baja");
  const when = new Intl.DateTimeFormat(t.locale, {
    timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(new Date(ev.starts_at));
  const money = (c: number) => (c / 100).toLocaleString(t.locale, { style: "currency", currency: "EUR" });
  const total = b.total_cents === 0 ? t.free : money(b.total_cents);

  const html = mailShell(`
<tr><td style="padding:28px 24px 8px;color:#fff;font:32px Arial,sans-serif;text-transform:uppercase">${esc(t.title)}</td></tr>
<tr><td style="padding:0 24px 20px;color:#ddd;font:16px/1.5 Arial,sans-serif">${esc(t.intro)}</td></tr>
<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml([
    [t.ref, b.ref], [t.event, title], [t.date, when], [t.place, address], ...(floor ? [[t.floor, floor]] : []), [t.tickets, String(b.qty)], ...(b.dni ? [[t.doc, maskDni(String(b.dni))]] : []), [t.total, total],
  ])}</table></td></tr>
${ticketBlock(b, t)}
<tr><td style="padding:20px 24px 4px;color:#e5453a;font:14px Arial,sans-serif">${b.payment_status === "pending" ? esc(t.unpaid) : ""}${ev.env === "night" ? " " + esc(t.age) : ""}</td></tr>
<tr><td style="padding:12px 24px 8px;color:#aaa;font:13px/1.5 Arial,sans-serif">${esc(t.cancel)}</td></tr>
<tr><td style="padding:0 24px 32px;color:#777;font:11px/1.5 Arial,sans-serif">${esc(t.privacy)}</td></tr>`);

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: brevoHeaders,
    body: JSON.stringify({
      sender: { name: "ROCE", email: FROM },
      replyTo: { email: REPLY_TO, name: "ROCE" },
      to: [{ email: b.email, name: b.name }],
      subject: t.subject(title),
      htmlContent: html,
    }),
  });
  if (!res.ok) return new Response("brevo error: " + (await res.text()), { status: 502 });

  // Contacto en Brevo: siempre en la lista de asistentes (comunicación de servicio sobre su evento);
  // en la newsletter solo si marcó la casilla de novedades (consentimiento aparte).
  const listIds = [LIST_ATTENDEES, b.marketing_optin ? LIST_NEWSLETTER : 0].filter((n) => n > 0);
  if (listIds.length) {
    const [first, ...rest] = String(b.name).trim().split(/\s+/);
    const attributes: Record<string, string> = {};
    const aFirst = Deno.env.get("BREVO_ATTR_FIRSTNAME");
    const aLast = Deno.env.get("BREVO_ATTR_LASTNAME");
    if (aFirst) attributes[aFirst] = first;
    if (aLast && rest.length) attributes[aLast] = rest.join(" ");
    const contact = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: brevoHeaders,
      body: JSON.stringify({ email: b.email, updateEnabled: true, listIds, attributes }),
    });
    if (!contact.ok) return new Response("sent (contact error: " + (await contact.text()) + ")", { status: 200 });
  }
  return new Response("sent");
}

// ─── Factura en PDF ──────────────────────────────────────────────────────
// Solo caracteres que la fuente estándar del PDF (WinAnsi) sabe dibujar.
const pdfText = (s: string) => String(s ?? "").replace(/[^\x20-\x7E -ÿ€–—‘’“”•]/g, "?");
const eur = (c: number) => (c / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

async function buildInvoicePdf(inv: any, ev: any, bookingRef: string, orig?: any): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.04, 0.04, 0.04), grey = rgb(0.42, 0.42, 0.42), line = rgb(0.8, 0.8, 0.8);
  const M = 48, W = 595.28 - 2 * M;
  const draw = (t: string, x: number, y: number, size = 10, font = reg, color = ink) =>
    page.drawText(pdfText(t), { x, y, size, font, color });
  const right = (t: string, xRight: number, y: number, size = 10, font = reg, color = ink) =>
    draw(t, xRight - font.widthOfTextAtSize(pdfText(t), size), y, size, font, color);
  const rule = (y: number, thick = 0.7) => page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: thick, color: line });
  const dateEs = (d: Date) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

  // Emisor
  draw("ROCE", M, 780, 30, bold);
  draw(ISSUER.name, M, 758, 10, bold);
  draw("NIF: " + ISSUER.taxId, M, 745, 9, reg, grey);
  draw(ISSUER.address, M, 732, 9, reg, grey);
  draw(ISSUER.email, M, 719, 9, reg, grey);

  // Título y datos
  const full = inv.kind === "full";
  const credit = inv.doc_type === "credit";
  right(credit ? (full ? "FACTURA RECTIFICATIVA (ABONO)" : "FACTURA SIMPLIFICADA RECTIFICATIVA (ABONO)") : (full ? "FACTURA" : "FACTURA SIMPLIFICADA"), M + W, 780, credit && !full ? 11 : 16, bold);
  right("Nº " + inv.number, M + W, 758, 12, bold);
  right("Fecha de expedición: " + dateEs(new Date(inv.issued_at)), M + W, 742, 9, reg, grey);
  right("Fecha del evento: " + dateEs(new Date(ev.starts_at)), M + W, 729, 9, reg, grey);
  right("Ref. de reserva: " + bookingRef, M + W, 716, 9, reg, grey);
  if (credit && orig) right("Rectifica la factura Nº " + orig.number + " de fecha " + dateEs(new Date(orig.issued_at)), M + W, 703, 9, bold, ink);

  rule(694);

  // Cliente
  draw("CLIENTE", M, 676, 8, bold, grey);
  let y = 660;
  draw(inv.customer_name, M, y, 11, bold); y -= 14;
  if (inv.customer_tax_id) { draw("NIF/CIF: " + inv.customer_tax_id, M, y, 10); y -= 13; }
  if (inv.customer_address) { draw(inv.customer_address, M, y, 10); y -= 13; }
  draw(inv.customer_email, M, y, 9, reg, grey);
  if (credit) { y -= 18; draw("Motivo de la rectificación: " + (inv.reason || "Devolución del importe de la entrada"), M, y, 9.5, reg, ink); }

  // Tabla
  let ty = 590;
  rule(ty + 16, 1.2);
  draw("DESCRIPCIÓN", M, ty, 8, bold, grey);
  right("CANT.", M + W - 190, ty, 8, bold, grey);
  right("PRECIO UD. (IVA incl.)", M + W - 80, ty, 8, bold, grey);
  right("TOTAL", M + W, ty, 8, bold, grey);
  rule(ty - 8);
  ty -= 28;
  draw(inv.description, M, ty, 10.5, reg);
  right(String(inv.qty), M + W - 190, ty, 10.5);
  right(eur(inv.unit_cents), M + W - 80, ty, 10.5);
  right(eur(inv.total_cents), M + W, ty, 10.5);
  rule(ty - 14);

  // Totales
  let sy = ty - 42;
  const vat = Number(inv.vat_percent).toLocaleString("es-ES", { maximumFractionDigits: 1 });
  draw("Base imponible", M + W - 230, sy, 10, reg, grey); right(eur(inv.base_cents), M + W, sy, 10); sy -= 16;
  draw("IVA (" + vat + " %)", M + W - 230, sy, 10, reg, grey); right(eur(inv.vat_cents), M + W, sy, 10); sy -= 10;
  page.drawLine({ start: { x: M + W - 230, y: sy }, end: { x: M + W, y: sy }, thickness: 0.7, color: line }); sy -= 18;
  draw(credit ? "TOTAL A DEVOLVER" : "TOTAL", M + W - 230, sy, 13, bold); right(eur(inv.total_cents), M + W, sy, 13, bold);

  // Pie
  draw("Impuestos incluidos en el precio. Servicio: entrada al evento indicado, prestado en Valencia (España).", M, 84, 8, reg, grey);
  draw(ISSUER.name + " · NIF " + ISSUER.taxId + " · " + ISSUER.address, M, 72, 8, reg, grey);
  if (credit) draw("Abono por devolución: importes en negativo. Rectifica la factura indicada arriba, que queda sin efecto por el importe devuelto.", M, 60, 8, reg, grey);
  else if (!full) draw("Factura simplificada. Si necesitas factura completa con tus datos fiscales, escríbenos a " + ISSUER.email + ".", M, 60, 8, reg, grey);

  return await pdf.save();
}

const toBase64 = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

// ─── UPDATE: factura al pasar a cobrada ──────────────────────────────────
async function issueAndSendInvoice(b: any, force = false): Promise<Response> {
  const supabase = serviceClient();
  const { data: inv, error: invErr } = await supabase.rpc("issue_invoice", { p_booking: b.id });
  if (invErr || !inv) return new Response("invoice error: " + (invErr?.message ?? "no data"), { status: 500 });
  if (inv.email_sent_at && !force) return new Response("already sent");

  const { data: ev } = await supabase.from("events").select("*").eq("id", b.event_id).single();
  const pdf = await buildInvoicePdf(inv, ev, b.ref);
  const b64 = toBase64(pdf);
  const fileName = `Factura-${inv.number}.pdf`;

  // 1) Email al cliente con la factura adjunta
  const l = b.lang === "en" ? "en" : "es";
  const t = T[l];
  const html = mailShell(`
<tr><td style="padding:28px 24px 8px;color:#fff;font:32px Arial,sans-serif;text-transform:uppercase">${esc(t.invTitle)}</td></tr>
<tr><td style="padding:0 24px 20px;color:#ddd;font:16px/1.5 Arial,sans-serif">${esc(t.invIntro)}</td></tr>
<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml([
    [t.ref, b.ref], ["Nº", inv.number], [t.total, (inv.total_cents / 100).toLocaleString(t.locale, { style: "currency", currency: "EUR" })],
  ])}</table></td></tr>
<tr><td style="padding:24px 24px 32px;color:#aaa;font:13px/1.5 Arial,sans-serif">${esc(t.cancel)}</td></tr>`);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: brevoHeaders,
    body: JSON.stringify({
      sender: { name: "ROCE", email: FROM },
      replyTo: { email: REPLY_TO, name: "ROCE" },
      to: [{ email: b.email, name: b.name }],
      subject: t.invSubject(inv.number),
      htmlContent: html,
      attachment: [{ name: fileName, content: b64 }],
    }),
  });
  if (!res.ok) return new Response("brevo error: " + (await res.text()), { status: 502 });
  await supabase.from("invoices").update({ email_sent_at: new Date().toISOString() }).eq("id", inv.id);
  if (force) return new Response(`invoice ${inv.number} re-sent`);

  // 2) Copia en la carpeta de Drive (Apps Script); si no está configurado se omite.
  let driveNote = "drive: not configured";
  if (DRIVE_SCRIPT_URL && DRIVE_SCRIPT_TOKEN) {
    try {
      const up = await fetch(DRIVE_SCRIPT_URL, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ token: DRIVE_SCRIPT_TOKEN, name: fileName, mime: "application/pdf", data: b64 }),
      });
      const out = await up.json().catch(() => ({}));
      if (out.ok && out.url) {
        await supabase.from("invoices").update({ drive_url: out.url }).eq("id", inv.id);
        driveNote = "drive: ok";
      } else driveNote = "drive error: " + JSON.stringify(out).slice(0, 200);
    } catch (e) { driveNote = "drive error: " + String(e).slice(0, 200); }
  }
  return new Response(`invoice ${inv.number} sent; ${driveNote}`);
}

// ─── UPDATE: el panel corrige el email de una reserva ────────────────────
// Se manda al email correcto la confirmación (y la factura, si está cobrada), el contacto se
// da de alta en las mismas listas de Brevo y se saca de ellas el email equivocado.
async function moveToNewEmail(o: any, n: any): Promise<Response> {
  const supabase = serviceClient();
  const sent = await sendBookingEmail(n); // confirmación + contacto en las listas (asistentes y, si lo marcó, newsletter)
  let invoiceNote = "";
  if (n.payment_status === "paid") {
    await supabase.from("invoices").update({ customer_email: n.email }).eq("booking_id", n.id);
    const inv = await issueAndSendInvoice(n, true);
    invoiceNote = "; " + (await inv.text());
  }
  const lists = [LIST_ATTENDEES, n.marketing_optin ? LIST_NEWSLETTER : 0].filter((id) => id > 0);
  for (const id of lists) {
    await fetch(`https://api.brevo.com/v3/contacts/lists/${id}/contacts/remove`, {
      method: "POST",
      headers: brevoHeaders,
      body: JSON.stringify({ emails: [o.email] }),
    }).catch(() => {});
  }
  return new Response(`email moved: ${await sent.text()}${invoiceNote}`, { status: sent.ok ? 200 : sent.status });
}

// ─── Listas de invitados: entrada personal con QR ───────────────────────
async function sweepLists(): Promise<Response> {
  const sb = serviceClient();
  const { data: rows, error } = await sb.from("guest_list_entries")
    .select("id, name, email, dni, ticket_token, guest_lists!inner(label, host_name, closes_at, closed, validated_at, event_id)")
    .is("emailed_at", null).neq("email", "").order("created_at").limit(60);
  if (error) return new Response("sweep error: " + error.message, { status: 500 });
  const now = Date.now();
  const due = (rows ?? []).filter((r: any) => {
    const l = r.guest_lists;
    return l && (l.validated_at || l.closed || new Date(l.closes_at).getTime() <= now);
  });
  if (!due.length) return new Response("nothing due");
  const evIds = [...new Set(due.map((r: any) => r.guest_lists.event_id))];
  const { data: evs } = await sb.from("events").select("*").in("id", evIds);
  const t = T.es;
  let sent = 0, failed = 0;
  for (const r of due as any[]) {
    const ev = (evs ?? []).find((e: any) => e.id === r.guest_lists.event_id);
    if (!ev) { failed++; continue; }
    // Se reserva el envío antes de mandarlo: dos barridos a la vez no repiten el email.
    const { data: claim } = await sb.from("guest_list_entries").update({ emailed_at: new Date().toISOString() }).eq("id", r.id).is("emailed_at", null).select("id");
    if (!claim || !claim.length) continue;
    const when = new Intl.DateTimeFormat(t.locale, { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(ev.starts_at));
    const floorRaw = ev.place_es || ev.place_en || "";
    const floor = !floorRaw ? "" : /primera|first|alta|upper/i.test(floorRaw) ? "Primera planta" : "Planta baja";
    const host = String(r.guest_lists.host_name || "").trim();
    const html = mailShell(`
<tr><td style="padding:28px 24px 8px;color:#fff;font:32px Arial,sans-serif;text-transform:uppercase">Estás en la lista</td></tr>
<tr><td style="padding:0 24px 20px;color:#ddd;font:16px/1.5 Arial,sans-serif">${esc(r.name)}, ${host ? esc(host) + " te ha apuntado" : "te han apuntado"} a ${esc(ev.title_es)}. Esta es tu entrada personal.</td></tr>
<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml([
      [t.event, ev.title_es], [t.date, when], [t.place, "ROCE · Marqués del Túria 16, Valencia"], ...(floor ? [[t.floor, floor]] : []),
      ["Lista", r.guest_lists.label], ...(r.dni ? [["Documento", maskDni(String(r.dni))]] : []),
    ])}</table></td></tr>
${ticketBlock({ ticket_token: r.ticket_token }, t, "Enseña este QR en la puerta junto con tu DNI o documento. Es personal: no lo compartas.")}
<tr><td style="padding:20px 24px 8px;color:#e5453a;font:14px Arial,sans-serif">${ev.env === "night" ? esc(t.age) : ""}</td></tr>
<tr><td style="padding:0 24px 32px;color:#777;font:11px/1.5 Arial,sans-serif">${esc(host || "Quien te ha apuntado")} nos ha facilitado tu nombre, email y documento para esta lista. ${esc(t.privacy)} Si no quieres estar en la lista, escríbenos a reservas@roce.es.</td></tr>`);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: brevoHeaders,
      body: JSON.stringify({
        sender: { name: "ROCE", email: FROM },
        replyTo: { email: REPLY_TO, name: "ROCE" },
        to: [{ email: r.email, name: r.name }],
        subject: `Tu entrada · ${ev.title_es} · ROCE`,
        htmlContent: html,
      }),
    });
    if (res.ok) sent++;
    else { await sb.from("guest_list_entries").update({ emailed_at: null }).eq("id", r.id); failed++; }
  }
  return new Response(`lists: sent ${sent}, failed ${failed}`);
}

// ─── UPDATE: abono al pasar a devuelta ───────────────────────────────────
async function issueAndSendCreditNote(b: any): Promise<Response> {
  const supabase = serviceClient();
  const { data: cn, error: cnErr } = await supabase.rpc("issue_credit_note", { p_booking: b.id, p_reason: "" });
  if (cnErr || !cn) return new Response("credit note: " + (cnErr?.message ?? "no data"), { status: cnErr?.message?.includes("no_invoice") ? 200 : 500 });
  if (cn.email_sent_at) return new Response("already sent");

  const { data: ev } = await supabase.from("events").select("*").eq("id", b.event_id).single();
  const { data: orig } = await supabase.from("invoices").select("number, issued_at").eq("id", cn.credit_of).single();
  const pdf = await buildInvoicePdf(cn, ev, b.ref, orig);
  const b64 = toBase64(pdf);
  const fileName = `Abono-${cn.number}.pdf`;

  const l = b.lang === "en" ? "en" : "es";
  const t = T[l];
  const html = mailShell(`
<tr><td style="padding:28px 24px 8px;color:#fff;font:32px Arial,sans-serif;text-transform:uppercase">${esc(t.crTitle)}</td></tr>
<tr><td style="padding:0 24px 20px;color:#ddd;font:16px/1.5 Arial,sans-serif">${esc(t.crIntro)}</td></tr>
<tr><td style="padding:0 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml([
    [t.ref, b.ref], ["Nº", cn.number], [t.crRefund, ((-cn.total_cents) / 100).toLocaleString(t.locale, { style: "currency", currency: "EUR" })],
  ])}</table></td></tr>
<tr><td style="padding:24px 24px 32px;color:#aaa;font:13px/1.5 Arial,sans-serif">reservas@roce.es</td></tr>`);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: brevoHeaders,
    body: JSON.stringify({
      sender: { name: "ROCE", email: FROM },
      replyTo: { email: REPLY_TO, name: "ROCE" },
      to: [{ email: b.email, name: b.name }],
      bcc: [{ email: REPLY_TO }], // copia a ROCE: queda constancia del abono enviado
      subject: t.crSubject(cn.number),
      htmlContent: html,
      attachment: [{ name: fileName, content: b64 }],
    }),
  });
  if (!res.ok) return new Response("brevo error: " + (await res.text()), { status: 502 });
  await supabase.from("invoices").update({ email_sent_at: new Date().toISOString() }).eq("id", cn.id);

  let driveNote = "drive: not configured";
  if (DRIVE_SCRIPT_URL && DRIVE_SCRIPT_TOKEN) {
    try {
      const up = await fetch(DRIVE_SCRIPT_URL, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ token: DRIVE_SCRIPT_TOKEN, name: fileName, mime: "application/pdf", data: b64 }),
      });
      const out = await up.json().catch(() => ({}));
      if (out.ok && out.url) {
        await supabase.from("invoices").update({ drive_url: out.url }).eq("id", cn.id);
        driveNote = "drive: ok";
      } else driveNote = "drive error: " + JSON.stringify(out).slice(0, 200);
    } catch (e) { driveNote = "drive error: " + String(e).slice(0, 200); }
  }
  return new Response(`credit note ${cn.number} sent; ${driveNote}`);
}

// Aviso interno a ROCE cuando entra una reserva pagada con tarjeta (las gratuitas y las
// de pago manual siguen avisando desde la web).
async function notifyStaff(b: any): Promise<void> {
  const { data: ev } = await serviceClient().from("events").select("title_es, starts_at").eq("id", b.event_id).single();
  const when = ev ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(ev.starts_at)) : "";
  const total = (b.total_cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: brevoHeaders,
    body: JSON.stringify({
      sender: { name: "ROCE", email: FROM },
      to: [{ email: REPLY_TO }],
      subject: `Reserva pagada · ${ev?.title_es ?? b.event_id} (${b.ref})`,
      htmlContent: `<p><b>${esc(String(ev?.title_es ?? b.event_id))}</b> · ${esc(when)}</p>
<p>${esc(b.name)} · ${esc(b.email)} · ${esc(b.phone)}<br>${b.qty} entrada(s) · ${esc(total)} · cobrado con tarjeta<br>Ref. ${esc(b.ref)}</p>`,
    }),
  }).catch(() => {});
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let payload: any = {};
  try { payload = await req.json(); } catch { /* sin cuerpo */ }
  if (payload.action === "list_sweep") {
    const r = await sweepLists();
    return new Response(await r.text(), { status: r.status, headers: CORS });
  }
  if (!WEBHOOK_SECRET || req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  if (payload.table !== "bookings") return new Response("ignored");
  if (payload.type === "INSERT") {
    // Con pago online la reserva nace "pending": el email sale cuando el banco confirma el cobro.
    if (payload.record.status === "pending") return new Response("awaiting payment");
    return await sendBookingEmail(payload.record);
  }
  if (payload.type === "UPDATE") {
    const n = payload.record, o = payload.old_record ?? {};
    if (n.payment_status === "refunded" && o.payment_status === "paid") return await issueAndSendCreditNote(n);
    if (o.email && n.email && String(o.email).toLowerCase() !== String(n.email).toLowerCase() && n.status === "confirmed" && n.payment_status === o.payment_status) {
      return await moveToNewEmail(o, n);
    }
    if (n.payment_status === "paid" && o.payment_status !== "paid" && n.status !== "cancelled") {
      // Pasó de "pending" a pagada: es la primera vez que se confirma, así que sale el email de reserva.
      let sent: Response | null = null;
      if (o.status === "pending") { sent = await sendBookingEmail(n); await notifyStaff(n); }
      const invoice = await issueAndSendInvoice(n);
      return sent && !sent.ok && invoice.ok ? sent : invoice;
    }
  }
  return new Response("ignored");
});
