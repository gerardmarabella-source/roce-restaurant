-- ROCE · Horarios de reserva
--  · Coffee, Bakery & Kitchen (planta baja): abierto todos los días de 10:00 a 20:00.
--  · Restaurant & Cocktails (planta alta): comida de 13:00 a 16:00 y cena de 20:00 a 02:00, todos los días.
-- La última mesa de cada turno es la que termina justo al cerrar (1 h 45 min antes): 18:00 abajo, 14:00 en la comida
-- y 22:30 en la cena (a las 00:30 se les invita a bajar).
-- Se puede ejecutar más de una vez.
update public.dining_services set start_min = 600, last_min = 1080 where id = 'day';

insert into public.dining_services (id, ambience, name_es, name_en, days, start_min, last_min, slot_min, duration_min, max_party, notice_min, days_ahead, active, zone_ids, grace_min)
select 'night-lunch', 'night', 'Restaurant & Cocktails (comida)', 'Restaurant & Cocktails (lunch)', '{1,2,3,4,5,6,7}', 780, 840, s.slot_min, s.duration_min, s.max_party, s.notice_min, s.days_ahead, true, array['alta'], s.grace_min
from public.dining_services s where s.id = 'night'
on conflict (id) do update set start_min = 780, last_min = 840, days = '{1,2,3,4,5,6,7}', zone_ids = array['alta'];
update public.dining_services set name_es = 'Restaurant & Cocktails (cena)', name_en = 'Restaurant & Cocktails (dinner)' where id = 'night' and name_es = 'Restaurant & Cocktails';
