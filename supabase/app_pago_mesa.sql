-- Pago en la mesa: el cliente pide desde la app y paga al camarero (efectivo o tarjeta) en lugar de pagar online.
--  · Solo pedidos «a mesa» (hace falta el QR de la mesa) y de una cuenta registrada.
--  · El pedido pasa a cocina igual que uno pagado, pero con payment_status = 'table' (cobro pendiente): el camarero lo cobra en Ágora.
--  · Límite de importe y de pedidos seguidos por cuenta/mesa; se puede apagar con dining_settings.app_pay_table = "off".
-- Ejecutar UNA vez en Supabase → SQL Editor (después de app_rocecover.sql y agora_pedidos.sql).
alter table public.app_orders add column if not exists pay_method text not null default 'card';
alter table public.app_orders drop constraint if exists app_orders_pay_method_check;
alter table public.app_orders add constraint app_orders_pay_method_check check (pay_method in ('card', 'table'));
alter table public.app_orders drop constraint if exists app_orders_payment_status_check;
alter table public.app_orders add constraint app_orders_payment_status_check check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'table'));

-- La visita en RoceCover y el envío a Ágora también se crean para los pedidos de pago en mesa.
create or replace function public.app_order_to_rocecover(p_order uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  o public.app_orders%rowtype; c public.app_customers%rowtype; v_b public.table_bookings%rowtype;
  v_id uuid; v_ref text; v_next timestamptz; v_name text; i int;
begin
  select * into o from public.app_orders where id = p_order for update;
  if not found or o.mode <> 'mesa' or o.table_id is null or o.payment_status not in ('paid', 'table') then return null; end if;
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

create or replace function public.app_orders_after_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status in ('paid', 'table') and old.payment_status is distinct from new.payment_status then
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

create or replace function public.app_agora_claim(p_limit integer default 5) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; out jsonb := '[]'::jsonb;
begin
  for r in
    select o.id from public.app_orders o
    where o.payment_status in ('paid', 'table') and (
      o.agora_status = 'pending'
      or (o.agora_status = 'error' and o.agora_attempts < 8 and o.agora_attempt_at < now() - interval '2 minutes')
      or (o.agora_status = 'sending' and o.agora_attempt_at < now() - interval '5 minutes'))
    order by o.paid_at nulls last
    limit greatest(1, least(coalesce(p_limit, 5), 20))
    for update skip locked
  loop
    update public.app_orders
       set agora_status = 'sending', agora_attempts = agora_attempts + 1, agora_attempt_at = now(),
           agora_number = coalesce(agora_number, nextval('public.app_agora_seq'))
     where id = r.id;
    out := out || jsonb_build_array((
      select jsonb_build_object('order', to_jsonb(o),
               'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.app_order_items i where i.order_id = o.id), '[]'::jsonb))
        from public.app_orders o where o.id = r.id));
  end loop;
  return out;
end;
$$;
revoke all on function public.app_agora_claim(integer) from public, anon, authenticated;
grant execute on function public.app_agora_claim(integer) to service_role;

-- Confirmar un pedido recién creado como «pago en mesa».
create or replace function public.app_order_pay_at_table(p_order uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); o public.app_orders%rowtype; v_off boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select exists (select 1 from public.dining_settings s where s.key = 'app_pay_table' and s.value::text in ('"off"', 'false', '"false"', '"no"')) into v_off;
  if v_off then raise exception 'pay_table_off'; end if;
  select * into o from public.app_orders where id = p_order and customer_id = v_uid for update;
  if not found then raise exception 'not_found'; end if;
  if o.mode <> 'mesa' or o.table_id is null then raise exception 'table_only'; end if;
  if o.status <> 'pending_payment' or o.payment_status <> 'pending' then raise exception 'not_payable'; end if;
  if o.total_cents > 15000 then raise exception 'too_big'; end if;
  if (select count(*) from public.app_orders x
       where x.payment_status = 'table' and x.created_at > now() - interval '30 minutes' and (x.customer_id = v_uid or x.table_id = o.table_id)) >= 3 then
    raise exception 'too_many_table';
  end if;
  update public.app_orders set status = 'paid', payment_status = 'table', pay_method = 'table', paid_at = now() where id = o.id;
  return jsonb_build_object('ok', true, 'ref', o.ref);
end;
$$;
revoke all on function public.app_order_pay_at_table(uuid) from public, anon;
grant execute on function public.app_order_pay_at_table(uuid) to authenticated;

-- El pedido de pago en mesa también avisa al momento a Ágora (sin esperar al barrido del minuto).
create or replace function public.app_orders_agora_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status in ('paid', 'table') and old.payment_status is distinct from new.payment_status then
    perform net.http_post(
      url := 'https://lhwmtknmjmhktpkcngyz.supabase.co/functions/v1/agora-sync',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc'),
      body := '{"action":"push"}'::jsonb);
  end if;
  return new;
end;
$$;
revoke all on function public.app_orders_agora_push() from public, anon, authenticated;
