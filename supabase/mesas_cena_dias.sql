-- ROCE · La cena de Restaurant & Cocktails abre de miércoles a sábado (isodow 3 = miércoles … 6 = sábado).
-- Antes solo estaba marcada de jueves a sábado. La comida (night-lunch) y Coffee, Bakery & Kitchen (day) abren todos los días.
update public.dining_services set days = '{3,4,5,6}' where id = 'night';
