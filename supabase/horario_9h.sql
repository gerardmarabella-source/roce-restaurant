-- Nuevo horario de Coffee, Bakery & Kitchen: abre a las 9:00 (antes 10:00), hasta las 20:00, hora de España.
-- 1) La app de pedidos: el servidor rechaza pedidos antes de las 9:00 (trigger app_orders_store_hours).
-- 2) Las reservas de mesa: el servicio «Day» empieza a las 9:00 (540 min).
-- 3) Platos de la carta que tuvieran «desde las 10:00» propio pasan a las 9:00.
-- Se puede ejecutar más de una vez.
do $$
declare d text;
begin
  select pg_get_functiondef('public.app_orders_store_hours()'::regprocedure) into d;
  if d like '%v_min < 600%' then
    execute replace(d, 'v_min < 600', 'v_min < 540');
  elsif d not like '%v_min < 540%' then
    raise exception 'app_orders_store_hours: no encuentro la comprobación de las 10:00 (revisar a mano)';
  end if;
end $$;

update public.dining_services set start_min = 540 where id = 'day' and start_min = 600;
update public.app_menu_items set from_min = 540 where from_min = 600;
