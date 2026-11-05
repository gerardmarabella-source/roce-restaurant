-- ROCE · Horarios y duración de las mesas
--  · Coffee, Bakery & Kitchen (planta baja): abierto todos los días de 10:00 a 20:00. Última reserva a las 19:00.
--    Consumo medio: 1 h por mesa.
--  · Restaurant & Cocktails (planta alta): comida de 13:00 a 16:00 y cena de 20:00 a 02:00, todos los días.
--    Consumo medio: 1 h 30 min por mesa. Última mesa de la comida a las 14:30 (acaba a las 16:00) y de la cena a las 23:00
--    (acaba a las 00:30, cuando se les invita a bajar a la planta baja).
-- Se puede ejecutar más de una vez.
update public.dining_services set start_min = 600, last_min = 1140, duration_min = 60 where id = 'day';

insert into public.dining_services (id, ambience, name_es, name_en, days, start_min, last_min, slot_min, duration_min, max_party, notice_min, days_ahead, active, zone_ids, grace_min)
select 'night-lunch', 'night', 'Restaurant & Cocktails (comida)', 'Restaurant & Cocktails (lunch)', '{1,2,3,4,5,6,7}', 780, 870, s.slot_min, 90, s.max_party, s.notice_min, s.days_ahead, true, array['alta'], s.grace_min
from public.dining_services s where s.id = 'night'
on conflict (id) do update set start_min = 780, last_min = 870, duration_min = 90, days = '{1,2,3,4,5,6,7}', zone_ids = array['alta'];
update public.dining_services set last_min = 1380, duration_min = 90 where id = 'night';
update public.dining_services set name_es = 'Restaurant & Cocktails (cena)', name_en = 'Restaurant & Cocktails (dinner)' where id = 'night' and name_es = 'Restaurant & Cocktails';
