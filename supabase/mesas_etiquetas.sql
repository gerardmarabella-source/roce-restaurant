-- Etiquetas de cliente propias (VIP, prensa, amigo de la casa…): se crean desde el panel y se pueden poner a reservas y clientes.
-- Se puede ejecutar más de una vez.
create table if not exists public.dining_tags (
  code       text primary key check (code ~ '^[a-z0-9-]{2,30}$'),
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
alter table public.dining_tags enable row level security;
drop policy if exists dining_tags_admin on public.dining_tags;
create policy dining_tags_admin on public.dining_tags for all to authenticated
  using (public.has_tab('tables')) with check (public.has_tab('tables'));
