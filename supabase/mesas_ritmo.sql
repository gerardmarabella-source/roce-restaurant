-- ROCE · Ritmo de llegadas y tope de comensales por turno (se configura en RoceCover → Mesas → Configuración).
--   · «Máx. comensales por hora de llegada»: suma de todas las reservas que llegan en ese tramo («Hora de llegada cada (min)»).
--   · Si sala mete a mano más del máximo, lo que sobra se descuenta de la hora siguiente (y de la otra, si aún sobra).
--   · «Máx. comensales del turno»: total de la noche; al llegar, todas las horas salen como «Completo».
--   · La web no puede pasarse de ninguno de los dos. Las reservas manuales del equipo cuentan, pero no se bloquean.
--   · Vacío = sin límite (como hasta ahora).
-- Se puede ejecutar más de una vez. Si se vuelve a ejecutar mesas_extras.sql o mesas_espera.sql, hay que volver a ejecutar este.

alter table public.dining_services add column if not exists pace_covers integer;
alter table public.dining_services add column if not exists max_covers integer;
alter table public.dining_services drop constraint if exists dining_services_pace_chk;
alter table public.dining_services add constraint dining_services_pace_chk check (pace_covers is null or pace_covers between 1 and 500);
alter table public.dining_services drop constraint if exists dining_services_covers_chk;
alter table public.dining_services add constraint dining_services_covers_chk check (max_covers is null or max_covers between 1 and 2000);

-- ¿Cabe un grupo de p_party en la hora de llegada p_starts de este turno?
create or replace function public.dining_pace_ok(p_service text, p_starts timestamptz, p_party integer) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  s public.dining_services%rowtype;
  v_date date;
  v_first timestamptz;
  v_idx integer;
  v_total integer;
  v_here integer;
  v_carry integer;
begin
  select * into s from public.dining_services where id = p_service;
  if not found or (s.pace_covers is null and s.max_covers is null) then return true; end if;
  -- Noche a la que pertenece la hora (una llegada a las 00:30 es de la cena del día anterior).
  v_date := ((p_starts at time zone 'Europe/Madrid') - interval '6 hours')::date;

  if s.max_covers is not null then
    select coalesce(sum(b.party), 0) into v_total
      from public.table_bookings b
     where b.service_id = s.id
       and b.starts_at >= (v_date::timestamp + interval '6 hours') at time zone 'Europe/Madrid'
       and b.starts_at <  (v_date::timestamp + interval '30 hours') at time zone 'Europe/Madrid'
       and (b.status = 'completed' or public.dining_holds(b.status, b.hold_until));
    if v_total + p_party > s.max_covers then return false; end if;
  end if;

  if s.pace_covers is null then return true; end if;
  v_first := (v_date::timestamp + make_interval(mins => s.start_min)) at time zone 'Europe/Madrid';
  v_idx := floor(extract(epoch from (p_starts - v_first)) / (s.slot_min * 60));
  -- v_here: lo que ya llega a esta hora. v_carry: lo que sobra de las horas anteriores.
  with a as (
    select floor(extract(epoch from (b.starts_at - v_first)) / (s.slot_min * 60))::integer as i, sum(b.party) as n
      from public.table_bookings b
     where b.ambience = s.ambience
       and b.starts_at >= v_first and b.starts_at < v_first + make_interval(mins => (v_idx + 1) * s.slot_min)
       and (b.status = 'completed' or public.dining_holds(b.status, b.hold_until))
     group by 1
  ), q as (
    select i, n, sum(n) filter (where i < v_idx) over (order by i desc) as run from a
  )
  select coalesce(sum(n) filter (where i = v_idx), 0),
         greatest(0, coalesce(max(run - s.pace_covers * (v_idx - i)) filter (where i < v_idx), 0))
    into v_here, v_carry
    from q;
  return v_carry + v_here + p_party <= s.pace_covers;
end;
$$;
revoke all on function public.dining_pace_ok(text, timestamptz, integer) from public, anon, authenticated;

-- Cierre en el servidor: una reserva web que pase del máximo no entra (book_table ya reserva de una en una).
-- Las del equipo (source 'admin') y las visitas de la app (kind 'walkin') no pasan por aquí.
create or replace function public.dining_pace_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'web' and new.kind is distinct from 'walkin' and not public.dining_pace_ok(new.service_id, new.starts_at, new.party) then
    raise exception 'no_table';
  end if;
  return new;
end;
$$;
revoke all on function public.dining_pace_guard() from public, anon, authenticated;
drop trigger if exists table_bookings_pace on public.table_bookings;
create trigger table_bookings_pace before insert on public.table_bookings for each row execute function public.dining_pace_guard();

-- La web pinta como «Completo» las horas que ya han llegado al máximo (se añade esa condición a las funciones que ya existen).
do $$
declare
  r record;
  def text;
  old_txt constant text := 'p_party, z.id) is not null';
  n integer := 0;
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname in ('dining_slots', 'dining_grid') loop
    def := pg_get_functiondef(r.oid);
    if position('dining_pace_ok' in def) = 0 then
      if position(old_txt in def) = 0 then
        raise exception 'No encuentro la comprobación de mesa libre en %: avísame para revisarlo.', r.proname;
      end if;
      execute replace(def, old_txt, old_txt || ' and public.dining_pace_ok(s.id, v_start, p_party)');
    end if;
    n := n + 1;
  end loop;
  if n < 2 then raise exception 'Faltan dining_slots o dining_grid: avísame para revisarlo.'; end if;
end $$;

-- Grupo más grande que cada turno admite por la web (para avisar al cliente de que escriba).
create or replace function public.dining_web_limits() returns table (o_service text, o_ambience text, o_days integer[], o_max_party integer)
language sql stable security definer set search_path = public as $$
  select s.id, s.ambience, s.days, least(s.max_party, coalesce(s.pace_covers, s.max_party))
    from public.dining_services s where s.active;
$$;
revoke all on function public.dining_web_limits() from public;
grant execute on function public.dining_web_limits() to anon, authenticated;

notify pgrst, 'reload schema';
