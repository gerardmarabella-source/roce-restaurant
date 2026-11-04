// Pasarela de pago Redsys (pago por redirección al TPV virtual).
//
// Una sola función con dos caras:
//   · La web le habla en JSON:  {action: "status"}  o  {action: "pay", ref, lang, return_base}
//     "pay" devuelve los datos firmados que la web envía al banco; la clave secreta
//     nunca sale de aquí.
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
  let body: { action?: string; ref?: string; lang?: string; return_base?: string; booking_id?: string; manual?: boolean; reason?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  if (body.action === "status") return json({ enabled: cfg.enabled, env: cfg.env });
  if (body.action === "refund") return await handleRefund(req, body as RefundBody);
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
