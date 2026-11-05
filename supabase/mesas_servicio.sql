-- ROCE · Seguimiento del servicio de cada reserva: llegada del cliente y postre
alter table public.table_bookings add column if not exists arrived_at timestamptz;   -- cuándo llegó el cliente
alter table public.table_bookings add column if not exists dessert_at timestamptz;   -- cuándo pasaron al postre
