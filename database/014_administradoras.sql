-- Cuentas privadas de la plataforma; sin relación con el registro de emprendedoras.
-- Aplicar solo después de revisar y autorizar la base destino.
BEGIN;
CREATE TABLE administradora (
    id_administradora INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    correo VARCHAR(150) NOT NULL UNIQUE CHECK (correo = lower(btrim(correo))),
    password_hash VARCHAR(255) NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;
