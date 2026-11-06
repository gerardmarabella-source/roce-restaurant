-- Entradas con QR para invitados de lista: barrido cada 5 minutos.
-- Cada 5 minutos se avisa a la función booking-email, que envía su entrada a los invitados de las listas
-- ya cerradas (por hora, a mano o confirmadas por su propietario) a los que aún no se les ha enviado.
-- Es seguro repetirlo: cada invitado recibe un único email. La clave "anon" es la pública de la web.
-- Ejecutar UNA vez en Supabase → SQL Editor (aparte de schema.sql).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'roce-listas-entradas',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://lhwmtknmjmhktpkcngyz.supabase.co/functions/v1/booking-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc', 'x-sweep-secret', '<SWEEP_SECRET>'),
    body := '{"action":"list_sweep"}'::jsonb
  );
  $job$
);
