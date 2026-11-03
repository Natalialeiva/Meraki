-- Correcciones de destinatario limitadas a una reserva; no cambian pagos.
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS correo_confirmacion VARCHAR(150);
CREATE TABLE IF NOT EXISTS correccion_correo_reserva (
 id_correccion INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_reserva INTEGER NOT NULL REFERENCES reserva(id_reserva),
 id_notificacion_anterior INTEGER REFERENCES notificacion_correo(id_notificacion),
 id_notificacion_nueva INTEGER NOT NULL REFERENCES notificacion_correo(id_notificacion),
 fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
