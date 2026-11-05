-- ROCE · Cobro de la fianza de las mesas con Redsys (paso 2: ejecutar DESPUÉS de mesas.sql)
-- Toca la tabla de pagos y la función confirm_payment, por eso va aparte.

-- Los pagos de Redsys pueden ser de una entrada o de la fianza de una mesa.
alter table public.payments alter column booking_id drop not null;
alter table public.payments add column if not exists table_booking_id uuid references public.table_bookings(id) on delete cascade;
alter table public.payments drop constraint if exists payments_one_target;
alter table public.payments add constraint payments_one_target check ((booking_id is null) <> (table_booking_id is null));

-- Devoluciones de fianzas: una por reserva (mismo candado que las de entradas).
create table if not exists public.table_refunds (
  table_booking_id uuid primary key references public.table_bookings(id) on delete restrict,
  order_id      text,
  amount_cents  integer not null,
  method        text not null check (method in ('redsys', 'manual')),
  status        text not null default 'started' check (status in ('started', 'done', 'failed')),
  response_code text,
  requested_by  text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.table_refunds enable row level security;
drop policy if exists table_refunds_admin_read on public.table_refunds;
create policy table_refunds_admin_read on public.table_refunds for select to authenticated using (public.has_tab('tables'));
drop policy if exists payments_admin_read on public.payments;
create policy payments_admin_read on public.payments for select to authenticated using (public.has_tab('bookings') or public.has_tab('tables'));

-- ─── Cobro de la fianza (la llama la función de Redsys con la clave de servicio) ──
-- Misma idea que confirm_payment: atómico y repetible. Reemplaza a la versión anterior (que solo conocía entradas).
create or replace function public.confirm_payment(p_order text, p_amount integer, p_response text, p_auth text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
  v_ok boolean;
  v_booking public.bookings%rowtype;
  v_table public.table_bookings%rowtype;
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
  if not v_ok then return 'failed'; end if;

  if pay.table_booking_id is not null then
    select * into v_table from public.table_bookings where id = pay.table_booking_id for update;
    if v_table.status = 'cancelled' then return 'paid_but_cancelled'; end if;
    -- Si pasaron los 15 minutos y la mesa se ocupó por otra reserva, hay que devolver el cobro a mano.
    if v_table.status = 'pending' and exists (
      select 1 from public.table_booking_tables mine
      join public.table_booking_tables other on other.table_id = mine.table_id and other.booking_id <> mine.booking_id
      join public.table_bookings o on o.id = other.booking_id
      where mine.booking_id = v_table.id and public.dining_holds(o.status, o.created_at) and o.starts_at < v_table.ends_at and o.ends_at > v_table.starts_at
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

