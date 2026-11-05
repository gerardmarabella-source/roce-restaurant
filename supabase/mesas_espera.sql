-- ROCE · Lista de espera y alternativas ("no hay esta hora, pero hay otra / otro día / otro espacio")
-- Ejecutar DESPUÉS de mesas_extras.sql. Se puede ejecutar más de una vez.

-- ─── Lista de espera ──────────────────────────────────────────────────────
create table if not exists public.dining_waitlist (
  id          uuid primary key default gen_random_uuid(),
  want_date   date not null,
  ambience    text check (ambience in ('day', 'night')),   -- vacío = cualquiera
  want_time   text not null default '',                      -- "HH:MM" preferida; vacío = cualquier hora
  party       integer not null check (party between 1 and 60),
  name        text not null default '',
  email       text not null,
  phone       text not null default '',
  notes       text not null default '',
  lang        text not null default 'es',
  status      text not null default 'waiting' check (status in ('waiting', 'notified', 'booked', 'expired', 'removed')),
  notified_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists dining_waitlist_date_idx on public.dining_waitlist (want_date, status);
alter table public.dining_waitlist enable row level security;
drop policy if exists dining_waitlist_admin on public.dining_waitlist;
create policy dining_waitlist_admin on public.dining_waitlist for all to authenticated using (public.has_tab('tables')) with check (public.has_tab('tables'));

-- Apuntarse (web). Un mismo email no se apunta dos veces al mismo día y espacio: se actualiza la petición.
drop function if exists public.waitlist_join(date, text, text, integer, text, text, text, text, text);
create function public.waitlist_join(
  p_date date, p_ambience text, p_time text, p_party integer, p_name text, p_email text, p_phone text default '', p_notes text default '', p_lang text default 'es'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_amb text := case when p_ambience in ('day', 'night') then p_ambience else null end;
  v_time text := case when coalesce(p_time, '') ~ '^[0-2][0-9]:[0-5][0-9]$' then p_time else '' end;
  v_id uuid;
begin
  if p_date is null or p_date < v_today or p_date > v_today + 90 then raise exception 'bad_date'; end if;
  if p_party is null or p_party < 1 or p_party > 60 then raise exception 'bad_party'; end if;
  if v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' or length(trim(coalesce(p_name, ''))) < 2 then raise exception 'bad_data'; end if;
  if public.dining_customer_blocked(v_email, p_phone) then raise exception 'blocked'; end if;
  if (select count(*) from public.dining_waitlist w where lower(w.email) = v_email and w.status = 'waiting' and w.want_date >= v_today) >= 6 then raise exception 'too_many'; end if;
  select w.id into v_id from public.dining_waitlist w
   where lower(w.email) = v_email and w.want_date = p_date and w.status = 'waiting' and w.ambience is not distinct from v_amb limit 1;
  if v_id is not null then
    update public.dining_waitlist w set want_time = v_time, party = p_party, name = trim(p_name), phone = trim(coalesce(p_phone, '')),
           notes = left(coalesce(p_notes, ''), 300), lang = case when p_lang = 'en' then 'en' else 'es' end where w.id = v_id;
  else
    insert into public.dining_waitlist (want_date, ambience, want_time, party, name, email, phone, notes, lang)
    values (p_date, v_amb, v_time, p_party, trim(p_name), v_email, trim(coalesce(p_phone, '')), left(coalesce(p_notes, ''), 300), case when p_lang = 'en' then 'en' else 'es' end);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.waitlist_join(date, text, text, integer, text, text, text, text, text) from public;
grant execute on function public.waitlist_join(date, text, text, integer, text, text, text, text, text) to anon, authenticated;

-- ─── Parrilla completa: horas libres y horas completas ────────────────────
-- Igual que dining_slots, pero devuelve también las horas sin mesa (o_free = false) para poder
-- ofrecer "apúntate a la lista de espera" y "estas otras horas sí tienen sitio".
drop function if exists public.dining_grid(date, integer, text);
create function public.dining_grid(p_date date, p_party integer, p_ambience text default null)
returns table (o_service text, o_ambience text, o_starts_at timestamptz, o_time text, o_zone text, o_zone_es text, o_zone_en text,
               o_deposit_cents integer, o_free_hours integer, o_payment_mode text, o_free boolean,
               o_duration integer, o_grace integer, o_end_es text, o_end_en text)
language plpgsql stable security definer set search_path = public as $$
declare
  s public.dining_services%rowtype;
  z public.dining_zones%rowtype;
  t integer;
  v_start timestamptz;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
begin
  if p_date is null or p_party is null or p_party < 1 or p_date < v_today then return; end if;
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
        if v_start > now() + make_interval(mins => s.notice_min) and not public.dining_closed(p_date, s.id, z.id, t) then
          o_service := s.id; o_ambience := s.ambience; o_starts_at := v_start;
          o_time := to_char(v_start at time zone 'Europe/Madrid', 'HH24:MI');
          o_zone := z.id; o_zone_es := z.name_es; o_zone_en := case when z.name_en <> '' then z.name_en else z.name_es end;
          o_deposit_cents := case when z.payment_mode = 'none' then 0 when z.deposit_per_person then z.deposit_cents * p_party else z.deposit_cents end;
          o_free_hours := z.free_cancel_hours; o_payment_mode := z.payment_mode;
          o_free := public.dining_assign(v_start, v_start + make_interval(mins => public.dining_duration(s.id, p_party)), p_party, z.id) is not null;
          o_duration := public.dining_duration(s.id, p_party); o_grace := s.grace_min; o_end_es := s.end_note_es; o_end_en := s.end_note_en;
          return next;
        end if;
        t := t + s.slot_min;
      end loop;
    end loop;
  end loop;
end;
$$;
revoke all on function public.dining_grid(date, integer, text) from public;
grant execute on function public.dining_grid(date, integer, text) to anon, authenticated;

-- ─── Próximos días con sitio ───────────────────────────────────────────────
drop function if exists public.dining_next_days(date, integer, text, integer);
create function public.dining_next_days(p_from date, p_party integer, p_ambience text default null, p_days integer default 21)
returns table (o_date date, o_count integer, o_first text, o_ambience text)
language plpgsql stable security definer set search_path = public as $$
declare
  d date;
  r record;
  v_n integer := 0;
begin
  if p_from is null or p_party is null or p_party < 1 then return; end if;
  for d in select g::date from generate_series(p_from, p_from + least(coalesce(p_days, 21), 45), interval '1 day') g loop
    select count(*) as c, min(x.o_time) as f, min(x.o_ambience) as a into r from public.dining_slots(d, p_party, p_ambience) x;
    if r.c > 0 then
      o_date := d; o_count := r.c; o_first := r.f; o_ambience := r.a; return next;
      v_n := v_n + 1; exit when v_n >= 6;
    end if;
  end loop;
end;
$$;
revoke all on function public.dining_next_days(date, integer, text, integer) from public;
grant execute on function public.dining_next_days(date, integer, text, integer) to anon, authenticated;

-- ─── Avisos por email de la lista de espera (mismo aviso que las reservas) ──
do $$
declare
  a text[];
begin
  select string_to_array(encode(t.tgargs, 'escape'), '\000') into a
  from pg_trigger t
  where t.tgrelid = 'public.bookings'::regclass and t.tgname = 'booking_email' and not t.tgisinternal;
  if a is null or cardinality(a) < 5 then
    raise exception 'No encuentro el aviso booking_email de la tabla bookings: crea el de dining_waitlist a mano en Database → Webhooks.';
  end if;
  drop trigger if exists waitlist_email on public.dining_waitlist;
  execute format(
    'create trigger waitlist_email after insert or update on public.dining_waitlist for each row execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
    a[1], a[2], a[3], a[4], a[5]);
end
$$;
