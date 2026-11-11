// Edge Function de Supabase de ROCE: integración con Ágora (TPV).
//  · Por defecto (sin acción): precios de la app desde Ágora. Ágora manda en los precios: cada minuto (pg_cron, ver
//    agora_sync.sql) pide a Ágora sus productos y copia el precio de cada uno a app_menu_items (price_cents) y a los extras
//    de las tostadas y del bol. Si Ágora no responde (PC apagado, sin internet) se mantienen los últimos precios y se anota el error.
//    No hace nada si la última sincronización fue hace menos de 45 s.
//  · {"action":"push"}: envía a Ágora los pedidos de la app ya pagados (ver agora_pedidos.sql). Cada pedido se importa como
//    pedido de la serie APP, con sus líneas, extras, nota y el pago «App Online»; Ágora lo manda a cocina/barra y luego factura
//    él (la factura y los abonos los emite Ágora). Es seguro llamarla a menudo: solo envía lo pendiente y reintenta los errores.
// Secretos: AGORA_API_TOKEN (token del API de Ágora), AGORA_URL (opcional, por defecto https://roce.tpvvalencia.es),
//           AGORA_SERIE (opcional, serie de pedidos de la app; por defecto APP: una serie de pedidos que NO usa el TPV ni el módulo web de Ágora).
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

// Extras (nombre en la app → producto «EXTRA …» de Ágora). Los de «Más proteína» van por agora_id en su propia fila.
const EXTRA_IDS: Record<string, number> = {
  "Bacon": 51, "Aguacate": 52, "Salmón": 53, "Huevo": 54, "Jamón": 55,
  "Fruta": 56, "Granola": 57, "Crema de cacahuete": 58,
  "Iced": 78, "Doble carga": 94, "Vegetal barista": 95, "Con hielo": 96, "Descafeinado": 77,   // complementos de los cafés
};
// En Ágora el precio de un extra es el «precio como complemento» (AddinPrice), que puede ser distinto del precio normal.
const addinCents = (p: any): number => {
  const pr = (p?.Prices ?? []).find((x: any) => x.PriceListId === 1) ?? (p?.Prices ?? [])[0];
  return Math.round(Number(pr?.AddinPrice ?? pr?.MainPrice ?? 0) * 100);
};

// Datos fijos de Ágora de ROCE (centro de venta «App», usuario ROCE, forma de pago «App Online», TPV WEB).
const SALE_CENTER = { Id: 2, Name: "App" };
const USER = { Id: 2, Name: "ROCE" };
const POS = { Id: 2, Name: "TPV WEB" };
const WORKPLACE = { Id: 1, Name: "ROCE" };
const PAY_METHOD = { Id: 7, Name: "App Online" };
// Ágora exige un cliente en cada pedido: se usa el «CLIENTE GENÉRICO» que ya existe (Id 1).
const CUSTOMER = { Id: 1, FiscalName: "CLIENTE GENÉRICO", Cif: "00000000", CountryCode: "ES", Street: "", City: "", Region: "", ZipCode: "", AccountCode: "", ApplySurcharge: false };

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

