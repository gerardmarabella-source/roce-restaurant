// Pasarela de pago Redsys (pago por redirección al TPV virtual).
//
// Una sola función con dos caras:
//   · La web le habla en JSON:  {action: "status"}  o  {action: "pay", ref, lang, return_base}
//     "pay" devuelve los datos firmados que la web envía al banco; la clave secreta
//     nunca sale de aquí.
//   · La app de pedidos (app.roce.es) le pide {action: "pay_app", order_id, lang} con la sesión del cliente: devuelve los datos
//     firmados para cobrar ese pedido (solo el suyo) y el cliente vuelve a https://app.roce.es/?pago=ok|ko&ref=<pedido>.
//   · El panel de administración le pide {action: "refund", booking_id, manual?}: devuelve el
//     cobro por el servicio REST de Redsys (o, con manual=true, solo registra una devolución ya hecha
//     en el portal del banco), emite el abono y deja la reserva como "devuelta". Solo responde a
//     administradores (admins.role = 'admin'), comprobando el token del usuario.
//   · Los emails piden GET ?qr=<código de la entrada> y reciben el QR (imagen GIF) de la página de esa
//     entrada. No lee la base de datos: solo dibuja la dirección roce.es/entrada/?t=<código>.
//   · Redsys le habla con un formulario (URL de notificación): Ds_SignatureVersion,
//     Ds_MerchantParameters y Ds_Signature. Se comprueba la firma, el importe y el
//     comercio, y se marca la reserva como cobrada (eso dispara el email y la factura).
//
// Secretos (Edge Functions → Secrets):
//   REDSYS_MERCHANT_CODE  código de comercio (FUC)
//   REDSYS_TERMINAL       terminal (por defecto 1)
//   REDSYS_SECRET_KEY     clave secreta de firma SHA-256 (base64)
//   REDSYS_ENV            "test" (sandbox) o "live" (real). Por defecto "test".
//   SITE_URL              web a la que vuelve el cliente (por defecto https://roce.es)
//   REDSYS_EXTRA_ORIGINS  (opcional) otros orígenes permitidos para volver, separados por comas
//   REDSYS_MERCHANT_NAME  (opcional) nombre que ve el cliente en el banco (por defecto ROCE)
//
// Desplegar con "Verify JWT" DESACTIVADO: Redsys no envía token. La seguridad está en
// la firma de cada notificación.
import { createClient } from "npm:@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";
import qrcode from "npm:qrcode-generator@1.4.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const URLS = {
  test: "https://sis-t.redsys.es:25443/sis/realizarPago",
  live: "https://sis.redsys.es/sis/realizarPago",
};
const REST_URLS = {
  test: "https://sis-t.redsys.es:25443/sis/rest/trataPeticionREST",
  live: "https://sis.redsys.es/sis/rest/trataPeticionREST",
};
const HOLD_MS = 30 * 60 * 1000; // la plaza queda retenida 30 min mientras se paga

