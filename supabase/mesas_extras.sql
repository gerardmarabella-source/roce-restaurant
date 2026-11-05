-- ROCE · Duración de la mesa, prescriptores, tipo de reserva, notas y bloqueo de clientes, etiquetas (alergias…) y CRM
-- Ejecutar DESPUÉS de mesas_tarjeta.sql y ANTES de mesas_espera.sql. Se puede ejecutar más de una vez.

-- Duración: cada turno tiene una duración base; los grupos grandes pueden llevar minutos extra
-- (p. ej. a partir de 6 personas, +30 min). Desde el panel se puede fijar la duración de una reserva concreta.
alter table public.dining_services add column if not exists big_party_from integer not null default 0;        -- 0 = sin extra
alter table public.dining_services add column if not exists big_party_extra_min integer not null default 0;
-- Condiciones del turno que se cuentan al cliente: minutos de cortesía de llegada y un aviso final
-- (p. ej. a las 00:30 se les invita a bajar a la planta baja a seguir descubriendo ROCE).
alter table public.dining_services add column if not exists grace_min integer not null default 15;
alter table public.dining_services add column if not exists end_note_es text not null default '';
alter table public.dining_services add column if not exists end_note_en text not null default '';
-- Valores acordados: 1 h 45 min por mesa; en Restaurant & Cocktails la última mesa es a las 22:45 (termina a las 00:30).
do $$
begin
  if exists (select 1 from public.dining_services where id = 'night' and end_note_es = '') then
    update public.dining_services set duration_min = 105 where id in ('day', 'night') and duration_min in (90, 120);
    update public.dining_services set last_min = 1365 where id = 'night' and last_min = 1470;
    update public.dining_services set
      end_note_es = 'A las 00:30 te invitamos a bajar a la planta baja para seguir descubriendo ROCE.',
      end_note_en = 'At 00:30 we invite you to go down to the ground floor to keep discovering ROCE.'
    where id = 'night';
  end if;
end $$;
create or replace function public.dining_duration(p_service text, p_party integer) returns integer
language sql stable set search_path = public as $$
  select s.duration_min + case when s.big_party_from > 0 and p_party >= s.big_party_from then s.big_party_extra_min else 0 end
  from public.dining_services s where s.id = p_service;
$$;

-- Prescriptores: quien trae o recomienda la reserva (RR. PP., conserjes, agencias…). Cada uno tiene un código
-- que se pone en el enlace de reserva (?pr=codigo) para saber de quién viene cada reserva de la web.
create table if not exists public.dining_prescribers (
  code       text primary key check (code ~ '^[a-z0-9-]{2,30}$'),
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.dining_prescribers enable row level security;
drop policy if exists dining_prescribers_admin on public.dining_prescribers;
create policy dining_prescribers_admin on public.dining_prescribers for all to authenticated using (public.has_tab('tables')) with check (public.has_tab('tables'));
alter table public.table_bookings add column if not exists prescriber text not null default '';
-- Tipo de garantía de ESTA reserva (puede distinguirse del de la zona cuando se crea desde el panel): '' = sin pago, 'card' o 'deposit'.
alter table public.table_bookings add column if not exists pay_mode text not null default '';

-- ─── Notas de cliente y bloqueo ────────────────────────────────────────────
-- Comentarios sobre un cliente y, si hace falta, bloqueo para que no pueda volver a reservar (web ni lista de espera).
-- La clave del cliente es su email (o su teléfono, si no tiene), igual que en el CRM.
create table if not exists public.dining_customer_notes (
  customer_key   text primary key,
  note           text not null default '',
  blocked        boolean not null default false,
  blocked_reason text not null default '',
  updated_by     text not null default '',
  updated_at     timestamptz not null default now()
);
alter table public.dining_customer_notes enable row level security;
drop policy if exists dining_customer_notes_admin on public.dining_customer_notes;
create policy dining_customer_notes_admin on public.dining_customer_notes for all to authenticated using (public.has_tab('tables')) with check (public.has_tab('tables'));

-- Etiquetas (alergias e intolerancias), tipo de cliente (particular / empresa / grupo empresarial para consumos internos)
-- y saldo pendiente de facturar.
alter table public.dining_customer_notes add column if not exists tags text[] not null default '{}';
alter table public.dining_customer_notes add column if not exists customer_type text not null default 'particular';
alter table public.dining_customer_notes drop constraint if exists dining_customer_notes_type_check;
alter table public.dining_customer_notes add constraint dining_customer_notes_type_check check (customer_type in ('particular', 'empresa', 'grupo'));
alter table public.dining_customer_notes add column if not exists company text not null default '';
alter table public.dining_customer_notes add column if not exists tax_id text not null default '';
alter table public.dining_customer_notes add column if not exists balance_cents integer not null default 0;   -- saldo pendiente (facturado, por cobrar)
-- Alergias e intolerancias de ESTA reserva (la web las pide; el equipo las puede cambiar).
alter table public.table_bookings add column if not exists allergy_tags text[] not null default '{}';

create or replace function public.dining_customer_blocked(p_email text, p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.dining_customer_notes n
    where n.blocked and n.customer_key in (nullif(lower(trim(coalesce(p_email, ''))), ''), nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), ''))
  );
