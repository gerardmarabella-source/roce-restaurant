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

Todos se pueden ejecutar más de una vez. Si se vuelve a ejecutar `mesas.sql` o `mesas_tarjeta.sql`, hay que volver a ejecutar los de después.
