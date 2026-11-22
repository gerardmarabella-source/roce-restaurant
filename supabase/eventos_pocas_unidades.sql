-- «Quedan pocas unidades»: la vista pública de eventos avisa cuando ya se ha vendido el 80 % o más de las plazas
-- (sin enseñar cifras). Se puede ejecutar más de una vez.
create or replace view public.events_public as
select
  e.id, e.env, e.starts_at, e.duration_h,
  e.title_es, e.title_en, e.desc_es, e.desc_en, e.place_es, e.place_en,
  e.price_cents, e.price_label_es, e.price_label_en, e.max_per_order,
  greatest(e.capacity - public.event_taken(e.id), 0)::int as spots_left,
  e.image_url,
  (e.capacity > 0 and public.event_taken(e.id) >= ceil(e.capacity * 0.8) and public.event_taken(e.id) < e.capacity) as low_stock
from public.events e
where e.published
  and e.starts_at + (e.duration_h * interval '1 hour') > now();

grant select on public.events_public to anon, authenticated;
