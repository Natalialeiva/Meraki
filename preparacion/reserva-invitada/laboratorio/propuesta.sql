-- PROPUESTA DE LABORATORIO. No es una migración publicada ni se aplica a bases conservadas.
BEGIN;
ALTER TABLE reserva ALTER COLUMN id_clienta DROP NOT NULL;
CREATE TABLE contacto_reserva_invitada (
 id_reserva integer PRIMARY KEY REFERENCES reserva(id_reserva),
 nombre varchar(100) NOT NULL CHECK(length(btrim(nombre)) BETWEEN 1 AND 100),
 correo varchar(150) NOT NULL CHECK(length(btrim(correo)) BETWEEN 3 AND 150),
 telefono varchar(20)
);
-- No contiene el cuerpo de la petición ni una segunda copia del token privado.
CREATE TABLE intento_reserva_invitada (
 contexto_hash char(64) NOT NULL,
 clave_hash char(64) NOT NULL,
 huella char(64) NOT NULL,
 estado varchar(12) NOT NULL CHECK(estado IN('en_proceso','creada','rechazada')),
 id_reserva integer UNIQUE REFERENCES reserva(id_reserva),
 token_hash char(64),
 codigo varchar(40),
 fecha timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 vence timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP + interval '24 hours',
 PRIMARY KEY(contexto_hash,clave_hash),
 CHECK((estado='en_proceso' AND id_reserva IS NULL AND token_hash IS NULL AND codigo IS NULL)
    OR (estado='creada' AND id_reserva IS NOT NULL AND token_hash IS NOT NULL AND codigo IS NULL)
    OR (estado='rechazada' AND id_reserva IS NULL AND token_hash IS NULL AND codigo IS NOT NULL))
);
CREATE INDEX intento_reserva_invitada_fecha ON intento_reserva_invitada(contexto_hash,fecha);
COMMIT;
