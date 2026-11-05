-- ROCE · Horarios de reserva
--  · Coffee, Bakery & Kitchen (planta baja): todos los días de 10:00 a 21:00.
--  · Restaurant & Cocktails (planta alta): comida todos los días de 13:00 a 16:00, y cena como hasta ahora.
-- Se puede ejecutar más de una vez.
update public.dining_services set start_min = 600, last_min = 1260 where id = 'day';

insert into public.dining_services (id, ambience, name_es, name_en, days, start_min, last_min, slot_min, duration_min, max_party, notice_min, days_ahead, active, zone_ids, grace_min)
select 'night-lunch', 'night', 'Restaurant & Cocktails (comida)', 'Restaurant & Cocktails (lunch)', '{1,2,3,4,5,6,7}', 780, 960, s.slot_min, s.duration_min, s.max_party, s.notice_min, s.days_ahead, true, array['alta'], s.grace_min
from public.dining_services s where s.id = 'night'
on conflict (id) do update set start_min = 780, last_min = 960, days = '{1,2,3,4,5,6,7}', zone_ids = array['alta'];
update public.dining_services set name_es = 'Restaurant & Cocktails (cena)', name_en = 'Restaurant & Cocktails (dinner)' where id = 'night' and name_es = 'Restaurant & Cocktails';
