-- Clientes de la app con datos de empresa → clientes de Ágora (el pedido llega a su nombre y la factura sale con sus datos).
-- Ágora recomienda Ids de cliente externos entre 500000 y 1.000.000.000 (los suyos son menores o mayores): se usa 500001 en adelante.
-- Ejecutar UNA vez en Supabase → SQL Editor (después de agora_pedidos.sql).
create sequence if not exists public.app_agora_customer_seq start 500001;
alter table public.app_customers add column if not exists agora_customer_id integer unique;
alter table public.app_customers add column if not exists agora_customer_hash text;   -- huella de los datos ya enviados a Ágora

-- Datos fiscales de un cliente de la app (solo si tiene nombre de empresa y NIF), con su Id de Ágora asignado.
create or replace function public.app_agora_customer(p_uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.app_customers%rowtype;
begin
  select * into c from public.app_customers where id = p_uid;
  if not found or coalesce(trim(c.billing_name), '') = '' or coalesce(trim(c.billing_tax_id), '') = '' then return null; end if;
  if c.agora_customer_id is null then
    update public.app_customers set agora_customer_id = nextval('public.app_agora_customer_seq') where id = p_uid returning agora_customer_id into c.agora_customer_id;
  end if;
  return jsonb_build_object('id', c.agora_customer_id, 'name', trim(c.billing_name), 'tax', trim(c.billing_tax_id), 'address', trim(c.billing_address),
    'postal', trim(c.billing_postal), 'city', trim(c.billing_city), 'email', c.email, 'phone', c.phone,
    'hash', md5(concat_ws('|', c.billing_name, c.billing_tax_id, c.billing_address, c.billing_postal, c.billing_city, c.email, c.phone)), 'synced', c.agora_customer_hash);
end;
$$;
revoke all on function public.app_agora_customer(uuid) from public, anon, authenticated;
grant execute on function public.app_agora_customer(uuid) to service_role;

create or replace function public.app_agora_customer_synced(p_uid uuid, p_hash text) returns void
language sql security definer set search_path = public as $$
  update public.app_customers set agora_customer_hash = p_hash where id = p_uid;
$$;
revoke all on function public.app_agora_customer_synced(uuid, text) from public, anon, authenticated;
grant execute on function public.app_agora_customer_synced(uuid, text) to service_role;
