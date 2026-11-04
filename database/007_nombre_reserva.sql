-- Conserva el nombre informado para cada cita, sin modificar otras reservas.
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS nombre_clienta VARCHAR(200);
