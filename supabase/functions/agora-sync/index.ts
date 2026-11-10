// Edge Function de Supabase de ROCE: integración con Ágora (TPV).
//  · Por defecto (sin acción): precios de la app desde Ágora. Ágora manda en los precios: cada 10 minutos (pg_cron, ver
//    agora_sync.sql) pide a Ágora sus productos y copia el precio de cada uno a app_menu_items (price_cents) y a los extras
//    de las tostadas y del bol. Si Ágora no responde (PC apagado, sin internet) se mantienen los últimos precios y se anota el error.
//    No hace nada si la última sincronización fue hace menos de 60 s.
//  · {"action":"push"}: envía a Ágora los pedidos de la app ya pagados (ver agora_pedidos.sql). Cada pedido se importa como
//    pedido de la serie WP, con sus líneas, extras, nota y el pago «App Online»; Ágora lo manda a cocina/barra y luego factura
//    él (la factura y los abonos los emite Ágora). Es seguro llamarla a menudo: solo envía lo pendiente y reintenta los errores.
// Secretos: AGORA_API_TOKEN (token del API de Ágora), AGORA_URL (opcional, por defecto https://roce.tpvvalencia.es),
//           AGORA_SERIE (opcional, serie de pedidos de la app; por defecto WP).
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

// Extras (nombre en la app → producto «EXTRA …» de Ágora). Los de «Más proteína» van por agora_id en su propia fila.
const EXTRA_IDS: Record<string, number> = {
  "Bacon": 51, "Aguacate": 52, "Salmón": 53, "Huevo": 54, "Jamón": 55,
  "Fruta": 56, "Granola": 57, "Crema de cacahuete": 58,
};

// Datos fijos de Ágora de ROCE (centro de venta «App», usuario ROCE, forma de pago «App Online», TPV WEB).
const SALE_CENTER = { Id: 2, Name: "App" };
const USER = { Id: 2, Name: "ROCE" };
const POS = { Id: 2, Name: "TPV WEB" };
const WORKPLACE = { Id: 1, Name: "ROCE" };
const PAY_METHOD = { Id: 7, Name: "App Online" };

async function agoraGet(base: string, token: string, filter: string): Promise<any> {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25_000);
  try {
    const r = await fetch(`${base}/api/export-master/?filter=${filter}`, { headers: { "Api-Token": token }, signal: ctl.signal });
    if (!r.ok) throw new Error(`Ágora respondió ${r.status}` + (r.status === 401 ? ` (el token guardado tiene ${token.length} caracteres)` : ""));
    return await r.json();
  } finally { clearTimeout(to); }
}

// ───────────────────────── Pedidos de la app → Ágora ─────────────────────────
const money = (c: number) => Math.round(c) / 100;

