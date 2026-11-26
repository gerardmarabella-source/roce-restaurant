-- ROCE · App de pedidos: las tostadas se pueden pedir hasta las 12:30 (antes 12:00). Se puede ejecutar más de una vez.
update public.app_menu_items set to_min = 750 where cat = 'Tostadas';
select key, from_min, to_min from public.app_menu_items where cat = 'Tostadas' order by key;
