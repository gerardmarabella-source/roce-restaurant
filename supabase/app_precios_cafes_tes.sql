-- ROCE · App de pedidos · Nuevos precios de cafés, tés e infusiones (y suplemento Vegetal barista). Se puede ejecutar más de una vez.
-- El servidor cobra con estos precios (app_create_order lee price_cents y los suplementos de aquí), no con los que se ven en la carta.
update public.app_menu_items as m set price_cents = v.cents
from (values
  ('Cafés|Espresso', 220), ('Cafés|Double espresso', 300), ('Cafés|Cortado', 240), ('Cafés|Americano', 270),
  ('Cafés|Latte', 350), ('Cafés|Flat white', 380), ('Cafés|Mocca latte', 450),
  ('Matcha & Tés|Té verde', 280), ('Matcha & Tés|Té negro', 280), ('Matcha & Tés|Té rojo', 280), ('Matcha & Tés|Rooibos', 280),
  ('Matcha & Tés|Manzanilla', 250), ('Matcha & Tés|Menta poleo', 250), ('Matcha & Tés|Digestivo', 250)
) as v(key, cents)
where m.key = v.key;

-- Suplemento «Vegetal barista»: de 0,30 € a 0,50 € en todos los cafés.
update public.app_menu_items
   set extras = (select coalesce(jsonb_agg(case when e ->> 'k' = 'Vegetal barista' then jsonb_set(e, '{cents}', '50') else e end order by o), '[]'::jsonb)
                   from jsonb_array_elements(extras) with ordinality as t(e, o))
 where cat = 'Cafés';
