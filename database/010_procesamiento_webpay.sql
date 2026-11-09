BEGIN;

ALTER TABLE abono
    ADD COLUMN operacion_webpay uuid UNIQUE,
    ADD COLUMN tipo_operacion_webpay varchar(6),
    ADD COLUMN estado_proceso_webpay varchar(12),
    ADD COLUMN fecha_operacion_webpay timestamptz,
    ADD COLUMN commit_webpay_reclamado_en timestamptz,
    ADD CONSTRAINT abono_proceso_webpay_valido CHECK (
        (operacion_webpay IS NULL AND tipo_operacion_webpay IS NULL
            AND estado_proceso_webpay IS NULL AND fecha_operacion_webpay IS NULL
            AND commit_webpay_reclamado_en IS NULL)
        OR
        (operacion_webpay IS NOT NULL AND tipo_operacion_webpay IS NOT NULL
            AND tipo_operacion_webpay IN ('commit', 'status')
            AND estado_proceso_webpay IS NOT NULL
            AND estado_proceso_webpay IN ('en_proceso', 'incierto', 'resuelto')
            AND fecha_operacion_webpay IS NOT NULL
            AND (tipo_operacion_webpay <> 'commit' OR commit_webpay_reclamado_en IS NOT NULL))
    );

COMMIT;
