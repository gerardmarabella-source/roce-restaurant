-- Pedido programado: con la app cerrada (fuera de 10:00-20:00, hora de España) se puede dejar el pedido hecho y pagado, SOLO PARA RECOGER,
-- para que esté listo a partir de las 10:00. Hasta esa hora no se envía a Ágora (la cocina no lo ve antes de abrir).
-- Cuatro cambios, todos seguros de repetir:
--   1) columna app_orders.scheduled_at (cuándo empieza a prepararse; NULL = pedido normal).
--   2) app_orders_store_hours: fuera de horario ya no rechaza los pedidos «recoger»: los programa para las 10:00; los de mesa siguen rechazados.
--   3) app_create_order: las reglas de horario de cada plato (Tostadas hasta las 12:00, Starters desde las 12:00…) se evalúan a las 10:00 si es un pedido programado.
--   4) app_agora_claim: no envía a Ágora los pedidos programados hasta que llega su hora (el barrido de cada minuto los recoge a las 10:00).

alter table public.app_orders add column if not exists scheduled_at timestamptz;

create or replace function public.app_orders_store_hours() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_local timestamp := now() at time zone 'Europe/Madrid';
  v_min integer := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
begin
  if (v_min < 600 or v_min >= 1200) and not coalesce(public.has_tab('orders'), false) then
    if new.mode = 'recoger' then
      new.scheduled_at := (date_trunc('day', v_local) + case when v_min < 600 then interval '10 hours' else interval '1 day 10 hours' end) at time zone 'Europe/Madrid';
    else
      raise exception 'store_closed';
    end if;
  end if;
  return new;
end $$;

do $$
declare d text; d2 text;
begin
  -- 3) app_create_order: hora de referencia = 10:00 fuera de horario
  select pg_get_functiondef(oid) into d from pg_proc where proname = 'app_create_order' and pronamespace = 'public'::regnamespace;
  if d is null then raise exception 'no existe app_create_order'; end if;
  if position('v_min := 600' in d) = 0 then
    d2 := regexp_replace(d, '(v_min := [^;]*;)', E'\\1\n  if v_min < 600 or v_min >= 1200 then v_min := 600; end if;');
    if d2 = d then raise exception 'no se encontro la linea de v_min en app_create_order'; end if;
    execute d2;
  end if;

  -- 4) app_agora_claim: los pedidos programados esperan a su hora
  select pg_get_functiondef(oid) into d from pg_proc where proname = 'app_agora_claim' and pronamespace = 'public'::regnamespace;
  if d is null then raise exception 'no existe app_agora_claim'; end if;
  if position('scheduled_at' in d) = 0 then
    d2 := replace(d, 'o.agora_status = ''pending''', '(o.agora_status = ''pending'' and (o.scheduled_at is null or o.scheduled_at <= now()))');
    if d2 = d then raise exception 'no se encontro la condicion agora_status en app_agora_claim'; end if;
    execute d2;
  end if;
end $$;