// Fecha y hora de Madrid («aaaa-mm-ddThh:mm:ss») y día de negocio (hasta las 05:00 cuenta como el día anterior).
function madrid(d: Date) {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(d).forEach((x) => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
const businessDay = (d: Date) => madrid(new Date(d.getTime() - 5 * 3600_000)).slice(0, 10);

function buildOrder(serie: string, ord: any, items: any[], agoraOf: Map<string, number>, prod: Map<number, any>, vats: Map<number, any>, fam: Map<number, string>, pt: Map<number, string>, po: Map<number, string>) {
  const paid = new Date(ord.paid_at ?? ord.created_at), now = madrid(paid);
  const info = (id: number) => {
    const p = prod.get(id); if (!p) throw new Error(`producto ${id} no existe en Ágora`);
    const v = vats.get(p.VatId); if (!v) throw new Error(`IVA ${p.VatId} no existe en Ágora`);
    return { p, v };
  };
  const lines = items.map((it, idx) => {
    const aid = agoraOf.get(it.item_key);
    if (!aid) throw new Error(`«${it.name}» (${it.item_key}) no tiene producto en Ágora`);
    const { p, v } = info(aid);
    const addins = (Array.isArray(it.extras) ? it.extras : []).map((name: string) => {
      const eid = EXTRA_IDS[name]; if (!eid) throw new Error(`extra «${name}» sin producto en Ágora`);
      const e = info(eid), price = (e.p.Prices ?? []).find((x: any) => x.PriceListId === 1) ?? (e.p.Prices ?? [])[0];
      return { id: eid, ...e, cents: Math.round(Number(price?.MainPrice ?? 0) * 100) };
    });
    // Lo que paga el cliente manda: el precio base se calcula restando los extras a lo cobrado, así el total coincide con Redsys.
    const addSum = addins.reduce((n: number, a: any) => n + a.cents, 0);
    const base = it.unit_cents - addSum;
    const notes = [it.variant, it.note].filter((x: string) => x && x.trim()).join(" · ").slice(0, 250);
    return {
      Index: idx, Type: "Standard", CreationDate: now, ParentIndex: null, MenuGroup: "",
      ProductId: aid, ProductName: p.Name, SaleFormatId: p.BaseSaleFormatId, SaleFormatName: p.Name, SaleFormatRatio: 1.0, MainBarcode: "",
      ProductPrice: money(base), Quantity: it.qty, VatId: p.VatId, VatRate: v.VatRate, SurchargeRate: v.SurchargeRate, UserId: USER.Id,
      UnitPrice: money(it.unit_cents), DiscountRate: 0.0, CashDiscount: 0.0, TotalAmount: money(it.unit_cents * it.qty),
      UnitCostPrice: 0.0, TotalCostPrice: 0.0,
      PreparationTypeId: p.PreparationTypeId ?? null, PreparationTypeName: pt.get(p.PreparationTypeId) ?? "", PLU: p.PLU ?? "",
      FamilyId: p.FamilyId, FamilyName: fam.get(p.FamilyId) ?? "", PreparationOrderId: p.PreparationOrderId ?? null, PreparationOrderName: po.get(p.PreparationOrderId) ?? "",
      PriceListId: 1, Notes: notes,
      Addins: addins.map((a: any) => ({
        ProductId: a.id, ProductName: a.p.Name, SaleFormatId: a.p.BaseSaleFormatId, SaleFormatName: a.p.Name, SaleFormatRatio: 1.0, MainBarcode: "",
        ProductPrice: money(a.cents), VatId: a.p.VatId, VatRate: a.v.VatRate, SurchargeRate: a.v.SurchargeRate, ProductCostPrice: 0.0,
        PreparationTypeId: a.p.PreparationTypeId ?? null, PreparationTypeName: pt.get(a.p.PreparationTypeId) ?? "", PLU: a.p.PLU ?? "",
        FamilyId: a.p.FamilyId, FamilyName: fam.get(a.p.FamilyId) ?? "",
      })),
    };
  });
  const sum = items.reduce((n, it) => n + it.unit_cents * it.qty, 0);
  const mesa = ord.mode === "mesa";
  const notes = [ord.name ? `Cliente: ${ord.name}` : "", mesa ? "" : "PARA RECOGER", ord.notes].filter((x) => x && String(x).trim()).join(" · ").slice(0, 300);
  return {
    Serie: serie, Number: ord.agora_number, Type: mesa ? "Table" : "TakeAway", VatIncluded: true, BusinessDay: businessDay(paid), Date: now,
    Guests: mesa ? ord.party ?? null : null, Status: "Pending",
    // Comandas a cocina/barra solo la primera vez que entra (los reintentos no duplican). Para llevar manda la configuración de Ágora.
    AutoPrepare: "OnlyIfNew", AutoPrint: "Never", GlobalId: ord.id, CustomerDocumentNumber: ord.ref,
    Pos: POS, Workplace: WORKPLACE, User: USER, SaleCenter: { ...SALE_CENTER, Location: mesa ? String(ord.table_name ?? "") : "" },
    Notes: notes, Lines: lines,
    Payments: [{
      MethodId: PAY_METHOD.Id, MethodName: PAY_METHOD.Name, Amount: money(sum), PaidAmount: money(sum), ChangeAmount: 0.0, PosId: POS.Id, IsPrepayment: true,
      ExtraInformation: `Pago con tarjeta en la app (Redsys) · ${ord.ref}`,
    }],
  };
}

async function pushOrders(db: any, base: string, token: string, serie: string) {
  const { data: claimed, error } = await db.rpc("app_agora_claim", { p_limit: 5 });
  if (error) return json({ ok: false, error: "base de datos: " + error.message }, 500);
  const list: any[] = claimed ?? [];
  if (!list.length) return json({ ok: true, pushed: 0 });

  let master: any;
  try { master = await agoraGet(base, token, "Products,Vats,Families,PreparationTypes,PreparationOrders"); }
  catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    for (const c of list) await db.from("app_orders").update({ agora_status: "error", agora_error: "Ágora no responde: " + msg }).eq("id", c.order.id);
    return json({ ok: false, error: msg }, 502);
  }
  const prod = new Map<number, any>((master.Products ?? []).map((p: any): [number, any] => [p.Id, p]));
  const vats = new Map<number, any>((master.Vats ?? []).map((v: any): [number, any] => [v.Id, v]));
  const fam = new Map<number, string>((master.Families ?? []).map((f: any): [number, string] => [f.Id, f.Name]));
  const pt = new Map<number, string>((master.PreparationTypes ?? []).map((f: any): [number, string] => [f.Id, f.Name]));
  const po = new Map<number, string>((master.PreparationOrders ?? []).map((f: any): [number, string] => [f.Id, f.Name]));
  const { data: menu } = await db.from("app_menu_items").select("key, agora_id");
  const agoraOf = new Map<string, number>((menu ?? []).filter((m: any) => m.agora_id != null).map((m: any): [string, number] => [m.key, m.agora_id]));

  const results: any[] = [];
  for (const c of list) {
    const ord = c.order;
    try {
      const body = { SalesOrders: [buildOrder(serie, ord, c.items ?? [], agoraOf, prod, vats, fam, pt, po)] };
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25_000);
      const r = await fetch(`${base}/api/import/`, {
        method: "POST", signal: ctl.signal,
        headers: { "Api-Token": token, "Accept": "application/json", "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });
      clearTimeout(to);
      const txt = await r.text();
      if (!r.ok) throw new Error(`Ágora respondió ${r.status}: ${txt.slice(0, 200)}`);
      await db.from("app_orders").update({ agora_status: "sent", agora_error: null, agora_sent_at: new Date().toISOString(), agora_ref: `${serie}-${ord.agora_number}` }).eq("id", ord.id);
      results.push({ ref: ord.ref, ok: true });
    } catch (e) {
      const msg = (e as Error).message.slice(0, 300);
      await db.from("app_orders").update({ agora_status: "error", agora_error: msg }).eq("id", ord.id);
      results.push({ ref: ord.ref, ok: false, error: msg });
    }
  }
  return json({ ok: results.every((x) => x.ok), pushed: results.filter((x) => x.ok).length, results });
}

// ───────────────────────── Precios de Ágora → app ─────────────────────────
async function syncPrices(db: any, base: string, token: string) {
  // Freno: una sincronización cada 60 s como mucho (así nadie puede saturar el PC del local llamando a la función).
  const { data: st } = await db.from("app_agora_sync").select("last_run").eq("id", 1).maybeSingle();
  if (st?.last_run && Date.now() - new Date(st.last_run).getTime() < 60_000) return json({ ok: true, skipped: "reciente" });
  await db.from("app_agora_sync").upsert({ id: 1, last_run: new Date().toISOString() });

  const fail = async (msg: string) => {
    await db.from("app_agora_sync").upsert({ id: 1, last_run: new Date().toISOString(), ok: false, error: msg.slice(0, 300) });
    return json({ ok: false, error: msg }, 502);
  };

  let products: any[];
  try { products = (await agoraGet(base, token, "Products")).Products ?? []; }
  catch (e) { return await fail((e as Error).message); }
  if (!products.length) return await fail("Ágora no devolvió productos");

  // Precio de venta principal en la tarifa 1 («General», IVA incluido). Se ignoran precios no válidos (≤ 0).
  const price = new Map<number, number>();
  for (const p of products) {
    const pr = (p.Prices ?? []).find((x: any) => x.PriceListId === 1) ?? (p.Prices ?? [])[0];
    const c = pr ? Math.round(Number(pr.MainPrice) * 100) : NaN;
    if (Number.isFinite(c) && c > 0) price.set(p.Id, c);
  }

  const { data: rows, error } = await db.from("app_menu_items").select("key, price_cents, extras, agora_id");
  if (error) return await fail("base de datos: " + error.message);

  let changed = 0; const changes: string[] = [];
  for (const row of rows ?? []) {
    const upd: Record<string, unknown> = {};
    const c = row.agora_id != null ? price.get(row.agora_id) : undefined;
    if (c != null && c !== row.price_cents) { upd.price_cents = c; changes.push(`${row.key}: ${row.price_cents}→${c}`); }
    if (Array.isArray(row.extras) && row.extras.length) {
      let ex = false;
      const nx = row.extras.map((e: any) => {
        const id = EXTRA_IDS[e.k], cc = id != null ? price.get(id) : undefined;
        if (cc != null && cc !== e.cents) { ex = true; changes.push(`${row.key} extra ${e.k}: ${e.cents}→${cc}`); return { ...e, cents: cc }; }
        return e;
      });
      if (ex) upd.extras = nx;
    }
    if (Object.keys(upd).length) {
      const { error: ue } = await db.from("app_menu_items").update(upd).eq("key", row.key);
      if (ue) return await fail("no se pudo actualizar " + row.key + ": " + ue.message);
      changed++;
    }
  }
  await db.from("app_agora_sync").upsert({ id: 1, last_run: new Date().toISOString(), ok: true, error: null, changed, detail: changes.slice(0, 40).join("; ") });
  return json({ ok: true, products: products.length, changed, changes: changes.slice(0, 40) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  const db = sb();
  // Tolera que el secreto se haya pegado con «API: » delante o con espacios alrededor.
  const token = (Deno.env.get("AGORA_API_TOKEN") ?? "").replace(/^\s*API\s*:\s*/i, "").trim();
  if (!token) return json({ ok: false, error: "AGORA_API_TOKEN no configurado" }, 500);
  const base = (Deno.env.get("AGORA_URL") ?? "https://roce.tpvvalencia.es").replace(/\/+$/, "");
  const serie = (Deno.env.get("AGORA_SERIE") ?? "WP").trim();
  let body: any = {};
  try { body = await req.json(); } catch { /* sin cuerpo */ }
  if (body?.action === "push") return await pushOrders(db, base, token, serie);
  return await syncPrices(db, base, token);
});
