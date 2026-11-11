-- Precios de la app desde Ágora: estado de la sincronización y programador cada minuto.
-- Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de crear la función agora-sync y su secreto AGORA_API_TOKEN.
create table if not exists public.app_agora_sync (
  id        integer primary key check (id = 1),
  last_run  timestamptz,
  ok        boolean,
  changed   integer,
  error     text,
  detail    text
);
alter table public.app_agora_sync enable row level security;   -- sin políticas: solo la función (service role) lo lee y escribe
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'roce-agora-precios',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://lhwmtknmjmhktpkcngyz.supabase.co/functions/v1/agora-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc'),
    body := '{}'::jsonb
  );
  $job$
);
