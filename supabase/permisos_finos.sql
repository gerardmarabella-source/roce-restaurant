-- ROCE · Permisos finos del equipo.
-- Cada persona del equipo tiene una lista de permisos (admins.tabs). Además de las pestañas de siempre
-- (events, bookings, checkin, lists, tables) hay permisos de detalle:
--   events_edit, events_delete                      → crear/editar/publicar y borrar eventos
--   bookings_manage                                  → anular, devolver y cambiar el email de reservas de eventos
--   tables_wait, tables_crm, tables_accounts,
--   tables_blocks, tables_config, tables_charge      → lista de espera, clientes, cuentas y saldos, bloqueos,
--                                                      configuración de RoceCover y cobro de tarjetas
-- Los administradores lo tienen todo. Se puede ejecutar más de una vez. Ejecútalo DESPUÉS de mesas_cuentas.sql y mesas_etiquetas.sql.

-- Sin lista explícita (NULL) se mantiene lo de siempre, con sus permisos de detalle.
create or replace function public.has_tab(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (a.role = 'admin' or coalesce(a.tabs, array['events', 'events_edit', 'events_delete', 'bookings', 'bookings_manage', 'checkin', 'lists']) @> array[t])
  );
$$;

-- Quien ya tenía una pestaña conserva todo lo que hacía en ella (así nadie pierde acceso por este cambio).
update public.admins set tabs = (
  select array(select distinct x from unnest(
    tabs
    || case when 'events' = any(tabs)   then array['events_edit', 'events_delete'] else '{}'::text[] end
    || case when 'bookings' = any(tabs) then array['bookings_manage'] else '{}'::text[] end
    || case when 'tables' = any(tabs)   then array['tables_wait', 'tables_crm', 'tables_accounts', 'tables_blocks', 'tables_config', 'tables_charge'] else '{}'::text[] end
  ) x)
) where role = 'staff' and tabs is not null
  and not (tabs && array['events_edit', 'events_delete', 'bookings_manage', 'tables_wait', 'tables_crm', 'tables_accounts', 'tables_blocks', 'tables_config', 'tables_charge']);

-- Eventos: ver = cualquiera del panel; crear/editar = events_edit; borrar = events_delete.
drop policy if exists events_admin_write on public.events;
drop policy if exists events_admin_insert on public.events;
create policy events_admin_insert on public.events for insert to authenticated with check (public.has_tab('events_edit'));
drop policy if exists events_admin_update on public.events;
create policy events_admin_update on public.events for update to authenticated using (public.has_tab('events_edit')) with check (public.has_tab('events_edit'));
drop policy if exists events_admin_delete on public.events;
create policy events_admin_delete on public.events for delete to authenticated using (public.has_tab('events_delete'));

-- RoceCover: configuración (zonas, mesas, horarios, cierres).
do $$
declare t text;
begin
  foreach t in array array['dining_zones', 'dining_tables', 'dining_services', 'dining_closures'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.has_tab(%L))', t || '_read', t, 'tables');
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_tab(%L)) with check (public.has_tab(%L))', t || '_write', t, 'tables_config', 'tables_config');
  end loop;
end $$;

-- Bloqueos de mesas.
drop policy if exists dining_blocks_admin on public.dining_blocks;
drop policy if exists dining_blocks_read on public.dining_blocks;
create policy dining_blocks_read on public.dining_blocks for select to authenticated using (public.has_tab('tables'));
drop policy if exists dining_blocks_write on public.dining_blocks;
create policy dining_blocks_write on public.dining_blocks for all to authenticated using (public.has_tab('tables_blocks')) with check (public.has_tab('tables_blocks'));

-- Lista de espera.
drop policy if exists dining_waitlist_admin on public.dining_waitlist;
create policy dining_waitlist_admin on public.dining_waitlist for all to authenticated using (public.has_tab('tables_wait')) with check (public.has_tab('tables_wait'));

-- Fichas de cliente (notas, bloqueo, tipo): verlas = RoceCover; cambiarlas = tables_crm.
drop policy if exists dining_customer_notes_admin on public.dining_customer_notes;
drop policy if exists dining_customer_notes_read on public.dining_customer_notes;
create policy dining_customer_notes_read on public.dining_customer_notes for select to authenticated using (public.has_tab('tables'));
drop policy if exists dining_customer_notes_write on public.dining_customer_notes;
create policy dining_customer_notes_write on public.dining_customer_notes for all to authenticated using (public.has_tab('tables_crm')) with check (public.has_tab('tables_crm'));
