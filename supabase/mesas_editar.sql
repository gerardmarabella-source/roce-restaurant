-- ROCE · Editar una reserva de mesa desde el panel (ampliar el grupo, cambiar hora, mesas, datos)
-- Pegar en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez. Solo añade una función.
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
  if p_party is null or p_party < 1 or p_party > 60 or length(trim(coalesce(p_name, ''))) < 1 then raise exception 'bad_data'; end if;

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
     set party = p_party, starts_at = v_start, ends_at = v_end, name = trim(p_name),
         phone = trim(coalesce(p_phone, '')), email = lower(trim(coalesce(p_email, ''))), notes = left(coalesce(p_notes, ''), 500)
   where bk.id = b.id;
  delete from public.table_booking_tables where booking_id = b.id;
  insert into public.table_booking_tables (booking_id, table_id) select b.id, unnest(v_tables);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.dining_admin_update(uuid, integer, timestamptz, text, text, text, text, uuid[]) from public, anon;
grant execute on function public.dining_admin_update(uuid, integer, timestamptz, text, text, text, text, uuid[]) to authenticated;
