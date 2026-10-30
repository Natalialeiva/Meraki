-- MERAKI
-- Migración para conservar múltiples intentos de abono.
-- Aplicar únicamente después de revisar los datos existentes.

BEGIN;

-- Impedir más de un pago aprobado por reserva.
CREATE UNIQUE INDEX IF NOT EXISTS
    abono_un_aprobado_por_reserva
ON abono (id_reserva)
WHERE estado = 'aprobado';

-- Impedir más de un intento pendiente por reserva.
CREATE UNIQUE INDEX IF NOT EXISTS
    abono_un_pendiente_por_reserva
ON abono (id_reserva)
WHERE estado = 'pendiente';

-- Impedir órdenes de compra duplicadas.
CREATE UNIQUE INDEX IF NOT EXISTS
    abono_buy_order_unico
ON abono (buy_order);

-- Permitir múltiples intentos históricos por reserva.
ALTER TABLE abono
DROP CONSTRAINT IF EXISTS abono_id_reserva_key;

COMMIT;