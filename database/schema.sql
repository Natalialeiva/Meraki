
-- BASE DE DATOS MERAKI
-- Estructura de tablas


-- Estados permitidos para las emprendedoras.
CREATE TYPE estado_emprendedora AS ENUM (
    'activa',
    'inactiva'
);
-- Habilita las comparaciones necesarias para evitar horarios superpuestos.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Tabla que almacena las cuentas de las emprendedoras.
CREATE TABLE emprendedora (
    id_emprendedora INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    rut VARCHAR(20) NOT NULL UNIQUE,
    correo VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    estado estado_emprendedora NOT NULL DEFAULT 'activa',
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- Tabla que almacena la información de los emprendimientos.
CREATE TABLE emprendimiento (
    id_emprendimiento INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_emprendedora INTEGER NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    direccion VARCHAR(200),
    comuna VARCHAR(100),
    latitud DECIMAL(10,7),
    longitud DECIMAL(10,7),
    telefono VARCHAR(20),
    estado BOOLEAN NOT NULL DEFAULT TRUE,

    -- Relaciona cada emprendimiento con su dueña.
    CONSTRAINT fk_emprendimiento_emprendedora
        FOREIGN KEY (id_emprendedora)
        REFERENCES emprendedora(id_emprendedora)
);

-- Tabla de personas que realizan servicios en un emprendimiento.
CREATE TABLE trabajadora (
    id_trabajadora INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_emprendimiento INTEGER NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100),
    descripcion TEXT,
    activa BOOLEAN NOT NULL DEFAULT TRUE,

    -- Cada trabajadora pertenece a un emprendimiento.
    CONSTRAINT fk_trabajadora_emprendimiento
        FOREIGN KEY (id_emprendimiento)
        REFERENCES emprendimiento(id_emprendimiento)
);

-- Estados permitidos para las suscripciones de Meraki.
CREATE TYPE estado_suscripcion AS ENUM (
    'prueba',
    'activa',
    'vencida',
    'cancelada'
);

-- Tabla que registra las suscripciones de las emprendedoras.
CREATE TABLE suscripcion (
    id_suscripcion INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_emprendedora INTEGER NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin_prueba DATE,
    fecha_proximo_cobro DATE,
    monto_mensual DECIMAL(10,2) NOT NULL,
    estado estado_suscripcion NOT NULL,

    -- Relacionamos la suscripción con la emprendedora.
    CONSTRAINT fk_suscripcion_emprendedora
        FOREIGN KEY (id_emprendedora)
        REFERENCES emprendedora(id_emprendedora)
);


-- Estados permitidos para los pagos de suscripciones.
CREATE TYPE estado_pago_suscripcion AS ENUM (
    'pendiente',
    'aprobado',
    'rechazado',
    'anulado'
);

-- Tabla que registra los pagos de suscripciones.
CREATE TABLE pago_suscripcion (
    id_pago_suscripcion INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_suscripcion INTEGER NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    estado estado_pago_suscripcion NOT NULL DEFAULT 'pendiente',
    token_transaccion VARCHAR(255) UNIQUE,
    codigo_autorizacion VARCHAR(100),
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_pago TIMESTAMP,

    -- Relacionamos cada pago con su suscripción.
    CONSTRAINT fk_pago_suscripcion_suscripcion
        FOREIGN KEY (id_suscripcion)
        REFERENCES suscripcion(id_suscripcion)
);

-- Tabla que almacena las categorías de servicios.
CREATE TABLE categoria (
    id_categoria INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);
-- Tabla que almacena los servicios ofrecidos por los emprendimientos.
CREATE TABLE servicio (
    id_servicio INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_emprendimiento INTEGER NOT NULL,
    id_categoria INTEGER NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    duracion_min INTEGER NOT NULL,
    monto_abono DECIMAL(10,2) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    -- Relaciona cada servicio con el emprendimiento que lo ofrece.
    CONSTRAINT fk_servicio_emprendimiento
        FOREIGN KEY (id_emprendimiento)
        REFERENCES emprendimiento(id_emprendimiento),

    -- Relaciona cada servicio con su categoría.
    CONSTRAINT fk_servicio_categoria
        FOREIGN KEY (id_categoria)
        REFERENCES categoria(id_categoria)
);
-- Tabla que relaciona a las trabajadoras con los servicios que realizan.
CREATE TABLE trabajadora_servicio (
    id_trabajadora INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,

    -- Evita asignar dos veces el mismo servicio a una trabajadora.
    CONSTRAINT pk_trabajadora_servicio
        PRIMARY KEY (id_trabajadora, id_servicio),

    -- Relaciona el registro con una trabajadora existente.
    CONSTRAINT fk_trabajadora_servicio_trabajadora
        FOREIGN KEY (id_trabajadora)
        REFERENCES trabajadora(id_trabajadora),

    -- Relaciona el registro con un servicio existente.
    CONSTRAINT fk_trabajadora_servicio_servicio
        FOREIGN KEY (id_servicio)
        REFERENCES servicio(id_servicio)
);

