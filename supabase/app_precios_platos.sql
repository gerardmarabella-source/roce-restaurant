-- ROCE · App de pedidos · Nuevos precios de platos, tostadas, sándwiches, açaí y extras de «Más proteína». Se puede ejecutar más de una vez.
-- El servidor cobra con estos precios (app_create_order lee price_cents de aquí), no con los que se ven en la carta.
update public.app_menu_items as m set price_cents = v.cents
from (values
  ('Platos ROCE|Egg & Egg', 1050),
  ('Platos ROCE|Primitive Chicken', 1550),
  ('Platos ROCE|Citric Nordic', 1750),
  ('Platos ROCE|Muuuuuucho Beef', 1850),
  ('Pokes|Black Rice Chicken', 1350),
  ('Tostadas|003', 1250),
  ('Tostadas|004', 1050),
  ('Sándwiches|Chicken Joe', 1250),
  ('Sándwiches|Liguria', 1350),
  ('Açaí & Yogur|Dark Açaí', 1050),
  ('Açaí & Yogur|Shaka Açaí', 1050),
  ('Extras|Pollo marinado', 450),
  ('Extras|Salmón', 650),
  ('Extras|Atún rojo', 650)
) as v(key, cents)
where m.key = v.key;
