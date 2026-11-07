-- ROCE · App de pedidos · Cobro con Redsys. Ejecutar DESPUÉS de app_pedidos.sql y mesas_pagos.sql. Se puede ejecutar más de una vez.
-- 1) Un pago de Redsys puede ser ahora de una entrada, de la fianza de una mesa o de un pedido de la app.
-- 2) confirm_payment (la llama la función «redsys» cuando el banco avisa) marca el pedido de la app como pagado.

alter table public.payments add column if not exists app_order_id uuid references public.app_orders(id) on delete cascade;
alter table public.payments drop constraint if exists payments_one_target;
alter table public.payments add constraint payments_one_target check (num_nonnulls(booking_id, table_booking_id, app_order_id) = 1);
create index if not exists payments_app_order_idx on public.payments (app_order_id);

create or replace function public.confirm_payment(p_order text, p_amount integer, p_response text, p_auth text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
  v_ok boolean;
  v_booking public.bookings%rowtype;
  v_table public.table_bookings%rowtype;
  v_app public.app_orders%rowtype;
begin
  select * into pay from public.payments where order_id = p_order for update;
  if not found then return 'unknown_order'; end if;
  if pay.amount_cents <> p_amount then return 'amount_mismatch'; end if;
  if pay.status = 'paid' then return 'already_paid'; end if;

  v_ok := coalesce(p_response, '') ~ '^[0-9]{1,4}$' and p_response::integer between 0 and 99;
  update public.payments
     set status = case when v_ok then 'paid' else 'failed' end,
         response_code = left(p_response, 10), auth_code = left(coalesce(p_auth, ''), 20), updated_at = now()
   where order_id = p_order;
  if not v_ok then
    if pay.app_order_id is not null then
      update public.app_orders set payment_status = 'failed' where id = pay.app_order_id and payment_status = 'pending';
    end if;
    return 'failed';
  end if;

  -- Pedido de la app: pasa a «pagado» y entra en la cocina.
  if pay.app_order_id is not null then
    select * into v_app from public.app_orders where id = pay.app_order_id for update;
    if v_app.status = 'cancelled' then return 'paid_but_cancelled'; end if;
    update public.app_orders
       set status = case when status = 'pending_payment' then 'paid' else status end, payment_status = 'paid', paid_at = coalesce(paid_at, now())
     where id = v_app.id and payment_status <> 'paid';
    return 'paid';
  end if;

  if pay.table_booking_id is not null then
    select * into v_table from public.table_bookings where id = pay.table_booking_id for update;
    if v_table.status = 'cancelled' then return 'paid_but_cancelled'; end if;
    -- Si pasaron los 15 minutos y la mesa se ocupó por otra reserva, hay que devolver el cobro a mano.
    if v_table.status = 'pending' and exists (
      select 1 from public.table_booking_tables mine
      join public.table_booking_tables other on other.table_id = mine.table_id and other.booking_id <> mine.booking_id
      join public.table_bookings o on o.id = other.booking_id
      where mine.booking_id = v_table.id and public.dining_holds(o.status, o.hold_until) and o.starts_at < v_table.ends_at and o.ends_at > v_table.starts_at
    ) then return 'paid_but_table_taken'; end if;
    update public.table_bookings
       set status = 'confirmed', payment_status = 'paid', paid_at = coalesce(paid_at, now())
     where id = v_table.id and payment_status <> 'paid';
    return 'paid';
  end if;

  select * into v_booking from public.bookings where id = pay.booking_id for update;
  if v_booking.status = 'cancelled' then return 'paid_but_cancelled'; end if; -- cobrado de una reserva anulada: hay que devolverlo
  update public.bookings
     set status = 'confirmed', payment_status = 'paid', paid_at = coalesce(paid_at, now())
   where id = pay.booking_id and payment_status <> 'paid';
  return 'paid';
end;
$$;
revoke all on function public.confirm_payment(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.confirm_payment(text, integer, text, text) to service_role;
