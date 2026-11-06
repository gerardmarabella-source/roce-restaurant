-- ROCE · Email "sigue con tu reserva / sigue con tu compra" a los 5 minutos de dejar a medias el pago.
-- Mesas (tarjeta de garantía o fianza pendientes) y entradas de eventos (pago pendiente). Cada reserva recibe UN solo aviso.
-- Se puede ejecutar más de una vez. Pegar en Supabase → SQL Editor → Run. Después hay que desplegar la función booking-email.

alter table public.table_bookings add column if not exists abandon_mail_at timestamptz;
alter table public.bookings add column if not exists abandon_mail_at timestamptz;

-- El barrido pasa de cada 15 a cada 5 minutos (misma tarea que el recordatorio de 24 h y la valoración).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'roce-mesas-avisos';
select cron.schedule(
  'roce-mesas-avisos',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://lhwmtknmjmhktpkcngyz.supabase.co/functions/v1/booking-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc'),
    body := '{"action":"table_sweep"}'::jsonb
  );
  $job$
);
