-- ROCE · Ampliar una reserva de mesa confirmada (solo de ahora en adelante: no toca las reservas que ya existen).
--   · El cliente, desde su enlace, solo puede subir personas si la web tendría sitio para ese grupo a esa hora
--     (bloqueos, aforo, tope y ritmo de la cena, antelación: las mismas reglas que al reservar).
--   · Con tarjeta de garantía, tiene que aceptar el importe nuevo, que es el que se cobra si no viene.
--   · Si amplía el equipo desde RoceCover, la ampliación queda PENDIENTE hasta que el cliente la acepte.
-- Se puede ejecutar más de una vez. No cambia ninguna función que ya exista.

alter table public.table_bookings add column if not exists grow_party integer;
alter table public.table_bookings add column if not exists grow_deposit_cents integer;
alter table public.table_bookings add column if not exists grow_asked_at timestamptz;
alter table public.table_bookings add column if not exists deposit_accepted_at timestamptz;

-- Garantía que le toca a un grupo en una zona.
create or replace function public.dining_deposit_for(p_zone text, p_party integer) returns integer
language sql stable security definer set search_path = public as $$
  select case when z.payment_mode = 'none' then 0 when z.deposit_per_person then z.deposit_cents * p_party else z.deposit_cents end
    from public.dining_zones z where z.id = p_zone;
$$;
revoke all on function public.dining_deposit_for(text, integer) from public, anon, authenticated;

-- ¿La web admitiría hoy ese grupo a la hora y en la zona de esta reserva? Se pregunta al mismo motor que pinta las horas
-- (dining_grid), quitando antes la propia reserva para que no se cuente dos veces; el cambio se deshace siempre.
create or replace function public.dining_can_grow(p_booking uuid, p_party integer) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  b public.table_bookings%rowtype;
  v_ok boolean := false;
begin
  select * into b from public.table_bookings where id = p_booking;
  if not found or b.status <> 'confirmed' or b.starts_at <= now() or p_party <= b.party then return false; end if;
  if p_party > coalesce((select w.o_max_party from public.dining_web_limits() w where w.o_service = b.service_id), 0) then return false; end if;
  begin
    update public.table_bookings set status = 'cancelled' where id = b.id;
    select exists (
      select 1 from public.dining_grid(((b.starts_at at time zone 'Europe/Madrid') - interval '6 hours')::date, p_party, b.ambience) g
       where g.o_starts_at = b.starts_at and g.o_zone = b.zone_id and g.o_free
    ) into v_ok;
    raise exception using errcode = 'RC001';          -- deshace el cambio de arriba
  exception when sqlstate 'RC001' then null;
  end;
  return v_ok;
end;
$$;
revoke all on function public.dining_can_grow(uuid, integer) from public, anon, authenticated;

