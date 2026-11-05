-- ROCE · Garantía con tarjeta para las reservas de Night (y cobro opcional de la penalización)
-- Ejecutar DESPUÉS de mesas.sql, mesas_pagos.sql y mesas_editar.sql. Se puede ejecutar más de una vez.
--
-- Cada zona decide cómo se garantiza una reserva (payment_mode):
--   none     → sin pago (planta baja)
--   deposit  → fianza cobrada al reservar, que se devuelve si se anula a tiempo
--   card     → la tarjeta se guarda en Redsys SIN cobrar nada; solo si no viene (o anula tarde) el panel cobra la penalización
-- (el importe sigue siendo "deposit_cents" de la zona: 20 € en la planta alta)
-- Además, el nombre de una reserva creada desde el panel puede ir vacío.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'dining_zones' and column_name = 'payment_mode') then
    alter table public.dining_zones add column payment_mode text not null default 'none';
    update public.dining_zones set payment_mode = case when deposit_cents > 0 then 'card' else 'none' end;
  end if;
end $$;
-- Anulación sin coste: la planta alta, hasta 12 h antes (solo si seguía con el valor de partida de 24 h).
update public.dining_zones set free_cancel_hours = 12 where id = 'alta' and free_cancel_hours = 24;
alter table public.dining_zones drop constraint if exists dining_zones_payment_mode_check;
alter table public.dining_zones add constraint dining_zones_payment_mode_check check (payment_mode in ('none', 'deposit', 'card'));

alter table public.table_bookings drop constraint if exists table_bookings_payment_status_check;
alter table public.table_bookings add constraint table_bookings_payment_status_check
  check (payment_status in ('free', 'pending', 'paid', 'refunded', 'retained', 'guaranteed', 'charging', 'charged', 'released'));
alter table public.table_bookings add column if not exists card_last4 text not null default '';
alter table public.table_bookings add column if not exists card_brand text not null default '';
alter table public.table_bookings add column if not exists card_expiry text not null default '';
alter table public.table_bookings add column if not exists late_cancel boolean not null default false;
alter table public.table_bookings add column if not exists fee_charged_cents integer not null default 0;

-- Los pagos de Redsys pueden ser un cobro o la alta de una tarjeta (importe 0).
alter table public.payments add column if not exists purpose text not null default 'payment';
alter table public.payments drop constraint if exists payments_purpose_check;
alter table public.payments add constraint payments_purpose_check check (purpose in ('payment', 'guarantee'));
alter table public.payments drop constraint if exists payments_amount_cents_check;
alter table public.payments add constraint payments_amount_cents_check check (amount_cents > 0 or purpose = 'guarantee');

-- Referencia de la tarjeta (la genera Redsys; nunca guardamos el número ni el CVV).
-- Nadie la lee desde el panel ni la web: solo la función "redsys" con la clave de servicio.
create table if not exists public.table_booking_cards (
  booking_id uuid primary key references public.table_bookings(id) on delete cascade,
  token      text not null,
  expiry     text not null default '',
  txnid      text not null default '',
  created_at timestamptz not null default now()
);
alter table public.table_booking_cards enable row level security;
revoke all on public.table_booking_cards from anon, authenticated;

-- La tarjeta se libera sola si la persona viene, o si anula a tiempo; y la referencia se borra en cuanto no hace falta.
create or replace function public.table_booking_card_before() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.payment_status = 'guaranteed' and (new.status in ('seated', 'completed') or (new.status = 'cancelled' and not new.late_cancel)) then
    new.payment_status := 'released';
  end if;
  return new;
end;
$$;
drop trigger if exists table_booking_card_before on public.table_bookings;
create trigger table_booking_card_before before update on public.table_bookings for each row execute function public.table_booking_card_before();

create or replace function public.table_booking_card_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status in ('released', 'charged', 'refunded', 'retained') then
    delete from public.table_booking_cards where booking_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists table_booking_card_after on public.table_bookings;
create trigger table_booking_card_after after update on public.table_bookings for each row execute function public.table_booking_card_after();

