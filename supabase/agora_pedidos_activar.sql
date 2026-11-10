-- Activa el envío automático de pedidos a Ágora: aviso inmediato al cobrar + barrido cada minuto (reintentos).
-- Ejecutar DESPUÉS de agora_pedidos.sql, de desplegar la función agora-sync y de probar con un pedido de ejemplo.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.app_orders_agora_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    perform net.http_post(
      url := 'https://lhwmtknmjmhktpkcngyz.supabase.co/functions/v1/agora-sync',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc'),
      body := '{"action":"push"}'::jsonb);
  end if;
  return new;
end;
$$;
revoke all on function public.app_orders_agora_push() from public, anon, authenticated;
drop trigger if exists app_orders_agora_push on public.app_orders;
create trigger app_orders_agora_push after update of payment_status on public.app_orders
  for each row execute function public.app_orders_agora_push();

select cron.schedule('roce-agora-pedidos', '* * * * *', $job$
  select net.http_post(
    url := 'https://lhwmtknmjmhktpkcngyz.supabase.co/functions/v1/agora-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc'),
    body := '{"action":"push"}'::jsonb);
$job$);
