-- ROCE · Aperturas especiales (abrir un día que de base está cerrado) y horizonte de reservas de la web.
-- Se puede ejecutar más de una vez. Ejecútalo después de mesas_calendario.sql.

create table if not exists public.dining_openings (
  id         uuid primary key default gen_random_uuid(),
  date_from  date not null,
  date_to    date not null,
  service_id text references public.dining_services(id) on delete cascade,   -- vacío = todos los turnos
  note       text not null default '',
  created_at timestamptz not null default now(),
  check (date_to >= date_from)
);
alter table public.dining_openings enable row level security;
drop policy if exists dining_openings_read on public.dining_openings;
create policy dining_openings_read on public.dining_openings for select to authenticated using (public.has_tab('tables'));
drop policy if exists dining_openings_write on public.dining_openings;
create policy dining_openings_write on public.dining_openings for all to authenticated using (public.has_tab('tables_config')) with check (public.has_tab('tables_config'));

-- ¿Funciona este turno ese día? Sí si ese día de la semana está en sus días, o si hay una apertura especial.
create or replace function public.dining_runs(p_date date, p_service text, p_days integer[]) returns boolean
language sql stable security definer set search_path = public as $$
  select extract(isodow from p_date)::integer = any (p_days)
      or exists (select 1 from public.dining_openings o
                 where p_date between o.date_from and o.date_to and (o.service_id is null or o.service_id = p_service));
$$;
revoke all on function public.dining_runs(date, text, integer[]) from public;
grant execute on function public.dining_runs(date, text, integer[]) to anon, authenticated;

-- Hasta cuántos días vista se puede reservar (el mayor de los turnos activos): lo usa el calendario de la web.
create or replace function public.dining_horizon() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(max(days_ahead), 60) from public.dining_services where active;
$$;
revoke all on function public.dining_horizon() from public;
grant execute on function public.dining_horizon() to anon, authenticated;

-- Las funciones que deciden qué turnos hay cada día pasan a usar dining_runs (se reescriben cambiando solo esa condición).
do $$
declare
  r record;
  def text;
  newdef text;
begin
  for r in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace
           and p.proname in ('dining_slot_date', 'dining_slots', 'dining_grid', 'dining_calendar') loop
    def := pg_get_functiondef(r.oid);
    newdef := replace(replace(replace(def,
      'extract(isodow from d)::integer = any (s.days)', 'public.dining_runs(d, s.id, s.days)'),
      'extract(isodow from p_date)::integer = any (days)', 'public.dining_runs(p_date, id, days)'),
      'extract(isodow from d)::integer = any (days)', 'public.dining_runs(d, id, days)');
    if newdef <> def then execute newdef; end if;
  end loop;
  -- Comprobación: ninguna de las cuatro debe seguir con la condición antigua.
  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
             and p.proname in ('dining_slot_date', 'dining_slots', 'dining_grid', 'dining_calendar')
             and (pg_get_functiondef(p.oid) like '%extract(isodow from p_date)::integer = any (days)%'
               or pg_get_functiondef(p.oid) like '%extract(isodow from d)::integer = any (s.days)%'
               or pg_get_functiondef(p.oid) like '%extract(isodow from d)::integer = any (days)%')) then
    raise exception 'No he podido actualizar alguna función de horarios: avísame para revisarlo.';
  end if;
end $$;
