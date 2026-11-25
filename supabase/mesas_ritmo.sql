-- ROCE · Ritmo de llegadas: máximo de comensales que pueden reservar por la web a cada hora de llegada.
-- Se configura por turno en RoceCover (Mesas → Configuración): «Hora de llegada cada (min)» + «Máx. comensales por hora de llegada».
--   · Ejemplo cena: cada 10 min y máximo 10 → a las 21:00 entran 10 personas como mucho, a las 21:10 otras 10, etc.
--   · Cuentan todas las reservas vivas que llegan en ese tramo (web y manuales). Las manuales del equipo no se bloquean.
--   · Un grupo mayor que el máximo solo puede reservar una hora en la que todavía no llegue nadie.
--   · Vacío = sin límite (como hasta ahora).
-- Se puede ejecutar más de una vez. Si se vuelve a ejecutar mesas_extras.sql o mesas_espera.sql, hay que volver a ejecutar este.

alter table public.dining_services add column if not exists pace_covers integer;
alter table public.dining_services drop constraint if exists dining_services_pace_chk;
alter table public.dining_services add constraint dining_services_pace_chk check (pace_covers is null or pace_covers between 1 and 500);

-- ¿Cabe un grupo de p_party en la hora de llegada p_starts de este turno?
create or replace function public.dining_pace_ok(p_service text, p_starts timestamptz, p_party integer) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  s public.dining_services%rowtype;
  v_used integer;
begin
  select * into s from public.dining_services where id = p_service;
  if not found or s.pace_covers is null then return true; end if;
  select coalesce(sum(b.party), 0) into v_used
    from public.table_bookings b
   where b.ambience = s.ambience
     and b.starts_at >= p_starts and b.starts_at < p_starts + make_interval(mins => s.slot_min)
     and public.dining_holds(b.status, b.hold_until);
  return v_used = 0 or v_used + p_party <= s.pace_covers;
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

notify pgrst, 'reload schema';
