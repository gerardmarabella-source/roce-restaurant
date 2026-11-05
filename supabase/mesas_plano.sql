-- ROCE · Mesas reales según los planos (planta baja, planta alta y sala privé)
-- (incluye el ajuste: Day = planta baja, Night = planta alta)
-- Pegar en Supabase → SQL Editor → Run. Sustituye las 16 mesas de ejemplo (solo si no tienen reservas).
-- Cada mesa lleva su posición en el plano (en % del dibujo) para el mapa del panel.

-- Day usa la planta baja y Night la planta alta
alter table public.dining_services add column if not exists zone_ids text[];
update public.dining_services set zone_ids = array['baja'] where id = 'day';
update public.dining_services set zone_ids = array['alta'] where id = 'night';

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
        and public.dining_holds(b.status, b.created_at)) >= 3 then raise exception 'too_many'; end if;

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
                                     status, payment_status, deposit_cents, source)
  values (v_ref, s.id, s.ambience, z.id, p_starts, v_end, p_party, trim(p_name), lower(trim(p_email)), trim(p_phone),
          left(coalesce(p_notes, ''), 500), case when p_lang = 'en' then 'en' else 'es' end, coalesce(p_marketing, false),
          v_status, case when v_dep > 0 then 'pending' else 'free' end, v_dep, 'web')
  returning id, token into v_id, v_token;
  insert into public.table_booking_tables (booking_id, table_id) select v_id, unnest(v_tables);

  return query select v_ref, v_token, v_status, v_dep;
end;
$$;
revoke all on function public.book_table(text, timestamptz, text, integer, text, text, text, text, text, boolean) from public;
grant execute on function public.book_table(text, timestamptz, text, integer, text, text, text, text, text, boolean) to anon, authenticated;


alter table public.dining_tables add column if not exists pos_x numeric;
alter table public.dining_tables add column if not exists pos_y numeric;
alter table public.dining_tables add column if not exists shape text not null default 'square';

-- La sala privé (terraza cubierta) no se reserva desde la web: la asigna el equipo desde el panel.
insert into public.dining_zones (id, name_es, name_en, deposit_cents, deposit_per_person, free_cancel_hours, active, sort)
values ('prive', 'Sala privé', 'Private room', 0, false, 24, false, 3)
on conflict (id) do nothing;

delete from public.dining_tables t where not exists (select 1 from public.table_booking_tables b where b.table_id = t.id);

insert into public.dining_tables (zone_id, name, seats_min, seats_max, combine_group, pos_x, pos_y, shape, sort) values
  ('baja', 'P1', 1, 2, 'pared-1', 31.3, 14.4, 'bench', 1),
  ('baja', 'P2', 1, 2, 'pared-1', 33.6, 14.4, 'bench', 2),
  ('baja', 'P3', 1, 2, 'pared-1', 37.3, 14.4, 'bench', 3),
  ('baja', 'P4', 1, 2, 'pared-1', 39.6, 14.4, 'bench', 4),
  ('baja', 'P5', 1, 2, 'pared-2', 47.4, 14.4, 'bench', 5),
  ('baja', 'P6', 1, 2, 'pared-2', 49.6, 14.4, 'bench', 6),
  ('baja', 'P7', 1, 2, 'pared-2', 55.6, 14.4, 'bench', 7),
  ('baja', 'P8', 1, 2, 'pared-2', 57.8, 14.4, 'bench', 8),
  ('baja', 'P9', 1, 2, 'pared-3', 64.1, 14.4, 'bench', 9),
  ('baja', 'P10', 1, 2, 'pared-3', 66.4, 14.4, 'bench', 10),
  ('baja', 'P11', 1, 2, 'pared-3', 71.0, 14.4, 'bench', 11),
  ('baja', 'P12', 1, 2, 'pared-3', 73.3, 14.4, 'bench', 12),
  ('baja', 'M1', 1, 4, 'suelo-izq', 32.4, 22.5, 'square', 13),
  ('baja', 'M2', 1, 4, 'suelo-izq', 38.2, 22.5, 'square', 14),
  ('baja', 'M3', 1, 4, 'suelo-izq', 35.2, 30.6, 'square', 15),
  ('baja', 'M4', 1, 4, 'suelo-centro', 48.3, 21.7, 'square', 16),
  ('baja', 'M5', 1, 4, 'suelo-centro', 53.8, 22.0, 'square', 17),
  ('baja', 'M6', 1, 4, 'suelo-der', 64.8, 22.7, 'square', 18),
  ('baja', 'M7', 1, 4, 'suelo-der', 72.7, 23.1, 'square', 19),
  ('baja', 'M8', 1, 4, 'suelo-der', 69.2, 28.5, 'square', 20),
  ('alta', 'P1', 1, 2, 'pared-izq-1', 18.1, 26.8, 'bench', 21),
  ('alta', 'P2', 1, 2, 'pared-izq-1', 20.5, 26.8, 'bench', 22),
  ('alta', 'P3', 1, 2, 'pared-izq-1', 24.8, 26.8, 'bench', 23),
  ('alta', 'P4', 1, 2, 'pared-izq-1', 27.2, 26.8, 'bench', 24),
  ('alta', 'P5', 1, 2, 'pared-izq-2', 31.4, 26.8, 'bench', 25),
  ('alta', 'P6', 1, 2, 'pared-izq-2', 33.9, 26.8, 'bench', 26),
  ('alta', 'P7', 1, 2, 'pared-izq-2', 38.1, 26.8, 'bench', 27),
  ('alta', 'P8', 1, 2, 'pared-izq-2', 40.5, 26.8, 'bench', 28),
  ('alta', 'P9', 1, 2, 'pared-der', 65.6, 26.8, 'bench', 29),
  ('alta', 'P10', 1, 2, 'pared-der', 67.9, 26.8, 'bench', 30),
  ('alta', 'P11', 1, 2, 'pared-der', 72.0, 26.8, 'bench', 31),
  ('alta', 'P12', 1, 2, 'pared-der', 74.5, 26.8, 'bench', 32),
  ('alta', 'P13', 1, 2, 'pared-der', 78.7, 26.8, 'bench', 33),
  ('alta', 'P14', 1, 2, 'pared-der', 81.2, 26.8, 'bench', 34),
  ('alta', 'P15', 1, 2, 'pared-der', 85.4, 26.8, 'bench', 35),
  ('alta', 'M1', 1, 4, 'comedor-3', 32.1, 38.4, 'square', 36),
  ('alta', 'M2', 1, 4, 'comedor-3', 38.2, 38.5, 'square', 37),
  ('alta', 'M3', 1, 4, 'comedor-3', 30.1, 51.7, 'square', 38),
  ('alta', 'L1', 6, 12, '', 20.9, 47.6, 'long', 39),
  ('alta', 'C1', 3, 6, 'comedor-2', 79.9, 36.3, 'rect', 40),
  ('alta', 'C2', 3, 6, 'comedor-2', 88.4, 36.3, 'rect', 41),
  ('alta', 'C3', 3, 6, 'comedor-2', 88.6, 46.7, 'rect', 42),
  ('alta', 'B1', 1, 3, '', 70.6, 42.3, 'bar', 43),
  ('alta', 'S1', 2, 5, '', 88.6, 55.7, 'sofa', 44),
  ('prive', 'PR1', 4, 8, '', 9.0, 73.6, 'round', 45)
on conflict (zone_id, name) do update
  set seats_min = excluded.seats_min, seats_max = excluded.seats_max, combine_group = excluded.combine_group,
      pos_x = excluded.pos_x, pos_y = excluded.pos_y, shape = excluded.shape, sort = excluded.sort;
