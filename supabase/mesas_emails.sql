-- ROCE · Emails de las reservas de mesa (ejecutar DESPUÉS de mesas.sql y mesas_pagos.sql)
-- Crea el aviso (Database Webhook) de la tabla table_bookings hacia la función booking-email.
-- Copia la configuración del aviso que ya existe para las entradas (booking_email, tabla bookings):
-- misma dirección y mismo secreto, sin tener que escribirlo otra vez.
do $$
declare
  a text[];
begin
  select string_to_array(encode(t.tgargs, 'escape'), '\000') into a
  from pg_trigger t
  where t.tgrelid = 'public.bookings'::regclass and t.tgname = 'booking_email' and not t.tgisinternal;
  if a is null or cardinality(a) < 5 then
    raise exception 'No encuentro el aviso booking_email de la tabla bookings: crea el de table_bookings a mano en Database → Webhooks.';
  end if;
  drop trigger if exists table_booking_email on public.table_bookings;
  execute format(
    'create trigger table_booking_email after insert or update on public.table_bookings for each row execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
    a[1], a[2], a[3], a[4], a[5]);
end
$$;
