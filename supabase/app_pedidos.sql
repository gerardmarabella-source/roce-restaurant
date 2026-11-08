-- ROCE · App de pedidos (app.roce.es) · Fase 1: tablas, permisos y funciones de los pedidos a mesa / para recoger.
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar más de una vez (no pisa el estado «agotado» ni los pedidos).
-- Después de este archivo vienen el cobro con Redsys (función redsys) y la pantalla de cocina en el admin.

-- ═══ 1. Códigos QR de las mesas de la planta baja ══════════════════════════════
-- La dirección del QR es app.roce.es/mesa/<código>; el código es aleatorio y se puede cambiar sin tocar la mesa.
alter table public.dining_tables add column if not exists qr_code text;
create unique index if not exists dining_tables_qr_code_uq on public.dining_tables (qr_code) where qr_code is not null;
update public.dining_tables set qr_code = substr(md5(random()::text || id::text || clock_timestamp()::text), 1, 10)
where zone_id = 'baja' and qr_code is null;

-- La app resuelve el código del QR a una mesa (solo devuelve el nombre).
create or replace function public.app_resolve_table(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', t.id, 'name', t.name)
  from public.dining_tables t
  where t.qr_code = nullif(trim(p_code), '') and t.zone_id = 'baja'
  limit 1;
$$;
revoke all on function public.app_resolve_table(text) from public;
grant execute on function public.app_resolve_table(text) to anon, authenticated;

-- ═══ 2. Carta para pedir (precios y disponibilidad = fuente de verdad del servidor) ═
create table if not exists public.app_menu_items (
  key         text primary key,                                   -- «Tostadas|001»
  cat         text not null,
  name        text not null,
  price_cents integer not null check (price_cents >= 0),
  station     text not null check (station in ('kitchen', 'bar')),
  extras      jsonb not null default '[]',                        -- [{"k":"Aguacate","cents":250}]
  variants    jsonb not null default '[]',                        -- ["Pollo","Pato Pekín"]
  active      boolean not null default true,                      -- false = agotado
  from_min    integer check (from_min between 0 and 1439),        -- minutos desde 00:00 (hora de Madrid)
  to_min      integer check (to_min between 1 and 1440),
  sort        integer not null default 0
);
alter table public.app_menu_items enable row level security;
drop policy if exists app_menu_read on public.app_menu_items;
create policy app_menu_read on public.app_menu_items for select to anon, authenticated using (true);
drop policy if exists app_menu_write on public.app_menu_items;
create policy app_menu_write on public.app_menu_items for all to authenticated using (public.has_tab('orders')) with check (public.has_tab('orders'));

insert into public.app_menu_items (key, cat, name, price_cents, station, extras, variants, from_min, to_min, sort) values
  ('Tostadas|000', 'Tostadas', '000', 390, 'kitchen', '[{"k": "Bacon", "cents": 250}, {"k": "Aguacate", "cents": 250}, {"k": "Salmón", "cents": 350}, {"k": "Huevo", "cents": 200}, {"k": "Jamón", "cents": 300}]'::jsonb, '[]'::jsonb, null, 720, 1),
  ('Tostadas|001', 'Tostadas', '001', 750, 'kitchen', '[{"k": "Bacon", "cents": 250}, {"k": "Aguacate", "cents": 250}, {"k": "Salmón", "cents": 350}, {"k": "Huevo", "cents": 200}, {"k": "Jamón", "cents": 300}]'::jsonb, '[]'::jsonb, null, 720, 2),
  ('Tostadas|002', 'Tostadas', '002', 1050, 'kitchen', '[{"k": "Bacon", "cents": 250}, {"k": "Aguacate", "cents": 250}, {"k": "Salmón", "cents": 350}, {"k": "Huevo", "cents": 200}, {"k": "Jamón", "cents": 300}]'::jsonb, '[]'::jsonb, null, 720, 3),
  ('Tostadas|003', 'Tostadas', '003', 1250, 'kitchen', '[{"k": "Bacon", "cents": 250}, {"k": "Aguacate", "cents": 250}, {"k": "Salmón", "cents": 350}, {"k": "Huevo", "cents": 200}, {"k": "Jamón", "cents": 300}]'::jsonb, '[]'::jsonb, null, 720, 4),
  ('Tostadas|004', 'Tostadas', '004', 1050, 'kitchen', '[{"k": "Bacon", "cents": 250}, {"k": "Aguacate", "cents": 250}, {"k": "Salmón", "cents": 350}, {"k": "Huevo", "cents": 200}, {"k": "Jamón", "cents": 300}]'::jsonb, '[]'::jsonb, null, 720, 5),
  ('Tostadas|005', 'Tostadas', '005', 650, 'kitchen', '[{"k": "Bacon", "cents": 250}, {"k": "Aguacate", "cents": 250}, {"k": "Salmón", "cents": 350}, {"k": "Huevo", "cents": 200}, {"k": "Jamón", "cents": 300}]'::jsonb, '[]'::jsonb, null, 720, 6),
  ('Tostadas|006', 'Tostadas', '006', 750, 'kitchen', '[{"k": "Bacon", "cents": 250}, {"k": "Aguacate", "cents": 250}, {"k": "Salmón", "cents": 350}, {"k": "Huevo", "cents": 200}, {"k": "Jamón", "cents": 300}]'::jsonb, '[]'::jsonb, null, 720, 7),
  ('Açaí & Yogur|Dark Açaí', 'Açaí & Yogur', 'Dark Açaí', 1050, 'kitchen', '[{"k": "Fruta", "cents": 200}, {"k": "Granola", "cents": 150}, {"k": "Crema de cacahuete", "cents": 150}]'::jsonb, '[]'::jsonb, null, null, 8),
  ('Açaí & Yogur|Shaka Açaí', 'Açaí & Yogur', 'Shaka Açaí', 1050, 'kitchen', '[{"k": "Fruta", "cents": 200}, {"k": "Granola", "cents": 150}, {"k": "Crema de cacahuete", "cents": 150}]'::jsonb, '[]'::jsonb, null, null, 9),
  ('Açaí & Yogur|Greek Freak', 'Açaí & Yogur', 'Greek Freak', 750, 'kitchen', '[{"k": "Fruta", "cents": 200}, {"k": "Granola", "cents": 150}, {"k": "Crema de cacahuete", "cents": 150}]'::jsonb, '[]'::jsonb, null, null, 10),
  ('Sándwiches|Chicken Joe', 'Sándwiches', 'Chicken Joe', 1250, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 11),
  ('Sándwiches|Terra', 'Sándwiches', 'Terra', 1050, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 12),
  ('Sándwiches|New York 1888', 'Sándwiches', 'New York 1888', 1350, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 13),
  ('Sándwiches|Liguria', 'Sándwiches', 'Liguria', 1350, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 14),
  ('Starters|Bloody Moon', 'Starters', 'Bloody Moon', 1450, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 15),
  ('Starters|El Trío', 'Starters', 'El Trío', 1350, 'kitchen', '[]'::jsonb, '["Pollo", "Pato Pekín", "Costilla"]'::jsonb, 720, null, 16),
  ('Starters|Patatas Artesanas', 'Starters', 'Patatas Artesanas', 950, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 17),
  ('Pokes|Black Rice Chicken', 'Pokes', 'Black Rice Chicken', 1350, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 18),
  ('Pokes|Black Rice Tuna', 'Pokes', 'Black Rice Tuna', 1650, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 19),
  ('Pokes|Forest Walk', 'Pokes', 'Forest Walk', 1250, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 20),
  ('Platos ROCE|Egg & Egg', 'Platos ROCE', 'Egg & Egg', 1050, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 21),
  ('Platos ROCE|Primitive Chicken', 'Platos ROCE', 'Primitive Chicken', 1550, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 22),
  ('Platos ROCE|Citric Nordic', 'Platos ROCE', 'Citric Nordic', 1750, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 23),
  ('Platos ROCE|Muuuuuucho Beef', 'Platos ROCE', 'Muuuuuucho Beef', 1850, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 24),
  ('Platos ROCE|Falafel & Hummus', 'Platos ROCE', 'Falafel & Hummus', 1350, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 25),
  ('Platos ROCE|La Huerta', 'Platos ROCE', 'La Huerta', 1250, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 26),
  ('Acompañamientos|Patatas artesanas', 'Acompañamientos', 'Patatas artesanas', 350, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 27),
  ('Acompañamientos|Garbanzo artesano', 'Acompañamientos', 'Garbanzo artesano', 350, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 28),
  ('Acompañamientos|Frijoles marinados', 'Acompañamientos', 'Frijoles marinados', 350, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 29),
  ('Acompañamientos|Maíz especiado', 'Acompañamientos', 'Maíz especiado', 350, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 30),
  ('Acompañamientos|Boniato al carbón', 'Acompañamientos', 'Boniato al carbón', 350, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 31),
  ('Extras|Huevo campero', 'Extras', 'Huevo campero', 200, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 32),
  ('Extras|Falafel', 'Extras', 'Falafel', 350, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 33),
  ('Extras|Cottage', 'Extras', 'Cottage', 250, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 34),
  ('Extras|Pollo marinado', 'Extras', 'Pollo marinado', 450, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 35),
  ('Extras|Atún rojo', 'Extras', 'Atún rojo', 650, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 36),
  ('Extras|Salmón', 'Extras', 'Salmón', 650, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 37),
  ('Extras|Filete de ternera', 'Extras', 'Filete de ternera', 950, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 38),
  ('Extras|Entrecot madurado', 'Extras', 'Entrecot madurado', 1500, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 39),
  ('Extras|Bacon crujiente', 'Extras', 'Bacon crujiente', 250, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 40),
  ('Extras|Hummus de remolacha', 'Extras', 'Hummus de remolacha', 250, 'kitchen', '[]'::jsonb, '[]'::jsonb, 720, null, 41),
  ('Cafés|Espresso', 'Cafés', 'Espresso', 220, 'bar', '[{"k": "Iced", "cents": 50}, {"k": "Doble carga", "cents": 100}, {"k": "Vegetal barista", "cents": 50}, {"k": "Con hielo", "cents": 15}, {"k": "Descafeinado", "cents": 0}]'::jsonb, '[]'::jsonb, null, null, 42),
  ('Cafés|Double espresso', 'Cafés', 'Double espresso', 300, 'bar', '[{"k": "Iced", "cents": 50}, {"k": "Doble carga", "cents": 100}, {"k": "Vegetal barista", "cents": 50}, {"k": "Con hielo", "cents": 15}, {"k": "Descafeinado", "cents": 0}]'::jsonb, '[]'::jsonb, null, null, 43),
  ('Cafés|Cortado', 'Cafés', 'Cortado', 240, 'bar', '[{"k": "Iced", "cents": 50}, {"k": "Doble carga", "cents": 100}, {"k": "Vegetal barista", "cents": 50}, {"k": "Con hielo", "cents": 15}, {"k": "Descafeinado", "cents": 0}]'::jsonb, '[]'::jsonb, null, null, 44),
  ('Cafés|Americano', 'Cafés', 'Americano', 270, 'bar', '[{"k": "Iced", "cents": 50}, {"k": "Doble carga", "cents": 100}, {"k": "Vegetal barista", "cents": 50}, {"k": "Con hielo", "cents": 15}, {"k": "Descafeinado", "cents": 0}]'::jsonb, '[]'::jsonb, null, null, 45),
  ('Cafés|Latte', 'Cafés', 'Latte', 350, 'bar', '[{"k": "Iced", "cents": 50}, {"k": "Doble carga", "cents": 100}, {"k": "Vegetal barista", "cents": 50}, {"k": "Con hielo", "cents": 15}, {"k": "Descafeinado", "cents": 0}]'::jsonb, '[]'::jsonb, null, null, 46),
  ('Cafés|Flat white', 'Cafés', 'Flat white', 380, 'bar', '[{"k": "Iced", "cents": 50}, {"k": "Doble carga", "cents": 100}, {"k": "Vegetal barista", "cents": 50}, {"k": "Con hielo", "cents": 15}, {"k": "Descafeinado", "cents": 0}]'::jsonb, '[]'::jsonb, null, null, 47),
  ('Cafés|Mocca latte', 'Cafés', 'Mocca latte', 450, 'bar', '[{"k": "Iced", "cents": 50}, {"k": "Doble carga", "cents": 100}, {"k": "Vegetal barista", "cents": 50}, {"k": "Con hielo", "cents": 15}, {"k": "Descafeinado", "cents": 0}]'::jsonb, '[]'::jsonb, null, null, 48),
  ('Matcha & Tés|Matcha', 'Matcha & Tés', 'Matcha', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 49),
  ('Matcha & Tés|Matcha latte', 'Matcha & Tés', 'Matcha latte', 450, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 50),
  ('Matcha & Tés|Iced matcha latte', 'Matcha & Tés', 'Iced matcha latte', 490, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 51),
  ('Matcha & Tés|Té verde', 'Matcha & Tés', 'Té verde', 280, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 52),
  ('Matcha & Tés|Té negro', 'Matcha & Tés', 'Té negro', 280, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 53),
  ('Matcha & Tés|Té rojo', 'Matcha & Tés', 'Té rojo', 280, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 54),
  ('Matcha & Tés|Rooibos', 'Matcha & Tés', 'Rooibos', 280, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 55),
  ('Matcha & Tés|Manzanilla', 'Matcha & Tés', 'Manzanilla', 250, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 56),
  ('Matcha & Tés|Menta poleo', 'Matcha & Tés', 'Menta poleo', 250, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 57),
  ('Matcha & Tés|Digestivo', 'Matcha & Tés', 'Digestivo', 250, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 58),
  ('Smoothies|01', 'Smoothies', 'Marathon Rat', 600, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 59),
  ('Smoothies|02', 'Smoothies', 'Purple Haze', 700, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 60),
  ('Smoothies|03', 'Smoothies', 'Out of the F*cking Office', 600, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 61),
  ('Smoothies|04', 'Smoothies', '404 Error Not Found', 600, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 62),
  ('Smoothies|05', 'Smoothies', 'Red Lips', 600, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 63),
  ('Smoothies|06', 'Smoothies', '6AM in Kyoto', 700, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 64),
  ('Zumos naturales|07', 'Zumos naturales', 'Depure', 550, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 65),
  ('Zumos naturales|08', 'Zumos naturales', 'Vitality', 550, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 66),
  ('Zumos naturales|09', 'Zumos naturales', 'Anti-inflammatory', 600, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 67),
  ('Zumos naturales|10', 'Zumos naturales', 'Immunity', 600, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 68),
  ('Zumos naturales|11', 'Zumos naturales', 'Probiotic', 600, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 69)
on conflict (key) do update set cat = excluded.cat, name = excluded.name, price_cents = excluded.price_cents, station = excluded.station,
  extras = excluded.extras, variants = excluded.variants, from_min = excluded.from_min, to_min = excluded.to_min, sort = excluded.sort;

-- ═══ 3. Clientes registrados de la app ═══════════════════════════════════════
create table if not exists public.app_customers (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null default '',
  name            text not null default '',
  phone           text not null default '',
  lang            text not null default 'es' check (lang in ('es', 'en')),
  marketing_optin boolean not null default false,
  allergies       integer[] not null default '{}',
  diets           text[] not null default '{}',
  created_at      timestamptz not null default now()
);
alter table public.app_customers enable row level security;
drop policy if exists app_customers_own on public.app_customers;
create policy app_customers_own on public.app_customers for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists app_customers_staff on public.app_customers;
create policy app_customers_staff on public.app_customers for select to authenticated using (public.has_tab('orders'));

-- Alta / actualización del perfil de quien ha iniciado sesión (el email sale de su sesión, no del cliente).
create or replace function public.app_customer_save(p_name text, p_phone text, p_lang text, p_marketing boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid := auth.uid(); v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_id is null then raise exception 'not_authenticated'; end if;
  insert into public.app_customers (id, email, name, phone, lang, marketing_optin)
  values (v_id, v_email, left(coalesce(trim(p_name), ''), 80), left(coalesce(trim(p_phone), ''), 30), case when p_lang = 'en' then 'en' else 'es' end, coalesce(p_marketing, false))
  on conflict (id) do update set name = excluded.name, phone = excluded.phone, lang = excluded.lang, marketing_optin = excluded.marketing_optin, email = excluded.email;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.app_customer_save(text, text, text, boolean) from public, anon;
grant execute on function public.app_customer_save(text, text, text, boolean) to authenticated;

-- ═══ 4. Pedidos ═══════════════════════════════════════════════════════════
create table if not exists public.app_orders (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique,
  customer_id    uuid references auth.users(id) on delete set null,
  mode           text not null check (mode in ('mesa', 'recoger')),
  table_id       uuid references public.dining_tables(id) on delete set null,
  table_name     text not null default '',
  pickup_at      timestamptz,
  status         text not null default 'pending_payment' check (status in ('pending_payment', 'paid', 'preparing', 'ready', 'served', 'cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  total_cents    integer not null check (total_cents > 0),
  notes          text not null default '',
  name           text not null default '',
  email          text not null default '',
  lang           text not null default 'es',
  agora_ref      text,                                             -- referencia del ticket en Ágora (integración posterior)
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  ready_at       timestamptz,
  served_at      timestamptz
);
create index if not exists app_orders_status_idx on public.app_orders (status, created_at desc);
create index if not exists app_orders_customer_idx on public.app_orders (customer_id, created_at desc);

create table if not exists public.app_order_items (
  id          bigserial primary key,
  order_id    uuid not null references public.app_orders(id) on delete cascade,
  item_key    text not null,
  name        text not null,
  cat         text not null,
  station     text not null check (station in ('kitchen', 'bar')),
  variant     text not null default '',
  extras      jsonb not null default '[]',
  qty         integer not null check (qty between 1 and 20),
  unit_cents  integer not null check (unit_cents >= 0),
  note        text not null default ''
);
create index if not exists app_order_items_order_idx on public.app_order_items (order_id);

alter table public.app_orders enable row level security;
alter table public.app_order_items enable row level security;
drop policy if exists app_orders_own on public.app_orders;
create policy app_orders_own on public.app_orders for select to authenticated using (customer_id = auth.uid());
drop policy if exists app_orders_staff on public.app_orders;
create policy app_orders_staff on public.app_orders for select to authenticated using (public.has_tab('orders'));
drop policy if exists app_order_items_own on public.app_order_items;
create policy app_order_items_own on public.app_order_items for select to authenticated using (exists (select 1 from public.app_orders o where o.id = order_id and o.customer_id = auth.uid()));
drop policy if exists app_order_items_staff on public.app_order_items;
create policy app_order_items_staff on public.app_order_items for select to authenticated using (public.has_tab('orders'));
-- Nadie escribe pedidos directamente: se crean con app_create_order y los cambia el equipo con app_order_set_status.

-- ═══ 5. Crear un pedido (precios, horarios y opciones se validan aquí, no en el móvil) ═══
-- p_items: [{"key":"Tostadas|001","qty":2,"variant":"","extras":["Aguacate"],"note":""}]
create or replace function public.app_create_order(p_mode text, p_code text, p_notes text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_cust public.app_customers%rowtype;
  v_table public.dining_tables%rowtype; v_id uuid; v_ref text; v_total integer := 0; v_min integer;
  it jsonb; m public.app_menu_items%rowtype; v_qty integer; v_unit integer; v_var text; v_ex jsonb; v_exs jsonb; ex_name text; ex_cents integer; v_n integer := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_cust from public.app_customers where id = v_uid;
  if not found then raise exception 'profile_missing'; end if;
  if p_mode not in ('mesa', 'recoger') then raise exception 'bad_mode'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 40 then raise exception 'bad_items'; end if;
  if (select count(*) from public.app_orders where customer_id = v_uid and status = 'pending_payment' and created_at > now() - interval '1 hour') >= 5 then raise exception 'too_many_pending'; end if;
  if p_mode = 'mesa' then
    select * into v_table from public.dining_tables where qr_code = nullif(trim(p_code), '') and zone_id = 'baja';
    if not found then raise exception 'bad_table'; end if;
  end if;
  v_min := extract(hour from (now() at time zone 'Europe/Madrid'))::int * 60 + extract(minute from (now() at time zone 'Europe/Madrid'))::int;
  v_ref := 'P' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
  insert into public.app_orders (ref, customer_id, mode, table_id, table_name, notes, name, email, lang, total_cents)
  values (v_ref, v_uid, p_mode, v_table.id, coalesce(v_table.name, ''), left(coalesce(p_notes, ''), 300), v_cust.name, v_cust.email, v_cust.lang, 1)
  returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into m from public.app_menu_items where key = it ->> 'key';
    if not found or not m.active then raise exception 'item_unavailable:%', coalesce(it ->> 'key', ''); end if;
    if (m.from_min is not null and v_min < m.from_min) or (m.to_min is not null and v_min >= m.to_min) then raise exception 'item_closed:%', m.name; end if;
    v_qty := (it ->> 'qty')::int; if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'bad_qty'; end if;
    v_var := coalesce(it ->> 'variant', '');
    if jsonb_array_length(m.variants) > 0 and not (m.variants ? v_var) then raise exception 'bad_variant:%', m.name; end if;
    if jsonb_array_length(m.variants) = 0 then v_var := ''; end if;
    v_unit := m.price_cents; v_exs := '[]'::jsonb;
    for ex_name in select jsonb_array_elements_text(coalesce(it -> 'extras', '[]'::jsonb)) loop
      select (e ->> 'cents')::int into ex_cents from jsonb_array_elements(m.extras) e where e ->> 'k' = ex_name limit 1;
      if ex_cents is null then raise exception 'bad_extra:%', ex_name; end if;
      v_unit := v_unit + ex_cents; v_exs := v_exs || to_jsonb(ex_name); ex_cents := null;
    end loop;
    insert into public.app_order_items (order_id, item_key, name, cat, station, variant, extras, qty, unit_cents, note)
    values (v_id, m.key, m.name, m.cat, m.station, v_var, v_exs, v_qty, v_unit, left(coalesce(it ->> 'note', ''), 200));
    v_total := v_total + v_unit * v_qty; v_n := v_n + 1;
  end loop;
  if v_total <= 0 or v_total > 50000 then raise exception 'bad_total'; end if;
  update public.app_orders set total_cents = v_total where id = v_id;
  return jsonb_build_object('id', v_id, 'ref', v_ref, 'total_cents', v_total);
end $$;
revoke all on function public.app_create_order(text, text, text, jsonb) from public, anon;
grant execute on function public.app_create_order(text, text, text, jsonb) to authenticated;

-- ═══ 6. El equipo cambia el estado del pedido (paid → preparing → ready → served, o cancelar) ═══
create or replace function public.app_order_set_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.app_orders%rowtype;
begin
  if not public.has_tab('orders') then raise exception 'forbidden'; end if;
  if p_status not in ('preparing', 'ready', 'served', 'cancelled') then raise exception 'bad_status'; end if;
  select * into o from public.app_orders where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if o.status = 'pending_payment' then raise exception 'not_paid'; end if;
  update public.app_orders set status = p_status,
    ready_at  = case when p_status = 'ready'  then coalesce(ready_at, now())  else ready_at end,
    served_at = case when p_status = 'served' then coalesce(served_at, now()) else served_at end
  where id = p_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.app_order_set_status(uuid, text) from public, anon;
grant execute on function public.app_order_set_status(uuid, text) to authenticated;

-- Pantalla de cocina en directo (Realtime).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_orders') then
    alter publication supabase_realtime add table public.app_orders;
  end if;
end $$;
