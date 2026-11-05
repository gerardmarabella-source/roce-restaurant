-- ROCE · Reservas de mesa propias (sustituyen a CoverManager)
-- Pegar entero en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.
-- Solo añade tablas y funciones nuevas: no toca eventos, entradas ni listas.

-- ─── Zonas (plantas) ──────────────────────────────────────────────────────
-- Cada zona decide si pide fianza: la planta baja es gratis; la de arriba pide 20 € con Redsys.
create table if not exists public.dining_zones (
  id                 text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  name_es            text not null,
  name_en            text not null default '',
  deposit_cents      integer not null default 0 check (deposit_cents >= 0),
  deposit_per_person boolean not null default false,   -- false = una fianza por reserva
  free_cancel_hours  integer not null default 24 check (free_cancel_hours >= 0),  -- hasta cuántas horas antes se devuelve
  active             boolean not null default true,
  sort               integer not null default 0
);

-- ─── Mesas ────────────────────────────────────────────────────────────────
-- Las mesas con el mismo "grupo de unión" (dentro de una zona) se pueden juntar para grupos grandes.
create table if not exists public.dining_tables (
  id            uuid primary key default gen_random_uuid(),
  zone_id       text not null references public.dining_zones(id) on update cascade,
  name          text not null check (length(trim(name)) > 0),
  seats_min     integer not null default 1 check (seats_min >= 1),
  seats_max     integer not null check (seats_max >= 1),
  combine_group text not null default '',
  active        boolean not null default true,
  sort          integer not null default 0,
  unique (zone_id, name)
);

-- ─── Turnos (servicios) ───────────────────────────────────────────────────
-- Horas en minutos desde las 00:00 del día del servicio (la cena de las 00:30 es 1470).
create table if not exists public.dining_services (
  id           text primary key check (id ~ '^[a-z0-9-]{2,30}$'),
  ambience     text not null check (ambience in ('day', 'night')),
  name_es      text not null,
  name_en      text not null default '',
  days         integer[] not null default '{1,2,3,4,5,6,7}',   -- 1 = lunes … 7 = domingo
  start_min    integer not null check (start_min between 0 and 2879),
  last_min     integer not null check (last_min between 0 and 2879),   -- última hora a la que se puede sentar a alguien
  slot_min     integer not null default 30 check (slot_min between 5 and 240),
  duration_min integer not null default 90 check (duration_min between 15 and 600),  -- cuánto ocupa la mesa
  max_party    integer not null default 8 check (max_party >= 1),
  notice_min   integer not null default 60 check (notice_min >= 0),   -- antelación mínima
  days_ahead   integer not null default 60 check (days_ahead >= 1),   -- cuántos días vista se puede reservar
  active       boolean not null default true,
  zone_ids     text[],   -- zonas que usa el turno (null = todas)
  check (last_min >= start_min)
);
alter table public.dining_services add column if not exists zone_ids text[];

-- ─── Cierres (festivos, eventos privados, una planta cerrada…) ────────────
create table if not exists public.dining_closures (
  id         uuid primary key default gen_random_uuid(),
  date_from  date not null,
  date_to    date not null,
  service_id text references public.dining_services(id) on delete cascade,   -- vacío = todos los turnos
  zone_id    text references public.dining_zones(id) on update cascade on delete cascade,   -- vacío = todas las zonas
  note       text not null default '',
  check (date_to >= date_from)
);