-- ─── Cierres del motor web por días o franjas ──────────────────────────────
-- Un cierre apaga las reservas de la WEB (para uno o varios días, y opcionalmente solo unas horas). Desde el panel
-- se puede seguir reservando a mano. Ejemplos: Fallas (todos esos días), Nochebuena (solo por la tarde).
alter table public.dining_closures add column if not exists start_min integer check (start_min between 0 and 2879);   -- hora desde (minutos desde las 00:00); vacío = todo el día
alter table public.dining_closures add column if not exists end_min integer check (end_min between 1 and 2880);
alter table public.dining_closures add column if not exists message_es text not null default '';   -- aviso que ve el público ese día
alter table public.dining_closures add column if not exists message_en text not null default '';
alter table public.dining_closures drop constraint if exists dining_closures_range_check;
alter table public.dining_closures add constraint dining_closures_range_check check (start_min is null or end_min is null or end_min > start_min);

drop function if exists public.dining_closed(date, text, text);
drop function if exists public.dining_closed(date, text, text, integer);
create function public.dining_closed(p_date date, p_service text, p_zone text, p_min integer default null) returns boolean
language sql stable set search_path = public as $$
  select exists (
    select 1 from public.dining_closures c
    where p_date between c.date_from and c.date_to
      and (c.service_id is null or c.service_id = p_service)
      and (c.zone_id is null or c.zone_id = p_zone)
      and ((c.start_min is null and c.end_min is null)
           or (p_min is not null and p_min >= coalesce(c.start_min, 0) and p_min < coalesce(c.end_min, 100000)))
  );
$$;

-- Avisos de cierre de un día (los que ve el público en la web de reservas).
drop function if exists public.dining_day_notice(date);
create function public.dining_day_notice(p_date date) returns table (o_es text, o_en text)
language sql stable security definer set search_path = public as $$
  select distinct c.message_es, case when c.message_en <> '' then c.message_en else c.message_es end
  from public.dining_closures c where p_date between c.date_from and c.date_to and c.message_es <> '';
$$;
revoke all on function public.dining_day_notice(date) from public;
grant execute on function public.dining_day_notice(date) to anon, authenticated;

