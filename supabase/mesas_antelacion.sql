-- Antelación mínima de reserva web: 30 minutos (mientras haya mesa libre se puede reservar hasta 30' antes de la hora).
-- Se puede ejecutar más de una vez. También se puede cambiar por servicio en RoceCover → Configuración → "Antelación mínima (min)".
update public.dining_services set notice_min = 30;
