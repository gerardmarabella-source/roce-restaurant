-- ROCE · Eventos y reservas (Supabase / Postgres)
-- Pegar entero en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez.

create extension if not exists pgcrypto;

-- ─── Administradores ──────────────────────────────────────────────────────
-- Solo las personas de esta tabla pueden usar el panel /admin/.
create table if not exists public.admins (
  email text primary key
);
-- 'admin' gestiona el equipo (crear, cambiar contraseñas, quitar); 'staff' solo eventos y reservas.
alter table public.admins add column if not exists role text not null default 'staff';
alter table public.admins drop constraint if exists admins_role_check;
alter table public.admins add constraint admins_role_check check (role in ('admin', 'staff'));

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ¿Puede gestionar el equipo? (solo role = 'admin')
create or replace function public.can_manage_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where role = 'admin' and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Pestañas del panel que puede usar cada persona del equipo: events, bookings, checkin, lists.
-- NULL = las cuatro (como hasta ahora). Los administradores (role = 'admin') lo ven todo.
alter table public.admins add column if not exists tabs text[];
create or replace function public.has_tab(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (a.role = 'admin' or coalesce(a.tabs, array['events', 'bookings', 'checkin', 'lists']) @> array[t])
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

-- Imagen de cabecera del evento (URL pública en el Storage de Supabase; vacío = sin imagen).
alter table public.events add column if not exists image_url text not null default '';

-- IVA del evento (%): el precio por entrada ya incluye el IVA.
alter table public.events add column if not exists vat_percent numeric(4,1) not null default 10 check (vat_percent >= 0 and vat_percent <= 30);

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
-- Momento en que se cobró (pasarela o a mano).
alter table public.bookings add column if not exists paid_at timestamptz;
-- Asistencia en la puerta: cuántas personas de la reserva han entrado (0 a qty) y cuándo se marcó.
alter table public.bookings add column if not exists checked_in integer not null default 0;
alter table public.bookings add column if not exists checked_in_at timestamptz;
alter table public.bookings drop constraint if exists bookings_checked_in_range;
alter table public.bookings add constraint bookings_checked_in_range check (checked_in >= 0 and checked_in <= qty);
-- Datos para factura completa (solo si el cliente la pide): nombre/razón social, NIF/CIF y dirección fiscal.
alter table public.bookings add column if not exists invoice_name text not null default '';
alter table public.bookings add column if not exists invoice_tax_id text not null default '';
alter table public.bookings add column if not exists invoice_address text not null default '';
-- DNI / NIE / pasaporte de quien compra (se pide en el formulario de entradas).
alter table public.bookings add column if not exists dni text not null default '';
-- Código secreto de la entrada (va en el QR): largo y aleatorio, no se puede adivinar a partir de la referencia.
alter table public.bookings add column if not exists ticket_token text;
update public.bookings set ticket_token = replace(gen_random_uuid()::text, '-', '') where ticket_token is null;
alter table public.bookings alter column ticket_token set default replace(gen_random_uuid()::text, '-', '');
alter table public.bookings alter column ticket_token set not null;
create unique index if not exists bookings_ticket_token_idx on public.bookings(ticket_token);
create index if not exists bookings_event_idx on public.bookings(event_id);

-- ─── Seguridad por filas (RLS) ────────────────────────────────────────────
alter table public.admins   enable row level security;
alter table public.events   enable row level security;
alter table public.bookings enable row level security;

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Equipo: solo los administradores (role = 'admin') ven la lista, añaden, cambian
-- el nivel y quitan personas. Nadie puede quitarse ni cambiarse el nivel a sí mismo
-- (así siempre queda al menos un administrador).
drop policy if exists admins_team_select on public.admins;
create policy admins_team_select on public.admins for select to authenticated
  using (public.can_manage_team());

drop policy if exists admins_team_insert on public.admins;
create policy admins_team_insert on public.admins for insert to authenticated
  with check (public.can_manage_team() and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

drop policy if exists admins_team_update on public.admins;
create policy admins_team_update on public.admins for update to authenticated
  using (public.can_manage_team() and lower(email) <> lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (public.can_manage_team() and lower(email) <> lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists admins_team_delete on public.admins;
create policy admins_team_delete on public.admins for delete to authenticated
  using (public.can_manage_team() and lower(email) <> lower(coalesce(auth.jwt() ->> 'email', '')));

-- Lista del equipo con nivel y estado de la cuenta (solo administradores).
drop function if exists public.admin_team();
create function public.admin_team()
returns table (email text, role text, has_account boolean, last_sign_in timestamptz, tabs text[])
language sql stable security definer set search_path = public, auth as $$
  select a.email, a.role, u.id is not null, u.last_sign_in_at, a.tabs
  from public.admins a
  left join auth.users u on lower(u.email) = lower(a.email)
  where public.can_manage_team()
  order by (a.role = 'admin') desc, a.email;
$$;
revoke all on function public.admin_team() from public, anon;
grant execute on function public.admin_team() to authenticated;

-- Eventos: los ven todas las cuentas del panel; solo los edita quien tiene la pestaña Eventos.
drop policy if exists events_admin_all on public.events;
drop policy if exists events_admin_read on public.events;
create policy events_admin_read on public.events for select to authenticated using (public.is_admin());
drop policy if exists events_admin_write on public.events;
create policy events_admin_write on public.events for all to authenticated
  using (public.has_tab('events')) with check (public.has_tab('events'));

-- Reservas: quien tiene Reservas o Asistencia (la puerta necesita ver y marcar llegadas).
drop policy if exists bookings_admin_all on public.bookings;
create policy bookings_admin_all on public.bookings for all to authenticated
  using (public.has_tab('bookings') or public.has_tab('checkin'))
  with check (public.has_tab('bookings') or public.has_tab('checkin'));

-- Sin políticas para "anon": el público no lee ni escribe las tablas directamente.

-- ─── Lo que ve el público: eventos publicados y próximos, con plazas libres ──
create or replace view public.events_public as
select
  e.id, e.env, e.starts_at, e.duration_h,
  e.title_es, e.title_en, e.desc_es, e.desc_en, e.place_es, e.place_en,
  e.price_cents, e.price_label_es, e.price_label_en, e.max_per_order,
  greatest(e.capacity - public.event_taken(e.id), 0)::int as spots_left,
  e.image_url
from public.events e
where e.published
  and e.starts_at + (e.duration_h * interval '1 hour') > now();

grant select on public.events_public to anon, authenticated;

-- Imágenes de los eventos: bucket público (se ven en la web) que solo los
-- administradores pueden subir o borrar. Máx. 5 MB, solo JPG/PNG/WebP.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists event_images_admin_select on storage.objects;
create policy event_images_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'event-images' and public.is_admin());
drop policy if exists event_images_admin_insert on storage.objects;
create policy event_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'event-images' and public.has_tab('events'));
drop policy if exists event_images_admin_update on storage.objects;
create policy event_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'event-images' and public.has_tab('events')) with check (bucket_id = 'event-images' and public.has_tab('events'));
drop policy if exists event_images_admin_delete on storage.objects;
create policy event_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'event-images' and public.has_tab('events'));

