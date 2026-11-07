-- ROCE · App de pedidos · Perfil completo del cliente (para el CRM). Ejecutar DESPUÉS de app_pedidos.sql. Se puede ejecutar más de una vez.
-- Campos: nombre y apellidos, cumpleaños, género, código postal, dieta, alergias, teléfono, comunicaciones (email / WhatsApp),
-- cómo nos conoció y datos de facturación. La clave del cliente es la misma que usa el CRM de RoceCover (email; si no hay, teléfono).

alter table public.app_customers add column if not exists last_name          text not null default '';
alter table public.app_customers add column if not exists birthday           date;
alter table public.app_customers add column if not exists gender             text not null default '' check (gender in ('', 'masculino', 'femenino', 'otro', 'no_decir'));
alter table public.app_customers add column if not exists postal_code        text not null default '';
alter table public.app_customers add column if not exists diet               text not null default '';
alter table public.app_customers add column if not exists marketing_whatsapp boolean not null default false;
alter table public.app_customers add column if not exists heard_from         text not null default '';
alter table public.app_customers add column if not exists billing_name       text not null default '';
alter table public.app_customers add column if not exists billing_tax_id     text not null default '';
alter table public.app_customers add column if not exists billing_address    text not null default '';
alter table public.app_customers add column if not exists billing_postal     text not null default '';
alter table public.app_customers add column if not exists billing_city       text not null default '';
alter table public.app_customers add column if not exists customer_key       text not null default '';
alter table public.app_customers add column if not exists updated_at         timestamptz not null default now();
create index if not exists app_customers_key_idx on public.app_customers (customer_key);

-- Guardar el perfil. Recibe un JSON con los campos; el email sale siempre de la sesión.
create or replace function public.app_profile_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := auth.uid(); v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_phone text := left(coalesce(trim(p ->> 'phone'), ''), 30);
  v_name text := left(coalesce(trim(p ->> 'name'), ''), 80);
  v_bday date; v_gender text := coalesce(p ->> 'gender', '');
  v_key text;
begin
  if v_id is null then raise exception 'not_authenticated'; end if;
  if v_name = '' then raise exception 'name_required'; end if;
  if regexp_replace(v_phone, '[^0-9]', '', 'g') !~ '^[0-9]{9,15}$' then raise exception 'phone_required'; end if;
  begin v_bday := nullif(p ->> 'birthday', '')::date; exception when others then v_bday := null; end;
  if v_bday is not null and (v_bday > current_date or v_bday < date '1900-01-01') then v_bday := null; end if;
  if v_gender not in ('', 'masculino', 'femenino', 'otro', 'no_decir') then v_gender := ''; end if;
  v_key := coalesce(nullif(v_email, ''), regexp_replace(v_phone, '[^0-9]', '', 'g'));
  insert into public.app_customers (id, email, name, last_name, phone, lang, birthday, gender, postal_code, diet, allergies, marketing_optin, marketing_whatsapp, heard_from,
                                    billing_name, billing_tax_id, billing_address, billing_postal, billing_city, customer_key, updated_at)
  values (v_id, v_email, v_name, left(coalesce(trim(p ->> 'last_name'), ''), 100), v_phone, case when p ->> 'lang' = 'en' then 'en' else 'es' end, v_bday, v_gender,
          left(coalesce(trim(p ->> 'postal_code'), ''), 10), left(coalesce(trim(p ->> 'diet'), ''), 30),
          coalesce((select array_agg(x::int) from jsonb_array_elements_text(coalesce(p -> 'allergies', '[]'::jsonb)) x where x ~ '^[0-9]{1,2}$' and x::int between 1 and 14), '{}'),
          coalesce((p ->> 'marketing_optin')::boolean, false), coalesce((p ->> 'marketing_whatsapp')::boolean, false), left(coalesce(trim(p ->> 'heard_from'), ''), 60),
          left(coalesce(trim(p ->> 'billing_name'), ''), 120), left(coalesce(trim(p ->> 'billing_tax_id'), ''), 30), left(coalesce(trim(p ->> 'billing_address'), ''), 160),
          left(coalesce(trim(p ->> 'billing_postal'), ''), 10), left(coalesce(trim(p ->> 'billing_city'), ''), 80), v_key, now())
  on conflict (id) do update set name = excluded.name, last_name = excluded.last_name, phone = excluded.phone, lang = excluded.lang, birthday = excluded.birthday,
    gender = excluded.gender, postal_code = excluded.postal_code, diet = excluded.diet, allergies = excluded.allergies, marketing_optin = excluded.marketing_optin,
    marketing_whatsapp = excluded.marketing_whatsapp, heard_from = excluded.heard_from, billing_name = excluded.billing_name, billing_tax_id = excluded.billing_tax_id,
    billing_address = excluded.billing_address, billing_postal = excluded.billing_postal, billing_city = excluded.billing_city, customer_key = excluded.customer_key,
    email = excluded.email, updated_at = now();
  return jsonb_build_object('ok', true, 'customer_key', v_key);
end $$;
revoke all on function public.app_profile_save(jsonb) from public, anon;
grant execute on function public.app_profile_save(jsonb) to authenticated;

-- Eliminar la cuenta (derecho de supresión): borra su perfil y su acceso; los pedidos se conservan sin datos personales (obligación fiscal).
create or replace function public.app_account_delete() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid := auth.uid();
begin
  if v_id is null then raise exception 'not_authenticated'; end if;
  update public.app_orders set name = '', email = '', customer_id = null where customer_id = v_id;
  delete from public.app_customers where id = v_id;
  delete from auth.users where id = v_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.app_account_delete() from public, anon;
grant execute on function public.app_account_delete() to authenticated;
