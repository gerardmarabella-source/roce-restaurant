-- ROCE · App de pedidos · Los sándwiches se piden todo el día (antes solo desde las 12:00). Se puede ejecutar más de una vez.
-- El servidor valida el horario de cada plato al crear el pedido (app_create_order): sin este cambio rechazaría un sándwich pedido por la mañana.
update public.app_menu_items set from_min = null where cat = 'Sándwiches';
