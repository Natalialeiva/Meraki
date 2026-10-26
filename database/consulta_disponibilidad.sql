-- MERAKI - CONSULTA DE DISPONIBILIDAD (PRUEBA)
-- Genera horarios posibles y excluye bloqueos y reservas.
-- Caso de prueba: Camila, Manicure permanente, 02-11-2026.
-- Pendiente: adaptar fechas y trabajadoras a parámetros del Backend.
-- Calculamos horarios posibles, excluyendo reservas y bloqueos.
SELECT
    horas.hora::TIME AS hora_inicio
FROM trabajadora t
INNER JOIN horario_atencion h
    ON t.id_trabajadora = h.id_trabajadora
INNER JOIN trabajadora_servicio ts
    ON t.id_trabajadora = ts.id_trabajadora
INNER JOIN servicio s
    ON ts.id_servicio = s.id_servicio
INNER JOIN emprendimiento e
    ON t.id_emprendimiento = e.id_emprendimiento

-- Generamos horarios según la jornada y duración del servicio.
CROSS JOIN LATERAL generate_series(
    DATE '2026-11-02' + h.hora_inicio,
    DATE '2026-11-02' + h.hora_fin
        - s.duracion_min * INTERVAL '1 minute',
    s.duracion_min * INTERVAL '1 minute'
) AS horas(hora)

WHERE t.nombre = 'Camila'
  AND t.apellido = 'Ejemplo'
  AND e.nombre = 'Belleza Camila'
  AND h.dia_semana = 'lunes'
  AND h.activo = TRUE
  AND t.activa = TRUE
  AND s.nombre = 'Manicure permanente'
  AND s.activo = TRUE
  AND e.estado = TRUE

-- Excluimos horarios que se superponen con bloqueos.
AND NOT EXISTS (
    SELECT 1
    FROM bloqueo_horario b
    WHERE b.id_trabajadora = t.id_trabajadora
      AND horas.hora < b.fecha_fin
      AND horas.hora
          + s.duracion_min * INTERVAL '1 minute' > b.fecha_inicio
)

-- Excluimos horarios que se superponen con reservas vigentes.
AND NOT EXISTS (
    SELECT 1
    FROM reserva r
    WHERE r.id_trabajadora = t.id_trabajadora
      AND r.estado IN ('pendiente_abono', 'confirmada')
      AND horas.hora < r.fecha_hora_fin
      AND horas.hora
          + s.duracion_min * INTERVAL '1 minute' > r.fecha_hora_inicio
)

ORDER BY horas.hora;