-- ─── Reservar (único camino del público para escribir) ───────────────────
-- Bloquea el evento mientras comprueba el aforo, así dos personas a la vez
-- no pueden pasarse de plazas.
drop function if exists public.book_event(text, integer, text, text, text, text, text, boolean);
drop function if exists public.book_event(text, integer, text, text, text, text, text, boolean, text, text, text);
drop function if exists public.book_event(text, integer, text, text, text, text, text, boolean, text, text, text, boolean);
drop function if exists public.book_event(text, integer, text, text, text, text, text, boolean, text, text, text, boolean, text);
create or replace function public.book_event(
  p_event text, p_qty integer, p_name text, p_email text, p_phone text,
  p_notes text default '', p_lang text default 'es', p_marketing boolean default false,
  p_invoice_name text default '', p_invoice_tax_id text default '', p_invoice_address text default '',
  p_online boolean default false, p_dni text default null
) returns table (o_ref text, o_spots_left integer, o_total_cents integer, o_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
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
  -- DNI/NIE/pasaporte: si llega, debe tener entre 5 y 20 letras o números (la web siempre lo envía).
  if p_dni is not null and upper(regexp_replace(p_dni, '[\s.\-]', '', 'g')) !~ '^[A-Z0-9]{5,20}$' then raise exception 'bad_data'; end if;

  taken := public.event_taken(ev.id);
  if taken + p_qty > ev.capacity then raise exception 'sold_out'; end if;

  loop
    v_ref := 'ROCE-';
    for i in 1..6 loop
      v_ref := v_ref || substr(chars, 1 + floor(random() * length(chars))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.bookings b where b.ref = v_ref);
  end loop;

  insert into public.bookings (ref, event_id, qty, name, email, phone, notes, lang, marketing_optin, invoice_name, invoice_tax_id, invoice_address, dni, total_cents, status, payment_status)
  values (
    v_ref, ev.id, p_qty, trim(p_name), lower(trim(p_email)), trim(p_phone),
    left(coalesce(p_notes, ''), 500), case when p_lang = 'en' then 'en' else 'es' end,
    coalesce(p_marketing, false),
    left(trim(coalesce(p_invoice_name, '')), 150), left(upper(trim(coalesce(p_invoice_tax_id, ''))), 20), left(trim(coalesce(p_invoice_address, '')), 250),
    left(upper(regexp_replace(coalesce(p_dni, ''), '[\s.\-]', '', 'g')), 20),
    ev.price_cents * p_qty,
    -- Con pago online la plaza queda retenida (30 min) hasta que el banco confirma el cobro.
    case when p_online and ev.price_cents > 0 then 'pending' else 'confirmed' end,
    case when ev.price_cents = 0 then 'free' else 'pending' end
  ) returning ticket_token into v_token;

  return query select v_ref, (ev.capacity - taken - p_qty)::integer, ev.price_cents * p_qty, v_token;
end;
$$;

revoke all on function public.book_event(text, integer, text, text, text, text, text, boolean, text, text, text, boolean, text) from public;
grant execute on function public.book_event(text, integer, text, text, text, text, text, boolean, text, text, text, boolean, text) to anon, authenticated;

-- ─── Pagos con tarjeta (Redsys) ───────────────────────────────────────────
-- Un intento de pago por fila (order_id es el número de pedido que ve Redsys).
-- Los escribe solo la función "redsys" con la clave de servicio.
create table if not exists public.payments (
  order_id      text primary key,
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  amount_cents  integer not null check (amount_cents > 0),
  status        text not null default 'started' check (status in ('started', 'paid', 'failed')),
  response_code text,
  auth_code     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.payments enable row level security;
drop policy if exists payments_admin_read on public.payments;
create policy payments_admin_read on public.payments for select to authenticated using (public.has_tab('bookings'));

-- Confirma (o rechaza) un pago con la respuesta del banco. Es atómico y repetible:
-- si Redsys avisa dos veces, la segunda no hace nada.
create or replace function public.confirm_payment(p_order text, p_amount integer, p_response text, p_auth text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
  v_ok boolean;
  v_booking public.bookings%rowtype;
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

-- Estado de pago de una reserva por su referencia (para la pantalla de vuelta del banco).
create or replace function public.booking_status(p_ref text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select payment_status from public.bookings where ref = p_ref), 'unknown');
$$;
revoke all on function public.booking_status(text) from public;
grant execute on function public.booking_status(text) to anon, authenticated;


-- ─── Listas de invitados (enlace para apuntar gente sin pasar por la pasarela) ─────
-- Cada lista tiene un enlace secreto (token): quien lo recibe apunta el nombre de
-- sus invitados hasta el máximo y la fecha de cierre. Entran gratis y cuentan en el
-- aforo del evento. Las tablas solo las toca el panel; el público usa guest_list_get
-- y guest_list_save con el token.
create table if not exists public.guest_lists (
  id           uuid primary key default gen_random_uuid(),
  event_id     text not null references public.events(id) on delete restrict,
  token        text not null unique default replace(gen_random_uuid()::text, '-', ''),
  label        text not null check (length(trim(label)) >= 2),   -- p. ej. "Lista de Pedro"
  max_people   integer not null check (max_people between 1 and 500),
  closes_at    timestamptz not null,
  closed       boolean not null default false,
  note         text not null default '',                          -- mensaje para quien rellena la lista
  host_name    text not null default '',                          -- lo rellena quien recibe el enlace
  host_contact text not null default '',
  created_at   timestamptz not null default now()
);
-- El propietario valida la lista: se cierra y se envía a cada invitado su entrada con QR.
alter table public.guest_lists add column if not exists validated_at timestamptz;
create table if not exists public.guest_list_entries (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references public.guest_lists(id) on delete cascade,
  name          text not null check (length(trim(name)) between 2 and 80),
  checked_in    boolean not null default false,
  checked_in_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists guest_list_entries_list_idx on public.guest_list_entries(list_id);
-- Cada invitado tiene su email, su DNI y su propio QR (código secreto), que se le envía al cerrar la lista.
alter table public.guest_list_entries add column if not exists email text not null default '';
alter table public.guest_list_entries add column if not exists dni text not null default '';
alter table public.guest_list_entries add column if not exists ticket_token text;
alter table public.guest_list_entries add column if not exists emailed_at timestamptz;
update public.guest_list_entries set ticket_token = replace(gen_random_uuid()::text, '-', '') where ticket_token is null;
alter table public.guest_list_entries alter column ticket_token set default replace(gen_random_uuid()::text, '-', '');
alter table public.guest_list_entries alter column ticket_token set not null;
create unique index if not exists guest_list_entries_token_idx on public.guest_list_entries(ticket_token);

alter table public.guest_lists enable row level security;
alter table public.guest_list_entries enable row level security;
drop policy if exists guest_lists_admin_all on public.guest_lists;
create policy guest_lists_admin_all on public.guest_lists for all to authenticated
  using (public.has_tab('lists') or public.has_tab('checkin')) with check (public.has_tab('lists') or public.has_tab('checkin'));
drop policy if exists guest_list_entries_admin_all on public.guest_list_entries;
create policy guest_list_entries_admin_all on public.guest_list_entries for all to authenticated
  using (public.has_tab('lists') or public.has_tab('checkin')) with check (public.has_tab('lists') or public.has_tab('checkin'));

-- Plazas ocupadas de un evento: reservas confirmadas (o pendientes de pago hace menos
-- de 30 min) más las personas apuntadas en listas.
create or replace function public.event_taken(p_event text) returns integer
language sql stable security definer set search_path = public as $$
  select (coalesce((select sum(b.qty) from public.bookings b
                    where b.event_id = p_event
                      and (b.status = 'confirmed' or (b.status = 'pending' and b.created_at > now() - interval '30 minutes'))), 0)
        + coalesce((select count(*) from public.guest_list_entries e join public.guest_lists l on l.id = e.list_id
                    where l.event_id = p_event), 0))::integer;
$$;

-- Lo que ve quien abre el enlace de una lista.
create or replace function public.guest_list_get(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.guest_lists%rowtype; ev public.events%rowtype; names jsonb; guests jsonb;
begin
  select * into l from public.guest_lists where token = p_token;
  if not found then return null; end if;
  select * into ev from public.events where id = l.event_id;
  select coalesce(jsonb_agg(e.name order by e.created_at), '[]'::jsonb),
         coalesce(jsonb_agg(jsonb_build_object('name', e.name, 'email', e.email, 'dni', e.dni) order by e.created_at), '[]'::jsonb)
    into names, guests from public.guest_list_entries e where e.list_id = l.id;
  return jsonb_build_object(
    'label', l.label, 'note', l.note, 'max_people', l.max_people, 'closes_at', l.closes_at,
    'closed', (l.closed or l.validated_at is not null or l.closes_at <= now() or ev.starts_at + (ev.duration_h * interval '1 hour') <= now()),
    'validated', (l.validated_at is not null),
    'host_name', l.host_name, 'host_contact', l.host_contact, 'names', names, 'guests', guests,
    'event', jsonb_build_object('title_es', ev.title_es, 'title_en', ev.title_en, 'env', ev.env, 'starts_at', ev.starts_at,
                                'duration_h', ev.duration_h, 'place_es', ev.place_es, 'place_en', ev.place_en, 'image_url', ev.image_url));
end;
$$;

-- Guarda la lista tal como la deja quien tiene el enlace (sustituye a la anterior).
-- Cada invitado lleva nombre, email y DNI/NIE/pasaporte: recibirá su entrada con QR cuando la lista
-- se cierre. Controla máximo, cierre y aforo con el evento bloqueado. Quien ya entró no se borra.
create or replace function public.guest_list_save(p_token text, p_host_name text, p_host_contact text, p_guests jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l public.guest_lists%rowtype; ev public.events%rowtype;
  v_names text[]; v_emails text[]; v_dnis text[];
  kept integer; added integer; final_n integer;
begin
  select * into l from public.guest_lists where token = p_token for update;
  if not found then raise exception 'list_not_found'; end if;
  select * into ev from public.events where id = l.event_id for update;
  if l.closed or l.validated_at is not null or l.closes_at <= now() or ev.starts_at + (ev.duration_h * interval '1 hour') <= now() then raise exception 'list_closed'; end if;
  if length(trim(coalesce(p_host_name, ''))) < 2 or length(trim(coalesce(p_host_contact, ''))) < 5 then raise exception 'bad_data'; end if;
  if p_guests is null or jsonb_typeof(p_guests) <> 'array' then raise exception 'bad_data'; end if;

  -- Invitados limpios, sin repetidos (sin distinguir mayúsculas) y en el orden en que llegaron.
  select coalesce(array_agg(nm order by pos), '{}'), coalesce(array_agg(em order by pos), '{}'), coalesce(array_agg(dn order by pos), '{}')
    into v_names, v_emails, v_dnis
  from (
    select distinct on (lower(nm)) nm, em, dn, pos from (
      select left(trim(coalesce(x ->> 'name', '')), 80) as nm,
             lower(left(trim(coalesce(x ->> 'email', '')), 120)) as em,
             upper(regexp_replace(coalesce(x ->> 'dni', ''), '[\s.\-]', '', 'g')) as dn,
             ord as pos
      from jsonb_array_elements(p_guests) with ordinality as t(x, ord)
    ) s where length(nm) >= 2
    order by lower(nm), pos
  ) d;
  if exists (select 1 from unnest(v_emails) e where e !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$')
     or exists (select 1 from unnest(v_dnis) d2 where d2 !~ '^[A-Z0-9]{5,20}$') then raise exception 'bad_data'; end if;

  delete from public.guest_list_entries where list_id = l.id and not checked_in and lower(name) <> all (select lower(c) from unnest(v_names) c);
  select count(*) into kept from public.guest_list_entries where list_id = l.id;
  select count(*) into added from unnest(v_names) c where lower(c) not in (select lower(name) from public.guest_list_entries where list_id = l.id);
  final_n := kept + added;
  if final_n > l.max_people then raise exception 'too_many'; end if;
  if added > 0 and public.event_taken(ev.id) + added > ev.capacity then raise exception 'sold_out'; end if;

  insert into public.guest_list_entries (list_id, name, email, dni)
  select l.id, n.nm, n.em, n.dn from unnest(v_names, v_emails, v_dnis) as n(nm, em, dn)
  where lower(n.nm) not in (select lower(name) from public.guest_list_entries where list_id = l.id);
  update public.guest_list_entries ge set email = n.em, dni = n.dn
  from unnest(v_names, v_emails, v_dnis) as n(nm, em, dn)
  where ge.list_id = l.id and lower(ge.name) = lower(n.nm) and ge.emailed_at is null;
  update public.guest_lists set host_name = left(trim(p_host_name), 80), host_contact = left(trim(p_host_contact), 120) where id = l.id;
  return jsonb_build_object('ok', true, 'count', final_n);
end;
$$;

-- El propietario valida su lista: se cierra ya y a cada invitado le llega su entrada con QR.
-- (La función booking-email hace los envíos; además se barre cada 5 minutos para las listas que
-- se cierran solas a su hora.)
create or replace function public.guest_list_validate(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l public.guest_lists%rowtype; ev public.events%rowtype; n integer;
begin
  select * into l from public.guest_lists where token = p_token for update;
  if not found then raise exception 'list_not_found'; end if;
  select * into ev from public.events where id = l.event_id;
  if l.closed or l.validated_at is not null or l.closes_at <= now() or ev.starts_at + (ev.duration_h * interval '1 hour') <= now() then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  select count(*) into n from public.guest_list_entries where list_id = l.id;
  if n = 0 or length(trim(l.host_name)) < 2 then raise exception 'bad_data'; end if;
  update public.guest_lists set validated_at = now() where id = l.id;
  return jsonb_build_object('ok', true, 'count', n);
end;
$$;
revoke all on function public.guest_list_get(text) from public;
revoke all on function public.guest_list_save(text, text, text, text[]) from public;
grant execute on function public.guest_list_get(text) to anon, authenticated;
grant execute on function public.guest_list_save(text, text, text, text[]) to anon, authenticated;
revoke all on function public.guest_list_save(text, text, text, jsonb) from public;
grant execute on function public.guest_list_save(text, text, text, jsonb) to anon, authenticated;
revoke all on function public.guest_list_validate(text) from public;
grant execute on function public.guest_list_validate(text) to anon, authenticated;

-- ─── Entrada con QR ─────────────────────────────────────────────────────────
-- Datos mínimos de una entrada para la página roce.es/entrada/ (solo con el código secreto).
create or replace function public.ticket_get(p_token text)
returns table (ref text, name text, qty integer, checked_in integer, status text, payment_status text,
               env text, starts_at timestamptz, duration_h numeric, title_es text, title_en text, place_es text, place_en text)
language sql stable security definer set search_path = public as $$
  select t.* from (
    select b.ref, b.name, b.qty, b.checked_in, b.status, b.payment_status,
           e.env, e.starts_at, e.duration_h::numeric as duration_h, e.title_es, e.title_en, e.place_es, e.place_en
    from public.bookings b join public.events e on e.id = b.event_id
    where b.ticket_token = p_token
    union all
    select 'LISTA'::text, ge.name, 1, case when ge.checked_in then 1 else 0 end, 'confirmed'::text, 'free'::text,
           e.env, e.starts_at, e.duration_h::numeric, e.title_es, e.title_en, e.place_es, e.place_en
    from public.guest_list_entries ge join public.guest_lists gl on gl.id = ge.list_id join public.events e on e.id = gl.event_id
    where ge.ticket_token = p_token
  ) t
  where length(coalesce(p_token, '')) = 32
  limit 1;
$$;
revoke all on function public.ticket_get(text) from public;
grant execute on function public.ticket_get(text) to anon, authenticated;

-- Registro de admisiones hechas con el escáner (quién, cuántas y cuándo).
create table if not exists public.admissions (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references public.bookings(id) on delete cascade,
  qty         integer not null check (qty > 0),
  admitted_by text not null default '',
  created_at  timestamptz not null default now()
);
alter table public.admissions alter column booking_id drop not null;
alter table public.admissions add column if not exists entry_id uuid references public.guest_list_entries(id) on delete cascade;
alter table public.admissions enable row level security;
drop policy if exists admissions_admin_read on public.admissions;
create policy admissions_admin_read on public.admissions for select to authenticated using (public.has_tab('bookings') or public.has_tab('checkin'));

-- Escáner del panel. p_count = 0 solo consulta; p_count > 0 admite esas personas (como mucho las que
-- faltan). Todo en una sola operación con la reserva bloqueada: dos escáneres a la vez no pueden admitir dos veces.
-- result: unknown | cancelled | unpaid | already | valid | topay | admitted
create or replace function public.scan_ticket(p_token text, p_count integer default 0)
returns table (result text, ref text, name text, qty integer, checked_in integer, checked_in_at timestamptz,
               status text, payment_status text, total_cents integer, event_id text, notes text)
language plpgsql security definer set search_path = public as $$
declare
  b        public.bookings;
  v_result text;
  n        integer;
  g        public.guest_list_entries;
  gl       public.guest_lists;
begin
  if not public.has_tab('checkin') then raise exception 'forbidden'; end if;
  select * into b from public.bookings where length(coalesce(p_token, '')) = 32 and ticket_token = p_token for update;
  if not found then
    -- ¿Es un invitado de lista? Un QR por persona.
    select * into g from public.guest_list_entries where length(coalesce(p_token, '')) = 32 and ticket_token = p_token for update;
    if found then
      select * into gl from public.guest_lists where id = g.list_id;
      if g.checked_in then v_result := 'already';
      elsif coalesce(p_count, 0) > 0 then
        update public.guest_list_entries ge set checked_in = true, checked_in_at = now() where ge.id = g.id returning ge.* into g;
        insert into public.admissions (entry_id, qty, admitted_by) values (g.id, 1, lower(coalesce(auth.jwt() ->> 'email', '')));
        v_result := 'admitted';
      else v_result := 'valid';
      end if;
      return query select v_result, 'LISTA'::text, g.name, 1, case when g.checked_in then 1 else 0 end, g.checked_in_at,
        'confirmed'::text, 'free'::text, 0, gl.event_id, (gl.label || case when gl.host_name <> '' then ' · ' || gl.host_name else '' end)::text;
      return;
    end if;
    return query select 'unknown'::text, null::text, null::text, 0, 0, null::timestamptz, null::text, null::text, 0, null::text, null::text;
    return;
  end if;
  if b.status = 'cancelled' then v_result := 'cancelled';
  elsif b.status = 'pending' then v_result := 'unpaid';
  elsif b.checked_in >= b.qty then v_result := 'already';
  elsif coalesce(p_count, 0) > 0 then
    n := least(p_count, b.qty - b.checked_in);
    update public.bookings bk set checked_in = bk.checked_in + n, checked_in_at = now() where bk.id = b.id returning bk.* into b;
    insert into public.admissions (booking_id, qty, admitted_by) values (b.id, n, lower(coalesce(auth.jwt() ->> 'email', '')));
    v_result := 'admitted';
  elsif b.payment_status = 'pending' then v_result := 'topay';
  else v_result := 'valid';
  end if;
  return query select v_result, b.ref, b.name, b.qty, b.checked_in, b.checked_in_at, b.status, b.payment_status, b.total_cents, b.event_id, b.notes;
end;
$$;
revoke all on function public.scan_ticket(text, integer) from public, anon;
grant execute on function public.scan_ticket(text, integer) to authenticated;

-- ─── Facturas ─────────────────────────────────────────────────────────────
-- Una factura por reserva de pago, que se emite cuando la reserva pasa a "paid".
-- La numeración (serie F + año + correlativo) no tiene saltos: el contador se
-- bloquea y se incrementa en la misma transacción que crea la factura.
create table if not exists public.invoice_counters (
  series   text not null,
  year     integer not null,
  last_seq integer not null default 0,
  primary key (series, year)
);

create table if not exists public.invoices (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,            -- p. ej. F-2026-0001
  series           text not null,
  year             integer not null,
  seq              integer not null,
  booking_id       uuid not null unique references public.bookings(id) on delete restrict,
  kind             text not null check (kind in ('simplified', 'full')),
  issued_at        timestamptz not null default now(),
  customer_name    text not null,
  customer_tax_id  text not null default '',
  customer_address text not null default '',
  customer_email   text not null,
  description      text not null,
  qty              integer not null,
  unit_cents       integer not null,                -- precio por entrada con IVA
  total_cents      integer not null,
  vat_percent      numeric(4,1) not null,
  base_cents       integer not null,                -- base imponible
  vat_cents        integer not null,                -- cuota de IVA
  drive_url        text not null default '',
  email_sent_at    timestamptz,
  unique (series, year, seq)
);

alter table public.invoice_counters enable row level security;
alter table public.invoices enable row level security;
drop policy if exists invoices_admin_read on public.invoices;
create policy invoices_admin_read on public.invoices for select to authenticated using (public.has_tab('bookings'));
-- Las facturas no se editan ni se borran desde el panel: sin políticas de escritura.

-- Abonos (facturas rectificativas por devolución): serie A, mismo contador sin saltos.
-- Una reserva tiene como mucho una factura y un abono (importes en negativo).
alter table public.invoices drop constraint if exists invoices_booking_id_key;
alter table public.invoices add column if not exists doc_type  text not null default 'invoice' check (doc_type in ('invoice', 'credit'));
alter table public.invoices add column if not exists credit_of uuid references public.invoices(id) on delete restrict;
alter table public.invoices add column if not exists reason    text not null default '';
create unique index if not exists invoices_one_invoice_per_booking on public.invoices (booking_id) where doc_type = 'invoice';
create unique index if not exists invoices_one_credit_per_booking  on public.invoices (booking_id) where doc_type = 'credit';

-- Emite (o devuelve, si ya existe) la factura de una reserva cobrada.
-- Solo la usa la función de Supabase con la clave de servicio.
create or replace function public.issue_invoice(p_booking uuid) returns public.invoices
language plpgsql security definer set search_path = public as $$
declare
  b        public.bookings;
  e        public.events;
  inv      public.invoices;
  v_series text := 'F';
  v_year   integer;
  v_seq    integer;
  v_base   integer;
begin
  select * into inv from public.invoices where booking_id = p_booking and doc_type = 'invoice';
  if found then return inv; end if;

  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'booking_not_found'; end if;
  if b.payment_status <> 'paid' or b.status = 'cancelled' or b.total_cents <= 0 then raise exception 'not_billable'; end if;
  select * into e from public.events where id = b.event_id;

  v_year := extract(year from (now() at time zone 'Europe/Madrid'))::integer;
  insert into public.invoice_counters (series, year, last_seq) values (v_series, v_year, 0) on conflict do nothing;
  update public.invoice_counters set last_seq = last_seq + 1
    where series = v_series and year = v_year returning last_seq into v_seq;

  v_base := round(b.total_cents::numeric / (1 + e.vat_percent / 100))::integer;

  insert into public.invoices (
    number, series, year, seq, booking_id, kind, customer_name, customer_tax_id, customer_address, customer_email,
    description, qty, unit_cents, total_cents, vat_percent, base_cents, vat_cents
  ) values (
    v_series || '-' || v_year || '-' || lpad(v_seq::text, 4, '0'), v_series, v_year, v_seq, b.id,
    case when b.invoice_tax_id <> '' then 'full' else 'simplified' end,
    case when b.invoice_name <> '' then b.invoice_name else b.name end,
    b.invoice_tax_id, b.invoice_address, b.email,
    'Entrada: ' || e.title_es, b.qty, (b.total_cents / b.qty), b.total_cents, e.vat_percent, v_base, b.total_cents - v_base
  ) returning * into inv;
  return inv;
end;
$$;

revoke all on function public.issue_invoice(uuid) from public, anon, authenticated;
grant execute on function public.issue_invoice(uuid) to service_role;

-- Emite (o devuelve, si ya existe) el abono de una reserva devuelta: copia la factura con importes en negativo.
create or replace function public.issue_credit_note(p_booking uuid, p_reason text default '') returns public.invoices
language plpgsql security definer set search_path = public as $$
declare
  orig     public.invoices;
  cn       public.invoices;
  v_series text := 'A';
  v_year   integer;
  v_seq    integer;
begin
  select * into cn from public.invoices where booking_id = p_booking and doc_type = 'credit';
  if found then return cn; end if;
  select * into orig from public.invoices where booking_id = p_booking and doc_type = 'invoice';
  if not found then raise exception 'no_invoice'; end if;

  v_year := extract(year from (now() at time zone 'Europe/Madrid'))::integer;
  insert into public.invoice_counters (series, year, last_seq) values (v_series, v_year, 0) on conflict do nothing;
  update public.invoice_counters set last_seq = last_seq + 1
    where series = v_series and year = v_year returning last_seq into v_seq;

  insert into public.invoices (
    number, series, year, seq, booking_id, kind, doc_type, credit_of, reason,
    customer_name, customer_tax_id, customer_address, customer_email,
    description, qty, unit_cents, total_cents, vat_percent, base_cents, vat_cents
  ) values (
    v_series || '-' || v_year || '-' || lpad(v_seq::text, 4, '0'), v_series, v_year, v_seq, p_booking, orig.kind, 'credit', orig.id,
    left(coalesce(nullif(trim(p_reason), ''), 'Devolución del importe de la entrada'), 200),
    orig.customer_name, orig.customer_tax_id, orig.customer_address, orig.customer_email,
    orig.description, orig.qty, -orig.unit_cents, -orig.total_cents, orig.vat_percent, -orig.base_cents, -orig.vat_cents
  ) returning * into cn;
  return cn;
end;
$$;
revoke all on function public.issue_credit_note(uuid, text) from public, anon, authenticated;
grant execute on function public.issue_credit_note(uuid, text) to service_role;

-- Devoluciones: una por reserva (el candado evita devolver dos veces con un doble clic).
-- Solo las escribe la función "redsys" con la clave de servicio.
create table if not exists public.refunds (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null unique references public.bookings(id) on delete restrict,
  order_id      text,                                    -- pedido de Redsys del cobro original
  amount_cents  integer not null,
  method        text not null check (method in ('redsys', 'manual')),
  status        text not null default 'started' check (status in ('started', 'done', 'failed')),
  response_code text,
  requested_by  text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.refunds enable row level security;
drop policy if exists refunds_admin_read on public.refunds;
create policy refunds_admin_read on public.refunds for select to authenticated using (public.has_tab('bookings'));
