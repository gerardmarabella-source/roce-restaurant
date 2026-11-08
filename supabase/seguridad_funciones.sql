-- Endurecimiento de funciones (revisión de seguridad, 8/11/2026). Es seguro repetirlo y no cambia el comportamiento de la web ni de la app.
-- 1) Funciones de disparador: solo las ejecuta la base de datos al guardar una fila; nadie debe poder llamarlas desde fuera (el aviso «Public Can Execute SECURITY DEFINER» del asesor de seguridad).
revoke execute on function public.app_orders_after_paid()      from public, anon, authenticated;
revoke execute on function public.dining_log_booking()         from public, anon, authenticated;
revoke execute on function public.table_booking_card_after()   from public, anon, authenticated;
revoke execute on function public.table_booking_card_before()  from public, anon, authenticated;
revoke execute on function public.dining_set_finished()        from public, anon, authenticated;
-- 2) Fija la ruta de búsqueda de la función que el asesor marca como «Function Search Path Mutable».
alter function public.dining_holds(text, timestamptz) set search_path = public;
