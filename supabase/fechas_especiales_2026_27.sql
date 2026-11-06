-- ROCE · Fechas especiales de Navidad, Reyes, San Valentín y Fallas (temporada 2026-27).
-- Cierres y aperturas especiales en la base de datos. No duplica lo que ya exista exactamente igual: se puede ejecutar más de una vez.
-- Turnos: 'day' = Coffee, Bakery & Kitchen · 'night-lunch' = Restaurant & Cocktails (comida) · 'night' = Restaurant & Cocktails (cena).
-- "Abierto hasta las 17:00" = última reserva web a las 16:00 en Coffee, Bakery & Kitchen (la mesa dura 1 h); la comida de R&C acaba a las 16:00.

insert into public.dining_closures (date_from, date_to, service_id, start_min, end_min, message_es, note)
select v.date_from, v.date_to, v.service_id, v.start_min, v.end_min, v.message_es, v.note
from (values
  ('2026-12-24'::date, '2026-12-24'::date, 'day'::text,  990::integer, 2880::integer, 'Nochebuena: hoy abrimos hasta las 17:00.', 'Navidad'),
  ('2026-12-24',       '2026-12-24',       'night',      null,         null,          'Nochebuena: por la noche estamos cerrados.', 'Navidad'),
  ('2026-12-25',       '2026-12-25',       null,         null,         null,          'Navidad: hoy estamos cerrados.', 'Navidad'),
  ('2026-12-31',       '2026-12-31',       'day',        990,          2880,          'Nochevieja: hoy abrimos hasta las 17:00.', 'Nochevieja'),
  ('2026-12-31',       '2026-12-31',       'night',      null,         null,          'Nochevieja: por la noche solo abrimos en preventa.', 'Nochevieja'),
  ('2027-01-01',       '2027-01-01',       null,         null,         null,          'Año Nuevo: hoy estamos cerrados.', 'Año Nuevo'),
  ('2027-01-06',       '2027-01-06',       'day',        990,          2880,          'Reyes: hoy abrimos hasta las 17:00.', 'Reyes'),
  ('2027-01-06',       '2027-01-06',       'night',      null,         null,          'Reyes: por la noche estamos cerrados.', 'Reyes'),
  ('2027-03-15',       '2027-03-19',       'night',      null,         null,          'Fallas: las reservas de cenas son solo por WhatsApp: 614 07 31 63', 'Fallas')
) as v(date_from, date_to, service_id, start_min, end_min, message_es, note)
where not exists (
  select 1 from public.dining_closures c
  where c.date_from = v.date_from and c.date_to = v.date_to and c.service_id is not distinct from v.service_id
    and c.zone_id is null and c.start_min is not distinct from v.start_min and c.end_min is not distinct from v.end_min
);

-- Aperturas especiales: días en que la cena abre aunque por su horario normal (jueves a sábado) estaría cerrada.
insert into public.dining_openings (date_from, date_to, service_id, note)
select v.date_from, v.date_to, v.service_id, v.note
from (values
  ('2027-01-05'::date, '2027-01-05'::date, 'night'::text, 'Víspera de Reyes'),
  ('2027-02-14',       '2027-02-14',       'night',       'San Valentín'),
  ('2027-03-15',       '2027-03-19',       'night',       'Fallas (cenas solo por WhatsApp: el cierre de la web manda)')
) as v(date_from, date_to, service_id, note)
where not exists (
  select 1 from public.dining_openings o
  where o.date_from = v.date_from and o.date_to = v.date_to and o.service_id is not distinct from v.service_id
);
