-- ROCE · App de pedidos ↔ RoceCover. Ejecutar DESPUÉS de app_pedidos.sql, app_perfil.sql y app_pago.sql. Se puede ejecutar más de una vez.
--
-- Qué hace:
--  1) Cuando un pedido A MESA se cobra, la mesa queda ocupada en el plano de RoceCover:
--       · si en esa mesa ya hay una visita (gente sentada, o una reserva confirmada que empieza en ±45 min), el pedido se suma a esa visita
--         (y la reserva pasa a «En mesa» con la hora de llegada) y su importe entra en el gasto de la visita;
--       · si no, se crea una visita «walkin» de 90 min en esa mesa, con los datos del cliente de la app.
--  2) El CRM (dining_crm) incluye a los clientes de la app (aunque no hayan reservado nunca): perfil, alergias, dieta, cumpleaños, comunicaciones,
--     nº de pedidos y gasto en la app. Los pedidos para recoger cuentan como visita y gasto.
--  3) El pedido guarda cuántos sois en la mesa (comensales), que se pide en la app al pedir a mesa.

-- ═══ 1. Columnas ═══════════════════════════════════════════════════════════
alter table public.app_orders add column if not exists table_booking_id uuid references public.table_bookings(id) on delete set null;
alter table public.app_orders add column if not exists party integer check (party is null or party between 1 and 60);
create index if not exists app_orders_booking_idx on public.app_orders (table_booking_id);

