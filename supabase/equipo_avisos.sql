-- ROCE · RoceCover · Avisos por email de cada persona del equipo.
-- Cada persona elige qué avisos recibe (reservas de mesa nuevas, anuladas, cambios, no shows, penalizaciones, entradas de eventos pagadas).
-- El buzón de reservas (reservas@roce.es) los sigue recibiendo todos; estos llegan además, en copia oculta, a quien los marque.
-- Los administradores cambian los de los demás desde Equipo; cada persona (también el equipo sin permisos) cambia los suyos en «Mi cuenta».
-- Ejecutar UNA vez en Supabase → SQL Editor (después de equipo_nombres.sql). Se puede repetir.
alter table public.admins add column if not exists notify text[] not null default '{}';

-- Cambiar los avisos propios (solo se admiten los avisos que existen).
create or replace function public.admin_set_my_notify(p_keys text[]) returns text[]
language plpgsql security definer set search_path = public as $$
declare v text[];
begin
  update public.admins
     set notify = coalesce((select array_agg(distinct k) from unnest(coalesce(p_keys, '{}')) k
                             where k in ('table_new', 'table_cancelled', 'table_changed', 'table_noshow', 'table_charged', 'event_paid')), '{}')
   where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
   returning notify into v;
  if v is null then raise exception 'not_team'; end if;
  return v;
end $$;
revoke all on function public.admin_set_my_notify(text[]) from public, anon;
grant execute on function public.admin_set_my_notify(text[]) to authenticated;
