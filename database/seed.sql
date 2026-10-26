-- ==========================================
-- MERAKI - DATOS DE PRUEBA
-- ==========================================

-- Categorías iniciales para probar el catálogo de servicios.
INSERT INTO categoria (nombre, descripcion)
VALUES
    ('Manicure', 'Servicios de cuidado y decoración de uñas'),
    ('Pedicure', 'Servicios de cuidado de los pies'),
    ('Peluquería', 'Servicios de corte y cuidado del cabello'),
    ('Pestañas', 'Servicios de extensiones y cuidado de pestañas'),
    ('Maquillaje', 'Servicios de maquillaje profesional')

-- Si una categoría ya existe, evitamos insertarla nuevamente.
ON CONFLICT (nombre) DO NOTHING;

-- Emprendedora ficticia para realizar pruebas.
-- La contraseña está deshabilitada hasta implementar la autenticación.
INSERT INTO emprendedora (
    nombre,
    apellido,
    rut,
    correo,
    password_hash
)
VALUES (
    'Camila',
    'Ejemplo',
    'RUT-PRUEBA-001',
    'camila@meraki.test',
    'SIN_ACCESO'
)
ON CONFLICT DO NOTHING;

-- Emprendimiento ficticio asociado a Camila Ejemplo.
INSERT INTO emprendimiento (
    id_emprendedora,
    nombre,
    descripcion,
    direccion,
    comuna
)
SELECT
    id_emprendedora,
    'Belleza Camila',
    'Emprendimiento de servicios de belleza y cuidado personal',
    'Dirección de prueba',
    'Santiago'
FROM emprendedora
WHERE correo = 'camila@meraki.test'
ON CONFLICT (id_emprendedora) DO NOTHING;

-- Servicio ficticio ofrecido por Belleza Camila.
INSERT INTO servicio (
    id_emprendimiento,
    id_categoria,
    nombre,
    descripcion,
    precio,
    duracion_min,
    monto_abono
)
SELECT
    e.id_emprendimiento,
    c.id_categoria,
    'Manicure permanente',
    'Aplicación de esmalte permanente en uñas',
    20000,
    60,
    5000
FROM emprendimiento e
INNER JOIN categoria c
    ON c.nombre = 'Manicure'
WHERE e.nombre = 'Belleza Camila'
  AND e.id_emprendedora = (
      SELECT id_emprendedora
      FROM emprendedora
      WHERE correo = 'camila@meraki.test'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM servicio s
      WHERE s.id_emprendimiento = e.id_emprendimiento
        AND s.nombre = 'Manicure permanente'
  );

  -- Registramos a Camila como trabajadora de su propio emprendimiento.
INSERT INTO trabajadora (
    id_emprendimiento,
    nombre,
    apellido,
    descripcion
)
SELECT
    e.id_emprendimiento,
    'Camila',
    'Ejemplo',
    'Emprendedora que realiza las atenciones'
FROM emprendimiento e
INNER JOIN emprendedora em
    ON e.id_emprendedora = em.id_emprendedora
WHERE em.correo = 'camila@meraki.test'
  AND NOT EXISTS (
      SELECT 1
      FROM trabajadora t
      WHERE t.id_emprendimiento = e.id_emprendimiento
        AND t.nombre = 'Camila'
        AND t.apellido = 'Ejemplo'
  );

  -- Asignamos el servicio Manicure permanente a Camila.
INSERT INTO trabajadora_servicio (
    id_trabajadora,
    id_servicio
)
SELECT
    t.id_trabajadora,
    s.id_servicio
FROM trabajadora t
INNER JOIN emprendimiento e
    ON t.id_emprendimiento = e.id_emprendimiento
INNER JOIN emprendedora em
    ON e.id_emprendedora = em.id_emprendedora
INNER JOIN servicio s
    ON s.id_emprendimiento = e.id_emprendimiento
WHERE em.correo = 'camila@meraki.test'
  AND t.nombre = 'Camila'
  AND t.apellido = 'Ejemplo'
  AND s.nombre = 'Manicure permanente'
ON CONFLICT (id_trabajadora, id_servicio) DO NOTHING;

