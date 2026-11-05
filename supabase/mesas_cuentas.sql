-- ROCE · Cuentas de empresa / grupo: dinero entregado a cuenta (bote) o consumo pendiente de facturar.
-- El saldo de una cuenta es la suma de sus movimientos: positivo = saldo a favor del grupo (puede consumir contra él),
-- negativo = consumido por encima / pendiente de facturar. Se puede ejecutar más de una vez.

create table if not exists public.dining_accounts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  kind       text not null default 'grupo' check (kind in ('grupo', 'empresa')),   -- grupo = bote prepagado · empresa = se factura después
  tax_id     text not null default '',
  note       text not null default '',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.dining_account_moves (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.dining_accounts(id) on delete cascade,
  amount_cents integer not null check (amount_cents <> 0),           -- + ingreso / − consumo
  kind        text not null check (kind in ('topup', 'spend', 'adjust')),
  booking_id  uuid references public.table_bookings(id) on delete set null,
  customer_key text not null default '',
  note        text not null default '',
  created_by  text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists dining_account_moves_acc on public.dining_account_moves (account_id, created_at desc);
create index if not exists dining_account_moves_bk on public.dining_account_moves (booking_id);

-- A qué cuenta pertenece un cliente (la clave del cliente es su email o su teléfono).
alter table public.dining_customer_notes add column if not exists account_id uuid references public.dining_accounts(id) on delete set null;

alter table public.dining_accounts enable row level security;
alter table public.dining_account_moves enable row level security;
drop policy if exists dining_accounts_admin on public.dining_accounts;
create policy dining_accounts_admin on public.dining_accounts for all to authenticated using (public.has_tab('tables')) with check (public.has_tab('tables'));
drop policy if exists dining_account_moves_admin on public.dining_account_moves;
create policy dining_account_moves_admin on public.dining_account_moves for all to authenticated using (public.has_tab('tables')) with check (public.has_tab('tables'));
