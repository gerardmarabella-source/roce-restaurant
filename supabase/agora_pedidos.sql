-- Pedidos de la app → Ágora (cada pedido pagado entra solo en Ágora y sale en cocina/barra).
-- Ejecutar UNA vez en Supabase → SQL Editor. La función agora-sync (acción "push") hace el envío; esto prepara la base de datos.
-- El programador y el aviso inmediato están al final, en agora_pedidos_activar.sql (se activan después de probar).

alter table public.app_orders add column if not exists agora_status text not null default 'pending'
  check (agora_status in ('pending', 'sending', 'sent', 'error', 'skipped'));
alter table public.app_orders add column if not exists agora_error text;
alter table public.app_orders add column if not exists agora_attempts integer not null default 0;
alter table public.app_orders add column if not exists agora_attempt_at timestamptz;
alter table public.app_orders add column if not exists agora_sent_at timestamptz;
alter table public.app_orders add column if not exists agora_number integer;   -- número de pedido en la serie de Ágora

-- Los pedidos anteriores a la integración no se envían (ya se gestionaron a mano).
update public.app_orders set agora_status = 'skipped' where agora_status = 'pending';

create sequence if not exists public.app_agora_seq start 1;

-- Reserva (de forma atómica) los pedidos pagados que faltan por enviar y los devuelve con sus líneas.
-- Reintenta los que dieron error cada 2 minutos (máx. 8 veces) y los que se quedaron "enviando" más de 5 minutos.
create or replace function public.app_agora_claim(p_limit integer default 5) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; out jsonb := '[]'::jsonb;
begin
  for r in
    select o.id from public.app_orders o
    where o.payment_status = 'paid' and (
      o.agora_status = 'pending'
      or (o.agora_status = 'error' and o.agora_attempts < 8 and o.agora_attempt_at < now() - interval '2 minutes')
      or (o.agora_status = 'sending' and o.agora_attempt_at < now() - interval '5 minutes'))
    order by o.paid_at nulls last
    limit greatest(1, least(coalesce(p_limit, 5), 20))
    for update skip locked
  loop
    update public.app_orders
       set agora_status = 'sending', agora_attempts = agora_attempts + 1, agora_attempt_at = now(),
           agora_number = coalesce(agora_number, nextval('public.app_agora_seq'))
     where id = r.id;
    out := out || jsonb_build_array((
      select jsonb_build_object('order', to_jsonb(o),
               'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.app_order_items i where i.order_id = o.id), '[]'::jsonb))
        from public.app_orders o where o.id = r.id));
  end loop;
  return out;
end;
$$;
revoke all on function public.app_agora_claim(integer) from public, anon, authenticated;
grant execute on function public.app_agora_claim(integer) to service_role;

-- RoceCover → «Pedidos app»: botón «Reenviar a Ágora» para los pedidos con error (o anteriores a la integración).
create or replace function public.app_agora_retry(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_tab('orders') or public.has_tab('tables')) then raise exception 'forbidden'; end if;
  update public.app_orders set agora_status = 'pending', agora_attempts = 0, agora_error = null
   where id = p_order and payment_status = 'paid' and agora_status in ('error', 'skipped');
  if not found then raise exception 'not_retryable'; end if;
end;
$$;
revoke all on function public.app_agora_retry(uuid) from public, anon;
grant execute on function public.app_agora_retry(uuid) to authenticated;
