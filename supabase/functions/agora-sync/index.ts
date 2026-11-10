// Edge Function de Supabase de ROCE: precios de la app desde Ágora.
// Ágora manda en los precios: cada pocos minutos (programador pg_cron, ver agora_sync.sql) esta función pide a Ágora
// sus productos y copia el precio de cada uno a app_menu_items (price_cents) y a los extras de las tostadas y del bol.
// Si Ágora no responde (PC apagado, sin internet) se mantienen los últimos precios y se anota el error.
// Es segura de llamar con frecuencia: no hace nada si la última sincronización fue hace menos de 60 s.
// Secretos: AGORA_API_TOKEN (token del API de Ágora), AGORA_URL (opcional, por defecto https://roce.tpvvalencia.es).
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

// Extras (nombre en la app → producto «EXTRA …» de Ágora). Los de «Más proteína» van por agora_id en su propia fila.
const EXTRA_IDS: Record<string, number> = {
  "Bacon": 51, "Aguacate": 52, "Salmón": 53, "Huevo": 54, "Jamón": 55,
  "Fruta": 56, "Granola": 57, "Crema de cacahuete": 58,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  const db = sb();
  const token = Deno.env.get("AGORA_API_TOKEN");
  if (!token) return json({ ok: false, error: "AGORA_API_TOKEN no configurado" }, 500);
  const base = (Deno.env.get("AGORA_URL") ?? "https://roce.tpvvalencia.es").replace(/\/+$/, "");

  // Freno: una sincronización cada 60 s como mucho (así nadie puede saturar el PC del local llamando a la función).
  const { data: st } = await db.from("app_agora_sync").select("last_run").eq("id", 1).maybeSingle();
  if (st?.last_run && Date.now() - new Date(st.last_run).getTime() < 60_000) return json({ ok: true, skipped: "reciente" });
  await db.from("app_agora_sync").upsert({ id: 1, last_run: new Date().toISOString() });

  const fail = async (msg: string) => {
    await db.from("app_agora_sync").upsert({ id: 1, last_run: new Date().toISOString(), ok: false, error: msg.slice(0, 300) });
    return json({ ok: false, error: msg }, 502);
  };

  let products: any[];
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20_000);
    const r = await fetch(`${base}/api/export-master/?filter=Products`, { headers: { "Api-Token": token }, signal: ctl.signal });
    clearTimeout(to);
    if (!r.ok) return await fail(`Ágora respondió ${r.status}`);
    products = (await r.json()).Products ?? [];
  } catch (e) { return await fail("Ágora no responde: " + (e as Error).message); }
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
});
