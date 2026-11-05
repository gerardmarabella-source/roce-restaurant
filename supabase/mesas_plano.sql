-- ROCE · Mesas reales según los planos (planta baja, planta alta y sala privé)
-- (ejecutar DESPUÉS de mesas.sql)
-- Pegar en Supabase → SQL Editor → Run. Sustituye las 16 mesas de ejemplo (solo si no tienen reservas).
-- Cada mesa lleva su posición en el plano (en % del dibujo) para el mapa del panel.

alter table public.dining_tables add column if not exists pos_x numeric;
alter table public.dining_tables add column if not exists pos_y numeric;
alter table public.dining_tables add column if not exists shape text not null default 'square';

-- La sala privé (terraza cubierta) no se reserva desde la web: la asigna el equipo desde el panel.
insert into public.dining_zones (id, name_es, name_en, deposit_cents, deposit_per_person, free_cancel_hours, active, sort)
values ('prive', 'Sala privé', 'Private room', 0, false, 24, false, 3)
on conflict (id) do nothing;

delete from public.dining_tables t where not exists (select 1 from public.table_booking_tables b where b.table_id = t.id);

insert into public.dining_tables (zone_id, name, seats_min, seats_max, combine_group, pos_x, pos_y, shape, sort) values
  ('baja', 'P1', 1, 2, 'pared-1', 31.3, 14.4, 'bench', 1),
  ('baja', 'P2', 1, 2, 'pared-1', 33.6, 14.4, 'bench', 2),
  ('baja', 'P3', 1, 2, 'pared-1', 37.3, 14.4, 'bench', 3),
  ('baja', 'P4', 1, 2, 'pared-1', 39.6, 14.4, 'bench', 4),
  ('baja', 'P5', 1, 2, 'pared-2', 47.4, 14.4, 'bench', 5),
  ('baja', 'P6', 1, 2, 'pared-2', 49.6, 14.4, 'bench', 6),
  ('baja', 'P7', 1, 2, 'pared-2', 55.6, 14.4, 'bench', 7),
  ('baja', 'P8', 1, 2, 'pared-2', 57.8, 14.4, 'bench', 8),
  ('baja', 'P9', 1, 2, 'pared-3', 64.1, 14.4, 'bench', 9),
  ('baja', 'P10', 1, 2, 'pared-3', 66.4, 14.4, 'bench', 10),
  ('baja', 'P11', 1, 2, 'pared-3', 71.0, 14.4, 'bench', 11),
  ('baja', 'P12', 1, 2, 'pared-3', 73.3, 14.4, 'bench', 12),
  ('baja', 'M1', 1, 4, 'suelo-izq', 32.4, 22.5, 'square', 13),
  ('baja', 'M2', 1, 4, 'suelo-izq', 38.2, 22.5, 'square', 14),
  ('baja', 'M3', 1, 4, 'suelo-izq', 35.2, 30.6, 'square', 15),
  ('baja', 'M4', 1, 4, 'suelo-centro', 48.3, 21.7, 'square', 16),
  ('baja', 'M5', 1, 4, 'suelo-centro', 53.8, 22.0, 'square', 17),
  ('baja', 'M6', 1, 4, 'suelo-der', 64.8, 22.7, 'square', 18),
  ('baja', 'M7', 1, 4, 'suelo-der', 72.7, 23.1, 'square', 19),
  ('baja', 'M8', 1, 4, 'suelo-der', 69.2, 28.5, 'square', 20),
  ('alta', 'P1', 1, 2, 'pared-izq-1', 18.1, 26.8, 'bench', 21),
  ('alta', 'P2', 1, 2, 'pared-izq-1', 20.5, 26.8, 'bench', 22),
  ('alta', 'P3', 1, 2, 'pared-izq-1', 24.8, 26.8, 'bench', 23),
  ('alta', 'P4', 1, 2, 'pared-izq-1', 27.2, 26.8, 'bench', 24),
  ('alta', 'P5', 1, 2, 'pared-izq-2', 31.4, 26.8, 'bench', 25),
  ('alta', 'P6', 1, 2, 'pared-izq-2', 33.9, 26.8, 'bench', 26),
  ('alta', 'P7', 1, 2, 'pared-izq-2', 38.1, 26.8, 'bench', 27),
  ('alta', 'P8', 1, 2, 'pared-izq-2', 40.5, 26.8, 'bench', 28),
  ('alta', 'P9', 1, 2, 'pared-der', 65.6, 26.8, 'bench', 29),
  ('alta', 'P10', 1, 2, 'pared-der', 67.9, 26.8, 'bench', 30),
  ('alta', 'P11', 1, 2, 'pared-der', 72.0, 26.8, 'bench', 31),
  ('alta', 'P12', 1, 2, 'pared-der', 74.5, 26.8, 'bench', 32),
  ('alta', 'P13', 1, 2, 'pared-der', 78.7, 26.8, 'bench', 33),
  ('alta', 'P14', 1, 2, 'pared-der', 81.2, 26.8, 'bench', 34),
  ('alta', 'P15', 1, 2, 'pared-der', 85.4, 26.8, 'bench', 35),
  ('alta', 'M1', 1, 4, 'comedor-3', 32.1, 38.4, 'square', 36),
  ('alta', 'M2', 1, 4, 'comedor-3', 38.2, 38.5, 'square', 37),
  ('alta', 'M3', 1, 4, 'comedor-3', 30.1, 51.7, 'square', 38),
  ('alta', 'L1', 6, 12, '', 20.9, 47.6, 'long', 39),
  ('alta', 'C1', 3, 6, 'comedor-2', 79.9, 36.3, 'rect', 40),
  ('alta', 'C2', 3, 6, 'comedor-2', 88.4, 36.3, 'rect', 41),
  ('alta', 'C3', 3, 6, 'comedor-2', 88.6, 46.7, 'rect', 42),
  ('alta', 'B1', 1, 3, '', 70.6, 42.3, 'bar', 43),
  ('alta', 'S1', 2, 5, '', 88.6, 55.7, 'sofa', 44),
  ('prive', 'PR1', 4, 8, '', 9.0, 73.6, 'round', 45)
on conflict (zone_id, name) do update
  set seats_min = excluded.seats_min, seats_max = excluded.seats_max, combine_group = excluded.combine_group,
      pos_x = excluded.pos_x, pos_y = excluded.pos_y, shape = excluded.shape, sort = excluded.sort;
