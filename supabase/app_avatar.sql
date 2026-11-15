-- ROCE · App de pedidos · Foto de perfil del cliente.
-- Se guarda como imagen cuadrada pequeña (JPEG de 320×320, ~20-40 KB) en el propio perfil. Cada cliente solo puede cambiar la suya
-- (la política app_customers_own ya limita las filas a las suyas); aquí solo se acota el formato y el tamaño. Se puede ejecutar más de una vez.
alter table public.app_customers add column if not exists avatar text;
alter table public.app_customers drop constraint if exists app_customers_avatar_check;
alter table public.app_customers add constraint app_customers_avatar_check check (avatar is null or (avatar like 'data:image/jpeg;base64,%' and length(avatar) <= 120000));
