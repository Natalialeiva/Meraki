-- Preparada, NO aplicar sobre una base conservada sin revisión y autorización.
-- NOT VALID conserva filas incompatibles existentes; protege escrituras futuras.
BEGIN;
ALTER TABLE servicio ADD CONSTRAINT servicio_abono_clp_valido CHECK (
    monto_abono >= 1 AND monto_abono <= 99999999
    AND monto_abono = trunc(monto_abono) AND monto_abono <= precio
) NOT VALID;
COMMIT;