$$;
revoke all on function public.dining_customer_blocked(text, text) from public, anon, authenticated;

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
           and public.dining_assign(v_start, v_start + make_interval(mins => public.dining_duration(s.id, p_party)), p_party, z.id) is not null then
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
drop function if exists public.book_table(text, timestamptz, text, integer, text, text, text, text, text, boolean, text);
drop function if exists public.book_table(text, timestamptz, text, integer, text, text, text, text, text, boolean, text, text[]);
create or replace function public.book_table(
  p_service text, p_starts timestamptz, p_zone text, p_party integer,
  p_name text, p_email text, p_phone text, p_notes text default '', p_lang text default 'es', p_marketing boolean default false, p_prescriber text default '', p_allergies text[] default '{}'
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

  if public.dining_customer_blocked(p_email, p_phone) then raise exception 'blocked'; end if;
  v_date := public.dining_slot_date(s.id, p_starts);
  if v_date is null then raise exception 'bad_slot'; end if;
  if p_starts <= now() + make_interval(mins => s.notice_min) then raise exception 'too_late'; end if;
  if v_date > (now() at time zone 'Europe/Madrid')::date + s.days_ahead then raise exception 'too_far'; end if;
  v_min := round(extract(epoch from (p_starts - (v_date::timestamp at time zone 'Europe/Madrid'))) / 60)::integer;
  if public.dining_closed(v_date, s.id, z.id) or public.dining_closed(v_date, s.id, z.id, v_min) then raise exception 'closed'; end if;

  -- Freno contra reservas falsas: como mucho 3 reservas futuras activas por email.
  if (select count(*) from public.table_bookings b
      where lower(b.email) = lower(trim(p_email)) and b.starts_at > now()
        and public.dining_holds(b.status, b.hold_until)) >= 10 then raise exception 'too_many'; end if;

  v_end := p_starts + make_interval(mins => public.dining_duration(s.id, p_party));
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
                                     status, payment_status, deposit_cents, source, hold_until, prescriber, pay_mode, allergy_tags)
  values (v_ref, s.id, s.ambience, z.id, p_starts, v_end, p_party, trim(p_name), lower(trim(p_email)), trim(p_phone),
          left(coalesce(p_notes, ''), 500), case when p_lang = 'en' then 'en' else 'es' end, coalesce(p_marketing, false),
          v_status, case when v_dep > 0 then 'pending' else 'free' end, v_dep, 'web', now() + interval '15 minutes',
          coalesce((select pr.code from public.dining_prescribers pr where pr.code = lower(trim(coalesce(p_prescriber, ''))) and pr.active), ''),
          case when v_dep > 0 then z.payment_mode else '' end,
          coalesce((select array_agg(distinct a) from unnest(coalesce(p_allergies, '{}')) a where a = any (array['gluten','lactosa','frutos-secos','marisco','pescado','huevo','soja','sesamo','vegetariano','vegano','otras'])), '{}'))
  returning id, token into v_id, v_token;
  insert into public.table_booking_tables (booking_id, table_id) select v_id, unnest(v_tables);

  return query select v_ref, v_token, v_status, v_dep;
end;
$$;
revoke all on function public.book_table(text, timestamptz, text, integer, text, text, text, text, text, boolean, text, text[]) from public;
grant execute on function public.book_table(text, timestamptz, text, integer, text, text, text, text, text, boolean, text, text[]) to anon, authenticated;