function config() {
  const merchant = Deno.env.get("REDSYS_MERCHANT_CODE") ?? "";
  const key = Deno.env.get("REDSYS_SECRET_KEY") ?? "";
  let keyOk = false;
  try { keyOk = forge.util.decode64(key).length === 24; } catch { /* clave mal pegada */ }
  const site = (Deno.env.get("SITE_URL") ?? "https://roce.es").replace(/\/+$/, "");
  return {
    merchant,
    key,
    terminal: Deno.env.get("REDSYS_TERMINAL") || "1",
    env: (Deno.env.get("REDSYS_ENV") ?? "test") === "live" ? ("live" as const) : ("test" as const),
    name: Deno.env.get("REDSYS_MERCHANT_NAME") || "ROCE",
    site,
    origins: [site, ...(Deno.env.get("REDSYS_EXTRA_ORIGINS") ?? "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean)],
    enabled: !!merchant && keyOk,
  };
}

// ─── Firma HMAC_SHA256_V1 ───────────────────────────────────────────────
// 1. clave del pedido = 3DES-CBC (IV a ceros, relleno de ceros) del número de pedido
//    con la clave secreta decodificada de base64;
// 2. firma = base64( HMAC-SHA256( clave del pedido, Ds_MerchantParameters ) ).
function orderKey(secretB64: string, order: string): Uint8Array {
  const cipher = forge.cipher.createCipher("3DES-CBC", forge.util.decode64(secretB64));
  cipher.start({ iv: "\0\0\0\0\0\0\0\0" });
  let data = order;
  while (data.length % 8 !== 0) data += "\0";
  cipher.update(forge.util.createBuffer(data));
  cipher.finish(() => true); // sin relleno PKCS#7
  const bin = cipher.output.getBytes();
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function sign(secretB64: string, order: string, paramsB64: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", orderKey(secretB64, order), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(paramsB64)));
  let s = "";
  for (const b of mac) s += String.fromCharCode(b);
  return btoa(s);
}

// Redsys devuelve base64 "seguro para URL" (-_ en lugar de +/): se compara sin ese detalle.
const canon = (b64: string) => b64.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const ascii = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").trim();
const toB64 = (s: string) => btoa(s); // el JSON que enviamos es ASCII
function fromB64Json(b64: string): Record<string, unknown> {
  const bin = atob(canon(b64) + "=".repeat((4 - (canon(b64).length % 4)) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

function newOrder(): string {
  const alpha = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const r = crypto.getRandomValues(new Uint8Array(12));
  let o = String(1000 + (r[0] * 256 + r[1]) % 9000); // los 4 primeros, numéricos
  for (let i = 2; i < 10; i++) o += alpha[r[i] % alpha.length];
  return o; // 12 caracteres
}

// ─── Web → función ──────────────────────────────────────────────────────
async function handleJson(req: Request): Promise<Response> {
  const cfg = config();
  let body: { action?: string; ref?: string; lang?: string; return_base?: string; booking_id?: string; manual?: boolean; reason?: string; token?: string; no_show?: boolean };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  if (body.action === "status") return json({ enabled: cfg.enabled, env: cfg.env });
  if (body.action === "refund") return await handleRefund(req, body as RefundBody);
  if (body.action === "pay_table") return await handlePayTable(body);
  if (body.action === "pay_app") return await handlePayApp(req, body as { order_id?: string; lang?: string });
  if (body.action === "app_refund") return await handleAppRefund(req, body);
  if (body.action === "table_refund") return await handleTableRefund(req, body);
  if (body.action === "table_charge") return await handleTableCharge(req, body);
  if (body.action !== "pay") return json({ error: "bad_action" }, 400);
  if (!cfg.enabled) return json({ error: "disabled" }, 503);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: b } = await sb.from("bookings")
    .select("id, ref, event_id, name, total_cents, status, payment_status, created_at, lang")
    .eq("ref", String(body.ref ?? "")).maybeSingle();
  if (!b) return json({ error: "not_found" }, 404);
  if (b.payment_status === "paid") return json({ error: "already_paid" }, 409);
  if (b.status !== "pending" || b.payment_status !== "pending" || b.total_cents <= 0) return json({ error: "not_payable" }, 409);
  if (Date.now() - Date.parse(b.created_at) > HOLD_MS) return json({ error: "expired" }, 410);

  const { data: ev } = await sb.from("events").select("title_es").eq("id", b.event_id).single();

  // Un intento de pago = un número de pedido nuevo (Redsys no admite repetirlo).
  let order = "";
  for (let i = 0; i < 5 && !order; i++) {
    const candidate = newOrder();
    const { error } = await sb.from("payments").insert({ order_id: candidate, booking_id: b.id, amount_cents: b.total_cents });
    if (!error) order = candidate;
  }
  if (!order) return json({ error: "order_failed" }, 500);

  const base = cfg.origins.includes(String(body.return_base ?? "").replace(/\/+$/, "")) ? String(body.return_base).replace(/\/+$/, "") : cfg.site;
  const back = (status: string) => `${base}/eventos/entradas/?e=${encodeURIComponent(b.event_id)}&status=${status}&ref=${encodeURIComponent(b.ref)}`;
  const params = {
    DS_MERCHANT_AMOUNT: String(b.total_cents),
    DS_MERCHANT_ORDER: order,
    DS_MERCHANT_MERCHANTCODE: cfg.merchant,
    DS_MERCHANT_CURRENCY: "978",
    DS_MERCHANT_TRANSACTIONTYPE: "0",
    DS_MERCHANT_TERMINAL: cfg.terminal,
    DS_MERCHANT_MERCHANTURL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/redsys`,
    DS_MERCHANT_URLOK: back("ok"),
    DS_MERCHANT_URLKO: back("ko"),
    DS_MERCHANT_CONSUMERLANGUAGE: (body.lang ?? b.lang) === "en" ? "002" : "001",
    DS_MERCHANT_PRODUCTDESCRIPTION: ascii(ev?.title_es ?? "Entradas ROCE").slice(0, 120),
    DS_MERCHANT_TITULAR: ascii(b.name).slice(0, 60),
    DS_MERCHANT_MERCHANTNAME: ascii(cfg.name).slice(0, 25),
  };
  const merchantParameters = toB64(JSON.stringify(params));
  return json({
    url: URLS[cfg.env],
    Ds_SignatureVersion: "HMAC_SHA256_V1",
    Ds_MerchantParameters: merchantParameters,
    Ds_Signature: await sign(cfg.key, order, merchantParameters),
  });
}

// ─── Email → función: imagen del QR de una entrada ──────────────────────
function handleQr(u: URL): Response {
  const t = u.searchParams.get("qr") ?? "";
  if (!/^[a-f0-9]{32}$/.test(t)) return new Response("bad token", { status: 400 });
  const qr = qrcode(0, "M");
  qr.addData(`${config().site}/entrada/?t=${t}`);
  qr.make();
  const bin = atob(qr.createDataURL(8, 4).split(",")[1]); // GIF en base64
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { "Content-Type": "image/gif", "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" } });
}

// ─── Panel → función: devolución ─────────────────────────────────────────
type RefundBody = { booking_id?: string; manual?: boolean; reason?: string };

async function handleRefund(req: Request, body: RefundBody): Promise<Response> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: isAdmin } = await caller.rpc("can_manage_team");
  if (isAdmin !== true) return json({ error: "forbidden" }, 403);
  const { data: me } = await caller.auth.getUser();
  const who = (me.user?.email ?? "").toLowerCase();

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: b } = await sb.from("bookings").select("id, ref, status, payment_status, total_cents").eq("id", String(body.booking_id ?? "")).maybeSingle();
  if (!b) return json({ error: "not_found" }, 404);
  if (b.payment_status === "refunded") return json({ error: "already_refunded" }, 409);
  if (b.payment_status !== "paid" || b.total_cents <= 0) return json({ error: "not_paid" }, 409);

  const { data: pay } = await sb.from("payments").select("order_id, amount_cents")
    .eq("booking_id", b.id).eq("status", "paid").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const manual = body.manual === true;
  // Cobrada a mano en el panel (sin pago online): no hay nada que devolver por Redsys.
  if (!manual && !pay) return json({ error: "no_online_payment" }, 409);

  // Candado: una devolución por reserva. Si una anterior falló, se puede reintentar.
  const row = { booking_id: b.id, order_id: pay?.order_id ?? null, amount_cents: b.total_cents, method: manual ? "manual" : "redsys", status: "started", requested_by: who };
  const ins = await sb.from("refunds").insert(row);
  if (ins.error) {
    const { data: prev } = await sb.from("refunds").select("status").eq("booking_id", b.id).maybeSingle();
    if (!prev || prev.status !== "failed") return json({ error: prev?.status === "done" ? "already_refunded" : "refund_in_progress" }, 409);
    await sb.from("refunds").update({ ...row, response_code: null, updated_at: new Date().toISOString() }).eq("booking_id", b.id);
  }
  const fail = async (code: string, detail: string, status = 502) => {
    await sb.from("refunds").update({ status: "failed", response_code: code.slice(0, 10), updated_at: new Date().toISOString() }).eq("booking_id", b.id);
    return json({ error: "bank_refused", code, detail }, status);
  };

  if (!manual) {
    const cfg = config();
    if (!cfg.enabled) return await fail("CONFIG", "Pasarela sin configurar", 503);
    const params = {
      DS_MERCHANT_AMOUNT: String(pay!.amount_cents),
      DS_MERCHANT_ORDER: pay!.order_id,
      DS_MERCHANT_MERCHANTCODE: cfg.merchant,
      DS_MERCHANT_CURRENCY: "978",
      DS_MERCHANT_TRANSACTIONTYPE: "3", // devolución
      DS_MERCHANT_TERMINAL: cfg.terminal,
    };
    const merchantParameters = toB64(JSON.stringify(params));
    let out: Record<string, unknown>;
    try {
      const r = await fetch(REST_URLS[cfg.env], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Ds_SignatureVersion: "HMAC_SHA256_V1",
          Ds_MerchantParameters: merchantParameters,
          Ds_Signature: await sign(cfg.key, pay!.order_id, merchantParameters),
        }),
        signal: AbortSignal.timeout(25000),
      });
      out = await r.json();
    } catch (e) {
      return await fail("NETWORK", "No se pudo contactar con el banco: " + String(e).slice(0, 120));
    }
    if (out.errorCode) return await fail(String(out.errorCode), "El banco ha rechazado la petición");
    let resp: Record<string, unknown>;
    try { resp = fromB64Json(String(out.Ds_MerchantParameters ?? "")); } catch { return await fail("RESPONSE", "Respuesta del banco ilegible"); }
    const get = (name: string) => { const k = Object.keys(resp).find((x) => x.toLowerCase() === name.toLowerCase()); return k ? String(resp[k]) : ""; };
    const expected = await sign(cfg.key, get("Ds_Order") || pay!.order_id, String(out.Ds_MerchantParameters));
    if (!safeEqual(canon(expected), canon(String(out.Ds_Signature ?? "")))) return await fail("SIGNATURE", "Firma de la respuesta no válida: compruébalo en el portal del banco");
    const code = get("Ds_Response");
    if (code !== "0900") return await fail(code || "UNKNOWN", "El banco no ha aceptado la devolución (código " + (code || "?") + ")");
    await sb.from("refunds").update({ status: "done", response_code: code, updated_at: new Date().toISOString() }).eq("booking_id", b.id);
  } else {
    await sb.from("refunds").update({ status: "done", response_code: "MANUAL", updated_at: new Date().toISOString() }).eq("booking_id", b.id);
  }

  // Abono (si hubo factura) y reserva devuelta y cancelada: esto dispara el email con el abono.
  let creditNumber = "";
  const cn = await sb.rpc("issue_credit_note", { p_booking: b.id, p_reason: String(body.reason ?? "").slice(0, 200) });
  if (!cn.error && cn.data) creditNumber = (cn.data as { number: string }).number;
  const up = await sb.from("bookings").update({ payment_status: "refunded", status: "cancelled" }).eq("id", b.id);
  if (up.error) return json({ error: "refund_done_but_not_saved", detail: up.error.message, credit_note: creditNumber }, 500);
  return json({ ok: true, method: manual ? "manual" : "redsys", credit_note: creditNumber });
}

// ─── Mesas: fianza de la reserva ────────────────────────────────────────
// La reserva de mesa con fianza se crea "pendiente" (book_table / dining_admin_create) y se confirma cuando
// Redsys avisa del cobro. Se identifica por su código secreto (token), el mismo del enlace del email.
async function handlePayTable(body: { token?: string; lang?: string; return_base?: string }): Promise<Response> {
  const cfg = config();
  if (!cfg.enabled) return json({ error: "disabled" }, 503);
  const token = String(body.token ?? "");
  if (!/^[a-f0-9]{32}$/.test(token)) return json({ error: "not_found" }, 404);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: b } = await sb.from("table_bookings")
    .select("id, ref, name, deposit_cents, status, payment_status, hold_until, starts_at, lang, zone_id, pay_mode")
    .eq("token", token).maybeSingle();
  if (!b) return json({ error: "not_found" }, 404);
  if (b.payment_status === "paid") return json({ error: "already_paid" }, 409);
  if (b.status !== "pending" || b.payment_status !== "pending" || b.deposit_cents <= 0) return json({ error: "not_payable" }, 409);
  if (Date.parse(b.hold_until) < Date.now() || Date.parse(b.starts_at) <= Date.now()) return json({ error: "expired" }, 410);

  // Mientras el cliente paga, la mesa se le guarda un cuarto de hora más.
  const extend = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  if (Date.parse(b.hold_until) < Date.parse(extend)) await sb.from("table_bookings").update({ hold_until: extend }).eq("id", b.id);

  // Zona con garantía de tarjeta: no se cobra nada, solo se pide la tarjeta y Redsys guarda una referencia.
  const { data: zone } = await sb.from("dining_zones").select("payment_mode").eq("id", b.zone_id).maybeSingle();
  // El tipo de garantía es el de la reserva (si se creó desde el panel con uno concreto) o el de la zona.
  const guarantee = (b.pay_mode || zone?.payment_mode) === "card";
  const guaranteeCents = Math.max(0, Number(Deno.env.get("REDSYS_GUARANTEE_AMOUNT") ?? "0") || 0);

  let order = "";
  for (let i = 0; i < 5 && !order; i++) {
    const candidate = newOrder();
    const { error } = await sb.from("payments").insert({
      order_id: candidate, table_booking_id: b.id,
      amount_cents: guarantee ? guaranteeCents : b.deposit_cents, purpose: guarantee ? "guarantee" : "payment",
    });
    if (!error) order = candidate;
  }
  if (!order) return json({ error: "order_failed" }, 500);

  const base = cfg.origins.includes(String(body.return_base ?? "").replace(/\/+$/, "")) ? String(body.return_base).replace(/\/+$/, "") : cfg.site;
  const back = (status: string) => `${base}/reserva/?t=${token}&status=${status}`;
  const params: Record<string, string> = {
    DS_MERCHANT_AMOUNT: String(guarantee ? guaranteeCents : b.deposit_cents),
    DS_MERCHANT_ORDER: order,
    DS_MERCHANT_MERCHANTCODE: cfg.merchant,
    DS_MERCHANT_CURRENCY: "978",
    DS_MERCHANT_TRANSACTIONTYPE: "0",
    DS_MERCHANT_TERMINAL: cfg.terminal,
    DS_MERCHANT_MERCHANTURL: `${Deno.env.get("SUPABASE_URL")}/functions/v1/redsys`,
    DS_MERCHANT_URLOK: back("ok"),
    DS_MERCHANT_URLKO: back("ko"),
    DS_MERCHANT_CONSUMERLANGUAGE: (body.lang ?? b.lang) === "en" ? "002" : "001",
    DS_MERCHANT_PRODUCTDESCRIPTION: ascii((guarantee ? "Garantia reserva de mesa ROCE " : "Fianza reserva de mesa ROCE ") + b.ref).slice(0, 120),
    DS_MERCHANT_TITULAR: ascii(b.name || "Cliente").slice(0, 60),
    DS_MERCHANT_MERCHANTNAME: ascii(cfg.name).slice(0, 25),
  };
  if (guarantee) {
    // Tarjeta en archivo: la primera operación (con el cliente delante) pide una referencia para poder cobrar
    // después, solo si no se presenta. Redsys devuelve Ds_Merchant_Identifier (la referencia) en el aviso.
    params.DS_MERCHANT_IDENTIFIER = "REQUIRED";
    params.DS_MERCHANT_COF_INI = "S";
    params.DS_MERCHANT_COF_TYPE = Deno.env.get("REDSYS_COF_TYPE") || "N";
  }
  const merchantParameters = toB64(JSON.stringify(params));
  return json({
    url: URLS[cfg.env],
    Ds_SignatureVersion: "HMAC_SHA256_V1",
    Ds_MerchantParameters: merchantParameters,
    Ds_Signature: await sign(cfg.key, order, merchantParameters),
    guarantee,
  });
}

// ─── App de pedidos: cobro de un pedido a mesa / para recoger ─────────────
// El cliente ya ha creado el pedido con app_create_order (los precios los calcula la base de datos). Aquí solo se firma el cobro
// de SU pedido (se comprueba con su sesión) y se vuelve siempre a la app.
const APP_ORIGIN = "https://app.roce.es";
const APP_HOLD_MS = 30 * 60 * 1000; // el pedido sin pagar caduca a los 30 min
async function handlePayApp(req: Request, body: { order_id?: string; lang?: string }): Promise<Response> {
  const cfg = config();
  if (!cfg.enabled) return json({ error: "disabled" }, 503);
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: me } = await caller.auth.getUser();
  const uid = me.user?.id;
  if (!uid) return json({ error: "unauthorized" }, 401);

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: o } = await sb.from("app_orders")
    .select("id, ref, customer_id, name, total_cents, status, payment_status, created_at, lang")
    .eq("id", String(body.order_id ?? "")).maybeSingle();
  if (!o || o.customer_id !== uid) return json({ error: "not_found" }, 404);
  if (o.payment_status === "paid") return json({ error: "already_paid" }, 409);
  if (o.status !== "pending_payment" || !["pending", "failed"].includes(o.payment_status) || o.total_cents <= 0) return json({ error: "not_payable" }, 409);
  if (Date.now() - Date.parse(o.created_at) > APP_HOLD_MS) return json({ error: "expired" }, 410);
  if (o.payment_status === "failed") await sb.from("app_orders").update({ payment_status: "pending" }).eq("id", o.id);

  // Un intento de pago = un número de pedido nuevo (Redsys no admite repetirlo).
  let order = "";
  for (let i = 0; i < 5 && !order; i++) {
    const candidate = newOrder();
    const { error } = await sb.from("payments").insert({ order_id: candidate, app_order_id: o.id, amount_cents: o.total_cents });
    if (!error) order = candidate;
  }
  if (!order) return json({ error: "order_failed" }, 500);

  const back = (status: string) => `${APP_ORIGIN}/?pago=${status}&ref=${encodeURIComponent(o.ref)}`;
  const params = {
    DS_MERCHANT_AMOUNT: String(o.total_cents),
    DS_MERCHANT_ORDER: order,
    DS_MERCHANT_MERCHANTCODE: cfg.merchant,
    DS_MERCHANT_CURRENCY: "978",
    DS_MERCHANT_TRANSACTIONTYPE: "0",
    DS_MERCHANT_TERMINAL: cfg.terminal,
    DS_MERCHANT_MERCHANTURL: `${url}/functions/v1/redsys`,
    DS_MERCHANT_URLOK: back("ok"),
    DS_MERCHANT_URLKO: back("ko"),
    DS_MERCHANT_CONSUMERLANGUAGE: (body.lang ?? o.lang) === "en" ? "002" : "001",
    DS_MERCHANT_PRODUCTDESCRIPTION: ascii("Pedido ROCE " + o.ref).slice(0, 120),
    DS_MERCHANT_TITULAR: ascii(o.name || "Cliente").slice(0, 60),
    DS_MERCHANT_MERCHANTNAME: ascii(cfg.name).slice(0, 25),
  };
  const merchantParameters = toB64(JSON.stringify(params));
  return json({
    url: URLS[cfg.env],
    Ds_SignatureVersion: "HMAC_SHA256_V1",
    Ds_MerchantParameters: merchantParameters,
    Ds_Signature: await sign(cfg.key, order, merchantParameters),
  });
}

// Devolución de la fianza de una mesa. Dos formas de llamarla:
//   · el cliente, justo después de anular su reserva a tiempo: {token}. Solo funciona si la reserva está anulada
//     con "refund_due" (lo decide la base de datos al anular, según las horas de antelación de la zona);
//   · el equipo desde el panel: {booking_id, manual?} con sesión de alguien con la pestaña Mesas. Puede devolver
//     también una fianza retenida (si se decide hacer un gesto) y registrar una devolución hecha a mano en el banco.
async function handleTableRefund(req: Request, body: { token?: string; booking_id?: string; manual?: boolean; reason?: string }): Promise<Response> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let who = "cliente";
  let staff = false;
  if (body.booking_id) {
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false },
    });
    const { data: ok } = await caller.rpc("has_tab", { t: "tables" });
    if (ok !== true) return json({ error: "forbidden" }, 403);
    const { data: me } = await caller.auth.getUser();
    who = (me.user?.email ?? "").toLowerCase();
    staff = true;
  } else if (!/^[a-f0-9]{32}$/.test(String(body.token ?? ""))) {
    return json({ error: "not_found" }, 404);
  }

  const q = sb.from("table_bookings").select("id, ref, status, payment_status, deposit_cents, refund_due");
  const { data: b } = await (staff ? q.eq("id", String(body.booking_id)) : q.eq("token", String(body.token))).maybeSingle();
  if (!b) return json({ error: "not_found" }, 404);
  if (b.payment_status === "refunded") return json({ error: "already_refunded" }, 409);
  if (staff ? !["paid", "retained", "charged"].includes(b.payment_status) : !(b.status === "cancelled" && b.refund_due && b.payment_status === "paid")) {
    return json({ error: "not_refundable" }, 409);
  }
  const { data: pay } = await sb.from("payments").select("order_id, amount_cents")
    .eq("table_booking_id", b.id).eq("status", "paid").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const manual = staff && body.manual === true;
  if (!manual && !pay) return json({ error: "no_online_payment" }, 409);

  // Candado: una devolución por reserva; si una anterior falló se puede reintentar.
  const row = { table_booking_id: b.id, order_id: pay?.order_id ?? null, amount_cents: b.deposit_cents, method: manual ? "manual" : "redsys", status: "started", requested_by: who };
  const ins = await sb.from("table_refunds").insert(row);
  if (ins.error) {
    const { data: prev } = await sb.from("table_refunds").select("status").eq("table_booking_id", b.id).maybeSingle();
    if (!prev || prev.status !== "failed") return json({ error: prev?.status === "done" ? "already_refunded" : "refund_in_progress" }, 409);
    await sb.from("table_refunds").update({ ...row, response_code: null, updated_at: new Date().toISOString() }).eq("table_booking_id", b.id);
  }
  const fail = async (code: string, detail: string, status = 502) => {
    await sb.from("table_refunds").update({ status: "failed", response_code: code.slice(0, 10), updated_at: new Date().toISOString() }).eq("table_booking_id", b.id);
    return json({ error: "bank_refused", code, detail }, status);
  };

  if (!manual) {
    const cfg = config();
    if (!cfg.enabled) return await fail("CONFIG", "Pasarela sin configurar", 503);
    const params = {
      DS_MERCHANT_AMOUNT: String(pay!.amount_cents),
      DS_MERCHANT_ORDER: pay!.order_id,
      DS_MERCHANT_MERCHANTCODE: cfg.merchant,
      DS_MERCHANT_CURRENCY: "978",
      DS_MERCHANT_TRANSACTIONTYPE: "3", // devolución
      DS_MERCHANT_TERMINAL: cfg.terminal,
    };
    const merchantParameters = toB64(JSON.stringify(params));
    let out: Record<string, unknown>;
    try {
      const r = await fetch(REST_URLS[cfg.env], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Ds_SignatureVersion: "HMAC_SHA256_V1",
          Ds_MerchantParameters: merchantParameters,
          Ds_Signature: await sign(cfg.key, pay!.order_id, merchantParameters),
        }),
        signal: AbortSignal.timeout(25000),
      });
      out = await r.json();
    } catch (e) {
      return await fail("NETWORK", "No se pudo contactar con el banco: " + String(e).slice(0, 120));
    }
    if (out.errorCode) return await fail(String(out.errorCode), "El banco ha rechazado la petición");
    let resp: Record<string, unknown>;
    try { resp = fromB64Json(String(out.Ds_MerchantParameters ?? "")); } catch { return await fail("RESPONSE", "Respuesta del banco ilegible"); }
    const get = (name: string) => { const k = Object.keys(resp).find((x) => x.toLowerCase() === name.toLowerCase()); return k ? String(resp[k]) : ""; };
    const expected = await sign(cfg.key, get("Ds_Order") || pay!.order_id, String(out.Ds_MerchantParameters));
    if (!safeEqual(canon(expected), canon(String(out.Ds_Signature ?? "")))) return await fail("SIGNATURE", "Firma de la respuesta no válida: compruébalo en el portal del banco");
    const code = get("Ds_Response");
    if (code !== "0900") return await fail(code || "UNKNOWN", "El banco no ha aceptado la devolución (código " + (code || "?") + ")");
    await sb.from("table_refunds").update({ status: "done", response_code: code, updated_at: new Date().toISOString() }).eq("table_booking_id", b.id);
  } else {
    await sb.from("table_refunds").update({ status: "done", response_code: "MANUAL", updated_at: new Date().toISOString() }).eq("table_booking_id", b.id);
  }

  const up = await sb.from("table_bookings")
    .update({ payment_status: "refunded", refund_due: false, status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", b.id);
  if (up.error) return json({ error: "refund_done_but_not_saved", detail: up.error.message }, 500);
  return json({ ok: true, method: manual ? "manual" : "redsys" });
}

// Devolución (total o parcial) de un pedido de la app cobrado con Redsys. Solo el equipo, desde RoceCover.
// Reserva el importe en la base de datos antes de llamar al banco (no se puede devolver dos veces lo mismo ni más de lo cobrado) y,
// si el banco la acepta, actualiza el pedido y resta lo devuelto del gasto de la visita. Con {manual: true} solo se registra una
// devolución que ya se hizo a mano en el portal del banco. Los abonos fiscales los emite Ágora, no esta función.
async function handleAppRefund(req: Request, body: { order_id?: string; amount_cents?: number; manual?: boolean; reason?: string }): Promise<Response> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: ok } = await caller.rpc("has_tab", { t: "tables" });
  if (ok !== true) return json({ error: "forbidden" }, 403);
  const { data: me } = await caller.auth.getUser();
  const who = (me.user?.email ?? "").toLowerCase();

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: o } = await sb.from("app_orders").select("id, ref, total_cents, refunded_cents, payment_status").eq("id", String(body.order_id ?? "")).maybeSingle();
  if (!o) return json({ error: "not_found" }, 404);
  if (o.payment_status === "refunded") return json({ error: "already_refunded" }, 409);
  if (o.payment_status !== "paid") return json({ error: "not_refundable" }, 409);
  const open = o.total_cents - (o.refunded_cents ?? 0);
  const amount = Number.isInteger(body.amount_cents) ? Number(body.amount_cents) : open;
  if (amount < 1 || amount > open) return json({ error: "bad_amount" }, 400);
  const manual = body.manual === true;

  const { data: rsv, error: rerr } = await sb.rpc("app_refund_reserve", {
    p_order: o.id, p_amount: amount, p_by: who, p_manual: manual, p_reason: String(body.reason ?? "").slice(0, 200),
  });
  if (rerr) {
    const m = String(rerr.message ?? "");
    const known = ["refund_in_progress", "no_online_payment", "bad_amount", "not_refundable", "not_found"].find((k) => m.includes(k));
    return json({ error: known ?? "reserve_failed", detail: known ? undefined : m.slice(0, 160) }, known === "not_found" ? 404 : 409);
  }
  const rid = (rsv as { id: number; order_id: string | null }).id;
  const payOrder = (rsv as { order_id: string | null }).order_id;
  const finish = async (good: boolean, code: string) => { await sb.rpc("app_refund_finish", { p_id: rid, p_ok: good, p_code: code }); };
  const fail = async (code: string, detail: string, status = 502) => {
    await finish(false, code);
    return json({ error: "bank_refused", code, detail }, status);
  };

  if (!manual) {
    const cfg = config();
    if (!cfg.enabled) return await fail("CONFIG", "Pasarela sin configurar", 503);
    const params = {
      DS_MERCHANT_AMOUNT: String(amount),
      DS_MERCHANT_ORDER: payOrder,
      DS_MERCHANT_MERCHANTCODE: cfg.merchant,
      DS_MERCHANT_CURRENCY: "978",
      DS_MERCHANT_TRANSACTIONTYPE: "3", // devolución
      DS_MERCHANT_TERMINAL: cfg.terminal,
    };
    const merchantParameters = toB64(JSON.stringify(params));
    let out: Record<string, unknown>;
    try {
      const r = await fetch(REST_URLS[cfg.env], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Ds_SignatureVersion: "HMAC_SHA256_V1",
          Ds_MerchantParameters: merchantParameters,
          Ds_Signature: await sign(cfg.key, String(payOrder), merchantParameters),
        }),
        signal: AbortSignal.timeout(25000),
      });
      out = await r.json();
    } catch (e) {
      return await fail("NETWORK", "No se pudo contactar con el banco: " + String(e).slice(0, 120));
    }
    if (out.errorCode) return await fail(String(out.errorCode), "El banco ha rechazado la petición");
    let resp: Record<string, unknown>;
    try { resp = fromB64Json(String(out.Ds_MerchantParameters ?? "")); } catch { return await fail("RESPONSE", "Respuesta del banco ilegible"); }
    const get = (name: string) => { const k = Object.keys(resp).find((x) => x.toLowerCase() === name.toLowerCase()); return k ? String(resp[k]) : ""; };
    const expected = await sign(cfg.key, get("Ds_Order") || String(payOrder), String(out.Ds_MerchantParameters));
    if (!safeEqual(canon(expected), canon(String(out.Ds_Signature ?? "")))) return await fail("SIGNATURE", "Firma de la respuesta no válida: compruébalo en el portal del banco");
    const code = get("Ds_Response");
    if (code !== "0900") return await fail(code || "UNKNOWN", "El banco no ha aceptado la devolución (código " + (code || "?") + ")");
    await finish(true, code);
  } else {
    await finish(true, "MANUAL");
  }
  return json({ ok: true, method: manual ? "manual" : "redsys", refunded_cents: amount, remaining_cents: open - amount });
}

// Cobro de la penalización a la tarjeta guardada (solo el equipo, desde el panel: no se presentó o anuló tarde).
// Operación iniciada por el comercio (MIT) con la referencia que devolvió Redsys al guardar la tarjeta.
async function handleTableCharge(req: Request, body: { booking_id?: string; token?: string; no_show?: boolean }): Promise<Response> {
  const url = Deno.env.get("SUPABASE_URL")!;
  // Dos formas de llamarla: el equipo desde el panel ({booking_id}, p. ej. al pulsar "No vino"), o el propio cliente justo
  // después de anular con poca antelación ({token}): solo funciona si la base de datos ya marcó la anulación como tardía.
  let who = "cliente";
  const staff = !!body.booking_id;
  if (staff) {
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      auth: { persistSession: false },
    });
    const { data: ok } = await caller.rpc("has_tab", { t: "tables_charge" });
    if (ok !== true) return json({ error: "forbidden" }, 403);
    const { data: me } = await caller.auth.getUser();
    who = (me.user?.email ?? "").toLowerCase();
  } else if (!/^[a-f0-9]{32}$/.test(String(body.token ?? ""))) {
    return json({ error: "not_found" }, 404);
  }

  const cfg = config();
  if (!cfg.enabled) return json({ error: "disabled" }, 503);
  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const q = sb.from("table_bookings").select("id, ref, status, payment_status, deposit_cents, party, zone_id, late_cancel");
  const { data: b } = await (staff ? q.eq("id", String(body.booking_id)) : q.eq("token", String(body.token))).maybeSingle();
  if (!b) return json({ error: "not_found" }, 404);
  if (!staff && !(b.status === "cancelled" && b.late_cancel === true)) return json({ error: "not_chargeable" }, 409);
  if (b.payment_status === "charged") return json({ error: "already_charged" }, 409);
  if (b.payment_status !== "guaranteed") return json({ error: "no_guarantee" }, 409);
  const { data: z } = await sb.from("dining_zones").select("deposit_cents, deposit_per_person").eq("id", b.zone_id).maybeSingle();
  const amount = b.deposit_cents > 0 ? b.deposit_cents : (z ? (z.deposit_per_person ? z.deposit_cents * b.party : z.deposit_cents) : 0);
  if (amount <= 0) return json({ error: "no_amount" }, 409);
  const { data: card } = await sb.from("table_booking_cards").select("token, txnid").eq("booking_id", b.id).maybeSingle();
  if (!card?.token) return json({ error: "no_card" }, 409);

  // Candado: pasa a "cobrando" solo si seguía con la garantía (un doble clic no cobra dos veces).
  const lock = await sb.from("table_bookings").update({ payment_status: "charging" }).eq("id", b.id).eq("payment_status", "guaranteed").select("id");
  if (lock.error || !lock.data || lock.data.length !== 1) return json({ error: "charge_in_progress" }, 409);
  const unlock = async () => { await sb.from("table_bookings").update({ payment_status: "guaranteed" }).eq("id", b.id).eq("payment_status", "charging"); };

  let order = "";
  for (let i = 0; i < 5 && !order; i++) {
    const candidate = newOrder();
    const { error } = await sb.from("payments").insert({ order_id: candidate, table_booking_id: b.id, amount_cents: amount, purpose: "payment" });
    if (!error) order = candidate;
  }
  if (!order) { await unlock(); return json({ error: "order_failed" }, 500); }

  const params: Record<string, string> = {
    DS_MERCHANT_AMOUNT: String(amount),
    DS_MERCHANT_ORDER: order,
    DS_MERCHANT_MERCHANTCODE: cfg.merchant,
    DS_MERCHANT_CURRENCY: "978",
    DS_MERCHANT_TRANSACTIONTYPE: "0",
    DS_MERCHANT_TERMINAL: cfg.terminal,
    DS_MERCHANT_IDENTIFIER: card.token,
    DS_MERCHANT_DIRECTPAYMENT: "true",
    DS_MERCHANT_EXCEPTION_SCA: "MIT",
    DS_MERCHANT_COF_INI: "N",
    DS_MERCHANT_COF_TYPE: Deno.env.get("REDSYS_COF_TYPE") || "N",
  };
  if (card.txnid) params.DS_MERCHANT_COF_TXNID = card.txnid;
  const merchantParameters = toB64(JSON.stringify(params));
  const failCharge = async (code: string, detail: string, status = 502) => {
    await sb.from("payments").update({ status: "failed", response_code: code.slice(0, 10), updated_at: new Date().toISOString() }).eq("order_id", order);
    await unlock();
    return json({ error: "bank_refused", code, detail }, status);
  };
  let out: Record<string, unknown>;
  try {
    const r = await fetch(REST_URLS[cfg.env], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Ds_SignatureVersion: "HMAC_SHA256_V1", Ds_MerchantParameters: merchantParameters, Ds_Signature: await sign(cfg.key, order, merchantParameters) }),
      signal: AbortSignal.timeout(25000),
    });
    out = await r.json();
  } catch (e) {
    // Sin respuesta no sabemos si cobró: se deja en "cobrando" para revisarlo a mano en el portal del banco.
    await sb.from("payments").update({ status: "failed", response_code: "NETWORK", updated_at: new Date().toISOString() }).eq("order_id", order);
    return json({ error: "unknown_result", detail: "Sin respuesta del banco: comprueba en el portal de Redsys si el cobro (pedido " + order + ") se hizo antes de reintentar. " + String(e).slice(0, 80) }, 504);
  }
  if (out.errorCode) return await failCharge(String(out.errorCode), "El banco ha rechazado la petición");
  let resp: Record<string, unknown>;
  try { resp = fromB64Json(String(out.Ds_MerchantParameters ?? "")); } catch { return await failCharge("RESPONSE", "Respuesta del banco ilegible"); }
  const get = (name: string) => { const k = Object.keys(resp).find((x) => x.toLowerCase() === name.toLowerCase()); return k ? String(resp[k]) : ""; };
  const expected = await sign(cfg.key, get("Ds_Order") || order, String(out.Ds_MerchantParameters));
  if (!safeEqual(canon(expected), canon(String(out.Ds_Signature ?? "")))) return await failCharge("SIGNATURE", "Firma de la respuesta no válida: compruébalo en el portal del banco");
  const code = get("Ds_Response");
  if (!/^[0-9]{1,4}$/.test(code) || Number(code) > 99) return await failCharge(code || "UNKNOWN", "El banco no ha aceptado el cobro (código " + (code || "?") + ")");

  await sb.from("payments").update({ status: "paid", response_code: code, auth_code: get("Ds_AuthorisationCode").slice(0, 20), updated_at: new Date().toISOString() }).eq("order_id", order);
  const next: Record<string, unknown> = { payment_status: "charged", fee_charged_cents: amount };
  if (body.no_show !== false && b.status === "confirmed") next.status = "no_show";
  const up = await sb.from("table_bookings").update(next).eq("id", b.id);
  if (up.error) return json({ error: "charged_but_not_saved", detail: up.error.message, order, charged_by: who }, 500);
  return json({ ok: true, amount_cents: amount });
}

// ─── Redsys → función (notificación del cobro) ──────────────────────────
async function handleNotification(req: Request): Promise<Response> {
  const cfg = config();
  if (!cfg.enabled) return new Response("disabled", { status: 503 });

  const form = await req.formData();
  const version = String(form.get("Ds_SignatureVersion") ?? "");
  const paramsB64 = String(form.get("Ds_MerchantParameters") ?? "");
  const received = String(form.get("Ds_Signature") ?? "");
  if (version !== "HMAC_SHA256_V1" || !paramsB64 || !received) return new Response("bad request", { status: 400 });

  let p: Record<string, unknown>;
  try { p = fromB64Json(paramsB64); } catch { return new Response("bad parameters", { status: 400 }); }
  const get = (name: string) => {
    const k = Object.keys(p).find((x) => x.toLowerCase() === name.toLowerCase());
    return k ? String(p[k]) : "";
  };
  const order = get("Ds_Order");
  if (!order) return new Response("bad parameters", { status: 400 });

  const expected = await sign(cfg.key, order, paramsB64);
  if (!safeEqual(canon(expected), canon(received))) {
    console.warn("redsys: firma no válida para el pedido", order);
    return new Response("bad signature", { status: 400 });
  }
  if (get("Ds_MerchantCode") && get("Ds_MerchantCode") !== cfg.merchant) return new Response("bad merchant", { status: 400 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // Alta de tarjeta (garantía de reserva): no hay cobro, la notificación trae la referencia de la tarjeta.
  const { data: payRow } = await sb.from("payments").select("purpose").eq("order_id", order).maybeSingle();
  if (payRow?.purpose === "guarantee") {
    const g = await sb.rpc("confirm_guarantee", {
      p_order: order, p_response: get("Ds_Response"), p_token: get("Ds_Merchant_Identifier"), p_expiry: get("Ds_ExpiryDate"),
      p_txnid: get("Ds_Merchant_Cof_Txnid"), p_masked: get("Ds_Card_Number"), p_brand: get("Ds_Card_Brand"),
    });
    if (g.error) { console.error("redsys: confirm_guarantee", g.error.message); return new Response("error", { status: 500 }); }
    console.log("redsys guarantee:", order, get("Ds_Response"), g.data);
    return new Response("OK");
  }
  const { data, error } = await sb.rpc("confirm_payment", {
    p_order: order,
    p_amount: Number(get("Ds_Amount")),
    p_response: get("Ds_Response"),
    p_auth: get("Ds_AuthorisationCode"),
  });
  if (error) { console.error("redsys: confirm_payment", error.message); return new Response("error", { status: 500 }); }
  console.log("redsys:", order, get("Ds_Response"), data);
  return new Response("OK"); // siempre 200 si la firma es buena, para que Redsys no reintente
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") {
    const u = new URL(req.url);
    return u.searchParams.has("qr") ? handleQr(u) : json({ error: "method" }, 405);
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return await handleJson(req);
  return await handleNotification(req);
});
