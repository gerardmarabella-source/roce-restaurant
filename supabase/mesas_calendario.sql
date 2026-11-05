-- ROCE · Calendario de la web con días cerrados, completos y con algún turno completo.
-- Se puede ejecutar más de una vez. Ejecútalo después de mesas_cuentas.sql y permisos_finos.sql.

-- Un cierre puede ser "cerrado" (no abrimos) o "completo" (no se admiten más reservas web aunque queden mesas).
alter table public.dining_closures add column if not exists kind text not null default 'closed';
alter table public.dining_closures drop constraint if exists dining_closures_kind_check;
alter table public.dining_closures add constraint dining_closures_kind_check check (kind in ('closed', 'full'));

-- Estado de cada día para un número de personas:
--   closed  = ese día no abrimos          full    = sin mesas (o marcado completo) en todos los turnos
--   partial = algún turno completo y otro con sitio     open = hay sitio en todos los turnos
--   none    = nada que ofrecer (p. ej. hoy ya pasó la hora)
-- o_full = nombres de los turnos completos (para avisar en el calendario).
drop function if exists public.dining_calendar(date, date, integer);
drop function if exists public.dining_calendar(date, date, integer, text);
create function public.dining_calendar(p_from date, p_to date, p_party integer, p_ambience text default null)
returns table (o_date date, o_state text, o_full_es text[], o_full_en text[])
language plpgsql stable security definer set search_path = public as $$
declare
  d date;
  s public.dining_services%rowtype;
  r record;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_open boolean; v_any_free boolean; v_any_slots boolean; v_manual_full boolean;
  v_fe text[]; v_fn text[];
  v_zone_open boolean; v_zone_manual boolean;
begin
  if p_from is null or p_to is null or p_party is null or p_party < 1 then return; end if;
  for d in select g::date from generate_series(greatest(p_from, v_today), least(p_to, greatest(p_from, v_today) + 62), interval '1 day') g loop
    v_open := false; v_any_free := false; v_any_slots := false; v_manual_full := false; v_fe := '{}'; v_fn := '{}';
    for s in select * from public.dining_services
             where active and (p_ambience is null or ambience = p_ambience) and extract(isodow from d)::integer = any (days) and p_party <= max_party and d <= v_today + days_ahead
             order by start_min loop
      -- ¿Alguna zona de este turno abre ese día? (si no, o está cerrado o marcado completo a mano)
      select bool_or(not public.dining_closed(d, s.id, z.id)), bool_or(public.dining_closed(d, s.id, z.id) and exists (
               select 1 from public.dining_closures c where c.kind = 'full' and d between c.date_from and c.date_to
                 and (c.service_id is null or c.service_id = s.id) and (c.zone_id is null or c.zone_id = z.id)
                 and c.start_min is null and c.end_min is null))
        into v_zone_open, v_zone_manual
        from public.dining_zones z where z.active and (s.zone_ids is null or z.id = any (s.zone_ids));
      if coalesce(v_zone_open, false) then
        v_open := true;
        select count(*) as c, count(*) filter (where g.o_free) as f into r from public.dining_grid(d, p_party, s.ambience) g where g.o_service = s.id;
        if r.c > 0 then
          v_any_slots := true;
          if r.f > 0 then v_any_free := true; else v_fe := v_fe || s.name_es; v_fn := v_fn || case when s.name_en <> '' then s.name_en else s.name_es end; end if;
        end if;
      elsif coalesce(v_zone_manual, false) then
        v_open := true; v_any_slots := true; v_manual_full := true;
        v_fe := v_fe || s.name_es; v_fn := v_fn || case when s.name_en <> '' then s.name_en else s.name_es end;
      end if;
    end loop;
    o_date := d; o_full_es := v_fe; o_full_en := v_fn;
    o_state := case when not v_open then 'closed'
                    when not v_any_slots then 'none'
                    when not v_any_free then 'full'
                    when cardinality(v_fe) > 0 then 'partial'
                    else 'open' end;
    return next;
  end loop;
end;
$$;
revoke all on function public.dining_calendar(date, date, integer, text) from public;
grant execute on function public.dining_calendar(date, date, integer, text) to anon, authenticated;
