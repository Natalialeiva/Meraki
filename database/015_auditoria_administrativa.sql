-- Ampliación del Admin existente (014). No cambia pagos ni datos históricos.
-- Respaldar y verificar restauración antes de aplicar en una base conservada.
BEGIN;
CREATE TABLE historial_administrativo (
 id_accion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_administradora INTEGER NOT NULL REFERENCES administradora(id_administradora),
 id_suscripcion INTEGER NOT NULL REFERENCES suscripcion(id_suscripcion),
 operacion VARCHAR(40) NOT NULL CHECK(operacion='cancelar_renovacion_local'),
 fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 motivo VARCHAR(500) NOT NULL CHECK(length(btrim(motivo)) BETWEEN 10 AND 500),
 resultado VARCHAR(30) NOT NULL CHECK(resultado='cancelada_localmente'),
 clave UUID NOT NULL,
 huella CHAR(64) NOT NULL,
 anterior JSONB NOT NULL,
 posterior JSONB NOT NULL,
 UNIQUE(id_administradora,clave)
);
CREATE INDEX historial_administrativo_fecha ON historial_administrativo(fecha DESC,id_accion DESC);
CREATE INDEX historial_administrativo_suscripcion ON historial_administrativo(id_suscripcion,id_accion DESC);
COMMIT;