drop function if exists public.dining_admin_create(text, timestamptz, text, integer, text, text, text, text, uuid[], boolean);
drop function if exists public.dining_admin_create(text, timestamptz, text, integer, text, text, text, text, uuid[], boolean, boolean, integer);
drop function if exists public.dining_admin_create(text, timestamptz, text, integer, text, text, text, text, uuid[], boolean, boolean, integer, integer, text);
drop function if exists public.dining_admin_create(text, timestamptz, text, integer, text, text, text, text, uuid[], boolean, boolean, integer, integer, text, text, integer);
drop function if exists public.dining_admin_create(text, timestamptz, text, integer, text, text, text, text, uuid[], boolean, boolean, integer);
create function public.dining_admin_create(
  p_service text, p_starts timestamptz, p_zone text, p_party integer,
  p_name text, p_email text, p_phone text, p_notes text default '', p_tables uuid[] default null, p_seated boolean default false,
  p_request_payment boolean default false, p_hold_hours integer default 24,
  p_duration integer default null, p_prescriber text default '', p_mode text default null, p_amount_cents integer default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.dining_services%rowtype;
  z public.dining_zones%rowtype;
  v_end timestamptz;
  v_tables uuid[];
  v_dep integer := 0;
  v_pend boolean;
  v_mode text := '';
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
  if public.dining_customer_blocked(p_email, p_phone) then raise exception 'customer_blocked'; end if;
  v_end := p_starts + make_interval(mins => case when p_duration between 15 and 600 then p_duration else public.dining_duration(s.id, p_party) end);

  -- Tipo de reserva: gratuita ('free'), con tarjeta de garantía ('card', no se cobra) o con fianza cobrada ('deposit').
  -- Sin indicarlo, vale lo de siempre: si se pide pago, el de la zona.
  v_mode := case when p_mode in ('card', 'deposit') then p_mode when p_mode = 'free' then '' when p_request_payment and z.payment_mode in ('card', 'deposit') then z.payment_mode else '' end;
  if v_mode <> '' then
    v_dep := coalesce(nullif(p_amount_cents, 0), case when z.payment_mode = 'none' then 0 when z.deposit_per_person then z.deposit_cents * p_party else z.deposit_cents end);
    if v_dep <= 0 then raise exception 'amount_required'; end if;
    if coalesce(p_email, '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then raise exception 'email_required'; end if;
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
                                     status, payment_status, deposit_cents, source, hold_until, prescriber, pay_mode)
  values (v_ref, s.id, s.ambience, p_zone, p_starts, v_end, p_party, trim(coalesce(p_name, '')), lower(trim(coalesce(p_email, ''))), trim(coalesce(p_phone, '')),
          left(coalesce(p_notes, ''), 500), 'es',
          case when v_pend then 'pending' when p_seated then 'seated' else 'confirmed' end,
          case when v_pend then 'pending' else 'free' end, v_dep, 'admin',
          now() + make_interval(hours => greatest(1, least(coalesce(p_hold_hours, 24), 168))),
          coalesce((select pr.code from public.dining_prescribers pr where pr.code = lower(trim(coalesce(p_prescriber, ''))) and pr.active), ''),
          case when v_pend then v_mode else '' end)
  returning id, token into v_id, v_token;
  insert into public.table_booking_tables (booking_id, table_id) select v_id, unnest(v_tables);
  return jsonb_build_object('ok', true, 'id', v_id, 'ref', v_ref, 'token', v_token, 'status', case when v_pend then 'pending' else 'confirmed' end, 'deposit_cents', v_dep);
end;
$$;
revoke all on function public.dining_admin_create(text, timestamptz, text, integer, text, text, text, text, uuid[], boolean, boolean, integer, integer, text, text, integer) from public, anon;
grant execute on function public.dining_admin_create(text, timestamptz, text, integer, text, text, text, text, uuid[], boolean, boolean, integer, integer, text, text, integer) to authenticated;

drop function if exists public.dining_admin_update(uuid, integer, timestamptz, text, text, text, text, uuid[]);
drop function if exists public.dining_admin_update(uuid, integer, timestamptz, text, text, text, text, uuid[], integer, text);
create function public.dining_admin_update(
  p_booking uuid, p_party integer, p_starts timestamptz, p_name text, p_phone text, p_email text, p_notes text, p_tables uuid[],
  p_duration integer default null, p_prescriber text default null
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
  v_end := v_start + case when p_duration between 15 and 600 then make_interval(mins => p_duration) else (b.ends_at - b.starts_at) end;

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
         phone = trim(coalesce(p_phone, '')), email = lower(trim(coalesce(p_email, ''))), notes = left(coalesce(p_notes, ''), 500),
         prescriber = case when p_prescriber is null then bk.prescriber else coalesce((select pr.code from public.dining_prescribers pr where pr.code = lower(trim(p_prescriber)) and pr.active), '') end
   where bk.id = b.id;
  delete from public.table_booking_tables where booking_id = b.id;
  insert into public.table_booking_tables (booking_id, table_id) select b.id, unnest(v_tables);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.dining_admin_update(uuid, integer, timestamptz, text, text, text, text, uuid[], integer, text) from public, anon;
grant execute on function public.dining_admin_update(uuid, integer, timestamptz, text, text, text, text, uuid[], integer, text) to authenticated;

-- Página de la reserva: el tipo de garantía es el de la reserva (si lo tiene) o el de la zona.
create or replace function public.table_booking_get(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  b public.table_bookings%rowtype;
  z public.dining_zones%rowtype;
  sv public.dining_services%rowtype;
begin
  select * into b from public.table_bookings where length(coalesce(p_token, '')) = 32 and token = p_token;
  if not found then return null; end if;
  select * into z from public.dining_zones where id = b.zone_id;
  select * into sv from public.dining_services where id = b.service_id;
  return jsonb_build_object(
    'ref', b.ref, 'name', b.name, 'party', b.party, 'ambience', b.ambience, 'status', b.status, 'payment_status', b.payment_status,
    'starts_at', b.starts_at, 'deposit_cents', b.deposit_cents, 'refund_due', b.refund_due,
    'zone_es', z.name_es, 'zone_en', case when z.name_en <> '' then z.name_en else z.name_es end,
    'free_cancel_hours', coalesce(z.free_cancel_hours, 24),
    'refundable_until', b.starts_at - make_interval(hours => coalesce(z.free_cancel_hours, 24)),
    'can_cancel', b.status in ('pending', 'confirmed') and b.starts_at > now(),
    'can_pay', b.status = 'pending' and b.payment_status = 'pending' and b.deposit_cents > 0 and b.hold_until > now() and b.starts_at > now(),
    'hold_until', b.hold_until, 'source', b.source,
    'payment_mode', coalesce(nullif(b.pay_mode, ''), z.payment_mode, 'none'),
    'ends_at', b.ends_at, 'grace_min', coalesce(sv.grace_min, 15), 'end_note_es', coalesce(sv.end_note_es, ''), 'end_note_en', coalesce(sv.end_note_en, ''), 'card_last4', b.card_last4, 'card_brand', b.card_brand, 'late_cancel', b.late_cancel
  );
end;
$$;
revoke all on function public.table_booking_get(text) from public;
grant execute on function public.table_booking_get(text) to anon, authenticated;

-- ─── CRM de clientes ───────────────────────────────────────────────────────
-- Gasto de cada visita: se anota a mano en la ficha de la reserva y, cuando se conecte la API del TPV (Ágora),
-- se rellenará solo. agora_ref guarda la referencia del ticket del TPV para no contar dos veces.
alter table public.table_bookings add column if not exists spend_cents integer check (spend_cents is null or spend_cents >= 0);
alter table public.table_bookings add column if not exists agora_ref text not null default '';

-- Una fila por cliente (por email; si no tiene, por teléfono): visitas, no shows, gasto y última visita.
-- Suma las reservas de mesa y, aparte, las entradas de eventos (visitas = entradas con acceso registrado).
-- Solo la ve quien tenga la pestaña Mesas.
drop function if exists public.dining_crm();
create function public.dining_crm()
returns table (customer_key text, name text, email text, phone text, visits integer, no_shows integer, cancellations integer, upcoming integer,
               first_visit timestamptz, last_visit timestamptz, spend_cents bigint, event_visits integer, tickets_cents bigint, prescribers text, marketing_optin boolean, note text, blocked boolean, blocked_reason text,
               tags text[], customer_type text, company text, tax_id text, balance_cents integer)
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
  )
  select tb.k, tb.nm, tb.em, tb.ph, tb.visits, tb.noshows, tb.cancels, tb.upcoming, tb.first_v, tb.last_v, tb.spend,
         coalesce(ev.vis, 0), coalesce(ev.tk, 0), tb.pres, tb.mk, coalesce(cn.note, ''), coalesce(cn.blocked, false), coalesce(cn.blocked_reason, ''),
         coalesce(cn.tags, '{}'), coalesce(cn.customer_type, 'particular'), coalesce(cn.company, ''), coalesce(cn.tax_id, ''), coalesce(cn.balance_cents, 0)
  from tb left join ev on ev.k = tb.k left join public.dining_customer_notes cn on cn.customer_key = tb.k
  order by tb.last_v desc nulls last;
end;
$$;
revoke all on function public.dining_crm() from public, anon;
grant execute on function public.dining_crm() to authenticated;
