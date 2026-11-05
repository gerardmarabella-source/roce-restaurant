-- ROCE · Un mismo email puede tener hasta 10 reservas de mesa activas (antes 3).
-- Reescribe la función book_table que ya está en la base de datos cambiando solo ese número. Se puede ejecutar más de una vez.
do $$
declare
  r record;
  def text;
  n integer := 0;
begin
  for r in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'book_table' loop
    def := pg_get_functiondef(r.oid);
    if def like '%>= 3 then raise exception ''too_many''%' then
      execute replace(def, '>= 3 then raise exception ''too_many''', '>= 10 then raise exception ''too_many''');
      n := n + 1;
    end if;
  end loop;
  if n = 0 and not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'book_table' and pg_get_functiondef(p.oid) like '%>= 10 then raise exception ''too_many''%') then
    raise exception 'No encuentro el límite de reservas en book_table: avísame para revisarlo.';
  end if;
end $$;