function buildOrder(serie: string, ord: any, items: any[], agoraOf: Map<string, number>, prod: Map<number, any>, vats: Map<number, any>, fam: Map<number, string>, pt: Map<number, string>, po: Map<number, string>, status = "Pending", refundCents = 0, customer: any = CUSTOMER) {
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
      const e = info(eid);
      return { id: eid, ...e, cents: addinCents(e.p) };
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
      UnitCostPrice: 0.0, TotalCostPrice: 0.0, ProductCostPrice: 0.0, OfferId: null, OfferCode: "", RemovedIngredients: [],
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
    Serie: serie, Number: ord.agora_number, Type: mesa ? "Table" : "TakeAway", VatIncluded: true, BusinessDay: businessDay(paid), Date: now, DeliveryDate: now,
    Guests: mesa ? ord.party ?? null : null, Status: status,
    // Comandas a cocina/barra solo la primera vez que entra (los reintentos no duplican). Para llevar manda la configuración de Ágora.
    AutoPrepare: "OnlyIfNew", AutoPrint: "Never", GlobalId: ord.id, CustomerDocumentNumber: ord.ref,
    Pos: POS, Workplace: WORKPLACE, User: USER, SaleCenter: { ...SALE_CENTER, Location: mesa ? String(ord.table_name ?? "") : "" },
    Customer: customer, DeliveryAddress: { Street: "", City: "", Region: "", ZipCode: "" }, Discounts: { DiscountRate: 0.0, CashDiscount: 0.0 },
    Notes: notes, Lines: lines,
    Payments: [{
      MethodId: PAY_METHOD.Id, MethodName: PAY_METHOD.Name, Amount: money(sum), PaidAmount: money(sum), ChangeAmount: 0.0, TipAmount: 0.0, Date: now, PosId: POS.Id, IsPrepayment: true,
      ExtraInformation: `Pago con tarjeta en la app (Redsys) · ${ord.ref}`,
    }].concat(refundCents > 0 ? [{
      // Devolución del dinero por Redsys: para anular el pedido en Ágora los pagos tienen que sumar cero.
      MethodId: PAY_METHOD.Id, MethodName: PAY_METHOD.Name, Amount: -money(refundCents), PaidAmount: -money(refundCents), ChangeAmount: 0.0, TipAmount: 0.0, Date: madrid(new Date()), PosId: POS.Id, IsPrepayment: true,
      ExtraInformation: `Devolución por Redsys · ${ord.ref}`,
    }] : []),
  };
}

