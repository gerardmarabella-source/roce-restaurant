-- Eventos de noche: qué horas de reserva de cena regalan la entrada al evento.
-- Se puede ejecutar más de una vez. Es solo AÑADIR columnas y ampliar la vista pública; no borra ni cambia nada existente.
--
--   dinner_access   la reserva de cena regala la entrada a este evento (sí / no)
--   dinner_times    horas de reserva que la regalan, p. ej. {20:00,20:30,21:00}; vacío = todas las horas de cena
--   drink_included  la entrada suelta lleva una copa incluida (se dice en el botón de compra)

alter table public.events add column if not exists dinner_access  boolean not null default false;
alter table public.events add column if not exists dinner_times   text[]  not null default '{}';
alter table public.events add column if not exists drink_included boolean not null default false;

-- El evento que ya existía (ROCE Opening Friday) sigue como estaba: la cena regala la entrada a cualquier hora y la entrada suelta lleva copa.
update public.events
   set dinner_access = true, drink_included = true
 where id = 'roce-urban-party-1211' and dinner_access = false;

-- La vista pública enseña los tres datos (las columnas nuevas van al final, como exige Postgres).
create or replace view public.events_public as
select
  e.id, e.env, e.starts_at, e.duration_h,
  e.title_es, e.title_en, e.desc_es, e.desc_en, e.place_es, e.place_en,
  e.price_cents, e.price_label_es, e.price_label_en, e.max_per_order,
  greatest(e.capacity - public.event_taken(e.id), 0)::int as spots_left,
  e.image_url,
  (e.capacity > 0 and public.event_taken(e.id) >= ceil(e.capacity * 0.8) and public.event_taken(e.id) < e.capacity) as low_stock,
  e.dinner_access, e.dinner_times, e.drink_included
from public.events e
where e.published
  and e.starts_at + (e.duration_h * interval '1 hour') > now();

grant select on public.events_public to anon, authenticated;
