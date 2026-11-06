-- ROCE · Recordatorio de 24 h y email de valoración tras la visita: barrido cada 5 minutos.
-- Avisa a la función booking-email, que envía los recordatorios y las valoraciones pendientes (cada reserva recibe uno solo).
-- Ejecutar UNA vez en Supabase → SQL Editor. Si lo repites no pasa nada: se reprograma.
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
