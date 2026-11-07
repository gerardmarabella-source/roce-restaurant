-- ROCE · App de pedidos: los extras de proteína («Más proteína») se piden todo el día (antes solo desde las 12:00). Se puede ejecutar más de una vez.
update public.app_menu_items set from_min = null, to_min = null where cat = 'Extras';
