-- El Trío: el cliente reparte 3 tacos entre Pollo, Pato Pekín y Costilla (puede repetir).
-- La app envía la variante como el reparto, p. ej. «2× Pollo + 1× Costilla»; hay que dejar esas 10 combinaciones como variantes válidas.
-- Ejecutar una sola vez en el SQL Editor de Supabase (es seguro repetirlo). No toca el precio ni el resto de la carta.
update public.app_menu_items
set variants = '["3× Pollo", "2× Pollo + 1× Pato Pekín", "2× Pollo + 1× Costilla", "1× Pollo + 2× Pato Pekín", "1× Pollo + 1× Pato Pekín + 1× Costilla", "1× Pollo + 2× Costilla", "3× Pato Pekín", "2× Pato Pekín + 1× Costilla", "1× Pato Pekín + 2× Costilla", "3× Costilla"]'::jsonb
where key = 'Starters|El Trío';
