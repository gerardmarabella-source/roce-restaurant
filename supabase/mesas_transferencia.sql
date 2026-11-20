-- ROCE · RoceCover · Pago de una reserva por transferencia bancaria.
--  · pay_method = 'transfer' → la reserva se paga por transferencia; transfer_status 'pending' | 'paid'; transfer_cents = importe.
--  · Para marcarla como pagada es OBLIGATORIO adjuntar el comprobante (transfer_proof = ruta en el bucket privado booking-proofs):
--    lo exige la propia base de datos (constraint), no solo el panel.
-- Ejecutar UNA vez en Supabase → SQL Editor (después de mesas.sql). Se puede repetir.
alter table public.table_bookings add column if not exists pay_method text not null default '';
alter table public.table_bookings add column if not exists transfer_status text not null default 'pending';
alter table public.table_bookings add column if not exists transfer_cents integer;
alter table public.table_bookings add column if not exists transfer_proof text not null default '';
alter table public.table_bookings add column if not exists transfer_paid_at timestamptz;

alter table public.table_bookings drop constraint if exists table_bookings_pay_method_check;
alter table public.table_bookings add constraint table_bookings_pay_method_check check (pay_method in ('', 'transfer'));
alter table public.table_bookings drop constraint if exists table_bookings_transfer_status_check;
alter table public.table_bookings add constraint table_bookings_transfer_status_check check (transfer_status in ('pending', 'paid'));
alter table public.table_bookings drop constraint if exists table_bookings_transfer_cents_check;
alter table public.table_bookings add constraint table_bookings_transfer_cents_check check (transfer_cents is null or transfer_cents >= 0);
alter table public.table_bookings drop constraint if exists table_bookings_transfer_proof_chk;
alter table public.table_bookings add constraint table_bookings_transfer_proof_chk
  check (pay_method <> 'transfer' or transfer_status <> 'paid' or transfer_proof <> '');

-- Comprobantes: bucket PRIVADO (solo el equipo con acceso a Mesas los ve, con enlaces temporales). Máx. 10 MB: JPG, PNG, WebP o PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-proofs', 'booking-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
drop policy if exists booking_proofs_select on storage.objects;
create policy booking_proofs_select on storage.objects for select to authenticated using (bucket_id = 'booking-proofs' and public.has_tab('tables'));
drop policy if exists booking_proofs_insert on storage.objects;
create policy booking_proofs_insert on storage.objects for insert to authenticated with check (bucket_id = 'booking-proofs' and public.has_tab('tables'));
drop policy if exists booking_proofs_update on storage.objects;
create policy booking_proofs_update on storage.objects for update to authenticated using (bucket_id = 'booking-proofs' and public.has_tab('tables')) with check (bucket_id = 'booking-proofs' and public.has_tab('tables'));
drop policy if exists booking_proofs_delete on storage.objects;
create policy booking_proofs_delete on storage.objects for delete to authenticated using (bucket_id = 'booking-proofs' and public.has_tab('tables'));
