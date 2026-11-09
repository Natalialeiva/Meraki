BEGIN;

ALTER TABLE abono
    ADD COLUMN fase_webpay varchar(25),
    ADD COLUMN sesion_webpay varchar(61),
    ADD COLUMN fecha_fase_webpay timestamptz,
    ADD CONSTRAINT abono_fase_webpay_valida CHECK (
        fase_webpay IS NULL OR (
            fase_webpay IN ('creacion_en_curso', 'pendiente_respuesta_pago', 'resultado_incierto')
            AND sesion_webpay IS NOT NULL
            AND buy_order IS NOT NULL
            AND fecha_fase_webpay IS NOT NULL
            AND (fase_webpay <> 'pendiente_respuesta_pago' OR token_transaccion IS NOT NULL)
        )
    );

CREATE UNIQUE INDEX abono_sesion_webpay_unica ON abono (sesion_webpay)
    WHERE sesion_webpay IS NOT NULL;

-- Refuerza las instalaciones anteriores sin quitar restricciones existentes.
CREATE UNIQUE INDEX IF NOT EXISTS abono_buy_order_key ON abono (buy_order);
CREATE UNIQUE INDEX IF NOT EXISTS abono_token_transaccion_key ON abono (token_transaccion);
CREATE UNIQUE INDEX IF NOT EXISTS abono_un_pendiente_por_reserva ON abono (id_reserva)
    WHERE estado = 'pendiente';
CREATE UNIQUE INDEX IF NOT EXISTS abono_un_aprobado_por_reserva ON abono (id_reserva)
    WHERE estado = 'aprobado';

COMMIT;
