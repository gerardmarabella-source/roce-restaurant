-- Horario de la app de pedidos: solo de 9:00 a 20:00, hora de España (Madrid), pida desde donde pida.
-- Lo comprueba el servidor al crear el pedido (no solo la pantalla). El personal con la pestaña «orders» puede probar a cualquier hora.
-- Se puede ejecutar más de una vez.
create or replace function public.app_orders_store_hours() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_min integer := extract(hour from (now() at time zone 'Europe/Madrid'))::int * 60 + extract(minute from (now() at time zone 'Europe/Madrid'))::int;
begin
  if (v_min < 540 or v_min >= 1200) and not coalesce(public.has_tab('orders'), false) then
    raise exception 'store_closed';
  end if;
  return new;
end $$;

create or replace trigger app_orders_store_hours before insert on public.app_orders
  for each row execute function public.app_orders_store_hours();
