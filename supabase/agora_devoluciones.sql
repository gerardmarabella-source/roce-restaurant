-- Devoluciones de la app → Ágora: cuando RoceCover devuelve el dinero de un pedido, el pedido se anula también en Ágora.
--  · Devolución TOTAL de un pedido que sigue abierto en Ágora → se anula allí solo (pago y devolución suman cero).
--  · Devolución PARCIAL, o pedido que ya está facturado en Ágora → queda marcado «abono pendiente en Ágora» en RoceCover
--    para que el equipo haga el abono a mano (la factura y los abonos los emite Ágora).
-- Ejecutar UNA vez en Supabase → SQL Editor (después de agora_pedidos.sql).
alter table public.app_orders add column if not exists agora_refunded_cents integer not null default 0;
alter table public.app_orders add column if not exists agora_refund_status text check (agora_refund_status in ('sent', 'manual', 'error'));
alter table public.app_orders add column if not exists agora_refund_note text;
alter table public.app_orders add column if not exists agora_refund_attempts integer not null default 0;
alter table public.app_orders add column if not exists agora_refund_attempt_at timestamptz;

-- Devoluciones que faltan por pasar a Ágora (de pedidos que ya están allí). Reintenta cada 2 minutos, máximo 5 veces.
create or replace function public.app_agora_claim_refunds(p_limit integer default 5) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r record; out jsonb := '[]'::jsonb;
begin
  for r in
    select o.id from public.app_orders o
    where o.agora_status = 'sent' and o.refunded_cents > o.agora_refunded_cents
      and o.agora_refund_attempts < 5
      and (o.agora_refund_attempt_at is null or o.agora_refund_attempt_at < now() - interval '2 minutes')
    order by o.paid_at nulls last
    limit greatest(1, least(coalesce(p_limit, 5), 20))
    for update skip locked
  loop
    update public.app_orders set agora_refund_attempts = agora_refund_attempts + 1, agora_refund_attempt_at = now() where id = r.id;
    out := out || jsonb_build_array((
      select jsonb_build_object('order', to_jsonb(o),
               'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.app_order_items i where i.order_id = o.id), '[]'::jsonb))
        from public.app_orders o where o.id = r.id));
  end loop;
  return out;
end;
$$;
revoke all on function public.app_agora_claim_refunds(integer) from public, anon, authenticated;
grant execute on function public.app_agora_claim_refunds(integer) to service_role;

-- Cliente con el que entró el pedido en Ágora (1 = genérico): la anulación por devolución lo respeta.
alter table public.app_orders add column if not exists agora_customer_id integer;
