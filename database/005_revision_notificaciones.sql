-- Ejecutar después de 004. Ningún envío interrumpido se reintenta automáticamente.
ALTER TABLE notificacion_correo ADD COLUMN IF NOT EXISTS id_mensaje TEXT;
CREATE TABLE IF NOT EXISTS revision_notificacion (
 id_revision INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_notificacion INTEGER NOT NULL REFERENCES notificacion_correo(id_notificacion),
 id_emprendedora INTEGER NOT NULL REFERENCES emprendedora(id_emprendedora),
 decision VARCHAR(30) NOT NULL CHECK (decision IN ('entregado','no_entregado','reintento')),
 evidencia TEXT NOT NULL CHECK (length(evidencia) BETWEEN 10 AND 500),
 fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
