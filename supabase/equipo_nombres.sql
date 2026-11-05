-- Nombre y apellidos del equipo + prescriptores que salen del equipo.
-- Se puede ejecutar más de una vez.

alter table public.admins add column if not exists first_name text not null default '';
alter table public.admins add column if not exists last_name  text not null default '';

-- Lista del equipo (solo administradores), ahora con nombre y apellidos.
drop function if exists public.admin_team();
create function public.admin_team()
returns table (email text, role text, has_account boolean, last_sign_in timestamptz, tabs text[], first_name text, last_name text)
language sql stable security definer set search_path = public, auth as $$
  select a.email, a.role, u.id is not null, u.last_sign_in_at, a.tabs, a.first_name, a.last_name
  from public.admins a
  left join auth.users u on lower(u.email) = lower(a.email)
  where public.can_manage_team()
  order by (a.role = 'admin') desc, a.email;
$$;
revoke all on function public.admin_team() from public, anon;
grant execute on function public.admin_team() to authenticated;

-- Personas del equipo para elegirlas como prescriptor desde RoceCover (no hace falta ser administrador).
drop function if exists public.dining_team_people();
create function public.dining_team_people()
returns table (email text, first_name text, last_name text)
language sql stable security definer set search_path = public as $$
  select a.email, a.first_name, a.last_name from public.admins a
  where public.has_tab('tables')
  order by a.first_name, a.last_name, a.email;
$$;
revoke all on function public.dining_team_people() from public, anon;
grant execute on function public.dining_team_people() to authenticated;

-- Un prescriptor puede venir del equipo (guarda su email) o crearse a mano (email vacío).
alter table public.dining_prescribers add column if not exists email text;
