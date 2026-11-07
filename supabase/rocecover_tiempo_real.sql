-- ROCE · RoceCover en tiempo real. Se puede ejecutar más de una vez.
-- Añade las tablas que mueven el plano y el día a la publicación «supabase_realtime»: cuando cambia una reserva, un bloqueo, las mesas
-- de una reserva o un pedido de la app, RoceCover lo recibe al instante por websocket (admin/mesas.js) y refresca la vista del día.
-- Los permisos no cambian: Realtime respeta las políticas de seguridad de cada tabla, así que solo reciben los cambios quienes ya pueden
-- ver esos datos (el equipo con permiso de Mesas); un cliente o un invitado de la app no recibe nada.
do $$
declare t text;
begin
  foreach t in array array['table_bookings', 'table_booking_tables', 'dining_blocks', 'app_orders'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