-- ─── Bloqueos (comida privada, evento, mesas fuera de servicio) ───────────
-- Bloquean una zona entera (o solo algunas mesas) en una franja horaria: nadie puede reservarlas desde la web.
-- Es lo que se usa cuando una planta se reserva fuera del motor de reservas.
create table if not exists public.dining_blocks (
  id         uuid primary key default gen_random_uuid(),
  zone_id    text not null references public.dining_zones(id) on update cascade on delete cascade,
  table_ids  uuid[],   -- null = toda la zona
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  note       text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists dining_blocks_range_idx on public.dining_blocks (starts_at, ends_at);

-- ─── Reservas de mesa ─────────────────────────────────────────────────────
create table if not exists public.table_bookings (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique,
  token          text not null unique default replace(gen_random_uuid()::text, '-', ''),
  service_id     text references public.dining_services(id) on delete set null,
  ambience       text not null check (ambience in ('day', 'night')),
  zone_id        text references public.dining_zones(id) on update cascade on delete set null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  party          integer not null check (party between 1 and 60),
  name           text not null,
  email          text not null default '',
  phone          text not null default '',
  notes          text not null default '',
  lang           text not null default 'es',
  marketing_optin boolean not null default false,
  status         text not null default 'confirmed' check (status in ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
  payment_status text not null default 'free' check (payment_status in ('free', 'pending', 'paid', 'refunded', 'retained')),
  deposit_cents  integer not null default 0 check (deposit_cents >= 0),
  refund_due     boolean not null default false,   -- cancelada a tiempo con fianza cobrada: falta devolverla
  source         text not null default 'web' check (source in ('web', 'admin')),
  admin_notes    text not null default '',
  cancelled_at   timestamptz,
  paid_at        timestamptz,
  hold_until     timestamptz not null default (now() + interval '15 minutes'),   -- una reserva pendiente de pago retiene mesa hasta aquí
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.table_bookings add column if not exists hold_until timestamptz not null default (now() + interval '15 minutes');
create index if not exists table_bookings_starts_idx on public.table_bookings (starts_at);
create index if not exists table_bookings_email_idx on public.table_bookings (lower(email));

-- Mesas que ocupa cada reserva (una, o varias si se han juntado).
create table if not exists public.table_booking_tables (
  booking_id uuid not null references public.table_bookings(id) on delete cascade,
  table_id   uuid not null references public.dining_tables(id) on delete restrict,
  primary key (booking_id, table_id)
);
create index if not exists table_booking_tables_table_idx on public.table_booking_tables (table_id);

-- ─── Permisos: solo quien tenga la pestaña "Mesas" toca estas tablas ──────
-- (los administradores la tienen siempre; el resto, si se la dan en Equipo)
alter table public.dining_zones enable row level security;
alter table public.dining_tables enable row level security;
alter table public.dining_services enable row level security;
alter table public.dining_closures enable row level security;
alter table public.dining_blocks enable row level security;
alter table public.table_bookings enable row level security;
alter table public.table_booking_tables enable row level security;

drop policy if exists dining_zones_admin on public.dining_zones;
create policy dining_zones_admin on public.dining_zones for all to authenticated using (public.has_tab('tables')) with check (public.has_tab('tables'));
drop policy if exists dining_tables_admin on public.dining_tables;
create policy dining_tables_admin on public.dining_tables for all to authenticated using (public.has_tab('tables')) with check (public.has_tab('tables'));
drop policy if exists dining_services_admin on public.dining_services;
create policy dining_services_admin on public.dining_services for all to authenticated using (public.has_tab('tables')) with check (public.has_tab('tables'));
drop policy if exists dining_closures_admin on public.dining_closures;
create policy dining_closures_admin on public.dining_closures for all to authenticated using (public.has_tab('tables')) with check (public.has_tab('tables'));
drop policy if exists dining_blocks_admin on public.dining_blocks;
create policy dining_blocks_admin on public.dining_blocks for all to authenticated using (public.has_tab('tables')) with check (public.has_tab('tables'));
drop policy if exists table_bookings_admin_read on public.table_bookings;
create policy table_bookings_admin_read on public.table_bookings for select to authenticated using (public.has_tab('tables'));
drop policy if exists table_bookings_admin_update on public.table_bookings;
create policy table_bookings_admin_update on public.table_bookings for update to authenticated using (public.has_tab('tables')) with check (public.has_tab('tables'));
drop policy if exists table_booking_tables_admin_read on public.table_booking_tables;
create policy table_booking_tables_admin_read on public.table_booking_tables for select to authenticated using (public.has_tab('tables'));

-- ─── Lógica de ocupación ──────────────────────────────────────────────────
-- ¿Esta reserva retiene mesa? Las pendientes de pago la retienen hasta su hora límite
-- (15 minutos en la web; las creadas desde el panel, el tiempo que se les dé).
drop function if exists public.dining_holds(text, timestamptz);
create function public.dining_holds(p_status text, p_hold_until timestamptz) returns boolean
language sql stable as $$
  select p_status in ('confirmed', 'seated') or (p_status = 'pending' and p_hold_until > now());
$$;

-- Hora de inicio de un servicio y fecha del servicio: ¿es p_starts una hora válida del turno?
-- Devuelve la fecha del servicio (la cena de las 00:30 pertenece al día anterior) o null.
create or replace function public.dining_slot_date(p_service text, p_starts timestamptz) returns date
language plpgsql stable set search_path = public as $$
declare
  s public.dining_services%rowtype;
  v_local timestamp := p_starts at time zone 'Europe/Madrid';
  d date;
  m integer;
begin
  select * into s from public.dining_services where id = p_service;
  if not found then return null; end if;
  foreach d in array array[v_local::date, v_local::date - 1] loop
    m := round(extract(epoch from (v_local - d::timestamp)) / 60)::integer;
    if m between s.start_min and s.last_min
       and (m - s.start_min) % s.slot_min = 0
       and extract(isodow from d)::integer = any (s.days) then
      return d;
    end if;
  end loop;
  return null;
end;
$$;

-- ¿Está cerrada esa zona (o el turno) ese día?
create or replace function public.dining_closed(p_date date, p_service text, p_zone text) returns boolean
language sql stable set search_path = public as $$
  select exists (
    select 1 from public.dining_closures c
    where p_date between c.date_from and c.date_to
      and (c.service_id is null or c.service_id = p_service)
      and (c.zone_id is null or c.zone_id = p_zone)
  );
$$;

-- Busca las mesas libres para un grupo en una zona y franja: una sola mesa (la más ajustada)
-- o, si no cabe, mesas del mismo grupo de unión. Devuelve null si no hay sitio.
create or replace function public.dining_assign(p_start timestamptz, p_end timestamptz, p_party integer, p_zone text, p_exclude uuid default null)
returns uuid[]
language plpgsql stable set search_path = public as $$
declare
  v_pick uuid[];
  v_sum integer;
  g text;
  r record;
begin
  select array[t.id] into v_pick
  from public.dining_tables t
  where t.active and t.zone_id = p_zone and t.seats_min <= p_party and t.seats_max >= p_party
    and not exists (select 1 from public.dining_blocks k where k.zone_id = t.zone_id and (k.table_ids is null or t.id = any (k.table_ids)) and k.starts_at < p_end and k.ends_at > p_start)
    and not exists (
      select 1 from public.table_booking_tables bt join public.table_bookings b on b.id = bt.booking_id
      where bt.table_id = t.id and b.id is distinct from p_exclude and public.dining_holds(b.status, b.hold_until)
        and b.starts_at < p_end and b.ends_at > p_start)
  order by t.seats_max, t.sort, t.name
  limit 1;
  if v_pick is not null then return v_pick; end if;

  for g in select distinct t.combine_group from public.dining_tables t where t.active and t.zone_id = p_zone and t.combine_group <> '' loop
    v_pick := '{}'; v_sum := 0;
    for r in
      select t.id, t.seats_max from public.dining_tables t
      where t.active and t.zone_id = p_zone and t.combine_group = g
        and not exists (select 1 from public.dining_blocks k where k.zone_id = t.zone_id and (k.table_ids is null or t.id = any (k.table_ids)) and k.starts_at < p_end and k.ends_at > p_start)
        and not exists (
          select 1 from public.table_booking_tables bt join public.table_bookings b on b.id = bt.booking_id
          where bt.table_id = t.id and b.id is distinct from p_exclude and public.dining_holds(b.status, b.hold_until)
            and b.starts_at < p_end and b.ends_at > p_start)
      order by t.seats_max desc, t.sort, t.name
    loop
      v_pick := v_pick || r.id; v_sum := v_sum + r.seats_max;
      exit when v_sum >= p_party;
    end loop;
    if v_sum >= p_party then return v_pick; end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.dining_assign(timestamptz, timestamptz, integer, text, uuid) from public, anon, authenticated;

-- ─── Disponibilidad pública ───────────────────────────────────────────────
-- Una fila por hora y zona con sitio. La web las agrupa por hora y deja elegir planta.
drop function if exists public.dining_slots(date, integer, text);
create or replace function public.dining_slots(p_date date, p_party integer, p_ambience text default null)
returns table (o_service text, o_ambience text, o_starts_at timestamptz, o_time text, o_zone text, o_zone_es text, o_zone_en text, o_deposit_cents integer, o_free_hours integer)
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
           and public.dining_assign(v_start, v_start + make_interval(mins => s.duration_min), p_party, z.id) is not null then
          o_service := s.id; o_ambience := s.ambience; o_starts_at := v_start;
          o_time := to_char(v_start at time zone 'Europe/Madrid', 'HH24:MI');
          o_zone := z.id; o_zone_es := z.name_es; o_zone_en := case when z.name_en <> '' then z.name_en else z.name_es end;
          o_deposit_cents := case when z.deposit_per_person then z.deposit_cents * p_party else z.deposit_cents end;
          o_free_hours := z.free_cancel_hours;
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

-- ─── Reservar (web) ───────────────────────────────────────────────────────
-- Con fianza, la reserva queda "pendiente" 15 minutos hasta que Redsys confirma el cobro.
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
  if public.dining_closed(v_date, s.id, z.id) then raise exception 'closed'; end if;

  -- Freno contra reservas falsas: como mucho 3 reservas futuras activas por email.
  if (select count(*) from public.table_bookings b
      where lower(b.email) = lower(trim(p_email)) and b.starts_at > now()
        and public.dining_holds(b.status, b.hold_until)) >= 10 then raise exception 'too_many'; end if;

  v_end := p_starts + make_interval(mins => s.duration_min);
  v_tables := public.dining_assign(p_starts, v_end, p_party, z.id);
  if v_tables is null then raise exception 'no_table'; end if;

  v_dep := case when z.deposit_per_person then z.deposit_cents * p_party else z.deposit_cents end;
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

-- ─── Reserva creada desde el panel (teléfono, mostrador, grupos) ──────────
-- Sin antelación mínima. p_tables vacío = asigna sola; con mesas = las que elijas.
-- p_request_payment = true y zona con fianza: queda "pendiente" y el cliente la confirma pagando la fianza
-- con el enlace del email (la mesa se le guarda p_hold_hours horas). Sin fianza (o false): queda confirmada.
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
  if p_party is null or p_party < 1 or p_party > 60 or length(trim(coalesce(p_name, ''))) < 1 then raise exception 'bad_data'; end if;
  v_end := p_starts + make_interval(mins => s.duration_min);

  if p_request_payment then
    v_dep := case when z.deposit_per_person then z.deposit_cents * p_party else z.deposit_cents end;
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
  values (v_ref, s.id, s.ambience, p_zone, p_starts, v_end, p_party, trim(p_name), lower(trim(coalesce(p_email, ''))), trim(coalesce(p_phone, '')),
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

-- Cambiar de mesa (o juntar mesas) una reserva, comprobando que estén libres.
create or replace function public.dining_admin_move(p_booking uuid, p_tables uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.table_bookings%rowtype;
begin
  if not public.has_tab('tables') then raise exception 'forbidden'; end if;
  perform pg_advisory_xact_lock(7001);
  select * into b from public.table_bookings where id = p_booking for update;
  if not found then raise exception 'not_found'; end if;
  if p_tables is null or cardinality(p_tables) = 0 then raise exception 'bad_data'; end if;
  if exists (
    select 1 from public.table_booking_tables bt join public.table_bookings o on o.id = bt.booking_id
    where bt.table_id = any (p_tables) and o.id <> b.id and public.dining_holds(o.status, o.hold_until) and o.starts_at < b.ends_at and o.ends_at > b.starts_at
  ) then raise exception 'table_busy'; end if;
  delete from public.table_booking_tables where booking_id = b.id;
  insert into public.table_booking_tables (booking_id, table_id) select b.id, unnest(p_tables);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.dining_admin_move(uuid, uuid[]) from public, anon;
grant execute on function public.dining_admin_move(uuid, uuid[]) to authenticated;

-- ─── Página de la reserva (con el código secreto del email) ───────────────
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
    'hold_until', b.hold_until, 'source', b.source
  );
end;
$$;
revoke all on function public.table_booking_get(text) from public;
grant execute on function public.table_booking_get(text) to anon, authenticated;

-- Anular la reserva. Si había fianza cobrada y se avisa a tiempo, queda "por devolver" (la devuelve la función de Redsys);
-- si no, el banco ya no se toca y la fianza se retiene.
create or replace function public.table_booking_cancel(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.table_bookings%rowtype;
  z public.dining_zones%rowtype;
  v_in_time boolean;
begin
  select * into b from public.table_bookings where length(coalesce(p_token, '')) = 32 and token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.status not in ('pending', 'confirmed') or b.starts_at <= now() then return jsonb_build_object('ok', false, 'error', 'not_cancellable'); end if;
  select * into z from public.dining_zones where id = b.zone_id;
  v_in_time := b.starts_at - make_interval(hours => coalesce(z.free_cancel_hours, 24)) >= now();
  update public.table_bookings bk
     set status = 'cancelled', cancelled_at = now(),
         refund_due = (bk.payment_status = 'paid' and v_in_time),
         payment_status = case when bk.payment_status = 'paid' and not v_in_time then 'retained' else bk.payment_status end
   where bk.id = b.id
   returning bk.* into b;
  return jsonb_build_object('ok', true, 'refund_due', b.refund_due, 'retained', b.payment_status = 'retained', 'deposit_cents', b.deposit_cents, 'ref', b.ref);
end;
$$;
revoke all on function public.table_booking_cancel(text) from public;
grant execute on function public.table_booking_cancel(text) to anon, authenticated;

-- Estado de pago de la fianza (para la pantalla de vuelta del banco).
create or replace function public.table_booking_status(p_ref text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select case when status = 'cancelled' then 'cancelled' else payment_status end from public.table_bookings where ref = p_ref), 'unknown');
$$;
revoke all on function public.table_booking_status(text) from public;
grant execute on function public.table_booking_status(text) to anon, authenticated;

-- ─── Datos de partida (solo si todavía no hay nada): se editan en el panel ──
insert into public.dining_zones (id, name_es, name_en, deposit_cents, deposit_per_person, free_cancel_hours, sort)
values ('baja', 'Planta baja', 'Ground floor', 0, false, 24, 1),
       ('alta', 'Planta alta', 'Upper floor', 2000, false, 24, 2)
on conflict (id) do nothing;

insert into public.dining_services (id, ambience, name_es, name_en, start_min, last_min, slot_min, duration_min, max_party)
values ('day', 'day', 'Day', 'Day', 600, 1110, 30, 90, 8),          -- 10:00 a 18:30
       ('night', 'night', 'Night', 'Night', 1200, 1470, 30, 120, 8)  -- 20:00 a 00:30
on conflict (id) do nothing;

-- Day usa la planta baja y Night la planta alta (solo si todavía no se ha configurado otra cosa).
update public.dining_services set zone_ids = array['baja'] where id = 'day' and zone_ids is null;
update public.dining_services set zone_ids = array['alta'] where id = 'night' and zone_ids is null;

insert into public.dining_tables (zone_id, name, seats_min, seats_max, combine_group, sort)
select z.id, 'M' || n, 1, case when n <= 4 then 2 else 4 end, z.id, n
from (values ('baja'), ('alta')) z(id), generate_series(1, 8) n
where not exists (select 1 from public.dining_tables)
on conflict (zone_id, name) do nothing;
