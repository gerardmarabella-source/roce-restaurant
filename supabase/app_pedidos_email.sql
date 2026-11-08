-- ROCE · App de pedidos · Emails del pedido (ejecutar DESPUÉS de app_pedidos.sql y mesas_emails.sql)
-- Crea el aviso (Database Webhook) de la tabla app_orders hacia la función booking-email: cuando un pedido se cobra, el cliente recibe
-- «Pedido confirmado»; cuando se le devuelve dinero, «Devolución de tu pedido». Copia la configuración del aviso que ya existe para las
-- entradas (booking_email, tabla bookings): misma dirección y mismo secreto, sin tener que escribirlo otra vez.
do $$
declare
  a text[];
begin
  select string_to_array(encode(t.tgargs, 'escape'), '\000') into a
  from pg_trigger t
  where t.tgrelid = 'public.bookings'::regclass and t.tgname = 'booking_email' and not t.tgisinternal;
  if a is null or cardinality(a) < 5 then
    raise exception 'No encuentro el aviso booking_email de la tabla bookings: crea el de app_orders a mano en Database → Webhooks.';
  end if;
  drop trigger if exists app_order_email on public.app_orders;
  execute format(
    'create trigger app_order_email after update on public.app_orders for each row execute function supabase_functions.http_request(%L, %L, %L, %L, %L)',
    a[1], a[2], a[3], a[4], a[5]);
end
$$;