-- ═══ 2. Crear el pedido: ahora con comensales (p_party) ═══════════════════════
drop function if exists public.app_create_order(text, text, text, jsonb);
create or replace function public.app_create_order(p_mode text, p_code text, p_notes text, p_items jsonb, p_party integer default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_cust public.app_customers%rowtype;
  v_table public.dining_tables%rowtype; v_id uuid; v_ref text; v_total integer := 0; v_min integer;
  it jsonb; m public.app_menu_items%rowtype; v_qty integer; v_unit integer; v_var text; v_exs jsonb; ex_name text; ex_cents integer;
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
  insert into public.app_orders (ref, customer_id, mode, table_id, table_name, notes, name, email, lang, total_cents, party)
  values (v_ref, v_uid, p_mode, v_table.id, coalesce(v_table.name, ''), left(coalesce(p_notes, ''), 300), v_cust.name, v_cust.email, v_cust.lang, 1,
          case when p_mode = 'mesa' then greatest(1, least(coalesce(p_party, 1), 20)) else null end)
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
    v_total := v_total + v_unit * v_qty;
  end loop;
  if v_total <= 0 or v_total > 50000 then raise exception 'bad_total'; end if;
  update public.app_orders set total_cents = v_total where id = v_id;
  return jsonb_build_object('id', v_id, 'ref', v_ref, 'total_cents', v_total);
end $$;
revoke all on function public.app_create_order(text, text, text, jsonb, integer) from public, anon;
grant execute on function public.app_create_order(text, text, text, jsonb, integer) to authenticated;

-- ═══ 3. Pedido a mesa cobrado → ocupación de la mesa y gasto de la visita ═════════════════
create or replace function public.app_order_to_rocecover(p_order uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  o public.app_orders%rowtype; c public.app_customers%rowtype; v_b public.table_bookings%rowtype;
  v_id uuid; v_ref text; v_next timestamptz; v_name text; i int;
begin
  select * into o from public.app_orders where id = p_order for update;
  if not found or o.mode <> 'mesa' or o.table_id is null or o.payment_status <> 'paid' then return null; end if;
  if o.table_booking_id is not null then return o.table_booking_id; end if;
  select * into c from public.app_customers where id = o.customer_id;

  -- ¿Ya hay una visita en esa mesa? (sentados, o con reserva confirmada que empieza ±45 min)
  select b.* into v_b from public.table_bookings b join public.table_booking_tables bt on bt.booking_id = b.id
   where bt.table_id = o.table_id and (
           (b.status = 'seated' and now() < b.ends_at + interval '45 minutes')
        or (b.status = 'confirmed' and b.starts_at between now() - interval '45 minutes' and now() + interval '45 minutes'))
   order by case b.status when 'seated' then 0 else 1 end, b.starts_at desc limit 1;
  if found then
    update public.table_bookings
       set status = case when status = 'confirmed' then 'seated' else status end,
           arrived_at = coalesce(arrived_at, now()),
           spend_cents = coalesce(spend_cents, 0) + o.total_cents
     where id = v_b.id;
    update public.app_orders set table_booking_id = v_b.id where id = o.id;
    return v_b.id;
  end if;

  -- Si no, una visita nueva «walkin» de 90 minutos en esa mesa.
  v_name := coalesce(nullif(trim(coalesce(o.name, '') || ' ' || coalesce(c.last_name, '')), ''), 'Cliente app');
  for i in 1..5 loop
    v_ref := 'MESA-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    begin
      insert into public.table_bookings (ref, service_id, ambience, zone_id, starts_at, ends_at, party, name, email, phone, notes, lang, marketing_optin,
                                         status, payment_status, source, kind, arrived_at, spend_cents)
      values (v_ref, 'day', 'day', 'baja', now(), now() + interval '90 minutes', coalesce(o.party, 1), v_name, coalesce(o.email, ''), coalesce(c.phone, ''),
              'Pedido de la app ' || o.ref, coalesce(o.lang, 'es'), coalesce(c.marketing_optin, false), 'seated', 'free', 'web', 'walkin', now(), o.total_cents)
      returning id into v_id;
      exit;
    exception when unique_violation then v_id := null;
    end;
  end loop;
  if v_id is null then return null; end if;
  insert into public.table_booking_tables (booking_id, table_id) values (v_id, o.table_id);
  -- Aviso si otra reserva empieza pronto en esta mesa.
  select min(b2.starts_at) into v_next from public.table_bookings b2 join public.table_booking_tables bt2 on bt2.booking_id = b2.id
   where bt2.table_id = o.table_id and b2.id <> v_id and b2.status in ('confirmed', 'pending') and b2.starts_at > now() and b2.starts_at < now() + interval '90 minutes';
  if v_next is not null then
    update public.table_bookings set admin_notes = 'AVISO: hay una reserva a las ' || to_char(v_next at time zone 'Europe/Madrid', 'HH24:MI') || ' en esta mesa.' where id = v_id;
  end if;
  update public.app_orders set table_booking_id = v_id where id = o.id;
  return v_id;
end $$;
revoke all on function public.app_order_to_rocecover(uuid) from public, anon, authenticated;
grant execute on function public.app_order_to_rocecover(uuid) to service_role;

-- Se lanza sola cuando el pedido pasa a «cobrado». Si algo fallase aquí, el cobro NO se ve afectado (solo queda un aviso en el registro).
create or replace function public.app_orders_after_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    begin
      perform public.app_order_to_rocecover(new.id);
    exception when others then
      raise warning 'app_order_to_rocecover(%): %', new.id, sqlerrm;
    end;
  end if;
  return new;
end $$;
drop trigger if exists app_orders_paid on public.app_orders;
create trigger app_orders_paid after update of payment_status on public.app_orders for each row execute function public.app_orders_after_paid();

-- ═══ 4. CRM: clientes de la app y sus pedidos ═══════════════════════════════════
drop function if exists public.dining_crm();
create function public.dining_crm()
returns table (customer_key text, name text, email text, phone text, visits integer, no_shows integer, cancellations integer, upcoming integer,
               first_visit timestamptz, last_visit timestamptz, spend_cents bigint, event_visits integer, tickets_cents bigint, prescribers text, marketing_optin boolean, note text, blocked boolean, blocked_reason text,
               tags text[], customer_type text, company text, tax_id text, balance_cents integer,
               app_user boolean, app_orders integer, app_spend_cents bigint, app_last timestamptz, birthday date, gender text, postal_code text, diet text,
               allergies integer[], marketing_whatsapp boolean, heard_from text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_tab('tables') then raise exception 'forbidden'; end if;
  return query
  with t as (
    select coalesce(nullif(lower(b.email), ''), nullif(regexp_replace(b.phone, '[^0-9]', '', 'g'), '')) as k, b.*
    from public.table_bookings b
  ), tb as (
    select t.k,
           (array_agg(nullif(t.name, '') order by t.starts_at desc) filter (where nullif(t.name, '') is not null))[1] as nm,
           max(nullif(t.email, '')) as em, max(nullif(t.phone, '')) as ph,
           count(*) filter (where t.status in ('seated', 'completed'))::integer as visits,
           count(*) filter (where t.status = 'no_show')::integer as noshows,
           count(*) filter (where t.status = 'cancelled')::integer as cancels,
           count(*) filter (where t.status in ('confirmed', 'pending') and t.starts_at > now())::integer as upcoming,
           min(t.starts_at) filter (where t.status in ('seated', 'completed')) as first_v,
           max(t.starts_at) filter (where t.status in ('seated', 'completed')) as last_v,
           coalesce(sum(t.spend_cents), 0)::bigint as spend,
           string_agg(distinct nullif(t.prescriber, ''), ', ') as pres,
           bool_or(t.marketing_optin) as mk
    from t where t.k is not null group by t.k
  ), ev as (
    select lower(e.email) as k, sum(case when e.checked_in > 0 then 1 else 0 end)::integer as vis, coalesce(sum(e.total_cents) filter (where e.payment_status = 'paid'), 0)::bigint as tk
    from public.bookings e where e.status <> 'cancelled' group by lower(e.email)
  ), ap as (
    select coalesce(nullif(lower(c.email), ''), nullif(regexp_replace(c.phone, '[^0-9]', '', 'g'), '')) as k, c.*
    from public.app_customers c
  ), ao as (
    select coalesce(nullif(lower(o.email), ''), '~' || o.customer_id::text) as k,
           count(*) filter (where o.payment_status = 'paid')::integer as n,
           coalesce(sum(o.total_cents) filter (where o.payment_status = 'paid'), 0)::bigint as spend,
           max(o.paid_at) as last_paid,
           count(*) filter (where o.payment_status = 'paid' and o.mode = 'recoger')::integer as pick_n,
           coalesce(sum(o.total_cents) filter (where o.payment_status = 'paid' and o.mode = 'recoger'), 0)::bigint as pick_spend
    from public.app_orders o group by 1
  ), keys as (
    select tb.k from tb union select ap.k from ap where ap.k is not null union select ao.k from ao where ao.k is not null and ao.k not like '~%'
  )
  select keys.k,
         coalesce(tb.nm, nullif(trim(coalesce(ap.name, '') || ' ' || coalesce(ap.last_name, '')), ''), ''),
         coalesce(tb.em, nullif(ap.email, ''), ''), coalesce(tb.ph, nullif(ap.phone, ''), ''),
         (coalesce(tb.visits, 0) + coalesce(ao.pick_n, 0))::integer, coalesce(tb.noshows, 0), coalesce(tb.cancels, 0), coalesce(tb.upcoming, 0),
         tb.first_v, greatest(tb.last_v, ao.last_paid), (coalesce(tb.spend, 0) + coalesce(ao.pick_spend, 0))::bigint,
         coalesce(ev.vis, 0), coalesce(ev.tk, 0), tb.pres, (coalesce(tb.mk, false) or coalesce(ap.marketing_optin, false)),
         coalesce(cn.note, ''), coalesce(cn.blocked, false), coalesce(cn.blocked_reason, ''),
         coalesce(cn.tags, '{}'), coalesce(cn.customer_type, 'particular'), coalesce(cn.company, ''), coalesce(cn.tax_id, ''), coalesce(cn.balance_cents, 0),
         (ap.id is not null), coalesce(ao.n, 0), coalesce(ao.spend, 0)::bigint, ao.last_paid, ap.birthday, coalesce(ap.gender, ''), coalesce(ap.postal_code, ''), coalesce(ap.diet, ''),
         coalesce(ap.allergies, '{}'), coalesce(ap.marketing_whatsapp, false), coalesce(ap.heard_from, '')
  from keys
  left join tb on tb.k = keys.k
  left join ev on ev.k = keys.k
  left join ap on ap.k = keys.k
  left join ao on ao.k = keys.k
  left join public.dining_customer_notes cn on cn.customer_key = keys.k
  order by greatest(tb.last_v, ao.last_paid) desc nulls last;
end;
$$;
revoke all on function public.dining_crm() from public, anon;
grant execute on function public.dining_crm() to authenticated;

-- ═══ 5. El equipo de RoceCover (pestaña Mesas) también ve los pedidos y perfiles de la app (CRM y ficha de la visita) ═══
drop policy if exists app_orders_staff on public.app_orders;
create policy app_orders_staff on public.app_orders for select to authenticated using (public.has_tab('orders') or public.has_tab('tables'));
drop policy if exists app_order_items_staff on public.app_order_items;
create policy app_order_items_staff on public.app_order_items for select to authenticated using (public.has_tab('orders') or public.has_tab('tables'));
drop policy if exists app_customers_staff on public.app_customers;
create policy app_customers_staff on public.app_customers for select to authenticated using (public.has_tab('orders') or public.has_tab('tables'));
