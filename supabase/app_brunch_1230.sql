-- ROCE · App de pedidos: toda la comida de la carta de brunch se pide hasta las 12:30 (desde la apertura, 9:00).
-- Café y bebidas, todo el día. Los platos ocultos en la app (Forest Walk, Primitive Chicken, Citric Nordic,
-- Muuuuuucho Beef, Starters y Acompañamientos) no se tocan. Se puede ejecutar más de una vez.
update public.app_menu_items
   set from_min = null, to_min = 750
 where cat in ('Tostadas', 'Açaí & Yogur', 'Sándwiches', 'Pokes', 'Platos ROCE', 'Extras')
   and key not in ('Pokes|Forest Walk', 'Platos ROCE|Primitive Chicken', 'Platos ROCE|Citric Nordic', 'Platos ROCE|Muuuuuucho Beef');
select cat, count(*) as platos, array_agg(distinct from_min) as desde, array_agg(distinct to_min) as hasta
  from public.app_menu_items where cat in ('Tostadas', 'Açaí & Yogur', 'Sándwiches', 'Pokes', 'Platos ROCE', 'Extras') group by cat order by cat;
