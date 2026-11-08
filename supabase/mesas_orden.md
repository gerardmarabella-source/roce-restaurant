# Orden de ejecución del SQL de mesas (Supabase → SQL Editor)

1. `mesas.sql` (ya aplicado)
2. `mesas_plano.sql` (ya aplicado)
3. `mesas_pagos.sql` (ya aplicado)
4. `mesas_editar.sql` (ya aplicado)
5. `mesas_emails.sql` (ya aplicado)
6. `mesas_tarjeta.sql` (ya aplicado)
7. `mesas_extras.sql` — duración, prescriptores, tipo de reserva, notas/bloqueo de clientes, etiquetas y CRM
8. `mesas_espera.sql` — lista de espera, parrilla completa y próximos días
9. `mesas_servicio.sql` — llegada y postre
10. `mesas_nombres.sql` — nombres de los dos espacios
11. `mesas_antelacion.sql` — antelación mínima de 30 minutos para reservar por la web
12. `equipo_nombres.sql` — nombre y apellidos del equipo y prescriptores desde el equipo
13. `mesas_etiquetas.sql` — etiquetas de cliente propias (VIP, etc.)
14. `mesas_cuentas.sql` — cuentas de empresa / grupo con saldo (bote) y movimientos
15. `permisos_finos.sql` — permisos de detalle del equipo (ejecutar el último)
16. `mesas_calendario.sql` — calendario de la web con días cerrados / completos / con un turno completo, y cierres de tipo "completo"
17. `mesas_limite_reservas.sql` — hasta 10 reservas activas por email
18. `mesas_aperturas.sql` — aperturas especiales (abrir un día cerrado de base) y horizonte de reservas de la web
19. `mesas_servicio2.sql` — cuenta/limpiar/barra, tipos de reserva, fidelización, historial, 14 alérgenos, etiquetas VIP/No paga/Partner
20. `cron_mesas.sql` — recordatorio de 24 h y email de valoración (barrido cada 15 min; ejecutar una vez)
21. `mesas_calendario2.sql` — el calendario marca también los turnos cerrados (p. ej. la cena de un domingo)
22. `mesas_cena_dias.sql` — la cena abre de miércoles a sábado
23. `mesas_plano_editor.sql` — giro de mesas en el plano («Editar plano») y las baldas V1 y V2 de la planta alta
24. `mails_abandono.sql` — aviso «sigue con tu reserva / compra» a los 5 min (columnas abandon_mail_at + barrido cada 5 min; después, desplegar booking-email)

Todos se pueden ejecutar más de una vez. Si se vuelve a ejecutar `mesas.sql` o `mesas_tarjeta.sql`, hay que volver a ejecutar los de después.
25. `app_pedidos.sql` — app de pedidos (app.roce.es): carta con precios del servidor, clientes, pedidos a mesa / recoger, códigos QR de las mesas de la planta baja y funciones `app_create_order`, `app_order_set_status`, `app_resolve_table`, `app_customer_save` (ya aplicado el 7 nov 2026)
26. `app_perfil.sql` — perfil completo del cliente de la app (nombre, apellidos, cumpleaños, género, CP, dieta, alergias, comunicaciones, facturación) y eliminar cuenta (ya aplicado el 7 nov 2026)
27. `app_pago.sql` — pagos de Redsys para pedidos de la app (payments.app_order_id y confirm_payment); después, desplegar la función «redsys» con la acción pay_app (ya aplicado)
28. `app_menu_extras.sql` — «Más proteína» disponible todo el día (ya aplicado)
29. `app_rocecover.sql` — pedido a mesa cobrado → visita «walkin» o suma a la visita de esa mesa (ocupación y gasto), CRM con clientes y pedidos de la app, comensales en el pedido (ya aplicado)
30. `app_devoluciones.sql` — devoluciones (total o parcial) de pedidos de la app cobrados con Redsys: `app_refunds`, `app_orders.refunded_cents` y las funciones `app_refund_reserve` / `app_refund_finish`; después, desplegar la función «redsys» con la acción app_refund (ya aplicado y desplegado el 7 nov 2026)
31. `rocecover_tiempo_real.sql` — RoceCover en tiempo real: añade `table_bookings`, `table_booking_tables`, `dining_blocks` y `app_orders` a la publicación `supabase_realtime`; el panel (admin/mesas.js) se conecta por websocket y refresca la vista del día al instante (ya aplicado el 7 nov 2026)
34. `app_precios_cafes_tes.sql` — nuevos precios de cafés, tés e infusiones y del suplemento «Vegetal barista» (0,50 €) en la app; la carta de roce.es también
35. `app_precios_platos.sql` — nuevos precios de platos, tostadas 003 y 004, sándwiches, açaí y extras de «Más proteína» (la carta de roce.es también)
