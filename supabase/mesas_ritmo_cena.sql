-- ROCE · Valores de la cena. Ejecutar UNA vez, después de mesas_ritmo.sql (luego se cambian desde RoceCover).
-- Llegadas de 20:00 a 22:50 cada 10 minutos, hasta 6 comensales en cada una y 100 en total por noche.
update public.dining_services
   set start_min = 1200, last_min = 1370, slot_min = 10, pace_covers = 6, max_party = 6, max_covers = 100
 where id = 'night';
