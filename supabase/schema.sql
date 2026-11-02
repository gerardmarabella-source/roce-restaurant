-- ROCE · Eventos y reservas (Supabase / Postgres)
-- Pegar entero en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.

create extension if not exists pgcrypto;

-- ─── Administradores ──────────────────────────────────────────────────────
-- Solo las personas de esta tabla pueden usar el panel /admin/.
create table if not exists public.admins (
  email text primary key
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ─── Eventos ──────────────────────────────────────────────────────────────
create table if not exists public.events (
  id             text primary key check (id ~ '^[a-z0-9-]{3,60}$'),
  env            text not null check (env in ('day', 'night')),
  starts_at      timestamptz not null,
  duration_h     numeric(4,1) not null default 2 check (duration_h > 0),
  title_es       text not null,
  title_en       text not null default '',
  desc_es        text not null default '',
  desc_en        text not null default '',
  place_es       text not null default '',
  place_en       text not null default '',
  price_cents    integer not null default 0 check (price_cents >= 0),
  price_label_es text not null default '',   -- vacío = se genera solo ("25 € por persona")
  price_label_en text not null default '',
  capacity       integer not null check (capacity >= 0),
  max_per_order  integer not null default 6 check (max_per_order between 1 and 20),
  published      boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ─── Reservas ─────────────────────────────────────────────────────────────
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique,
  event_id       text not null references public.events(id) on delete restrict,
  qty            integer not null check (qty between 1 and 20),
  name           text not null,
  email          text not null,
  phone          text not null,
  notes          text not null default '',
  lang           text not null default 'es' check (lang in ('es', 'en')),
  -- Casilla opcional "quiero recibir novedades": solo con ella se añade a la newsletter.
  marketing_optin boolean not null default false,
  total_cents    integer not null default 0,
  -- pending = plaza retenida a la espera del pago; confirmed = vale; cancelled = libera la plaza
  status         text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled')),
  -- free = gratis; pending = por cobrar; paid / refunded / failed = pasarela
  payment_status text not null default 'free' check (payment_status in ('free', 'pending', 'paid', 'refunded', 'failed')),
  created_at     timestamptz not null default now()
);
alter table public.bookings add column if not exists marketing_optin boolean not null default false;
create index if not exists bookings_event_idx on public.bookings(event_id);

-- ─── Seguridad por filas (RLS) ────────────────────────────────────────────
alter table public.admins   enable row level security;
alter table public.events   enable row level security;
alter table public.bookings enable row level security;

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists events_admin_all on public.events;
create policy events_admin_all on public.events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_admin_all on public.bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Sin políticas para "anon": el público no lee ni escribe las tablas directamente.

-- ─── Lo que ve el público: eventos publicados y próximos, con plazas libres ──
create or replace view public.events_public as
select
  e.id, e.env, e.starts_at, e.duration_h,
  e.title_es, e.title_en, e.desc_es, e.desc_en, e.place_es, e.place_en,
  e.price_cents, e.price_label_es, e.price_label_en, e.max_per_order,
  greatest(
    e.capacity - coalesce((
      select sum(b.qty) from public.bookings b
      where b.event_id = e.id and b.status in ('pending', 'confirmed')
    ), 0),
    0
  )::int as spots_left
from public.events e
where e.published
  and e.starts_at + (e.duration_h * interval '1 hour') > now();

grant select on public.events_public to anon, authenticated;

-- ─── Reservar (único camino del público para escribir) ───────────────────
-- Bloquea el evento mientras comprueba el aforo, así dos personas a la vez
-- no pueden pasarse de plazas.
create or replace function public.book_event(
  p_event text, p_qty integer, p_name text, p_email text, p_phone text,
  p_notes text default '', p_lang text default 'es', p_marketing boolean default false
) returns table (o_ref text, o_spots_left integer, o_total_cents integer)
language plpgsql security definer set search_path = public as $$
declare
  ev     public.events%rowtype;
  taken  integer;
  v_ref  text;
  chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i      integer;
begin
  select * into ev from public.events where id = p_event and published for update;
  if not found then raise exception 'event_not_found'; end if;
  if ev.starts_at + (ev.duration_h * interval '1 hour') <= now() then raise exception 'event_past'; end if;
  if p_qty is null or p_qty < 1 or p_qty > ev.max_per_order then raise exception 'bad_qty'; end if;
  if length(trim(coalesce(p_name, ''))) < 3
     or coalesce(p_email, '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'
     or length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) < 9
  then raise exception 'bad_data'; end if;

  select coalesce(sum(b.qty), 0) into taken
  from public.bookings b where b.event_id = ev.id and b.status in ('pending', 'confirmed');
  if taken + p_qty > ev.capacity then raise exception 'sold_out'; end if;

  loop
    v_ref := 'ROCE-';
    for i in 1..6 loop
      v_ref := v_ref || substr(chars, 1 + floor(random() * length(chars))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.bookings b where b.ref = v_ref);
  end loop;

  insert into public.bookings (ref, event_id, qty, name, email, phone, notes, lang, marketing_optin, total_cents, status, payment_status)
  values (
    v_ref, ev.id, p_qty, trim(p_name), lower(trim(p_email)), trim(p_phone),
    left(coalesce(p_notes, ''), 500), case when p_lang = 'en' then 'en' else 'es' end,
    coalesce(p_marketing, false), ev.price_cents * p_qty, 'confirmed',
    case when ev.price_cents = 0 then 'free' else 'pending' end
  );

  return query select v_ref, (ev.capacity - taken - p_qty)::integer, ev.price_cents * p_qty;
end;
$$;

revoke all on function public.book_event(text, integer, text, text, text, text, text, boolean) from public;
grant execute on function public.book_event(text, integer, text, text, text, text, text, boolean) to anon, authenticated;