-- Horarios de atención de Camila, de lunes a viernes.
INSERT INTO horario_atencion (
    id_trabajadora,
    dia_semana,
    hora_inicio,
    hora_fin
)
SELECT
    t.id_trabajadora,
    dias.dia_semana,
    '09:00'::TIME,
    '18:00'::TIME
FROM trabajadora t
INNER JOIN emprendimiento e
    ON t.id_emprendimiento = e.id_emprendimiento
INNER JOIN emprendedora em
    ON e.id_emprendedora = em.id_emprendedora
CROSS JOIN (
    VALUES
        ('lunes'),
        ('martes'),
        ('miercoles'),
        ('jueves'),
        ('viernes')
) AS dias(dia_semana)
WHERE em.correo = 'camila@meraki.test'
  AND t.nombre = 'Camila'
  AND t.apellido = 'Ejemplo'
  AND NOT EXISTS (
      SELECT 1
      FROM horario_atencion h
      WHERE h.id_trabajadora = t.id_trabajadora
        AND h.dia_semana = dias.dia_semana
        AND h.hora_inicio = '09:00'::TIME
        AND h.hora_fin = '18:00'::TIME
  );

  -- Bloqueo ficticio de Camila por un compromiso personal.
INSERT INTO bloqueo_horario (
    id_trabajadora,
    fecha_inicio,
    fecha_fin,
    motivo
)
SELECT
    t.id_trabajadora,
    TIMESTAMP '2026-11-02 12:00:00',
    TIMESTAMP '2026-11-02 13:00:00',
    'Compromiso personal de prueba'
FROM trabajadora t
INNER JOIN emprendimiento e
    ON t.id_emprendimiento = e.id_emprendimiento
INNER JOIN emprendedora em
    ON e.id_emprendedora = em.id_emprendedora
WHERE em.correo = 'camila@meraki.test'
  AND t.nombre = 'Camila'
  AND t.apellido = 'Ejemplo'
  AND NOT EXISTS (
      SELECT 1
      FROM bloqueo_horario b
      WHERE b.id_trabajadora = t.id_trabajadora
        AND b.fecha_inicio = TIMESTAMP '2026-11-02 12:00:00'
        AND b.fecha_fin = TIMESTAMP '2026-11-02 13:00:00'
  );

  -- Clienta ficticia para probar las reservas de Meraki.
INSERT INTO clienta (
    nombre,
    correo,
    telefono
)
SELECT
    'Valentina Prueba',
    'valentina@meraki.test',
    '900000000'
WHERE NOT EXISTS (
    SELECT 1
    FROM clienta
    WHERE correo = 'valentina@meraki.test'
);

-- Reserva ficticia de Valentina con Camila.
INSERT INTO reserva (
    id_emprendimiento,
    id_servicio,
    id_trabajadora,
    id_clienta,
    fecha_hora_inicio,
    fecha_hora_fin,
    estado,
    precio_servicio,
    monto_abono
)
SELECT
    e.id_emprendimiento,
    s.id_servicio,
    t.id_trabajadora,
    c.id_clienta,
    TIMESTAMP '2026-11-02 10:00:00',
    TIMESTAMP '2026-11-02 11:00:00',
    'confirmada',
    s.precio,
    s.monto_abono
FROM emprendimiento e
INNER JOIN emprendedora em
    ON e.id_emprendedora = em.id_emprendedora
INNER JOIN servicio s
    ON s.id_emprendimiento = e.id_emprendimiento
INNER JOIN trabajadora t
    ON t.id_emprendimiento = e.id_emprendimiento
INNER JOIN trabajadora_servicio ts
    ON ts.id_trabajadora = t.id_trabajadora
    AND ts.id_servicio = s.id_servicio
CROSS JOIN clienta c
WHERE em.correo = 'camila@meraki.test'
  AND s.nombre = 'Manicure permanente'
  AND t.nombre = 'Camila'
  AND t.apellido = 'Ejemplo'
  AND c.correo = 'valentina@meraki.test'
  AND NOT EXISTS (
      SELECT 1
      FROM reserva r
      WHERE r.id_trabajadora = t.id_trabajadora
        AND r.estado <> 'cancelada'
        AND TIMESTAMP '2026-11-02 10:00:00' < r.fecha_hora_fin
        AND TIMESTAMP '2026-11-02 11:00:00' > r.fecha_hora_inicio
  );