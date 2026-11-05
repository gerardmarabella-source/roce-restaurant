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

Todos se pueden ejecutar más de una vez. Si se vuelve a ejecutar `mesas.sql` o `mesas_tarjeta.sql`, hay que volver a ejecutar los de después.
