-- ROCE · App de pedidos · Bebidas nuevas (cervezas, vermuts, refrescos y aguas) en la hoja «Drinks». Se puede ejecutar más de una vez.
-- Los precios de aquí son los de la carta; en cuanto una bebida se enlaza con Ágora (la función agora-sync lo hace sola por el nombre), manda Ágora.
insert into public.app_menu_items (key, cat, name, price_cents, station, extras, variants, from_min, to_min, sort) values
  ('Cervezas|Alhambra Reserva 1925', 'Cervezas', 'Alhambra Reserva 1925', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 101),
  ('Cervezas|Alhambra Reserva Roja', 'Cervezas', 'Alhambra Reserva Roja', 400, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 102),
  ('Cervezas|Mahou 5 Estrellas', 'Cervezas', 'Mahou 5 Estrellas', 330, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 103),
  ('Cervezas|Mahou Reserva', 'Cervezas', 'Mahou Reserva', 380, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 104),
  ('Cervezas|Mahou Session IPA', 'Cervezas', 'Mahou Session IPA', 400, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 105),
  ('Cervezas|Mahou Sin Gluten', 'Cervezas', 'Mahou Sin Gluten', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 106),
  ('Cervezas|Mahou 0,0 Tostada', 'Cervezas', 'Mahou 0,0 Tostada', 330, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 107),
  ('Vermuts|Vermut casero ROCE', 'Vermuts', 'Vermut casero ROCE', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 108),
  ('Vermuts|Martini Rosso', 'Vermuts', 'Martini Rosso', 450, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 109),
  ('Vermuts|Martini Bianco', 'Vermuts', 'Martini Bianco', 450, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 110),
  ('Vermuts|Martini Fiero', 'Vermuts', 'Martini Fiero', 500, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 111),
  ('Vermuts|Martini Rosato', 'Vermuts', 'Martini Rosato', 450, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 112),
  ('Refrescos|Pepsi', 'Refrescos', 'Pepsi', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 113),
  ('Refrescos|Pepsi 0', 'Refrescos', 'Pepsi 0', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 114),
  ('Refrescos|Kas Limón', 'Refrescos', 'Kas Limón', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 115),
  ('Refrescos|Kas Naranja', 'Refrescos', 'Kas Naranja', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 116),
  ('Refrescos|Aquarade Limón', 'Refrescos', 'Aquarade Limón', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 117),
  ('Refrescos|Aquarade Naranja', 'Refrescos', 'Aquarade Naranja', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 118),
  ('Refrescos|7UP', 'Refrescos', '7UP', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 119),
  ('Refrescos|Lipton', 'Refrescos', 'Lipton', 350, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 120),
  ('Aguas|Solán de Cabras 0,5 L', 'Aguas', 'Solán de Cabras 0,5 L', 250, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 121),
  ('Aguas|Solán de Cabras con gas 0,5 L', 'Aguas', 'Solán de Cabras con gas 0,5 L', 280, 'bar', '[]'::jsonb, '[]'::jsonb, null, null, 122)
on conflict (key) do update set cat = excluded.cat, name = excluded.name, station = excluded.station, sort = excluded.sort;