// Cliente de Ágora para un pedido: si quien pide tiene datos de empresa (nombre fiscal y NIF) se crea o actualiza como cliente de Ágora
// y el pedido entra a su nombre, así el ticket o la factura salen con sus datos. Si no tiene (o Ágora no admite el cliente, p. ej. un NIF
// inválido) el pedido entra igualmente con el cliente genérico y los datos de factura quedan en la nota para facturarlo a mano.
async function customerFor(db: any, base: string, token: string, uid: string | null | undefined): Promise<{ customer: any; note: string }> {
  if (!uid) return { customer: CUSTOMER, note: "" };
  const { data } = await db.rpc("app_agora_customer", { p_uid: uid });
  if (!data) return { customer: CUSTOMER, note: "" };
  const note = `FACTURA A: ${data.name} · ${data.tax} · ${[data.address, data.postal, data.city].filter(Boolean).join(", ")}`;
  const c = {
    Id: data.id, FiscalName: data.name, BusinessName: data.name, Cif: String(data.tax).toUpperCase().replace(/[\s.-]+/g, ""), CountryCode: "ES",
    Street: data.address, City: data.city, Region: "", ZipCode: data.postal, Email: data.email, Telephone: data.phone, AccountCode: "", ApplySurcharge: false,
  };
  try {
    if (data.hash !== data.synced) {
      const r = await fetch(`${base}/api/import/`, {
        method: "POST", signal: AbortSignal.timeout(20_000),
        headers: { "Api-Token": token, "Accept": "application/json", "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ Customers: [{ ...c, PosGroups: { ValidForAll: true, ValidPosGroups: [] } }] }),
      });
      if (!r.ok) throw new Error(`Ágora respondió ${r.status}: ${(await r.text()).slice(0, 160)}`);
      await db.rpc("app_agora_customer_synced", { p_uid: uid, p_hash: data.hash });
    }
    return { customer: c, note: "" };
  } catch { return { customer: CUSTOMER, note }; }
}

// A veces Ágora guarda el pedido y corta la respuesta («unexpected end of file»): antes de dar un error se mira si el pedido ya está en Ágora.
async function existsInAgora(base: string, token: string, serie: string, ord: any): Promise<boolean> {
  try {
    const day = businessDay(new Date(ord.paid_at ?? ord.created_at));
    const r = await fetch(`${base}/api/export/?business-day=${day}&filter=SalesOrders&include-processed`, { headers: { "Api-Token": token }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return false;
    const d = await r.json();
    return (d.SalesOrders ?? []).some((o: any) => o.Serie === serie && o.Number === ord.agora_number && o.Status !== "Cancelled");
  } catch { return false; }
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
    let custId = 1;   // cliente con el que entra el pedido en Ágora (1 = genérico); se guarda para que una anulación posterior no lo cambie
    try {
      const cu = await customerFor(db, base, token, ord.customer_id);
      custId = cu.customer.Id;
      const o2 = cu.note ? { ...ord, notes: [ord.notes, cu.note].filter(Boolean).join(" · ") } : ord;
      const body = { SalesOrders: [buildOrder(serie, o2, c.items ?? [], agoraOf, prod, vats, fam, pt, po, "Pending", 0, cu.customer)] };
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25_000);
      const r = await fetch(`${base}/api/import/`, {
        method: "POST", signal: ctl.signal,
        headers: { "Api-Token": token, "Accept": "application/json", "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });
      clearTimeout(to);
      const txt = await r.text();
      if (!r.ok) throw new Error(`Ágora respondió ${r.status}: ${txt.slice(0, 200)}`);
      await db.from("app_orders").update({ agora_status: "sent", agora_error: null, agora_sent_at: new Date().toISOString(), agora_ref: `${serie}-${ord.agora_number}`, agora_customer_id: custId }).eq("id", ord.id);
      results.push({ ref: ord.ref, ok: true });
    } catch (e) {
      const msg = (e as Error).message.slice(0, 300);
      if (await existsInAgora(base, token, serie, ord)) {
        await db.from("app_orders").update({ agora_status: "sent", agora_error: null, agora_sent_at: new Date().toISOString(), agora_ref: `${serie}-${ord.agora_number}`, agora_customer_id: custId }).eq("id", ord.id);
        results.push({ ref: ord.ref, ok: true, note: "ya estaba en Ágora (" + msg + ")" });
        continue;
      }
      await db.from("app_orders").update({ agora_status: "error", agora_error: msg }).eq("id", ord.id);
      results.push({ ref: ord.ref, ok: false, error: msg });
    }
  }
  return json({ ok: results.every((x) => x.ok), pushed: results.filter((x) => x.ok).length, results });
}

// ───────────────────────── Devoluciones de RoceCover → Ágora ─────────────────────────
// Devolución total de un pedido abierto en Ágora: se anula allí. Devolución parcial o pedido ya facturado: queda marcado para abonar a mano.
async function refundOrders(db: any, base: string, token: string, serie: string) {
  const { data: claimed, error } = await db.rpc("app_agora_claim_refunds", { p_limit: 5 });
  if (error) return { error: "base de datos: " + error.message, results: [] as any[] };
  const list: any[] = claimed ?? [];
  if (!list.length) return { results: [] as any[] };
  let master: any;
  try { master = await agoraGet(base, token, "Products,Vats,Families,PreparationTypes,PreparationOrders"); }
  catch (e) { return { error: (e as Error).message.slice(0, 300), results: [] as any[] }; }
  const prod = new Map<number, any>((master.Products ?? []).map((p: any): [number, any] => [p.Id, p]));
  const vats = new Map<number, any>((master.Vats ?? []).map((v: any): [number, any] => [v.Id, v]));
  const fam = new Map<number, string>((master.Families ?? []).map((f: any): [number, string] => [f.Id, f.Name]));
  const pt = new Map<number, string>((master.PreparationTypes ?? []).map((f: any): [number, string] => [f.Id, f.Name]));
  const po = new Map<number, string>((master.PreparationOrders ?? []).map((f: any): [number, string] => [f.Id, f.Name]));
  const { data: menu } = await db.from("app_menu_items").select("key, agora_id");
  const agoraOf = new Map<string, number>((menu ?? []).filter((m: any) => m.agora_id != null).map((m: any): [string, number] => [m.key, m.agora_id]));

  const results: any[] = [];
  for (const c of list) {
    const ord = c.order, items: any[] = c.items ?? [];
    const total = items.reduce((n, it) => n + it.unit_cents * it.qty, 0);
    const done = async (st: "sent" | "manual", note: string) => {
      await db.from("app_orders").update({ agora_refunded_cents: ord.refunded_cents, agora_refund_status: st, agora_refund_note: note, agora_refund_attempts: 0 }).eq("id", ord.id);
      results.push({ ref: ord.ref, status: st });
    };
    try {
      if (ord.refunded_cents < total) {
        await done("manual", `Devolución parcial de ${(ord.refunded_cents / 100).toFixed(2).replace(".", ",")} €: ajusta o abona el pedido ${ord.ref} en Ágora`);
        continue;
      }
      // La anulación conserva el cliente con el que entró el pedido (genérico si no tenía datos de empresa).
      const cu = ord.agora_customer_id && ord.agora_customer_id !== 1 ? await customerFor(db, base, token, ord.customer_id) : { customer: CUSTOMER, note: "" };
      const body = { SalesOrders: [buildOrder(serie, ord, items, agoraOf, prod, vats, fam, pt, po, "Cancelled", total, cu.customer)] };
      // A veces Ágora anula el pedido y corta la respuesta: no se da por fallo hasta comprobar el estado real.
      let postErr: Error | null = null;
      try {
        const r = await fetch(`${base}/api/import/`, { method: "POST", signal: AbortSignal.timeout(25_000), headers: { "Api-Token": token, "Accept": "application/json", "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
        const txt = await r.text();
        if (!r.ok) throw new Error(`Ágora respondió ${r.status}: ${txt.slice(0, 200)}`);
      } catch (e) { postErr = e as Error; }
      // Si el pedido ya estaba facturado, Ágora ignora la anulación sin avisar: se comprueba el estado real.
      const day = (body.SalesOrders[0] as any).BusinessDay;
      const chk = await (await fetch(`${base}/api/export/?business-day=${day}&filter=SalesOrders&include-processed`, { headers: { "Api-Token": token } })).json();
      const found = (chk.SalesOrders ?? []).find((o: any) => o.Serie === serie && o.Number === ord.agora_number);
      if (found && found.Status === "Cancelled") await done("sent", "Pedido anulado en Ágora");
      else if (postErr) throw postErr;
      else await done("manual", `El pedido ${ord.ref} ya está facturado en Ágora: haz el abono allí`);
    } catch (e) {
      const msg = (e as Error).message.slice(0, 300);
      await db.from("app_orders").update({ agora_refund_status: "error", agora_refund_note: msg }).eq("id", ord.id);
      results.push({ ref: ord.ref, status: "error", error: msg });
    }
  }
  return { results };
}

// ───────────────────────── Precios de Ágora → app ─────────────────────────
async function syncPrices(db: any, base: string, token: string) {
  // Freno: una sincronización cada 45 s como mucho (así nadie puede saturar el PC del local llamando a la función; el programador la llama cada minuto).
  const { data: st } = await db.from("app_agora_sync").select("last_run").eq("id", 1).maybeSingle();
  if (st?.last_run && Date.now() - new Date(st.last_run).getTime() < 45_000) return json({ ok: true, skipped: "reciente" });
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
  const price = new Map<number, number>(), addin = new Map<number, number>();
  for (const p of products) {
    addin.set(p.Id, addinCents(p));
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
        const id = EXTRA_IDS[e.k], cc = id != null ? addin.get(id) : undefined;
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
  const serie = (Deno.env.get("AGORA_SERIE") ?? "APP").trim();
  let body: any = {};
  try { body = await req.json(); } catch { /* sin cuerpo */ }
  if (body?.action === "push") {
    const res = await pushOrders(db, base, token, serie);
    const ref = await refundOrders(db, base, token, serie);
    if (!ref.results.length && !ref.error) return res;
    const o = await res.json();
    return json({ ...o, refunds: ref.results, refundError: ref.error ?? null }, res.status);
  }
  return await syncPrices(db, base, token);
});
