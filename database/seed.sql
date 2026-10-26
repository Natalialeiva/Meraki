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