-- Lo que ve el cliente en su enlace: si puede ampliar, hasta cuántos y qué garantía le tocaría.
create or replace function public.table_booking_grow_info(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  b public.table_bookings%rowtype;
  z public.dining_zones%rowtype;
  v_card boolean;
  v_options jsonb := '[]'::jsonb;
  n integer;
begin
  select * into b from public.table_bookings where token = p_token;
  if not found then return null; end if;
  select * into z from public.dining_zones where id = b.zone_id;
  v_card := b.payment_status = 'guaranteed';
  -- Reservas con fianza ya cobrada: ampliar exigiría otro pago; se gestiona escribiendo a ROCE.
  if b.status <> 'confirmed' or b.starts_at <= now() or b.payment_status = 'paid' or b.kind = 'walkin' then
    return jsonb_build_object('can_ask', false);
  end if;
  perform pg_advisory_xact_lock(7001);
  for n in b.party + 1 .. least(b.party + 8, 20) loop
    if public.dining_can_grow(b.id, n) then
      v_options := v_options || jsonb_build_object('party', n, 'deposit_cents', case when v_card then public.dining_deposit_for(b.zone_id, n) else 0 end);
    end if;
  end loop;
  return jsonb_build_object('can_ask', true, 'party', b.party, 'card', v_card, 'deposit_cents', b.deposit_cents,
    'free_cancel_hours', z.free_cancel_hours, 'options', v_options,
    'pending_party', b.grow_party, 'pending_deposit_cents', b.grow_deposit_cents);
end;
$$;
revoke all on function public.table_booking_grow_info(text) from public;
grant execute on function public.table_booking_grow_info(text) to anon, authenticated;

-- El cliente amplía (o acepta la ampliación que le ha propuesto el equipo). p_accept_cents = garantía que ha visto y acepta.
create or replace function public.table_booking_grow(p_token text, p_party integer, p_accept_cents integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b public.table_bookings%rowtype;
  v_card boolean;
  v_offer boolean;
  v_dep integer;
  v_end timestamptz;
  v_tables uuid[];
  v_seats integer;
begin
  perform pg_advisory_xact_lock(7001);
  select * into b from public.table_bookings where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if b.status <> 'confirmed' or b.starts_at <= now() or b.payment_status = 'paid' or p_party is null or p_party <= b.party then
    return jsonb_build_object('ok', false, 'error', 'not_editable');
  end if;
  v_card := b.payment_status = 'guaranteed';
  v_offer := b.grow_party is not null and p_party = b.grow_party;          -- propuesta del equipo: ya le han guardado sitio
  v_dep := case when not v_card then b.deposit_cents when v_offer then b.grow_deposit_cents else public.dining_deposit_for(b.zone_id, p_party) end;
  if v_card and p_accept_cents is distinct from v_dep then return jsonb_build_object('ok', false, 'error', 'amount_changed'); end if;
  if not v_offer and not public.dining_can_grow(b.id, p_party) then return jsonb_build_object('ok', false, 'error', 'no_table'); end if;

  v_end := b.starts_at + greatest(b.ends_at - b.starts_at, make_interval(mins => public.dining_duration(b.service_id, p_party)));
  select coalesce(sum(t.seats_max), 0) into v_seats
    from public.table_booking_tables bt join public.dining_tables t on t.id = bt.table_id where bt.booking_id = b.id;
  if not v_offer or v_seats < p_party then
    v_tables := public.dining_assign(b.starts_at, v_end, p_party, b.zone_id, b.id);
    if v_tables is null and not v_offer then return jsonb_build_object('ok', false, 'error', 'no_table'); end if;
  end if;

  perform set_config('roce.grow_apply', '1', true);
  update public.table_bookings
     set party = p_party, deposit_cents = v_dep, ends_at = v_end, grow_party = null, grow_deposit_cents = null, grow_asked_at = null,
         deposit_accepted_at = case when v_card then now() else deposit_accepted_at end
   where id = b.id;
  perform set_config('roce.grow_apply', '', true);
  if v_tables is not null then
    delete from public.table_booking_tables where booking_id = b.id;
    insert into public.table_booking_tables (booking_id, table_id) select b.id, unnest(v_tables);
  end if;
  return jsonb_build_object('ok', true, 'party', p_party, 'deposit_cents', v_dep);
end;
$$;
revoke all on function public.table_booking_grow(text, integer, integer) from public;
grant execute on function public.table_booking_grow(text, integer, integer) to anon, authenticated;

-- El cliente dice que no a la ampliación propuesta: la reserva se queda como estaba.
create or replace function public.table_booking_grow_reject(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update public.table_bookings set grow_party = null, grow_deposit_cents = null, grow_asked_at = null
   where token = p_token and grow_party is not null;
  return jsonb_build_object('ok', found);
end;
$$;
revoke all on function public.table_booking_grow_reject(text) from public;
grant execute on function public.table_booking_grow_reject(text) to anon, authenticated;

-- RoceCover: si el equipo sube las personas de una reserva con tarjeta de garantía, queda pendiente de que el cliente acepte.
create or replace function public.dining_grow_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dep integer;
begin
  -- Anulada o ya en la mesa: no queda nada pendiente (si se sienta a más gente, se apunta sin más).
  if new.status in ('cancelled', 'no_show', 'completed', 'seated') then
    new.grow_party := null; new.grow_deposit_cents := null; new.grow_asked_at := null;
    return new;
  end if;
  if coalesce(current_setting('roce.grow_apply', true), '') = '1' or coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return new;
  end if;
  if new.party < old.party then
    new.grow_party := null; new.grow_deposit_cents := null; new.grow_asked_at := null;
  elsif new.party > old.party then
    v_dep := public.dining_deposit_for(new.zone_id, new.party);
    if old.status = 'pending' and old.payment_status = 'pending' and v_dep > old.deposit_cents then
      new.deposit_cents := v_dep;                      -- aún no ha puesto la tarjeta: verá ya el importe nuevo
    elsif old.payment_status = 'guaranteed' and v_dep > old.deposit_cents and coalesce(new.email, '') <> '' then
      new.grow_party := new.party; new.grow_deposit_cents := v_dep; new.grow_asked_at := now();
      new.party := old.party;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.dining_grow_guard() from public, anon, authenticated;
drop trigger if exists table_bookings_grow on public.table_bookings;
create trigger table_bookings_grow before update on public.table_bookings for each row execute function public.dining_grow_guard();

-- RoceCover: retirar una ampliación que el cliente no ha aceptado.
create or replace function public.dining_grow_cancel(p_booking uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_tab('tables') then raise exception 'forbidden'; end if;
  update public.table_bookings set grow_party = null, grow_deposit_cents = null, grow_asked_at = null where id = p_booking;
  return jsonb_build_object('ok', found);
end;
$$;
revoke all on function public.dining_grow_cancel(uuid) from public, anon;
grant execute on function public.dining_grow_cancel(uuid) to authenticated;

notify pgrst, 'reload schema';
