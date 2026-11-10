-- ⚠ YA EJECUTADO EN PRODUCCIÓN. NO VOLVER A EJECUTAR: borra y recrea mesas y recoloca el plano.
-- Los nombres de este archivo son los vigentes desde el 10-11-2026 (planta baja 1–20; planta alta 1–28; la sala privé sigue siendo PR1),
-- según los planos de RoceCover. Antes eran P1–P12/M1–M8 (baja) y P/M/L/C/S/V/R (alta).
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
  ('baja', '12', 1, 2, 'pared-1', 31.3, 14.4, 'bench', 1),
  ('baja', '11', 1, 2, 'pared-1', 33.6, 14.4, 'bench', 2),
  ('baja', '10', 1, 2, 'pared-1', 37.3, 14.4, 'bench', 3),
  ('baja', '9', 1, 2, 'pared-1', 39.6, 14.4, 'bench', 4),
  ('baja', '8', 1, 2, 'pared-2', 47.4, 14.4, 'bench', 5),
  ('baja', '7', 1, 2, 'pared-2', 49.6, 14.4, 'bench', 6),
  ('baja', '6', 1, 2, 'pared-2', 55.6, 14.4, 'bench', 7),
  ('baja', '5', 1, 2, 'pared-2', 57.8, 14.4, 'bench', 8),
  ('baja', '4', 1, 2, 'pared-3', 64.1, 14.4, 'bench', 9),
  ('baja', '3', 1, 2, 'pared-3', 66.4, 14.4, 'bench', 10),
  ('baja', '2', 1, 2, 'pared-3', 71.0, 14.4, 'bench', 11),
  ('baja', '1', 1, 2, 'pared-3', 73.3, 14.4, 'bench', 12),
  ('baja', '13', 1, 4, 'suelo-izq', 32.4, 22.5, 'square', 13),
  ('baja', '15', 1, 4, 'suelo-izq', 38.2, 22.5, 'square', 14),
  ('baja', '14', 1, 4, 'suelo-izq', 35.2, 30.6, 'square', 15),
  ('baja', '16', 1, 4, 'suelo-centro', 48.3, 21.7, 'square', 16),
  ('baja', '17', 1, 4, 'suelo-centro', 53.8, 22.0, 'square', 17),
  ('baja', '18', 1, 4, 'suelo-der', 64.8, 22.7, 'square', 18),
  ('baja', '20', 1, 4, 'suelo-der', 72.7, 23.1, 'square', 19),
  ('baja', '19', 1, 4, 'suelo-der', 69.2, 28.5, 'square', 20),
  ('alta', '15', 1, 2, 'pared-izq-1', 18.1, 26.8, 'bench', 21),
  ('alta', '14', 1, 2, 'pared-izq-1', 20.5, 26.8, 'bench', 22),
  ('alta', '13', 1, 2, 'pared-izq-1', 24.8, 26.8, 'bench', 23),
  ('alta', '12', 1, 2, 'pared-izq-1', 27.2, 26.8, 'bench', 24),
  ('alta', '11', 1, 2, 'pared-izq-2', 31.4, 26.8, 'bench', 25),
  ('alta', '10', 1, 2, 'pared-izq-2', 33.9, 26.8, 'bench', 26),
  ('alta', '9', 1, 2, 'pared-izq-2', 38.1, 26.8, 'bench', 27),
  ('alta', '8', 1, 2, 'pared-izq-2', 40.5, 26.8, 'bench', 28),
  ('alta', '7', 1, 2, 'pared-der', 65.6, 26.8, 'bench', 29),
  ('alta', '6', 1, 2, 'pared-der', 67.9, 26.8, 'bench', 30),
  ('alta', '5', 1, 2, 'pared-der', 72.0, 26.8, 'bench', 31),
  ('alta', '4', 1, 2, 'pared-der', 74.5, 26.8, 'bench', 32),
  ('alta', '3', 1, 2, 'pared-der', 78.7, 26.8, 'bench', 33),
  ('alta', '2', 1, 2, 'pared-der', 81.2, 26.8, 'bench', 34),
  ('alta', '1', 1, 2, 'pared-der', 85.4, 26.8, 'bench', 35),
  ('alta', '18', 1, 4, 'comedor-3', 32.1, 38.4, 'square', 36),
  ('alta', '17', 1, 4, 'comedor-3', 38.2, 38.5, 'square', 37),
  ('alta', '19', 1, 4, 'comedor-3', 30.1, 51.7, 'square', 38),
  ('alta', '16', 6, 12, '', 20.9, 47.6, 'long', 39),
  ('alta', '23', 3, 6, 'comedor-2', 79.9, 36.3, 'rect', 40),
  ('alta', '24', 3, 6, 'comedor-2', 88.4, 36.3, 'rect', 41),
  ('alta', '25', 3, 6, 'comedor-2', 88.6, 46.7, 'rect', 42),
  ('alta', 'B1', 1, 3, '', 70.6, 42.3, 'bar', 43),
  ('alta', '26', 2, 5, '', 88.6, 55.7, 'sofa', 44),
  ('prive', 'PR1', 4, 8, '', 9.0, 73.6, 'round', 45)
on conflict (zone_id, name) do update
  set seats_min = excluded.seats_min, seats_max = excluded.seats_max, combine_group = excluded.combine_group,
      pos_x = excluded.pos_x, pos_y = excluded.pos_y, shape = excluded.shape, sort = excluded.sort;