-- Tabla que almacena las imágenes asociadas a los servicios.
CREATE TABLE imagen_servicio (
    id_imagen INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_servicio INTEGER NOT NULL,
    url VARCHAR(500) NOT NULL,
    descripcion VARCHAR(255),

    -- Relaciona cada imagen con un servicio existente.
    CONSTRAINT fk_imagen_servicio_servicio
        FOREIGN KEY (id_servicio)
        REFERENCES servicio(id_servicio)
);
-- Tabla que registra los horarios de atención de cada trabajadora.
CREATE TABLE horario_atencion (
    id_horario INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_trabajadora INTEGER NOT NULL,
    dia_semana VARCHAR(15) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    -- Relaciona cada horario con una trabajadora.
    CONSTRAINT fk_horario_atencion_trabajadora
        FOREIGN KEY (id_trabajadora)
        REFERENCES trabajadora(id_trabajadora),

    -- Comprueba que la hora de término sea posterior a la de inicio.
    CONSTRAINT chk_horario_atencion_horas
        CHECK (hora_fin > hora_inicio)
);
-- Impide que una trabajadora tenga horarios activos superpuestos.
ALTER TABLE horario_atencion
ADD CONSTRAINT horario_atencion_sin_superposicion
EXCLUDE USING gist (
    id_trabajadora WITH =,
    dia_semana WITH =,
    tsrange(
        DATE '2000-01-01' + hora_inicio,
        DATE '2000-01-01' + hora_fin,
        '[)'
    ) WITH &&
)
WHERE (activo = TRUE);

-- Tabla que registra los períodos en que una trabajadora no está disponible.
CREATE TABLE bloqueo_horario (
    id_bloqueo INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_trabajadora INTEGER NOT NULL,
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP NOT NULL,
    motivo VARCHAR(255),

    -- Relaciona cada bloqueo con una trabajadora.
    CONSTRAINT fk_bloqueo_horario_trabajadora
        FOREIGN KEY (id_trabajadora)
        REFERENCES trabajadora(id_trabajadora),

    -- Evita que un bloqueo termine antes de comenzar.
    CONSTRAINT chk_bloqueo_horario_fechas
        CHECK (fecha_fin > fecha_inicio)
);

-- Tabla que almacena los datos de las clientas que realizan reservas.
CREATE TABLE clienta (
    id_clienta INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150) NOT NULL,
    telefono VARCHAR(20),
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Estados permitidos para las reservas de Meraki.
CREATE TYPE estado_reserva AS ENUM (
    'pendiente_abono',
    'confirmada',
    'atendida',
    'no_atendida',
    'cancelada'
);


-- Tabla que registra las reservas realizadas por las clientas.
CREATE TABLE reserva (
    id_reserva INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_emprendimiento INTEGER NOT NULL,
    id_servicio INTEGER NOT NULL,
    id_trabajadora INTEGER NOT NULL,
    id_clienta INTEGER NOT NULL,
    fecha_hora_inicio TIMESTAMP NOT NULL,
    fecha_hora_fin TIMESTAMP NOT NULL,
    estado estado_reserva NOT NULL DEFAULT 'pendiente_abono',
    precio_servicio DECIMAL(10,2) NOT NULL,
    monto_abono DECIMAL(10,2) NOT NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Relacionamos la reserva con el emprendimiento.
    CONSTRAINT fk_reserva_emprendimiento
        FOREIGN KEY (id_emprendimiento)
        REFERENCES emprendimiento(id_emprendimiento),

    -- Relacionamos la reserva con el servicio solicitado.
    CONSTRAINT fk_reserva_servicio
        FOREIGN KEY (id_servicio)
        REFERENCES servicio(id_servicio),

    -- Indicamos qué trabajadora realizará la atención.
    CONSTRAINT fk_reserva_trabajadora
        FOREIGN KEY (id_trabajadora)
        REFERENCES trabajadora(id_trabajadora),

    -- Identificamos a la clienta que realizó la reserva.
    CONSTRAINT fk_reserva_clienta
        FOREIGN KEY (id_clienta)
        REFERENCES clienta(id_clienta),

    -- La reserva debe terminar después de comenzar.
    CONSTRAINT chk_reserva_fechas
        CHECK (fecha_hora_fin > fecha_hora_inicio)
);


-- Estados permitidos para los abonos de las reservas.
CREATE TYPE estado_abono AS ENUM (
    'pendiente',
    'aprobado',
    'rechazado',
    'anulado'
);
-- Tabla que registra los abonos realizados para confirmar reservas.
CREATE TABLE abono (
    id_abono INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_reserva INTEGER NOT NULL UNIQUE,
    monto DECIMAL(10,2) NOT NULL,
    estado estado_abono NOT NULL DEFAULT 'pendiente',
    token_transaccion VARCHAR(255) UNIQUE,
    codigo_autorizacion VARCHAR(100),
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_pago TIMESTAMP,

    -- Relaciona cada abono con una reserva existente.
    CONSTRAINT fk_abono_reserva
        FOREIGN KEY (id_reserva)
        REFERENCES reserva(id_reserva)
);