-- Alta de la tarjeta (la llama la función de Redsys al recibir el aviso del banco).
create or replace function public.confirm_guarantee(p_order text, p_response text, p_token text, p_expiry text, p_txnid text, p_masked text, p_brand text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
  v   public.table_bookings%rowtype;
  v_ok boolean;
begin
  select * into pay from public.payments where order_id = p_order for update;
  if not found then return 'unknown_order'; end if;
  if pay.purpose <> 'guarantee' or pay.table_booking_id is null then return 'wrong_purpose'; end if;
  if pay.status = 'paid' then return 'already_done'; end if;
  v_ok := coalesce(p_response, '') ~ '^[0-9]{1,4}$' and p_response::integer between 0 and 99 and coalesce(p_token, '') <> '';
  update public.payments set status = case when v_ok then 'paid' else 'failed' end, response_code = left(p_response, 10), updated_at = now() where order_id = p_order;
  if not v_ok then return 'failed'; end if;

  select * into v from public.table_bookings where id = pay.table_booking_id for update;
  if v.status = 'cancelled' then return 'ok_but_cancelled'; end if;
  if v.status = 'pending' and exists (
    select 1 from public.table_booking_tables mine
    join public.table_booking_tables other on other.table_id = mine.table_id and other.booking_id <> mine.booking_id
    join public.table_bookings o on o.id = other.booking_id
    where mine.booking_id = v.id and public.dining_holds(o.status, o.hold_until) and o.starts_at < v.ends_at and o.ends_at > v.starts_at
  ) then return 'ok_but_table_taken'; end if;

  insert into public.table_booking_cards (booking_id, token, expiry, txnid)
  values (v.id, p_token, left(coalesce(p_expiry, ''), 8), left(coalesce(p_txnid, ''), 60))
  on conflict (booking_id) do update set token = excluded.token, expiry = excluded.expiry, txnid = excluded.txnid, created_at = now();
  update public.table_bookings
     set status = 'confirmed', payment_status = 'guaranteed', paid_at = coalesce(paid_at, now()),
         card_last4 = right(regexp_replace(coalesce(p_masked, ''), '[^0-9]', '', 'g'), 4),
         card_brand = left(coalesce(p_brand, ''), 20), card_expiry = left(coalesce(p_expiry, ''), 8)
   where id = v.id;
  return 'guaranteed';
end;
$$;
revoke all on function public.confirm_guarantee(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.confirm_guarantee(text, text, text, text, text, text, text) to service_role;

drop function if exists public.dining_slots(date, integer, text);
create or replace function public.dining_slots(p_date date, p_party integer, p_ambience text default null)
returns table (o_service text, o_ambience text, o_starts_at timestamptz, o_time text, o_zone text, o_zone_es text, o_zone_en text, o_deposit_cents integer, o_free_hours integer, o_payment_mode text)
language plpgsql stable security definer set search_path = public as $$
declare
  s public.dining_services%rowtype;
  z public.dining_zones%rowtype;
  t integer;
  v_start timestamptz;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
begin
  if p_date is null or p_party is null or p_party < 1 then return; end if;
  if p_date < v_today then return; end if;
  for s in select * from public.dining_services
           where active and (p_ambience is null or ambience = p_ambience)
             and extract(isodow from p_date)::integer = any (days)
             and p_party <= max_party and p_date <= v_today + days_ahead
           order by start_min loop
    for z in select * from public.dining_zones where active and (s.zone_ids is null or id = any (s.zone_ids)) order by sort, id loop
      if public.dining_closed(p_date, s.id, z.id) then continue; end if;
      t := s.start_min;
      while t <= s.last_min loop
        v_start := (p_date::timestamp + make_interval(mins => t)) at time zone 'Europe/Madrid';
        if v_start > now() + make_interval(mins => s.notice_min)
           and not public.dining_closed(p_date, s.id, z.id, t)
           and public.dining_assign(v_start, v_start + make_interval(mins => s.duration_min), p_party, z.id) is not null then
          o_service := s.id; o_ambience := s.ambience; o_starts_at := v_start;
          o_time := to_char(v_start at time zone 'Europe/Madrid', 'HH24:MI');
          o_zone := z.id; o_zone_es := z.name_es; o_zone_en := case when z.name_en <> '' then z.name_en else z.name_es end;
          o_deposit_cents := case when z.payment_mode = 'none' then 0 when z.deposit_per_person then z.deposit_cents * p_party else z.deposit_cents end;
          o_free_hours := z.free_cancel_hours;
          o_payment_mode := z.payment_mode;
          return next;
        end if;
        t := t + s.slot_min;
      end loop;
    end loop;
  end loop;
end;
$$;
revoke all on function public.dining_slots(date, integer, text) from public;
grant execute on function public.dining_slots(date, integer, text) to anon, authenticated;

drop function if exists public.book_table(text, timestamptz, text, integer, text, text, text, text, text, boolean);
create or replace function public.book_table(
  p_service text, p_starts timestamptz, p_zone text, p_party integer,
  p_name text, p_email text, p_phone text, p_notes text default '', p_lang text default 'es', p_marketing boolean default false
) returns table (o_ref text, o_token text, o_status text, o_deposit_cents integer)
language plpgsql security definer set search_path = public as $$
declare
  s public.dining_services%rowtype;
  z public.dining_zones%rowtype;
  v_date date;
  v_end timestamptz;
  v_tables uuid[];
  v_dep integer;
  v_id uuid;
  v_ref text;
  v_token text;
  v_status text;
  v_min integer;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
begin
  perform pg_advisory_xact_lock(7001);   -- una reserva cada vez: dos personas no pueden coger la misma mesa
  select * into s from public.dining_services where id = p_service and active;
  if not found then raise exception 'service_not_found'; end if;
  select * into z from public.dining_zones where id = p_zone and active;
  if not found or (s.zone_ids is not null and not (z.id = any (s.zone_ids))) then raise exception 'zone_not_found'; end if;
  if p_party is null or p_party < 1 or p_party > s.max_party then raise exception 'bad_party'; end if;
  if length(trim(coalesce(p_name, ''))) < 3
     or coalesce(p_email, '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'
     or length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9
  then raise exception 'bad_data'; end if;

  v_date := public.dining_slot_date(s.id, p_starts);
  if v_date is null then raise exception 'bad_slot'; end if;
  if p_starts <= now() + make_interval(mins => s.notice_min) then raise exception 'too_late'; end if;
  if v_date > (now() at time zone 'Europe/Madrid')::date + s.days_ahead then raise exception 'too_far'; end if;
  v_min := round(extract(epoch from (p_starts - (v_date::timestamp at time zone 'Europe/Madrid'))) / 60)::integer;
  if public.dining_closed(v_date, s.id, z.id) or public.dining_closed(v_date, s.id, z.id, v_min) then raise exception 'closed'; end if;

  -- Freno contra reservas falsas: como mucho 3 reservas futuras activas por email.
  if (select count(*) from public.table_bookings b
      where lower(b.email) = lower(trim(p_email)) and b.starts_at > now()
        and public.dining_holds(b.status, b.hold_until)) >= 3 then raise exception 'too_many'; end if;

  v_end := p_starts + make_interval(mins => s.duration_min);
  v_tables := public.dining_assign(p_starts, v_end, p_party, z.id);
  if v_tables is null then raise exception 'no_table'; end if;

  v_dep := case when z.payment_mode = 'none' then 0 when z.deposit_per_person then z.deposit_cents * p_party else z.deposit_cents end;
  v_status := case when v_dep > 0 then 'pending' else 'confirmed' end;

  loop
    v_ref := 'MESA-';
    for i in 1..6 loop v_ref := v_ref || substr(chars, 1 + floor(random() * length(chars))::integer, 1); end loop;
    exit when not exists (select 1 from public.table_bookings b where b.ref = v_ref);
  end loop;

  insert into public.table_bookings (ref, service_id, ambience, zone_id, starts_at, ends_at, party, name, email, phone, notes, lang, marketing_optin,
                                     status, payment_status, deposit_cents, source, hold_until)
  values (v_ref, s.id, s.ambience, z.id, p_starts, v_end, p_party, trim(p_name), lower(trim(p_email)), trim(p_phone),
          left(coalesce(p_notes, ''), 500), case when p_lang = 'en' then 'en' else 'es' end, coalesce(p_marketing, false),
          v_status, case when v_dep > 0 then 'pending' else 'free' end, v_dep, 'web', now() + interval '15 minutes')
  returning id, token into v_id, v_token;
  insert into public.table_booking_tables (booking_id, table_id) select v_id, unnest(v_tables);

  return query select v_ref, v_token, v_status, v_dep;
end;
$$;
revoke all on function public.book_table(text, timestamptz, text, integer, text, text, text, text, text, boolean) from public;
grant execute on function public.book_table(text, timestamptz, text, integer, text, text, text, text, text, boolean) to anon, authenticated;

drop function if exists public.dining_admin_create(text, timestamptz, text, integer, text, text, text, text, uuid[], boolean);
drop function if exists public.dining_admin_create(text, timestamptz, text, integer, text, text, text, text, uuid[], boolean, boolean, integer);
create function public.dining_admin_create(
  p_service text, p_starts timestamptz, p_zone text, p_party integer,
  p_name text, p_email text, p_phone text, p_notes text default '', p_tables uuid[] default null, p_seated boolean default false,
  p_request_payment boolean default false, p_hold_hours integer default 24
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.dining_services%rowtype;
  z public.dining_zones%rowtype;
  v_end timestamptz;
  v_tables uuid[];
  v_dep integer := 0;
  v_pend boolean;
  v_id uuid;
  v_ref text;
  v_token text;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
begin
  if not public.has_tab('tables') then raise exception 'forbidden'; end if;
  perform pg_advisory_xact_lock(7001);
  select * into s from public.dining_services where id = p_service;
  if not found then raise exception 'service_not_found'; end if;
  select * into z from public.dining_zones where id = p_zone;
  if not found then raise exception 'zone_not_found'; end if;
  if p_party is null or p_party < 1 or p_party > 60 then raise exception 'bad_data'; end if;   -- el nombre puede ir vacío
  v_end := p_starts + make_interval(mins => s.duration_min);

  if p_request_payment then
    v_dep := case when z.payment_mode = 'none' then 0 when z.deposit_per_person then z.deposit_cents * p_party else z.deposit_cents end;
    if v_dep > 0 and coalesce(p_email, '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then raise exception 'email_required'; end if;
  end if;
  v_pend := v_dep > 0;

  if p_tables is not null and cardinality(p_tables) > 0 then
    if exists (
      select 1 from public.table_booking_tables bt join public.table_bookings b on b.id = bt.booking_id
      where bt.table_id = any (p_tables) and public.dining_holds(b.status, b.hold_until) and b.starts_at < v_end and b.ends_at > p_starts
    ) then raise exception 'table_busy'; end if;
    v_tables := p_tables;
  else
    v_tables := public.dining_assign(p_starts, v_end, p_party, p_zone);
    if v_tables is null then raise exception 'no_table'; end if;
  end if;

  loop
    v_ref := 'MESA-';
    for i in 1..6 loop v_ref := v_ref || substr(chars, 1 + floor(random() * length(chars))::integer, 1); end loop;
    exit when not exists (select 1 from public.table_bookings b where b.ref = v_ref);
  end loop;
  insert into public.table_bookings (ref, service_id, ambience, zone_id, starts_at, ends_at, party, name, email, phone, notes, lang,
                                     status, payment_status, deposit_cents, source, hold_until)
  values (v_ref, s.id, s.ambience, p_zone, p_starts, v_end, p_party, trim(coalesce(p_name, '')), lower(trim(coalesce(p_email, ''))), trim(coalesce(p_phone, '')),
          left(coalesce(p_notes, ''), 500), 'es',
          case when v_pend then 'pending' when p_seated then 'seated' else 'confirmed' end,
          case when v_pend then 'pending' else 'free' end, v_dep, 'admin',
          now() + make_interval(hours => greatest(1, least(coalesce(p_hold_hours, 24), 168))))
  returning id, token into v_id, v_token;
  insert into public.table_booking_tables (booking_id, table_id) select v_id, unnest(v_tables);
  return jsonb_build_object('ok', true, 'id', v_id, 'ref', v_ref, 'token', v_token, 'status', case when v_pend then 'pending' else 'confirmed' end, 'deposit_cents', v_dep);
end;
$$;
revoke all on function public.dining_admin_create(text, timestamptz, text, integer, text, text, text, text, uuid[], boolean, boolean, integer) from public, anon;
grant execute on function public.dining_admin_create(text, timestamptz, text, integer, text, text, text, text, uuid[], boolean, boolean, integer) to authenticated;

create or replace function public.table_booking_get(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  b public.table_bookings%rowtype;
  z public.dining_zones%rowtype;
begin
  select * into b from public.table_bookings where length(coalesce(p_token, '')) = 32 and token = p_token;
  if not found then return null; end if;
  select * into z from public.dining_zones where id = b.zone_id;
  return jsonb_build_object(
    'ref', b.ref, 'name', b.name, 'party', b.party, 'ambience', b.ambience, 'status', b.status, 'payment_status', b.payment_status,
    'starts_at', b.starts_at, 'deposit_cents', b.deposit_cents, 'refund_due', b.refund_due,
    'zone_es', z.name_es, 'zone_en', case when z.name_en <> '' then z.name_en else z.name_es end,
    'free_cancel_hours', coalesce(z.free_cancel_hours, 24),
    'refundable_until', b.starts_at - make_interval(hours => coalesce(z.free_cancel_hours, 24)),
    'can_cancel', b.status in ('pending', 'confirmed') and b.starts_at > now(),
    'can_pay', b.status = 'pending' and b.payment_status = 'pending' and b.deposit_cents > 0 and b.hold_until > now() and b.starts_at > now(),
    'hold_until', b.hold_until, 'source', b.source,
    'payment_mode', coalesce(z.payment_mode, 'none'), 'card_last4', b.card_last4, 'card_brand', b.card_brand, 'late_cancel', b.late_cancel
  );
end;
$$;
revoke all on function public.table_booking_get(text) from public;
grant execute on function public.table_booking_get(text) to anon, authenticated;

-- Anular la reserva.
--  · Con garantía de tarjeta: si se avisa a tiempo, la tarjeta se libera (no se cobra nada); si es tarde, la garantía
--    sigue en pie y el equipo decide si cobra la penalización desde el panel.
--  · Con fianza ya cobrada: a tiempo queda "por devolver"; tarde, se retiene.
create or replace function public.table_booking_cancel(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.table_bookings%rowtype;
  z public.dining_zones%rowtype;
  v_in_time boolean;
  v_card boolean;
begin
  select * into b from public.table_bookings where length(coalesce(p_token, '')) = 32 and token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.status not in ('pending', 'confirmed') or b.starts_at <= now() then return jsonb_build_object('ok', false, 'error', 'not_cancellable'); end if;
  select * into z from public.dining_zones where id = b.zone_id;
  v_in_time := b.starts_at - make_interval(hours => coalesce(z.free_cancel_hours, 24)) >= now();
  v_card := b.payment_status = 'guaranteed';
  update public.table_bookings bk
     set status = 'cancelled', cancelled_at = now(),
         late_cancel = (v_card and not v_in_time),
         refund_due = (bk.payment_status = 'paid' and v_in_time),
         payment_status = case when bk.payment_status = 'paid' and not v_in_time then 'retained' else bk.payment_status end
   where bk.id = b.id
   returning bk.* into b;
  return jsonb_build_object('ok', true, 'refund_due', b.refund_due, 'retained', b.payment_status = 'retained', 'deposit_cents', b.deposit_cents,
                            'ref', b.ref, 'card', v_card, 'late', b.late_cancel);
end;
$$;
revoke all on function public.table_booking_cancel(text) from public;
grant execute on function public.table_booking_cancel(text) to anon, authenticated;

drop function if exists public.dining_admin_update(uuid, integer, timestamptz, text, text, text, text, uuid[]);
create function public.dining_admin_update(
  p_booking uuid, p_party integer, p_starts timestamptz, p_name text, p_phone text, p_email text, p_notes text, p_tables uuid[]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.table_bookings%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_tables uuid[];
begin
  if not public.has_tab('tables') then raise exception 'forbidden'; end if;
  perform pg_advisory_xact_lock(7001);
  select * into b from public.table_bookings where id = p_booking for update;
  if not found then raise exception 'not_found'; end if;
  if b.status in ('cancelled', 'no_show', 'completed') then raise exception 'not_editable'; end if;
  if p_party is null or p_party < 1 or p_party > 60 then raise exception 'bad_data'; end if;

  v_start := coalesce(p_starts, b.starts_at);
  v_end := v_start + (b.ends_at - b.starts_at);

  if p_tables is not null and cardinality(p_tables) > 0 then
    v_tables := p_tables;
  else
    select array_agg(t.table_id) into v_tables from public.table_booking_tables t where t.booking_id = b.id;
  end if;

  -- ¿Siguen libres esas mesas en la nueva franja? Si no, y no se eligieron a mano, se busca otra combinación.
  if exists (
    select 1 from public.table_booking_tables bt join public.table_bookings o on o.id = bt.booking_id
    where bt.table_id = any (v_tables) and o.id <> b.id and public.dining_holds(o.status, o.hold_until) and o.starts_at < v_end and o.ends_at > v_start
  ) then
    if p_tables is not null and cardinality(p_tables) > 0 then raise exception 'table_busy'; end if;
    v_tables := public.dining_assign(v_start, v_end, p_party, b.zone_id, b.id);
    if v_tables is null then raise exception 'no_table'; end if;
  end if;

  update public.table_bookings bk
     set party = p_party, starts_at = v_start, ends_at = v_end, name = trim(coalesce(p_name, '')),
         phone = trim(coalesce(p_phone, '')), email = lower(trim(coalesce(p_email, ''))), notes = left(coalesce(p_notes, ''), 500)
   where bk.id = b.id;
  delete from public.table_booking_tables where booking_id = b.id;
  insert into public.table_booking_tables (booking_id, table_id) select b.id, unnest(v_tables);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.dining_admin_update(uuid, integer, timestamptz, text, text, text, text, uuid[]) from public, anon;
grant execute on function public.dining_admin_update(uuid, integer, timestamptz, text, text, text, text, uuid[]) to authenticated;
