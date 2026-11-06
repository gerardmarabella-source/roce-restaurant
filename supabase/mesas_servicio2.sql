-- ROCE · Servicio, fidelización, historial, recordatorios y valoraciones de RoceCover.
-- Se puede ejecutar más de una vez. Ejecútalo después de mesas_aperturas.sql.

-- ─── Estados de servicio nuevos ───────────────────────────────────────────
alter table public.table_bookings add column if not exists bar_at         timestamptz;   -- llegó y espera en la barra
alter table public.table_bookings add column if not exists bill_at        timestamptz;   -- han pedido la cuenta
alter table public.table_bookings add column if not exists finished_at    timestamptz;   -- visita terminada
alter table public.table_bookings add column if not exists cleaned_at      timestamptz;   -- mesa limpia otra vez
alter table public.table_bookings add column if not exists reconfirmed_at  timestamptz;   -- el cliente reconfirmó su asistencia
alter table public.table_bookings add column if not exists reminder_sent_at timestamptz;  -- recordatorio de 24 h enviado
alter table public.table_bookings add column if not exists review_sent_at  timestamptz;   -- email de valoración enviado (o descartado)
alter table public.table_bookings add column if not exists kind            text not null default 'normal';   -- normal · walkin · group · private
alter table public.table_bookings drop constraint if exists table_bookings_kind_check;
alter table public.table_bookings add constraint table_bookings_kind_check check (kind in ('normal', 'walkin', 'group', 'private'));

-- Al terminar la visita (cualquier camino) se anota la hora.
create or replace function public.dining_set_finished() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and new.finished_at is null then new.finished_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists table_bookings_finished on public.table_bookings;
create trigger table_bookings_finished before update on public.table_bookings for each row execute function public.dining_set_finished();

-- Reconfirmar la asistencia desde el enlace del recordatorio.
create or replace function public.table_booking_reconfirm(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.table_bookings%rowtype;
begin
  select * into b from public.table_bookings where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.status not in ('pending', 'confirmed') or b.starts_at <= now() then return jsonb_build_object('ok', false, 'error', 'not_active'); end if;
  update public.table_bookings set reconfirmed_at = coalesce(reconfirmed_at, now()) where id = b.id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.table_booking_reconfirm(text) from public;
grant execute on function public.table_booking_reconfirm(text) to anon, authenticated;

-- ─── Ajustes (fidelización) ───────────────────────────────────────────────
create table if not exists public.dining_settings (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.dining_settings enable row level security;
drop policy if exists dining_settings_read on public.dining_settings;
create policy dining_settings_read on public.dining_settings for select to authenticated using (public.has_tab('tables'));
drop policy if exists dining_settings_write on public.dining_settings;
create policy dining_settings_write on public.dining_settings for all to authenticated using (public.has_tab('tables_config')) with check (public.has_tab('tables_config'));
-- Nivel de cliente: Plata o Oro si cumple las visitas O el gasto acumulado (Bronce desde la primera visita).
insert into public.dining_settings (key, value)
values ('loyalty', '{"silver": {"visits": 3, "spend": 150}, "gold": {"visits": 8, "spend": 500}}')
on conflict (key) do nothing;

-- ─── Etiquetas de sistema ─────────────────────────────────────────────────
insert into public.dining_tags (code, name) values ('vip', 'VIP'), ('no-paga', 'No paga'), ('partner', 'Partner') on conflict (code) do nothing;

-- ─── Los 14 alérgenos oficiales (la reserva web solo aceptaba una lista corta) ──
do $$
declare
  r record;
  def text;
  old_list text := $l$array['gluten','lactosa','frutos-secos','marisco','pescado','huevo','soja','sesamo','vegetariano','vegano','otras']$l$;
  new_list text := $l$array['gluten','lactosa','frutos-secos','marisco','pescado','huevo','soja','sesamo','altramuz','apio','cacahuetes','moluscos','mostaza','sulfitos','vegetariano','vegano','otras']$l$;
begin
  for r in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'book_table' loop
    def := pg_get_functiondef(r.oid);
    if position(old_list in def) > 0 then execute replace(def, old_list, new_list); end if;
  end loop;
end $$;

-- ─── Historial de cambios de cada reserva ─────────────────────────────────
create table if not exists public.dining_booking_log (
  id         bigint generated always as identity primary key,
  booking_id uuid not null references public.table_bookings(id) on delete cascade,
  at         timestamptz not null default now(),
  who        text not null default '',
  action     text not null,
  detail     jsonb not null default '{}'
);
create index if not exists dining_booking_log_bk on public.dining_booking_log (booking_id, at desc);
create index if not exists dining_booking_log_at on public.dining_booking_log (at desc);
alter table public.dining_booking_log enable row level security;
drop policy if exists dining_booking_log_read on public.dining_booking_log;
create policy dining_booking_log_read on public.dining_booking_log for select to authenticated using (public.has_tab('tables'));

create or replace function public.dining_log_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_who text := coalesce(nullif(auth.jwt() ->> 'email', ''), case when coalesce(auth.jwt() ->> 'role', '') = 'service_role' then 'sistema' else 'web' end);
  v_chg jsonb := '{}'::jsonb;
  k text;
begin
  if tg_op = 'INSERT' then
    insert into public.dining_booking_log (booking_id, who, action, detail)
    values (new.id, v_who, 'created', jsonb_build_object('party', new.party, 'starts_at', new.starts_at, 'source', new.source, 'status', new.status));
    return new;
  end if;
  foreach k in array array['status', 'starts_at', 'ends_at', 'party', 'name', 'phone', 'email', 'notes', 'zone_id', 'payment_status', 'prescriber', 'kind',
                           'arrived_at', 'bar_at', 'dessert_at', 'bill_at', 'finished_at', 'cleaned_at', 'reconfirmed_at', 'spend_cents', 'deposit_cents', 'late_cancel'] loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      v_chg := v_chg || jsonb_build_object(k, jsonb_build_object('from', to_jsonb(old) -> k, 'to', to_jsonb(new) -> k));
    end if;
  end loop;
  if v_chg <> '{}'::jsonb then
    insert into public.dining_booking_log (booking_id, who, action, detail) values (new.id, v_who, 'updated', v_chg);
  end if;
  return new;
end;
$$;
drop trigger if exists table_bookings_log on public.table_bookings;
create trigger table_bookings_log after insert or update on public.table_bookings for each row execute function public.dining_log_booking();
