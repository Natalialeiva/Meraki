-- Una sola suscripción por cuenta: evita repetir el mes gratuito.
CREATE UNIQUE INDEX IF NOT EXISTS suscripcion_por_emprendedora ON suscripcion(id_emprendedora);
ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS renovacion_automatica BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS usuario_oneclick VARCHAR(50);
ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS tarjeta_cifrada TEXT;
ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS tarjeta_ultimos4 VARCHAR(4);
ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS tarjeta_tipo VARCHAR(100);
ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS consentimiento_fecha TIMESTAMPTZ;
ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS consentimiento_version VARCHAR(80);
ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS acceso_hasta DATE;
ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS dia_cobro INTEGER CHECK (dia_cobro BETWEEN 1 AND 31);
ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS reintento_autorizado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE suscripcion ADD COLUMN IF NOT EXISTS cancelada_fecha TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS inscripcion_suscripcion (
 id_inscripcion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_suscripcion INTEGER NOT NULL REFERENCES suscripcion(id_suscripcion),
 usuario_oneclick VARCHAR(50) NOT NULL,
 token_hash VARCHAR(64) UNIQUE,
 estado VARCHAR(20) NOT NULL CHECK(estado IN ('iniciando','pendiente','confirmando','completada','rechazada','revision','cancelada')),
 fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 fecha_resolucion TIMESTAMPTZ
);
ALTER TABLE pago_suscripcion ADD COLUMN IF NOT EXISTS periodo_inicio DATE;
ALTER TABLE pago_suscripcion ADD COLUMN IF NOT EXISTS periodo_fin DATE;
ALTER TABLE pago_suscripcion ADD COLUMN IF NOT EXISTS orden_compra VARCHAR(26);
ALTER TABLE pago_suscripcion ADD COLUMN IF NOT EXISTS orden_tienda VARCHAR(26);
ALTER TABLE pago_suscripcion ADD COLUMN IF NOT EXISTS codigo_comercio VARCHAR(20);
ALTER TABLE pago_suscripcion ADD COLUMN IF NOT EXISTS intento INTEGER NOT NULL DEFAULT 1;
ALTER TABLE pago_suscripcion ADD COLUMN IF NOT EXISTS proceso VARCHAR(20) NOT NULL DEFAULT 'revision'
 CHECK(proceso IN ('enviando','revision','finalizado'));
ALTER TABLE pago_suscripcion ADD COLUMN IF NOT EXISTS codigo_respuesta INTEGER;
ALTER TABLE pago_suscripcion ADD COLUMN IF NOT EXISTS dia_cobro INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS pago_suscripcion_orden ON pago_suscripcion(orden_compra);
CREATE UNIQUE INDEX IF NOT EXISTS pago_suscripcion_tienda ON pago_suscripcion(orden_tienda);
CREATE UNIQUE INDEX IF NOT EXISTS pago_suscripcion_intento ON pago_suscripcion(id_suscripcion,periodo_inicio,intento);
CREATE UNIQUE INDEX IF NOT EXISTS pago_suscripcion_periodo_aprobado ON pago_suscripcion(id_suscripcion,periodo_inicio) WHERE estado='aprobado';
CREATE TABLE IF NOT EXISTS evento_suscripcion (
 id_evento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_suscripcion INTEGER NOT NULL REFERENCES suscripcion(id_suscripcion),
 tipo VARCHAR(60) NOT NULL,
 fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 detalle JSONB NOT NULL DEFAULT '{}'
);
