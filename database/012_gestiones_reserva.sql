-- Asistencia y solicitud independientes del estado financiero y de atención.
BEGIN;
ALTER TABLE reserva ADD COLUMN asistencia_confirmada_en timestamptz;
CREATE TABLE solicitud_cancelacion (
 id_solicitud integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_reserva integer NOT NULL UNIQUE REFERENCES reserva(id_reserva),
 estado varchar(10) NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','cerrada')),
 creada_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 motivo varchar(500),
 cerrada_en timestamptz,
 cerrada_por integer REFERENCES emprendedora(id_emprendedora),
 respuesta varchar(500),
 CHECK (motivo IS NULL OR length(btrim(motivo)) BETWEEN 1 AND 500),
 CHECK ((estado='pendiente' AND cerrada_en IS NULL AND cerrada_por IS NULL AND respuesta IS NULL)
 OR (estado='cerrada' AND cerrada_en IS NOT NULL AND cerrada_por IS NOT NULL AND respuesta IS NOT NULL AND length(btrim(respuesta)) BETWEEN 1 AND 500))
);
COMMIT;
