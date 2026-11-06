-- ROCE · El calendario también marca los días en que algún turno está cerrado (p. ej. la cena de un domingo).
-- Antes solo marcaba los turnos completos. Ahora: punto = algún turno completo O cerrado; el aviso dice cuáles.
-- Se puede ejecutar más de una vez. Ejecútalo después de mesas_aperturas.sql.
drop function if exists public.dining_calendar(date, date, integer, text);
create function public.dining_calendar(p_from date, p_to date, p_party integer, p_ambience text default null)
returns table (o_date date, o_state text, o_full_es text[], o_full_en text[], o_closed_es text[], o_closed_en text[])
language plpgsql stable security definer set search_path = public as $$
declare
  d date;
  s public.dining_services%rowtype;
  r record;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_open boolean; v_any_free boolean; v_any_slots boolean;
  v_fe text[]; v_fn text[]; v_ce text[]; v_cn text[];
  v_zone_open boolean; v_zone_manual boolean;
begin
  if p_from is null or p_to is null or p_party is null or p_party < 1 then return; end if;
  for d in select g::date from generate_series(greatest(p_from, v_today), least(p_to, greatest(p_from, v_today) + 62), interval '1 day') g loop
    v_open := false; v_any_free := false; v_any_slots := false; v_fe := '{}'; v_fn := '{}'; v_ce := '{}'; v_cn := '{}';
    for s in select * from public.dining_services
             where active and (p_ambience is null or ambience = p_ambience) and p_party <= max_party and d <= v_today + days_ahead
             order by start_min loop
      -- Turno que ese día de la semana no abre (p. ej. la cena de un domingo): cerrado.
      if not public.dining_runs(d, s.id, s.days) then
        v_ce := v_ce || s.name_es; v_cn := v_cn || (case when s.name_en <> '' then s.name_en else s.name_es end);
        continue;
      end if;
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
          if r.f > 0 then v_any_free := true; else v_fe := v_fe || s.name_es; v_fn := v_fn || (case when s.name_en <> '' then s.name_en else s.name_es end); end if;
        end if;
      elsif coalesce(v_zone_manual, false) then
        v_open := true; v_any_slots := true;
        v_fe := v_fe || s.name_es; v_fn := v_fn || (case when s.name_en <> '' then s.name_en else s.name_es end);
      else
        -- Cerrado por un cierre de ese día.
        v_ce := v_ce || s.name_es; v_cn := v_cn || (case when s.name_en <> '' then s.name_en else s.name_es end);
      end if;
    end loop;
    o_date := d; o_full_es := v_fe; o_full_en := v_fn; o_closed_es := v_ce; o_closed_en := v_cn;
    o_state := case when not v_open then 'closed'
                    when not v_any_slots then 'none'
                    when not v_any_free then 'full'
                    when cardinality(v_fe) > 0 or cardinality(v_ce) > 0 then 'partial'
                    else 'open' end;
    return next;
  end loop;
end;
$$;
revoke all on function public.dining_calendar(date, date, integer, text) from public;
grant execute on function public.dining_calendar(date, date, integer, text) to anon, authenticated;
