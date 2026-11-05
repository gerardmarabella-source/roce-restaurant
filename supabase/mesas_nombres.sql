-- ROCE · Nombres de los dos espacios en las reservas de mesa (los ven el panel y los emails)
update public.dining_services set name_es = 'Coffee, Bakery & Kitchen', name_en = 'Coffee, Bakery & Kitchen' where id = 'day' and name_es = 'Day';
update public.dining_services set name_es = 'Restaurant & Cocktails', name_en = 'Restaurant & Cocktails' where id = 'night' and name_es = 'Night';
