
-- MERAKI
-- Migración 003: registro de notificaciones por correo.
-- Ejecutar una sola vez en cada base de datos local.
-- IF NOT EXISTS permite volver a ejecutar sin recrear la tabla.

CREATE TABLE IF NOT EXISTS notificacion_correo (
    id_notificacion INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    id_reserva INTEGER NOT NULL
        REFERENCES reserva(id_reserva),

    tipo VARCHAR(50) NOT NULL
        DEFAULT 'confirmacion_reserva',

    estado VARCHAR(20) NOT NULL
        DEFAULT 'pendiente',

    intentos INTEGER NOT NULL DEFAULT 0,

    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    fecha_envio TIMESTAMP,

    ultimo_error TEXT,

    CONSTRAINT notificacion_estado_valido
        CHECK (estado IN ('pendiente', 'enviando', 'enviado', 'fallido')),

    CONSTRAINT notificacion_intentos_validos
        CHECK (intentos >= 0),

    CONSTRAINT notificacion_reserva_tipo_unico
        UNIQUE (id_reserva, tipo)
);
