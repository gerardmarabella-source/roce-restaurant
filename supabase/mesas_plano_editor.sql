-- Ya ejecutado en producción (es seguro repetirlo: no duplica ni pisa mesas).
-- Los nombres de este archivo son los vigentes desde el 10-11-2026 (planta baja 1–20; planta alta 1–28; la sala privé sigue siendo PR1),
-- según los planos de RoceCover. Antes eran P1–P12/M1–M8 (baja) y P/M/L/C/S/V/R (alta).
-- ROCE · Editor del plano de mesas (RoceCover → Mapa → «Editar plano») + 2 baldas nuevas en la planta alta.
-- Se puede ejecutar más de una vez. Pegar en Supabase → SQL Editor → Run.

-- 1) Giro de cada mesa en el plano (en grados). 0 = como estaba.
alter table public.dining_tables add column if not exists rot numeric not null default 0;

-- 2) Dos baldas de 2 sillas pegadas a las ventanas de la derecha de la planta alta (V1 y V2).
--    Aparecen en el plano en una posición aproximada: colócalas con «Editar plano» (arrastrar y girar) y guarda.
insert into public.dining_tables (zone_id, name, seats_min, seats_max, combine_group, pos_x, pos_y, shape, rot, sort)
values
  ('alta', '28', 1, 2, '', 89.6, 30.6, 'balda', 90, 46),
  ('alta', '27', 1, 2, '', 89.6, 61.8, 'balda', 90, 47)
on conflict (zone_id, name) do nothing;
