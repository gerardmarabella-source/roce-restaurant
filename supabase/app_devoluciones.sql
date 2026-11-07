-- ROCE · App de pedidos · Devoluciones de pedidos cobrados con Redsys (total o parcial).
-- Ejecutar DESPUÉS de app_pedidos.sql, app_pago.sql y app_rocecover.sql. Se puede ejecutar más de una vez.
--
-- Qué hace:
--  1) app_orders.refunded_cents: lo ya devuelto de cada pedido. Cuando llega al total, el pedido pasa a payment_status = 'refunded'.
--  2) app_refunds: una fila por cada devolución (quién la pidió, cuánto, si fue por Redsys o a mano en el portal del banco y qué respondió el banco).
--  3) app_refund_reserve / app_refund_finish: las usa la función «redsys» (acción app_refund). Reservan el importe antes de llamar al banco
--     (así no se puede devolver dos veces lo mismo ni más de lo cobrado) y, al terminar, actualizan el pedido y restan lo devuelto del gasto de la visita en RoceCover.
-- Ágora emite los abonos y las facturas: aquí solo se guarda la devolución del dinero.

alter table public.app_orders add column if not exists refunded_cents integer not null default 0 check (refunded_cents >= 0);

create table if not exists public.app_refunds (
  id            bigserial primary key,
  app_order_id  uuid not null references public.app_orders(id) on delete cascade,
  order_id      text,                                                  -- número de operación de Redsys del cobro original
  amount_cents  integer not null check (amount_cents > 0),
  method        text not null check (method in ('redsys', 'manual')),
  status        text not null default 'started' check (status in ('started', 'done', 'failed')),
  response_code text,
  reason        text not null default '',
  requested_by  text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists app_refunds_order_idx on public.app_refunds (app_order_id, created_at desc);
alter table public.app_refunds enable row level security;
drop policy if exists app_refunds_staff on public.app_refunds;
create policy app_refunds_staff on public.app_refunds for select to authenticated using (public.has_tab('tables') or public.has_tab('orders'));
-- Nadie escribe aquí directamente: solo las dos funciones de abajo (las llama la función «redsys» con la clave de servicio).

create or replace function public.app_refund_reserve(p_order uuid, p_amount integer, p_by text, p_manual boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.app_orders%rowtype; v_open integer; v_pay_order text; v_pay_amount integer; v_id bigint;
begin
  select * into o from public.app_orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  if o.payment_status <> 'paid' then raise exception 'not_refundable'; end if;
  select order_id, amount_cents into v_pay_order, v_pay_amount from public.payments
   where app_order_id = o.id and status = 'paid' order by updated_at desc limit 1;
  if v_pay_order is null and not coalesce(p_manual, false) then raise exception 'no_online_payment'; end if;
  if exists (select 1 from public.app_refunds where app_order_id = o.id and status = 'started') then raise exception 'refund_in_progress'; end if;
  v_open := o.total_cents - o.refunded_cents;
  if p_amount is null or p_amount < 1 or p_amount > v_open then raise exception 'bad_amount'; end if;
  insert into public.app_refunds (app_order_id, order_id, amount_cents, method, reason, requested_by)
  values (o.id, v_pay_order, p_amount, case when coalesce(p_manual, false) then 'manual' else 'redsys' end, left(coalesce(p_reason, ''), 200), left(coalesce(p_by, ''), 120))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'order_id', v_pay_order, 'paid_cents', v_pay_amount, 'open_cents', v_open);
end $$;
revoke all on function public.app_refund_reserve(uuid, integer, text, boolean, text) from public, anon, authenticated;
grant execute on function public.app_refund_reserve(uuid, integer, text, boolean, text) to service_role;

create or replace function public.app_refund_finish(p_id bigint, p_ok boolean, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.app_refunds%rowtype; o public.app_orders%rowtype;
begin
  select * into r from public.app_refunds where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'started' then return jsonb_build_object('status', r.status); end if;
  update public.app_refunds set status = case when p_ok then 'done' else 'failed' end, response_code = left(coalesce(p_code, ''), 10), updated_at = now() where id = p_id;
  if p_ok then
    update public.app_orders
       set refunded_cents = refunded_cents + r.amount_cents,
           payment_status = case when refunded_cents + r.amount_cents >= total_cents then 'refunded' else payment_status end
     where id = r.app_order_id
    returning * into o;
    -- RoceCover: el gasto de la visita baja lo devuelto.
    if o.table_booking_id is not null then
      update public.table_bookings set spend_cents = greatest(0, coalesce(spend_cents, 0) - r.amount_cents) where id = o.table_booking_id;
    end if;
  end if;
  return jsonb_build_object('status', case when p_ok then 'done' else 'failed' end);
end $$;
revoke all on function public.app_refund_finish(bigint, boolean, text) from public, anon, authenticated;
grant execute on function public.app_refund_finish(bigint, boolean, text) to service_role;
