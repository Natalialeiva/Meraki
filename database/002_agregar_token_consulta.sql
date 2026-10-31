
-- ============================================================
-- MERAKI - MIGRACIÓN 002
-- Agregar token seguro para consultar reservas
-- ============================================================

-- Permite identificar una reserva mediante un enlace privado.
-- Las reservas existentes conservarán NULL inicialmente.
ALTER TABLE reserva
ADD COLUMN IF NOT EXISTS token_consulta UUID;

-- Evita que dos reservas tengan el mismo token.
-- PostgreSQL permite múltiples NULL en un índice UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS reserva_token_consulta_unico
ON reserva (token_consulta);
