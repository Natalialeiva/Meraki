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