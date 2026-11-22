-- Un evento de pago NUNCA queda confirmado (con entrada y QR) sin que el banco haya cobrado.
-- Antes, una reserva hecha sin el indicador p_online (por ejemplo al llamar a book_event directamente) salía «confirmed»
-- aunque el evento costara dinero. Ahora un evento de pago queda siempre «pending» (plaza retenida 30 min) hasta que Redsys confirma el cobro.
-- Cambia en la función que ya está en la base de datos la línea del estado; falla si no la encuentra. Se puede ejecutar más de una vez (la segunda vez falla sin cambiar nada).
do $$
declare d text; d2 text; n integer;
begin
  select count(*) into n from pg_proc where proname = 'book_event' and pronamespace = 'public'::regnamespace;
  if n <> 1 then raise exception 'se esperaba una sola book_event y hay %', n; end if;
  select pg_get_functiondef(oid) into d from pg_proc where proname = 'book_event' and pronamespace = 'public'::regnamespace;
  d2 := replace(d, 'case when p_online and ev.price_cents > 0 then ''pending'' else ''confirmed'' end', 'case when ev.price_cents > 0 then ''pending'' else ''confirmed'' end');
  if d2 = d then raise exception 'no se encontro la linea a cambiar'; end if;
  execute d2;
end $$;
