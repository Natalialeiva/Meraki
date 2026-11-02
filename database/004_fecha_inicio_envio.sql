-- MERAKI
-- Migración 004: fecha de inicio de envío de correos.
--
-- Permite identificar notificaciones cuyo envío
-- pudo haberse interrumpido.
--
-- No elimina registros ni modifica pagos o reservas.

ALTER TABLE notificacion_correo
ADD COLUMN IF NOT EXISTS fecha_inicio_envio TIMESTAMP;