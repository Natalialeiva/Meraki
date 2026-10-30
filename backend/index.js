// Importamos Express.
const express = require("express");

// Importamos bcrypt para proteger las contraseñas.
const bcrypt = require("bcrypt");

// Importamos las herramientas para administrar sesiones.
const session = require("express-session");

// Permitimos almacenar las sesiones en PostgreSQL.
const connectPgSimple = require("connect-pg-simple");
const PgSession = connectPgSimple(session);

// Creamos la aplicación que utilizará Express.
const app = express();

// Permitimos que el Backend reciba datos en formato JSON.
// Esto será necesario para registrar reservas desde el Front Office.
app.use(express.json());

// Ruta principal para comprobar el funcionamiento del Backend.
app.get("/", (req, res) => {
    res.send("Bienvenida al Backend de Meraki");
});

// Importamos la conexión con PostgreSQL.
const pool = require("./db");

// Comprobamos que exista la clave privada de sesiones.
if (!process.env.SESSION_SECRET) {
    throw new Error("Falta SESSION_SECRET en el archivo .env");
}

// Mensaje temporal para verificar que el servidor
// está cargando la configuración actual de sesiones.
console.log("MERAKI: configuración de sesiones cargada");

// Configuramos las sesiones de las emprendedoras.
app.use(session({
    // Nombre de la cookie de Meraki.
    name: "meraki.sid",

    // Clave privada utilizada para firmar la cookie.
    secret: process.env.SESSION_SECRET,

    // Almacenamos las sesiones en PostgreSQL.
    store: new PgSession({
        pool: pool,
        tableName: "sesion_meraki",
        createTableIfMissing: true
    }),

    // Evitamos guardar sesiones si no han cambiado.
    resave: false,

    // No creamos sesiones para visitantes que no han iniciado sesión.
    saveUninitialized: false,

    cookie: {
        // JavaScript del navegador no puede leer esta cookie.
        httpOnly: true,

        // Reduce el envío de cookies en solicitudes entre sitios.
        sameSite: "lax",

        // En desarrollo local utilizamos HTTP.
        // En producción con HTTPS deberá cambiarse a true.
        secure: false,

        // La sesión dura dos horas desde que se emite la cookie.
        maxAge: 2 * 60 * 60 * 1000
    }
}));
// Verificamos que la emprendedora haya iniciado sesión.
// Esta función protegerá las rutas privadas del Back Office.
function verificarSesion(req, res, next) {

    // Si no existe una emprendedora autenticada, rechazamos el acceso.
    if (!req.session || !req.session.idEmprendedora) {
        return res.status(401).json({
            mensaje: "Debes iniciar sesión para acceder al Back Office"
        });
    }

    // Si existe una sesión, permitimos continuar.
    next();
}

// Ruta para comprobar que el Backend puede consultar PostgreSQL.
app.get("/api/estado-db", async (req, res) => {
    try {
        // Consultamos el nombre de la base de datos conectada.
        const resultado = await pool.query(
            "SELECT current_database() AS nombre"
        );

        // Enviamos una respuesta en formato JSON.
        res.json({
            mensaje: "Conexión exitosa con PostgreSQL",
            base_datos: resultado.rows[0].nombre
        });

    } catch (error) {
        // Registramos el error en la terminal.
        console.error("Error al consultar PostgreSQL:", error.message);

        // Informamos que ocurrió un error en el servidor.
        res.status(500).json({
            mensaje: "Error al conectar con la base de datos"
        });
    }
});
// Ruta para consultar las categorías de servicios de Meraki.
app.get("/api/categorias", async (req, res) => {
    try {
        // Obtenemos las categorías guardadas en PostgreSQL.
        const resultado = await pool.query(
            "SELECT id_categoria, nombre, descripcion FROM categoria ORDER BY id_categoria"
        );

        // Enviamos las categorías al navegador en formato JSON.
        res.json(resultado.rows);

    } catch (error) {
        // Mostramos el error en la terminal.
        console.error("Error al consultar categorías:", error.message);

        // Informamos que la consulta no se pudo completar.
        res.status(500).json({
            mensaje: "Error al obtener las categorías"
        });
    }
});



// Ruta para consultar los servicios activos de Meraki.
app.get("/api/servicios", async (req, res) => {
    try {
        // Consultamos los servicios y los nombres de sus emprendimientos y categorías.
        const resultado = await pool.query(`
            SELECT
                s.id_servicio,
                s.nombre AS servicio,
                s.descripcion,
                e.nombre AS emprendimiento,
                c.nombre AS categoria,
                s.precio,
                s.duracion_min,
                s.monto_abono
            FROM servicio s
            INNER JOIN emprendimiento e
                ON s.id_emprendimiento = e.id_emprendimiento
            INNER JOIN categoria c
                ON s.id_categoria = c.id_categoria
            WHERE s.activo = TRUE
              AND e.estado = TRUE
            ORDER BY s.nombre;
        `);

        // Enviamos los servicios al navegador en formato JSON.
        res.json(resultado.rows);

    } catch (error) {
        // Mostramos el error en la terminal.
        console.error("Error al consultar servicios:", error.message);

        // Respondemos con un error si la consulta falla.
        res.status(500).json({
            mensaje: "Error al obtener los servicios"
        });
    }
});
// Ruta para consultar los servicios propios del Back Office.
// Incluye servicios activos y desactivados.
app.get("/api/mis-servicios", verificarSesion, async (req, res) => {
    try {

        // Consultamos únicamente los servicios de los
        // emprendimientos de la emprendedora autenticada.
        const resultado = await pool.query(`
            SELECT
                s.id_servicio,
                s.id_emprendimiento,
                e.nombre AS emprendimiento,
                s.id_categoria,
                c.nombre AS categoria,
                s.nombre AS servicio,
                s.descripcion,
                s.precio,
                s.duracion_min,
                s.monto_abono,
                s.activo
            FROM servicio s
            INNER JOIN emprendimiento e
                ON s.id_emprendimiento = e.id_emprendimiento
            INNER JOIN categoria c
                ON s.id_categoria = c.id_categoria
            WHERE e.id_emprendedora = $1
            ORDER BY s.id_servicio;
        `, [req.session.idEmprendedora]);

        // Enviamos los servicios al Back Office.
        return res.json(resultado.rows);

    } catch (error) {
        console.error("Error al consultar servicios propios:", error.message);

        return res.status(500).json({
            mensaje: "No se pudieron obtener los servicios"
        });
    }
});
// Ruta para consultar las trabajadoras del Back Office.
// Solo muestra las trabajadoras de los emprendimientos propios.
app.get("/api/mis-trabajadoras", verificarSesion, async (req, res) => {
    try {

        // Consultamos las trabajadoras de la emprendedora autenticada.
        const resultado = await pool.query(`
            SELECT
                t.id_trabajadora,
                t.id_emprendimiento,
                e.nombre AS emprendimiento,
                t.nombre,
                t.apellido,
                t.descripcion,
                t.activa
            FROM trabajadora t
            INNER JOIN emprendimiento e
                ON t.id_emprendimiento = e.id_emprendimiento
            WHERE e.id_emprendedora = $1
            ORDER BY t.id_trabajadora;
        `, [req.session.idEmprendedora]);

        // Enviamos las trabajadoras al Back Office.
        return res.json(resultado.rows);

    } catch (error) {
        console.error("Error al consultar trabajadoras:", error.message);

        return res.status(500).json({
            mensaje: "No se pudieron obtener las trabajadoras"
        });
    }
});


// Ruta para consultar los servicios asignados a una trabajadora.
// Solo permite acceder a trabajadoras de los emprendimientos propios.

// ============================================================
// CONSULTAR SERVICIOS ASIGNADOS A UNA TRABAJADORA
// ============================================================

app.get("/api/trabajadoras/:id/servicios", verificarSesion, async (req, res) => {
    try {
        const idTrabajadora = Number(req.params.id);

        // Validamos el identificador de la trabajadora.
        if (!Number.isSafeInteger(idTrabajadora) || idTrabajadora <= 0) {
            return res.status(400).json({
                mensaje: "Debes indicar una trabajadora válida"
            });
        }

        // Verificamos que la trabajadora pertenezca
        // a la emprendedora que inició sesión.
        const propiedad = await pool.query(`
            SELECT
                t.id_trabajadora,
                t.nombre,
                t.id_emprendimiento
            FROM trabajadora t
            INNER JOIN emprendimiento e
                ON t.id_emprendimiento = e.id_emprendimiento
            WHERE t.id_trabajadora = $1
              AND e.id_emprendedora = $2;
        `, [
            idTrabajadora,
            req.session.idEmprendedora
        ]);

        if (propiedad.rows.length === 0) {
            return res.status(404).json({
                mensaje: "La trabajadora no existe"
            });
        }

        // Consultamos los servicios asignados a la trabajadora.
        // Incluimos servicios activos e inactivos para el Back Office.
        const resultado = await pool.query(`
            SELECT
                s.id_servicio,
                s.id_emprendimiento,
                s.nombre,
                s.descripcion,
                s.duracion_min,
                s.precio,
                s.activo
            FROM trabajadora_servicio ts
            INNER JOIN servicio s
                ON ts.id_servicio = s.id_servicio
            WHERE ts.id_trabajadora = $1
              AND s.id_emprendimiento = $2
            ORDER BY s.nombre;
        `, [
            idTrabajadora,
            propiedad.rows[0].id_emprendimiento
        ]);

        return res.status(200).json(resultado.rows);

    } catch (error) {
        console.error("Error al consultar servicios asignados:", error.message);

        return res.status(500).json({
            mensaje: "No se pudieron consultar los servicios de la trabajadora"
        });
    }
});


// ============================================================
// ASIGNAR UN SERVICIO A UNA TRABAJADORA
// ============================================================

app.post("/api/trabajadoras/:id/servicios", verificarSesion, async (req, res) => {
    try {
        const idTrabajadora = Number(req.params.id);
        const { id_servicio } = req.body || {};
        const idServicio = Number(id_servicio);

        // Validamos los identificadores.
        if (
            !Number.isSafeInteger(idTrabajadora) ||
            idTrabajadora <= 0 ||
            !Number.isSafeInteger(idServicio) ||
            idServicio <= 0
        ) {
            return res.status(400).json({
                mensaje: "Debes indicar una trabajadora y un servicio válidos"
            });
        }

        // Comprobamos que ambos pertenezcan al mismo
        // emprendimiento y estén activos.
        const propiedad = await pool.query(`
            SELECT
                t.id_trabajadora,
                s.id_servicio,
                t.id_emprendimiento
            FROM trabajadora t
            INNER JOIN emprendimiento e
                ON t.id_emprendimiento = e.id_emprendimiento
            INNER JOIN servicio s
                ON s.id_emprendimiento = e.id_emprendimiento
            WHERE t.id_trabajadora = $1
              AND s.id_servicio = $2
              AND e.id_emprendedora = $3
              AND t.activa = TRUE
              AND s.activo = TRUE;
        `, [
            idTrabajadora,
            idServicio,
            req.session.idEmprendedora
        ]);

        if (propiedad.rows.length === 0) {
            return res.status(404).json({
                mensaje: "No se encontró una trabajadora activa y un servicio activo válidos para este emprendimiento"
            });
        }

        // Registramos la asignación, evitando duplicados.
        const resultado = await pool.query(`
            INSERT INTO trabajadora_servicio (
                id_trabajadora,
                id_servicio
            )
            VALUES ($1, $2)
            ON CONFLICT (id_trabajadora, id_servicio)
            DO NOTHING
            RETURNING id_trabajadora, id_servicio;
        `, [
            idTrabajadora,
            idServicio
        ]);

        // La asignación ya existía.
        if (resultado.rows.length === 0) {
            return res.status(409).json({
                mensaje: "Este servicio ya está asignado a la trabajadora"
            });
        }

        return res.status(201).json({
            mensaje: "Servicio asignado correctamente",
            asignacion: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al asignar servicio:", error.message);

        return res.status(500).json({
            mensaje: "No se pudo asignar el servicio a la trabajadora"
        });
    }
});



// Ruta para consultar los horarios de atención del Back Office.


// Incluye horarios activos e inactivos de los negocios propios.
app.get("/api/mis-horarios", verificarSesion, async (req, res) => {
    try {
        // Consultamos los horarios de las trabajadoras
        // de los emprendimientos de la sesión.
        const resultado = await pool.query(`
            SELECT
                h.id_horario,
                h.id_trabajadora,
                t.nombre AS trabajadora,
                t.id_emprendimiento,
                e.nombre AS emprendimiento,
                h.dia_semana,
                h.hora_inicio,
                h.hora_fin,
                h.activo
            FROM horario_atencion h
            INNER JOIN trabajadora t
                ON h.id_trabajadora = t.id_trabajadora
            INNER JOIN emprendimiento e
                ON t.id_emprendimiento = e.id_emprendimiento
            WHERE e.id_emprendedora = $1
            ORDER BY
                t.id_trabajadora,
                h.dia_semana,
                h.hora_inicio;
        `, [req.session.idEmprendedora]);

        return res.json(resultado.rows);

    } catch (error) {
        console.error("Error al consultar horarios:", error.message);

        return res.status(500).json({
            mensaje: "No se pudieron obtener los horarios"
        });
    }
});

// Ruta para registrar horarios de atención del Back Office.
// Solo las emprendedoras autenticadas pueden registrar horarios.
app.post("/api/horarios", verificarSesion, async (req, res) => {
    try {
        // Recibimos los datos del horario.
        const {
            id_trabajadora,
            dia_semana,
            hora_inicio,
            hora_fin
        } = req.body || {};

        // Convertimos el identificador de la trabajadora a número.
const idTrabajadora = Number(id_trabajadora);

// Validamos que sea un identificador entero positivo.
if (
    !Number.isSafeInteger(idTrabajadora) ||
    idTrabajadora <= 0
) {
    return res.status(400).json({
        mensaje: "Debes indicar una trabajadora válida"
    });
}

// Comprobamos que la trabajadora pertenezca a un
// emprendimiento de la emprendedora autenticada.
const propiedad = await pool.query(`
    SELECT t.id_trabajadora, t.activa
    FROM trabajadora t
    INNER JOIN emprendimiento e
        ON t.id_emprendimiento = e.id_emprendimiento
    WHERE t.id_trabajadora = $1
      AND e.id_emprendedora = $2;
`, [idTrabajadora, req.session.idEmprendedora]);

// Rechazamos trabajadoras inexistentes o ajenas.
if (propiedad.rows.length === 0) {
    return res.status(404).json({
        mensaje: "La trabajadora no existe"
    });
}

// No permitimos registrar horarios para trabajadoras desactivadas.
if (propiedad.rows[0].activa === false) {
    return res.status(409).json({
        mensaje: "No puedes registrar horarios para una trabajadora desactivada"
    });
}

// Definimos los días válidos para mantener el mismo
// formato utilizado por la API de disponibilidad.
const diasValidos = [
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
    "domingo"
];

// Validamos el día de la semana.
if (
    typeof dia_semana !== "string" ||
    !diasValidos.includes(dia_semana.trim().toLowerCase())
) {
    return res.status(400).json({
        mensaje: "Debes indicar un día de la semana válido"
    });
}

// Normalizamos el día antes de guardarlo.
const diaSemanaLimpio = dia_semana.trim().toLowerCase();

// Validamos que las horas tengan formato HH:MM o HH:MM:SS.
const formatoHora = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

if (
    typeof hora_inicio !== "string" ||
    typeof hora_fin !== "string" ||
    !formatoHora.test(hora_inicio) ||
    !formatoHora.test(hora_fin)
) {
    return res.status(400).json({
        mensaje: "Las horas deben tener formato HH:MM o HH:MM:SS"
    });
}

// Normalizamos las horas a HH:MM:SS.
const horaInicioLimpia =
    hora_inicio.length === 5 ? `${hora_inicio}:00` : hora_inicio;

const horaFinLimpia =
    hora_fin.length === 5 ? `${hora_fin}:00` : hora_fin;

// Comprobamos que el horario termine después de comenzar.
if (horaFinLimpia <= horaInicioLimpia) {
    return res.status(400).json({
        mensaje: "La hora de término debe ser posterior a la hora de inicio"
    });
}

// Comprobamos si ya existe un horario activo que se cruce
// con el nuevo horario de la misma trabajadora y día.
const superposicion = await pool.query(`
    SELECT id_horario
    FROM horario_atencion
    WHERE id_trabajadora = $1
      AND dia_semana = $2
      AND activo = TRUE
      AND hora_inicio < $4::time
      AND hora_fin > $3::time
    LIMIT 1;
`, [
    idTrabajadora,
    diaSemanaLimpio,
    horaInicioLimpia,
    horaFinLimpia
]);

// Si encontramos un horario superpuesto, rechazamos el registro.
if (superposicion.rows.length > 0) {
    return res.status(409).json({
        mensaje: "La trabajadora ya tiene un horario que se superpone con el indicado"
    });
}

// Registramos el horario de atención en PostgreSQL.
const resultado = await pool.query(`
    INSERT INTO horario_atencion (
        id_trabajadora,
        dia_semana,
        hora_inicio,
        hora_fin
    )
    VALUES ($1, $2, $3::time, $4::time)
    RETURNING
        id_horario,
        id_trabajadora,
        dia_semana,
        hora_inicio,
        hora_fin,
        activo;
`, [
    idTrabajadora,
    diaSemanaLimpio,
    horaInicioLimpia,
    horaFinLimpia
]);

// Confirmamos que el horario fue registrado.
return res.status(201).json({
    mensaje: "Horario registrado correctamente",
    horario: resultado.rows[0]
});

    } catch (error) {
    // Detectamos cuando PostgreSQL rechaza horarios superpuestos.
    if (error.code === "23P01") {
        return res.status(409).json({
            mensaje: "La trabajadora ya tiene un horario que se superpone con el indicado"
        });
    }

    console.error("Error al registrar horario:", error.message);

    return res.status(500).json({
        mensaje: "No se pudo registrar el horario"
    });
}
});



// Ruta para editar horarios de atención del Back Office.
app.patch("/api/horarios/:id", verificarSesion, async (req, res) => {
    try {
        // Identificamos el horario que se desea modificar.
        const idHorario = Number(req.params.id);

        // Validamos el identificador.
        if (!Number.isSafeInteger(idHorario) || idHorario <= 0) {
            return res.status(400).json({
                mensaje: "Debes indicar un horario válido"
            });
        }

       // Buscamos el horario y comprobamos que pertenezca
// a un emprendimiento de la emprendedora autenticada.
const propiedad = await pool.query(`
    SELECT
        h.id_horario,
        h.id_trabajadora,
        h.dia_semana,
        h.hora_inicio,
        h.hora_fin,
        h.activo
    FROM horario_atencion h
    INNER JOIN trabajadora t
        ON h.id_trabajadora = t.id_trabajadora
    INNER JOIN emprendimiento e
        ON t.id_emprendimiento = e.id_emprendimiento
    WHERE h.id_horario = $1
      AND e.id_emprendedora = $2;
`, [idHorario, req.session.idEmprendedora]);

// Rechazamos horarios inexistentes o de otros emprendimientos.
if (propiedad.rows.length === 0) {
    return res.status(404).json({
        mensaje: "El horario no existe"
    });
}

// Guardamos los datos actuales para utilizarlos al editar.
const horarioActual = propiedad.rows[0];

// No permitimos editar horarios desactivados.
if (horarioActual.activo === false) {
    return res.status(409).json({
        mensaje: "No puedes editar un horario desactivado"
    });
}

       // Recibimos los datos que la emprendedora desea modificar.
const {
    dia_semana,
    hora_inicio,
    hora_fin
} = req.body || {};

// Si no se envía un campo, conservamos su valor actual.
const nuevoDia = dia_semana === undefined
    ? horarioActual.dia_semana
    : dia_semana;

const nuevaHoraInicio = hora_inicio === undefined
    ? horarioActual.hora_inicio
    : hora_inicio;

const nuevaHoraFin = hora_fin === undefined
    ? horarioActual.hora_fin
    : hora_fin;

// Definimos los días de atención válidos.
const diasValidos = [
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
    "domingo"
];

// Validamos el día.
if (
    typeof nuevoDia !== "string" ||
    !diasValidos.includes(nuevoDia.trim().toLowerCase())
) {
    return res.status(400).json({
        mensaje: "Debes indicar un día de la semana válido"
    });
}

const diaSemanaLimpio = nuevoDia.trim().toLowerCase();

// Validamos el formato de las horas.
const formatoHora = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

if (
    typeof nuevaHoraInicio !== "string" ||
    typeof nuevaHoraFin !== "string" ||
    !formatoHora.test(nuevaHoraInicio) ||
    !formatoHora.test(nuevaHoraFin)
) {
    return res.status(400).json({
        mensaje: "Las horas deben tener formato HH:MM o HH:MM:SS"
    });
}

// Normalizamos las horas.
const horaInicioLimpia = nuevaHoraInicio.length === 5
    ? `${nuevaHoraInicio}:00`
    : nuevaHoraInicio;

const horaFinLimpia = nuevaHoraFin.length === 5
    ? `${nuevaHoraFin}:00`
    : nuevaHoraFin;

// La hora de término debe ser posterior a la de inicio.
if (horaFinLimpia <= horaInicioLimpia) {
    return res.status(400).json({
        mensaje: "La hora de término debe ser posterior a la hora de inicio"
    });
}

// Comprobamos que el nuevo horario no se superponga
// con otro horario activo de la misma trabajadora.
const superposicion = await pool.query(`
    SELECT id_horario
    FROM horario_atencion
    WHERE id_trabajadora = $1
      AND dia_semana = $2
      AND activo = TRUE
      AND id_horario <> $3
      AND hora_inicio < $5::time
      AND hora_fin > $4::time
    LIMIT 1;
`, [
    horarioActual.id_trabajadora,
    diaSemanaLimpio,
    idHorario,
    horaInicioLimpia,
    horaFinLimpia
]);

// Rechazamos la edición si encontramos un conflicto.
if (superposicion.rows.length > 0) {
    return res.status(409).json({
        mensaje: "El horario modificado se superpone con otro horario de la trabajadora"
    });
}

// Actualizamos el horario en PostgreSQL.
const resultado = await pool.query(`
    UPDATE horario_atencion
    SET
        dia_semana = $1,
        hora_inicio = $2::time,
        hora_fin = $3::time
    WHERE id_horario = $4
      AND activo = TRUE
      AND EXISTS (
          SELECT 1
          FROM trabajadora t
          INNER JOIN emprendimiento e
              ON t.id_emprendimiento = e.id_emprendimiento
          WHERE t.id_trabajadora = horario_atencion.id_trabajadora
            AND e.id_emprendedora = $5
      )
    RETURNING
        id_horario,
        id_trabajadora,
        dia_semana,
        hora_inicio,
        hora_fin,
        activo;
`, [
    diaSemanaLimpio,
    horaInicioLimpia,
    horaFinLimpia,
    idHorario,
    req.session.idEmprendedora
]);

// Comprobamos que el horario haya sido actualizado.
if (resultado.rows.length === 0) {
    return res.status(404).json({
        mensaje: "El horario no está disponible para edición"
    });
}

// Confirmamos la modificación.
return res.status(200).json({
    mensaje: "Horario actualizado correctamente",
    horario: resultado.rows[0]
});

    } catch (error) {
    // Detectamos conflictos de horarios desde PostgreSQL.
    if (error.code === "23P01") {
        return res.status(409).json({
            mensaje: "El horario modificado se superpone con otro horario de la trabajadora"
        });
    }

    console.error("Error al editar horario:", error.message);

    return res.status(500).json({
        mensaje: "No se pudo editar el horario"
    });
}
});


// Ruta para desactivar horarios de atención del Back Office.
app.patch("/api/horarios/:id/desactivar", verificarSesion, async (req, res) => {
    try {
        // Obtenemos el identificador del horario.
        const idHorario = Number(req.params.id);

        // Validamos el identificador.
        if (!Number.isSafeInteger(idHorario) || idHorario <= 0) {
            return res.status(400).json({
                mensaje: "Debes indicar un horario válido"
            });
        }

      // Buscamos el horario y verificamos que pertenezca
// a un emprendimiento de la emprendedora autenticada.
const propiedad = await pool.query(`
    SELECT
        h.id_horario,
        h.id_trabajadora,
        h.activo
    FROM horario_atencion h
    INNER JOIN trabajadora t
        ON h.id_trabajadora = t.id_trabajadora
    INNER JOIN emprendimiento e
        ON t.id_emprendimiento = e.id_emprendimiento
    WHERE h.id_horario = $1
      AND e.id_emprendedora = $2;
`, [
    idHorario,
    req.session.idEmprendedora
]);

// Rechazamos horarios inexistentes o de otros emprendimientos.
if (propiedad.rows.length === 0) {
    return res.status(404).json({
        mensaje: "El horario no existe"
    });
}

// Comprobamos si el horario ya está desactivado.
if (propiedad.rows[0].activo === false) {
    return res.status(409).json({
        mensaje: "El horario ya está desactivado"
    });
}

        // Desactivamos el horario sin eliminarlo de PostgreSQL.
const resultado = await pool.query(`
    UPDATE horario_atencion
    SET activo = FALSE
    WHERE id_horario = $1
      AND activo = TRUE
      AND EXISTS (
          SELECT 1
          FROM trabajadora t
          INNER JOIN emprendimiento e
              ON t.id_emprendimiento = e.id_emprendimiento
          WHERE t.id_trabajadora = horario_atencion.id_trabajadora
            AND e.id_emprendedora = $2
      )
    RETURNING
        id_horario,
        id_trabajadora,
        dia_semana,
        hora_inicio,
        hora_fin,
        activo;
`, [
    idHorario,
    req.session.idEmprendedora
]);

// Comprobamos que la desactivación se haya realizado.
if (resultado.rows.length === 0) {
    return res.status(409).json({
        mensaje: "El horario no está disponible para desactivación"
    });
}

// Confirmamos la desactivación.
return res.status(200).json({
    mensaje: "Horario desactivado correctamente",
    horario: resultado.rows[0]
});

    } catch (error) {
        console.error("Error al desactivar horario:", error.message);

        return res.status(500).json({
            mensaje: "No se pudo desactivar el horario"
        });
    }
});
// Ruta para registrar nuevas trabajadoras en Meraki.
// Solo las emprendedoras autenticadas pueden registrar trabajadoras.
app.post("/api/trabajadoras", verificarSesion, async (req, res) => {
    try {

        // Recibimos los datos de la trabajadora.
        const {
            id_emprendimiento,
            nombre,
            apellido,
            descripcion
        } = req.body || {};

        // Convertimos el identificador del emprendimiento a número.
const idEmprendimiento = Number(id_emprendimiento);

// Comprobamos que sea un entero positivo.
if (
    !Number.isSafeInteger(idEmprendimiento) ||
    idEmprendimiento <= 0
) {
    return res.status(400).json({
        mensaje: "Debes indicar un emprendimiento válido"
    });
}

// Verificamos que el emprendimiento pertenezca
// a la emprendedora que inició sesión.
const propiedad = await pool.query(`
    SELECT id_emprendimiento
    FROM emprendimiento
    WHERE id_emprendimiento = $1
      AND id_emprendedora = $2;
`, [idEmprendimiento, req.session.idEmprendedora]);

// Impedimos registrar trabajadoras en emprendimientos ajenos.
if (propiedad.rows.length === 0) {
    return res.status(403).json({
        mensaje: "No tienes permiso para registrar trabajadoras en este emprendimiento"
    });
}

// Validamos que el nombre sea obligatorio y no supere 100 caracteres.
if (
    typeof nombre !== "string" ||
    nombre.trim() === "" ||
    nombre.trim().length > 100
) {
    return res.status(400).json({
        mensaje: "El nombre debe tener entre 1 y 100 caracteres"
    });
}

// Validamos el apellido, que es opcional.
if (
    apellido != null &&
    (
        typeof apellido !== "string" ||
        apellido.trim().length > 100
    )
) {
    return res.status(400).json({
        mensaje: "El apellido no debe superar 100 caracteres"
    });
}

// Validamos la descripción, que también es opcional.
if (
    descripcion != null &&
    (
        typeof descripcion !== "string" ||
        descripcion.length > 1000
    )
) {
    return res.status(400).json({
        mensaje: "La descripción no debe superar 1000 caracteres"
    });
}

// Preparamos los datos para guardarlos en PostgreSQL.
const nombreLimpio = nombre.trim();
const apellidoLimpio = apellido?.trim() || null;
const descripcionLimpia = descripcion?.trim() || null;

// Registramos la trabajadora en PostgreSQL.
const resultado = await pool.query(`
    INSERT INTO trabajadora (
        id_emprendimiento,
        nombre,
        apellido,
        descripcion
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
        id_trabajadora,
        id_emprendimiento,
        nombre,
        apellido,
        descripcion,
        activa;
`, [
    idEmprendimiento,
    nombreLimpio,
    apellidoLimpio,
    descripcionLimpia
]);


// Confirmamos que la trabajadora fue registrada.
return res.status(201).json({
    mensaje: "Trabajadora registrada correctamente",
    trabajadora: resultado.rows[0]
});

    } catch (error) {
        console.error("Error al registrar trabajadora:", error.message);

        return res.status(500).json({
            mensaje: "No se pudo registrar la trabajadora"
        });
    }
});

// Ruta para modificar los datos de una trabajadora del Back Office.
// Solo las emprendedoras autenticadas pueden modificar trabajadoras.
app.patch("/api/trabajadoras/:id", verificarSesion, async (req, res) => {
    try {
        // Obtenemos el identificador de la trabajadora.
        const idTrabajadora = Number(req.params.id);

        // Comprobamos que sea un número entero positivo.
        if (
            !Number.isSafeInteger(idTrabajadora) ||
            idTrabajadora <= 0
        ) {
            return res.status(400).json({
                mensaje: "El identificador de la trabajadora no es válido"
            });
        }

        // Verificamos que la trabajadora pertenezca a un
// emprendimiento de la emprendedora autenticada.
const propiedad = await pool.query(`
    SELECT t.id_trabajadora
    FROM trabajadora t
    INNER JOIN emprendimiento e
        ON t.id_emprendimiento = e.id_emprendimiento
    WHERE t.id_trabajadora = $1
      AND e.id_emprendedora = $2;
`, [idTrabajadora, req.session.idEmprendedora]);

// Si no existe o no pertenece a su negocio, rechazamos la edición.
if (propiedad.rows.length === 0) {
    return res.status(404).json({
        mensaje: "La trabajadora no existe"
    });
}

// Recibimos los datos que la emprendedora desea modificar.
const {
    nombre,
    apellido,
    descripcion
} = req.body || {};

// Comprobamos que se haya enviado al menos un campo editable.
if (
    nombre === undefined &&
    apellido === undefined &&
    descripcion === undefined
) {
    return res.status(400).json({
        mensaje: "Debes indicar al menos un campo para modificar"
    });
}

// Validamos el nombre solamente si fue enviado.
if (nombre !== undefined) {
    if (
        typeof nombre !== "string" ||
        nombre.trim() === "" ||
        nombre.trim().length > 100
    ) {
        return res.status(400).json({
            mensaje: "El nombre debe tener entre 1 y 100 caracteres"
        });
    }
}

// Validamos el apellido si fue enviado.
// También permitimos null para quitar el apellido.
if (
    apellido !== undefined &&
    apellido !== null &&
    (
        typeof apellido !== "string" ||
        apellido.trim().length > 100
    )
) {
    return res.status(400).json({
        mensaje: "El apellido no debe superar 100 caracteres"
    });
}

// Validamos la descripción si fue enviada.
// También permitimos null para quitar la descripción.
if (
    descripcion !== undefined &&
    descripcion !== null &&
    (
        typeof descripcion !== "string" ||
        descripcion.length > 1000
    )
) {
    return res.status(400).json({
        mensaje: "La descripción no debe superar 1000 caracteres"
    });
}

// Actualizamos únicamente los campos enviados.
// Los demás conservarán sus valores actuales.
const resultado = await pool.query(`
    UPDATE trabajadora
    SET
        nombre = COALESCE($1::text, nombre),
        apellido = CASE
            WHEN $2::boolean THEN $3::text
            ELSE apellido
        END,
        descripcion = CASE
            WHEN $4::boolean THEN $5::text
            ELSE descripcion
        END
    WHERE id_trabajadora = $6
      AND id_emprendimiento IN (
          SELECT id_emprendimiento
          FROM emprendimiento
          WHERE id_emprendedora = $7
      )
    RETURNING
        id_trabajadora,
        id_emprendimiento,
        nombre,
        apellido,
        descripcion,
        activa;
`, [
    nombre !== undefined ? nombre.trim() : null,
    apellido !== undefined,
    apellido == null ? null : apellido.trim(),
    descripcion !== undefined,
    descripcion == null ? null : descripcion.trim(),
    idTrabajadora,
    req.session.idEmprendedora
]);

// Comprobamos que se haya actualizado la trabajadora.
if (resultado.rows.length === 0) {
    return res.status(404).json({
        mensaje: "La trabajadora no existe"
    });
}

// Devolvemos los datos actualizados al Back Office.
return res.json({
    mensaje: "Trabajadora actualizada correctamente",
    trabajadora: resultado.rows[0]
});

    } catch (error) {
        console.error("Error al modificar trabajadora:", error.message);

        return res.status(500).json({
            mensaje: "No se pudo modificar la trabajadora"
        });
    }
});

// Ruta para desactivar trabajadoras del Back Office.
// Solo las emprendedoras autenticadas pueden desactivar trabajadoras.
app.patch("/api/trabajadoras/:id/desactivar", verificarSesion, async (req, res) => {
    try {
        // Obtenemos y validamos el identificador.
        const idTrabajadora = Number(req.params.id);

        if (!Number.isSafeInteger(idTrabajadora) || idTrabajadora <= 0) {
            return res.status(400).json({
                mensaje: "El identificador de la trabajadora no es válido"
            });
        }

        // Desactivamos únicamente trabajadoras activas
        // pertenecientes a los emprendimientos de la sesión.
        const resultado = await pool.query(`
            UPDATE trabajadora
            SET activa = FALSE
            WHERE id_trabajadora = $1
              AND activa = TRUE
              AND id_emprendimiento IN (
                  SELECT id_emprendimiento
                  FROM emprendimiento
                  WHERE id_emprendedora = $2
              )
            RETURNING
                id_trabajadora,
                id_emprendimiento,
                nombre,
                apellido,
                activa;
        `, [idTrabajadora, req.session.idEmprendedora]);

        // Si no hubo actualización, comprobamos si la trabajadora
        // existe dentro de los emprendimientos de esta cuenta.
        if (resultado.rows.length === 0) {
            const existente = await pool.query(`
                SELECT t.id_trabajadora
                FROM trabajadora t
                INNER JOIN emprendimiento e
                    ON t.id_emprendimiento = e.id_emprendimiento
                WHERE t.id_trabajadora = $1
                  AND e.id_emprendedora = $2;
            `, [idTrabajadora, req.session.idEmprendedora]);

            if (existente.rows.length === 0) {
                return res.status(404).json({
                    mensaje: "La trabajadora no existe"
                });
            }

            return res.status(409).json({
                mensaje: "La trabajadora ya está desactivada"
            });
        }

        return res.json({
            mensaje: "Trabajadora desactivada correctamente",
            trabajadora: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al desactivar trabajadora:", error.message);

        return res.status(500).json({
            mensaje: "No se pudo desactivar la trabajadora"
        });
    }
});


// Ruta para registrar nuevos servicios en Meraki.
// Solo las emprendedoras autenticadas pueden crear servicios.
app.post("/api/servicios", verificarSesion, async (req, res) => {
    try {

        // Recibimos los datos del servicio.
        const {
            id_emprendimiento,
            id_categoria,
            nombre,
            descripcion,
            precio,
            duracion_min,
            monto_abono
        } = req.body || {};

        // Convertimos el identificador del emprendimiento a número.
const idEmprendimiento = Number(id_emprendimiento);

// Comprobamos que sea un número entero positivo.
if (
    !Number.isSafeInteger(idEmprendimiento) ||
    idEmprendimiento <= 0
) {
    return res.status(400).json({
        mensaje: "Debes indicar un emprendimiento válido"
    });
}

// Comprobamos que el emprendimiento pertenezca
// a la emprendedora que inició sesión.
const propiedad = await pool.query(`
    SELECT id_emprendimiento
    FROM emprendimiento
    WHERE id_emprendimiento = $1
      AND id_emprendedora = $2;
`, [idEmprendimiento, req.session.idEmprendedora]);

// Rechazamos la operación si el emprendimiento no es suyo.
if (propiedad.rows.length === 0) {
    return res.status(403).json({
        mensaje: "No tienes permiso para crear servicios en este emprendimiento"
    });
}
// Convertimos el identificador de la categoría a número.
const idCategoria = Number(id_categoria);

// Comprobamos que sea un entero positivo.
if (!Number.isSafeInteger(idCategoria) || idCategoria <= 0) {
    return res.status(400).json({
        mensaje: "Debes indicar una categoría válida"
    });
}

// Comprobamos que la categoría exista en PostgreSQL.
const categoria = await pool.query(`
    SELECT id_categoria
    FROM categoria
    WHERE id_categoria = $1;
`, [idCategoria]);

if (categoria.rows.length === 0) {
    return res.status(400).json({
        mensaje: "La categoría indicada no existe"
    });
}

// Validamos el nombre del servicio.
if (
    typeof nombre !== "string" ||
    nombre.trim() === "" ||
    nombre.trim().length > 150
) {
    return res.status(400).json({
        mensaje: "El nombre del servicio debe tener entre 1 y 150 caracteres"
    });
}

// Preparamos el nombre sin espacios innecesarios.
const nombreLimpio = nombre.trim();
// Validamos que el precio sea un número mayor que cero.
if (
    typeof precio !== "number" ||
    !Number.isFinite(precio) ||
    precio <= 0
) {
    return res.status(400).json({
        mensaje: "El precio debe ser un número mayor que cero"
    });
}

// Validamos que la duración sea un entero positivo.
if (
    !Number.isSafeInteger(duracion_min) ||
    duracion_min <= 0
) {
    return res.status(400).json({
        mensaje: "La duración debe ser un número entero positivo"
    });
}

// Validamos que el abono no sea negativo ni supere el precio.
if (
    typeof monto_abono !== "number" ||
    !Number.isFinite(monto_abono) ||
    monto_abono < 0 ||
    monto_abono > precio
) {
    return res.status(400).json({
        mensaje: "El abono debe estar entre cero y el precio del servicio"
    });
}

// Validamos la descripción opcional.
if (
    descripcion != null &&
    (typeof descripcion !== "string" || descripcion.length > 1000)
) {
    return res.status(400).json({
        mensaje: "La descripción no debe superar los 1000 caracteres"
    });
}

// Preparamos la descripción para guardarla.
const descripcionLimpia = descripcion?.trim() || null;
// Registramos el nuevo servicio en PostgreSQL.
const resultado = await pool.query(`
    INSERT INTO servicio (
        id_emprendimiento,
        id_categoria,
        nombre,
        descripcion,
        precio,
        duracion_min,
        monto_abono
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
        id_servicio,
        id_emprendimiento,
        id_categoria,
        nombre,
        descripcion,
        precio,
        duracion_min,
        monto_abono,
        activo;
`, [
    idEmprendimiento,
    idCategoria,
    nombreLimpio,
    descripcionLimpia,
    precio,
    duracion_min,
    monto_abono
]);

// Confirmamos que el servicio fue registrado.
return res.status(201).json({
    mensaje: "Servicio registrado correctamente",
    servicio: resultado.rows[0]
});




    } catch (error) {
        console.error("Error al crear servicio:", error.message);

        return res.status(500).json({
            mensaje: "No se pudo registrar el servicio"
        });
    }
});


// Ruta para modificar servicios del Back Office.
// Solo las emprendedoras autenticadas pueden editar servicios.
app.patch("/api/servicios/:id", verificarSesion, async (req, res) => {
    try {

        // Obtenemos el identificador del servicio.
        const idServicio = Number(req.params.id);

        // Comprobamos que el identificador sea válido.
        if (!Number.isSafeInteger(idServicio) || idServicio <= 0) {
            return res.status(400).json({
                mensaje: "El identificador del servicio no es válido"
            });
        }

       // Comprobamos que el servicio pertenezca a un emprendimiento
// de la emprendedora que inició sesión.
const propiedad = await pool.query(`
    SELECT s.id_servicio
    FROM servicio s
    INNER JOIN emprendimiento e
        ON s.id_emprendimiento = e.id_emprendimiento
    WHERE s.id_servicio = $1
      AND e.id_emprendedora = $2;
`, [idServicio, req.session.idEmprendedora]);

// Si el servicio no existe o no pertenece a la emprendedora,
// no permitimos modificarlo.
if (propiedad.rows.length === 0) {
    return res.status(404).json({
        mensaje: "El servicio no existe"
    });
}

// Recibimos los campos que la emprendedora desea modificar.
const {
    nombre,
    descripcion,
    precio,
    duracion_min,
    monto_abono
} = req.body || {};

// Comprobamos que se haya enviado al menos un campo permitido.
if (
    nombre === undefined &&
    descripcion === undefined &&
    precio === undefined &&
    duracion_min === undefined &&
    monto_abono === undefined
) {
    return res.status(400).json({
        mensaje: "Debes indicar al menos un campo para modificar"
    });
}

// Validamos el nombre solamente si fue enviado.
if (nombre !== undefined) {
    if (
        typeof nombre !== "string" ||
        nombre.trim() === "" ||
        nombre.trim().length > 150
    ) {
        return res.status(400).json({
            mensaje: "El nombre del servicio debe tener entre 1 y 150 caracteres"
        });
    }
}

// Validamos la descripción solamente si fue enviada.
if (descripcion !== undefined) {
    if (
        descripcion !== null &&
        (
            typeof descripcion !== "string" ||
            descripcion.length > 1000
        )
    ) {
        return res.status(400).json({
            mensaje: "La descripción no debe superar los 1000 caracteres"
        });
    }
}

// Validamos el precio si fue enviado.
if (precio !== undefined) {
    if (
        typeof precio !== "number" ||
        !Number.isFinite(precio) ||
        precio <= 0
    ) {
        return res.status(400).json({
            mensaje: "El precio debe ser un número mayor que cero"
        });
    }
}

// Validamos la duración si fue enviada.
if (duracion_min !== undefined) {
    if (
        !Number.isSafeInteger(duracion_min) ||
        duracion_min <= 0
    ) {
        return res.status(400).json({
            mensaje: "La duración debe ser un número entero positivo"
        });
    }
}

// Validamos el abono si fue enviado.
if (monto_abono !== undefined) {
    if (
        typeof monto_abono !== "number" ||
        !Number.isFinite(monto_abono) ||
        monto_abono < 0
    ) {
        return res.status(400).json({
            mensaje: "El abono debe ser un número mayor o igual a cero"
        });
    }
}

// Consultamos los valores actuales del servicio.
// Los necesitamos porque PATCH permite modificar solo algunos campos.
const servicioActual = await pool.query(`
    SELECT precio, monto_abono
    FROM servicio
    WHERE id_servicio = $1;
`, [idServicio]);

// Obtenemos los valores actuales desde PostgreSQL.
const precioActual = Number(servicioActual.rows[0].precio);
const abonoActual = Number(servicioActual.rows[0].monto_abono);

// Si enviaron un precio o abono nuevo, lo utilizamos.
// Si no, conservamos el valor que ya estaba registrado.
const precioFinal = precio !== undefined ? precio : precioActual;
const abonoFinal = monto_abono !== undefined ? monto_abono : abonoActual;

// Comprobamos que el abono no supere el precio final.
if (abonoFinal > precioFinal) {
    return res.status(400).json({
        mensaje: "El abono no puede superar el precio del servicio"
    });
}

// Actualizamos únicamente los campos enviados.
// Los demás conservan sus valores actuales.
const resultado = await pool.query(`
    UPDATE servicio
    SET
        nombre = COALESCE($1, nombre),
        descripcion = CASE
            WHEN $2::boolean THEN $3::text
            ELSE descripcion
        END,
        precio = COALESCE($4, precio),
        duracion_min = COALESCE($5, duracion_min),
        monto_abono = COALESCE($6, monto_abono)
    WHERE id_servicio = $7
      AND id_emprendimiento IN (
          SELECT id_emprendimiento
          FROM emprendimiento
          WHERE id_emprendedora = $8
      )
    RETURNING
        id_servicio,
        id_emprendimiento,
        id_categoria,
        nombre,
        descripcion,
        precio,
        duracion_min,
        monto_abono,
        activo;
`, [
    nombre !== undefined ? nombre.trim() : null,
    descripcion !== undefined,
    descripcion == null ? null : descripcion.trim(),
    precio !== undefined ? precio : null,
    duracion_min !== undefined ? duracion_min : null,
    monto_abono !== undefined ? monto_abono : null,
    idServicio,
    req.session.idEmprendedora
]);

// Comprobamos que el servicio haya sido actualizado.
if (resultado.rows.length === 0) {
    return res.status(404).json({
        mensaje: "El servicio no existe"
    });
}

// Respondemos con los datos actualizados.
return res.json({
    mensaje: "Servicio actualizado correctamente",
    servicio: resultado.rows[0]
});

    } catch (error) {
        console.error("Error al modificar servicio:", error.message);

        return res.status(500).json({
            mensaje: "No se pudo modificar el servicio"
        });
    }
});



 // Ruta para desactivar servicios del Back Office.
 // Solo las emprendedoras autenticadas pueden desactivar sus servicios.
 app.patch("/api/servicios/:id/desactivar", verificarSesion, async (req, res) => {
     try {
         // Obtenemos el identificador del servicio.
         const idServicio = Number(req.params.id);

         // Comprobamos que sea un identificador válido.
         if (!Number.isSafeInteger(idServicio) || idServicio <= 0) {
             return res.status(400).json({
                 mensaje: "El identificador del servicio no es válido"
             });
         }

         // Desactivamos únicamente un servicio activo
         // perteneciente a la emprendedora autenticada.
         const resultado = await pool.query(`
             UPDATE servicio
             SET activo = FALSE
             WHERE id_servicio = $1
               AND activo = TRUE
               AND id_emprendimiento IN (
                   SELECT id_emprendimiento
                   FROM emprendimiento
                   WHERE id_emprendedora = $2
               )
             RETURNING id_servicio, nombre, activo;
         `, [idServicio, req.session.idEmprendedora]);

         // Si no se actualizó, comprobamos si pertenece a la emprendedora.
         if (resultado.rows.length === 0) {
             const existente = await pool.query(`
                 SELECT s.id_servicio
                 FROM servicio s
                 INNER JOIN emprendimiento e
                     ON s.id_emprendimiento = e.id_emprendimiento
                 WHERE s.id_servicio = $1
                   AND e.id_emprendedora = $2;
             `, [idServicio, req.session.idEmprendedora]);

             if (existente.rows.length === 0) {
                 return res.status(404).json({
                     mensaje: "El servicio no existe"
                 });
             }

             return res.status(409).json({
                 mensaje: "El servicio ya está desactivado"
             });
         }

         return res.json({
             mensaje: "Servicio desactivado correctamente",
             servicio: resultado.rows[0]
         });

     } catch (error) {
         console.error("Error al desactivar servicio:", error.message);

         return res.status(500).json({
             mensaje: "No se pudo desactivar el servicio"
         });
     }
 });




// Ruta para consultar los horarios de atención.
app.get("/api/disponibilidad", async (req, res) => {
    try {
         // Obtenemos la fecha enviada por el navegador.
        const fecha = req.query.fecha;
        // Obtenemos los identificadores enviados desde el navegador.
const idTrabajadora = Number(req.query.id_trabajadora);
const idServicio = Number(req.query.id_servicio);

// Comprobamos que sean números enteros positivos.
if (
    !Number.isSafeInteger(idTrabajadora) ||
    idTrabajadora <= 0 ||
    !Number.isSafeInteger(idServicio) ||
    idServicio <= 0
) {
    return res.status(400).json({
        mensaje: "Debes indicar una trabajadora y un servicio válidos"
    });
}

        // Mostramos la fecha recibida para comprobarla.
        console.log("Fecha solicitada:", fecha);

         // Comprobamos que la fecha tenga el formato AAAA-MM-DD.
        if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return res.status(400).json({
                mensaje: "Debes indicar una fecha con formato AAAA-MM-DD"
            });
        }

        // Convertimos la fecha recibida en un objeto Date.
        const fechaConvertida = new Date(fecha + "T00:00:00Z");

        // Comprobamos que la fecha exista realmente.
        if (
            Number.isNaN(fechaConvertida.getTime()) ||
            fechaConvertida.toISOString().slice(0, 10) !== fecha
        ) {
            return res.status(400).json({
                mensaje: "La fecha indicada no existe"
            });
        }
        // Obtenemos el número del día de la semana.
        // JavaScript utiliza: 0 = domingo, 1 = lunes, ..., 6 = sábado.
    const numeroDia = fechaConvertida.getUTCDay();

    // Relacionamos cada número con el nombre del día.
    const diasSemana = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado"
];

// Obtenemos el nombre del día correspondiente a la fecha.
    const diaSemana = diasSemana[numeroDia];

// Mostramos el día para comprobar el resultado.
    console.log("Día solicitado:", diaSemana);
        
        
// Consultamos los horarios disponibles según la trabajadora,
// el servicio y la fecha seleccionados.
const resultado = await pool.query(`
    SELECT
        t.id_trabajadora,
        t.nombre AS trabajadora,
        s.id_servicio,
        s.nombre AS servicio,
        horas.hora::TIME AS hora_inicio
    FROM trabajadora t

    INNER JOIN horario_atencion h
        ON t.id_trabajadora = h.id_trabajadora

    INNER JOIN trabajadora_servicio ts
        ON t.id_trabajadora = ts.id_trabajadora

    INNER JOIN servicio s
        ON ts.id_servicio = s.id_servicio

    -- Generamos los horarios según la duración del servicio.
    CROSS JOIN LATERAL generate_series(
        $1::DATE + h.hora_inicio,
        $1::DATE + h.hora_fin
            - s.duracion_min * INTERVAL '1 minute',
        s.duracion_min * INTERVAL '1 minute'
    ) AS horas(hora)

    WHERE t.id_trabajadora = $3
      AND s.id_servicio = $4
      AND h.dia_semana = $2
      AND h.activo = TRUE
      AND t.activa = TRUE
      AND s.activo = TRUE

    -- Excluimos los horarios bloqueados.
    AND NOT EXISTS (
        SELECT 1
        FROM bloqueo_horario b
        WHERE b.id_trabajadora = t.id_trabajadora
          AND horas.hora < b.fecha_fin
          AND horas.hora + s.duracion_min * INTERVAL '1 minute'
              > b.fecha_inicio
    )

    -- Excluimos los horarios que ya tienen reservas.
    AND NOT EXISTS (
        SELECT 1
        FROM reserva r
        WHERE r.id_trabajadora = t.id_trabajadora
          AND r.estado IN ('pendiente_abono', 'confirmada')
          AND horas.hora < r.fecha_hora_fin
          AND horas.hora + s.duracion_min * INTERVAL '1 minute'
              > r.fecha_hora_inicio
    )

    ORDER BY horas.hora;
`, [fecha, diaSemana, idTrabajadora, idServicio]);
// Enviamos los resultados al navegador.
        res.json(resultado.rows);

    } catch (error) {
        // Mostramos el error en la terminal.
        console.error("Error al consultar horarios:", error.message);

        // Respondemos si ocurre un error.
        res.status(500).json({
            mensaje: "Error al consultar la disponibilidad"
        });
    }
});
// Ruta para registrar nuevas reservas en Meraki.
app.post("/api/reservas", async (req, res) => {

    // Recibimos los datos enviados por la clienta.
    const {
        id_clienta,
        id_trabajadora,
        id_servicio,
        fecha,
        hora
    } = req.body || {};

    // Convertimos los identificadores a números.
    const idClienta = Number(id_clienta);
    const idTrabajadora = Number(id_trabajadora);
    const idServicio = Number(id_servicio);

    // Validamos que los identificadores sean enteros positivos.
    if (
        ![idClienta, idTrabajadora, idServicio].every(
            id => Number.isSafeInteger(id) && id > 0
        )
    ) {
        return res.status(400).json({
            mensaje: "Los identificadores deben ser números positivos"
        });
    }

    // Validamos el formato de la fecha.
    if (
        typeof fecha !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ) {
        return res.status(400).json({
            mensaje: "La fecha debe tener formato AAAA-MM-DD"
        });
    }

    // Comprobamos que la fecha exista realmente.
    const fechaConvertida = new Date(fecha + "T00:00:00Z");

    if (
        Number.isNaN(fechaConvertida.getTime()) ||
        fechaConvertida.toISOString().slice(0, 10) !== fecha
    ) {
        return res.status(400).json({
            mensaje: "La fecha indicada no existe"
        });
    }

    // Validamos la hora en formato HH:MM.
    if (
        typeof hora !== "string" ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)
    ) {
        return res.status(400).json({
            mensaje: "La hora debe tener formato HH:MM"
        });
    }

    // Identificamos el día de la semana.
    const diasSemana = [
        "domingo", "lunes", "martes", "miercoles",
        "jueves", "viernes", "sabado"
    ];

    const diaSemana = diasSemana[fechaConvertida.getUTCDay()];

    // Solicitamos una conexión exclusiva para esta transacción.
    let clienteDB;

    try {
        clienteDB = await pool.connect();

        // Comenzamos la transacción.
        await clienteDB.query("BEGIN");

        // Bloqueamos temporalmente las reservas de esta trabajadora.
        // Así, dos solicitudes de esta ruta no podrán reservar
        // simultáneamente un mismo horario.
        await clienteDB.query(
            "SELECT pg_advisory_xact_lock(117, $1)",
            [idTrabajadora]
        );

        // Comprobamos que la clienta exista.
        const clienta = await clienteDB.query(
            "SELECT id_clienta FROM clienta WHERE id_clienta = $1",
            [idClienta]
        );

        if (clienta.rows.length === 0) {
            await clienteDB.query("ROLLBACK");

            return res.status(404).json({
                mensaje: "La clienta no existe"
            });
        }

        // Impedimos reservar fechas u horas que ya pasaron.
        // Utilizamos la zona horaria de Chile.
        const fechaFutura = await clienteDB.query(`
            SELECT (
                $1::DATE + $2::TIME
                > CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago'
            ) AS es_futura
        `, [fecha, hora]);

        if (!fechaFutura.rows[0].es_futura) {
            await clienteDB.query("ROLLBACK");

            return res.status(400).json({
                mensaje: "No puedes reservar una fecha u hora pasada"
            });
        }

        // Comprobamos que la hora solicitada esté disponible.
        // También obtenemos los datos del servicio desde PostgreSQL.
        const disponibilidad = await clienteDB.query(`
            SELECT
                s.id_emprendimiento,
                s.id_servicio,
                s.precio,
                s.monto_abono,
                horas.hora AS fecha_hora_inicio,
                horas.hora
                    + s.duracion_min * INTERVAL '1 minute'
                    AS fecha_hora_fin

            FROM trabajadora t

            INNER JOIN horario_atencion h
                ON t.id_trabajadora = h.id_trabajadora

            INNER JOIN trabajadora_servicio ts
                ON t.id_trabajadora = ts.id_trabajadora

            INNER JOIN servicio s
                ON ts.id_servicio = s.id_servicio

            INNER JOIN emprendimiento e
                ON s.id_emprendimiento = e.id_emprendimiento

            CROSS JOIN LATERAL generate_series(
                $1::DATE + h.hora_inicio,
                $1::DATE + h.hora_fin
                    - s.duracion_min * INTERVAL '1 minute',
                s.duracion_min * INTERVAL '1 minute'
            ) AS horas(hora)

            WHERE t.id_trabajadora = $3
              AND s.id_servicio = $4
              AND h.dia_semana = $2
              AND horas.hora = $1::DATE + $5::TIME
              AND t.id_emprendimiento = e.id_emprendimiento
              AND t.activa = TRUE
              AND h.activo = TRUE
              AND s.activo = TRUE
              AND e.estado = TRUE

              -- Rechazamos horas bloqueadas.
              AND NOT EXISTS (
                  SELECT 1
                  FROM bloqueo_horario b
                  WHERE b.id_trabajadora = t.id_trabajadora
                    AND horas.hora < b.fecha_fin
                    AND horas.hora
                        + s.duracion_min * INTERVAL '1 minute'
                        > b.fecha_inicio
              )

              -- Rechazamos horas ocupadas por otras reservas.
              AND NOT EXISTS (
                  SELECT 1
                  FROM reserva r
                  WHERE r.id_trabajadora = t.id_trabajadora
                    AND r.estado IN (
                        'pendiente_abono',
                        'confirmada'
                    )
                    AND horas.hora < r.fecha_hora_fin
                    AND horas.hora
                        + s.duracion_min * INTERVAL '1 minute'
                        > r.fecha_hora_inicio
              )

            LIMIT 1;
        `, [
            fecha,
            diaSemana,
            idTrabajadora,
            idServicio,
            hora
        ]);

        // Si no encontramos el horario, no creamos la reserva.
        if (disponibilidad.rows.length === 0) {
            await clienteDB.query("ROLLBACK");

            return res.status(409).json({
                mensaje: "El horario no está disponible"
            });
        }

        // Obtenemos la información verificada del servicio.
        const datos = disponibilidad.rows[0];

        // Registramos la reserva como pendiente de abono.
        const nuevaReserva = await clienteDB.query(`
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
            VALUES (
                $1, $2, $3, $4, $5, $6,
                'pendiente_abono', $7, $8
            )
            RETURNING
                id_reserva,
                id_servicio,
                id_trabajadora,
                id_clienta,
                fecha_hora_inicio,
                fecha_hora_fin,
                estado,
                precio_servicio,
                monto_abono;
        `, [
            datos.id_emprendimiento,
            idServicio,
            idTrabajadora,
            idClienta,
            datos.fecha_hora_inicio,
            datos.fecha_hora_fin,
            datos.precio,
            datos.monto_abono
        ]);

        // Confirmamos los cambios en PostgreSQL.
        await clienteDB.query("COMMIT");

        // Informamos que la reserva fue registrada.
        return res.status(201).json({
            mensaje: "Reserva registrada correctamente",
            reserva: nuevaReserva.rows[0]
        });

    } catch (error) {

        // Revertimos los cambios si ocurre un error.
        if (clienteDB) {
            try {
                await clienteDB.query("ROLLBACK");
            } catch (errorRollback) {
                console.error(
                    "Error al revertir reserva:",
                    errorRollback.message
                );
            }
        }

        console.error("Error al crear reserva:", error.message);

        return res.status(500).json({
            mensaje: "No se pudo registrar la reserva"
        });

    } finally {

        // Liberamos la conexión para que pueda reutilizarse.
        if (clienteDB) {
            clienteDB.release();
        }
    }
});
// Ruta para consultar las reservas de un emprendimiento.
// Por ahora es una ruta de desarrollo; más adelante
// estará protegida mediante autenticación y permisos.

// Solo las emprendedoras autenticadas pueden consultar reservas.
app.get("/api/reservas", verificarSesion, async (req, res) => {
    try {
        // Recibimos el identificador del emprendimiento.
        const idEmprendimiento = Number(req.query.id_emprendimiento);

        // Validamos que sea un identificador correcto.
        if (
            !Number.isSafeInteger(idEmprendimiento) ||
            idEmprendimiento <= 0
        ) {
            return res.status(400).json({
                mensaje: "Debes indicar un emprendimiento válido"
            });
        }
// Verificamos que el emprendimiento pertenezca a la emprendedora conectada.
const propiedad = await pool.query(`
    SELECT id_emprendimiento
    FROM emprendimiento
    WHERE id_emprendimiento = $1
      AND id_emprendedora = $2;
`, [idEmprendimiento, req.session.idEmprendedora]);

// Si no pertenece a su cuenta, rechazamos la consulta.
if (propiedad.rows.length === 0) {
    return res.status(403).json({
        mensaje: "No tienes permiso para consultar este emprendimiento"
    });
}
        // Consultamos las reservas y sus datos relacionados.
        const resultado = await pool.query(`
            SELECT
                r.id_reserva,
                c.nombre AS clienta,
                t.nombre AS trabajadora,
                s.nombre AS servicio,
               TO_CHAR(r.fecha_hora_inicio, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_hora_inicio,
               TO_CHAR(r.fecha_hora_fin, 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_hora_fin,
                r.estado,
                r.precio_servicio,
                r.monto_abono
            FROM reserva r
            INNER JOIN clienta c
                ON r.id_clienta = c.id_clienta
            INNER JOIN trabajadora t
                ON r.id_trabajadora = t.id_trabajadora
           INNER JOIN servicio s
                ON r.id_servicio = s.id_servicio

           -- Relacionamos la reserva con su emprendimiento.
           INNER JOIN emprendimiento e
                ON r.id_emprendimiento = e.id_emprendimiento

           -- Verificamos el emprendimiento y su propietaria.
           WHERE r.id_emprendimiento = $1
            AND e.id_emprendedora = $2

           ORDER BY r.fecha_hora_inicio;
        `, [idEmprendimiento, req.session.idEmprendedora]);

        // Enviamos las reservas al navegador.
        res.json(resultado.rows);

    } catch (error) {
        console.error("Error al consultar reservas:", error.message);

        res.status(500).json({
            mensaje: "Error al obtener las reservas"
        });
    }
});
// Ruta para cancelar una reserva.
// Es provisional para desarrollo local: requiere autenticación
// y autorización antes de publicar el sistema.
// Solo las emprendedoras autenticadas pueden solicitar cancelaciones.
app.patch("/api/reservas/:id/cancelar", verificarSesion, async (req, res) => {
    try {
        // Obtenemos el identificador de la reserva.
        const idReserva = Number(req.params.id);

        // Validamos que sea un número entero positivo.
        if (!Number.isSafeInteger(idReserva) || idReserva <= 0) {
            return res.status(400).json({
                mensaje: "El identificador de la reserva no es válido"
            });
        }

        // Cancelamos únicamente reservas pendientes o confirmadas.
        // RETURNING nos devuelve la reserva modificada.
        const resultado = await pool.query(`
           UPDATE reserva
           SET estado = 'cancelada'
           WHERE id_reserva = $1
            AND estado IN ('pendiente_abono', 'confirmada')

        -- Solo permitimos cancelar reservas de emprendimientos propios.
           AND id_emprendimiento IN (
          SELECT id_emprendimiento
          FROM emprendimiento
          WHERE id_emprendedora = $2
  )
            RETURNING
                id_reserva,
                id_clienta,
                id_trabajadora,
                id_servicio,
                estado,
                TO_CHAR(
                    fecha_hora_inicio,
                    'YYYY-MM-DD"T"HH24:MI:SS'
                ) AS fecha_hora_inicio;
      `, [idReserva, req.session.idEmprendedora]);

        // Si no se modificó ninguna fila, comprobamos si existe.
        if (resultado.rows.length === 0) {
            // Comprobamos si la reserva existe dentro de un emprendimiento propio.
    const existente = await pool.query(`
       SELECT r.estado
       FROM reserva r
       INNER JOIN emprendimiento e
        ON r.id_emprendimiento = e.id_emprendimiento
       WHERE r.id_reserva = $1
        AND e.id_emprendedora = $2
`, [idReserva, req.session.idEmprendedora]);

            if (existente.rows.length === 0) {
                return res.status(404).json({
                    mensaje: "La reserva no existe"
                });
            }

            return res.status(409).json({
                mensaje: "La reserva no puede cancelarse en su estado actual"
            });
        }

        // Respondemos con la reserva actualizada.
        return res.json({
            mensaje: "Reserva cancelada correctamente",
            reserva: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al cancelar reserva:", error.message);

        return res.status(500).json({
            mensaje: "No se pudo cancelar la reserva"
        });
    }
});
// Ruta para registrar nuevas emprendedoras en Meraki.
app.post("/api/auth/registro", async (req, res) => {
    try {
        // Recibimos los datos enviados desde el formulario.
        const {
            nombre,
            apellido,
            rut,
            correo,
            password,
            telefono
        } = req.body || {};

        // Comprobamos que los datos obligatorios sean textos válidos.
        if (
            [nombre, apellido, rut, correo, password].some(
                dato => typeof dato !== "string" || dato.trim() === ""
            )
        ) {
            return res.status(400).json({
                mensaje: "Debes completar todos los campos obligatorios"
            });
        }

        // Comprobamos que los campos no superen límites razonables.
        if (
            nombre.length > 100 ||
            apellido.length > 100 ||
            rut.length > 20 ||
            correo.length > 150 ||
            (telefono != null &&
                (typeof telefono !== "string" || telefono.length > 20))
        ) {
            return res.status(400).json({
                mensaje: "Uno o más campos superan el tamaño permitido"
            });
        }

        // Normalizamos los datos para evitar diferencias innecesarias.
        const nombreLimpio = nombre.trim();
        const apellidoLimpio = apellido.trim();
        const rutLimpio = rut.trim().toUpperCase();
        const correoLimpio = correo.trim().toLowerCase();
        const telefonoLimpio = telefono?.trim() || null;

        // Validamos un formato básico de correo electrónico.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
            return res.status(400).json({
                mensaje: "El correo electrónico no tiene un formato válido"
            });
        }

        // Exigimos una contraseña de al menos 12 caracteres.
        // bcrypt trabaja con un máximo de 72 bytes de contraseña.
        if (
            password.length < 12 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                mensaje: "La contraseña debe tener al menos 12 caracteres y no superar 72 bytes"
            });
        }

        // Validación básica del formato del RUT.
        // Más adelante agregaremos la comprobación del dígito verificador.
        if (!/^[0-9.\-K]+$/.test(rutLimpio)) {
            return res.status(400).json({
                mensaje: "El RUT contiene caracteres no permitidos"
            });
        }

        // Generamos el hash. Nunca guardamos la contraseña original.
        const passwordHash = await bcrypt.hash(password, 12);

        // Registramos la emprendedora en PostgreSQL.
        const resultado = await pool.query(`
            INSERT INTO emprendedora (
                nombre,
                apellido,
                rut,
                correo,
                password_hash,
                telefono
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
                id_emprendedora,
                nombre,
                apellido,
                rut,
                correo,
                telefono;
        `, [
            nombreLimpio,
            apellidoLimpio,
            rutLimpio,
            correoLimpio,
            passwordHash,
            telefonoLimpio
        ]);

        // Respondemos sin mostrar la contraseña ni su hash.
        return res.status(201).json({
            mensaje: "Emprendedora registrada correctamente",
            emprendedora: resultado.rows[0]
        });

    } catch (error) {

        // PostgreSQL utiliza 23505 para valores UNIQUE duplicados.
        if (error.code === "23505") {
            return res.status(409).json({
                mensaje: "El correo o RUT ya está registrado"
            });
        }

        console.error("Error al registrar emprendedora:", error.message);

        return res.status(500).json({
            mensaje: "No se pudo registrar la emprendedora"
        });
    }
});
// Ruta para comprobar las credenciales de una emprendedora.
app.post("/api/auth/login", async (req, res) => {
    // Mensaje temporal para comprobar que esta ruta recibe solicitudes.
console.log("MERAKI: solicitud de login recibida");
    try {
        // Recibimos el correo y la contraseña.
        const { correo, password } = req.body || {};

        // Validamos los datos recibidos.
        if (
            typeof correo !== "string" ||
            typeof password !== "string" ||
            correo.trim() === "" ||
            password === ""
        ) {
            return res.status(400).json({
                mensaje: "Debes ingresar correo y contraseña"
            });
        }

        // Normalizamos el correo electrónico.
        const correoLimpio = correo.trim().toLowerCase();

        // Buscamos la cuenta y su contraseña protegida.
        const resultado = await pool.query(`
            SELECT
                id_emprendedora,
                nombre,
                apellido,
                correo,
                password_hash,
                estado
            FROM emprendedora
            WHERE correo = $1;
        `, [correoLimpio]);

        // Si el correo no existe, rechazamos el acceso.
        if (resultado.rows.length === 0) {
            return res.status(401).json({
                mensaje: "Correo o contraseña incorrectos"
            });
        }

        const emprendedora = resultado.rows[0];

        // Comparamos la contraseña recibida con el hash.
        const passwordCorrecta = await bcrypt.compare(
            password,
            emprendedora.password_hash
        );

        if (!passwordCorrecta) {
            return res.status(401).json({
                mensaje: "Correo o contraseña incorrectos"
            });
        }

        // Comprobamos que la cuenta esté activa.
        if (emprendedora.estado !== "activa") {
            return res.status(403).json({
                mensaje: "La cuenta no está activa"
            });
        }

        // Creamos una nueva sesión después de verificar las credenciales.
await new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
        if (error) reject(error);
        else resolve();
    });
});

// Guardamos el identificador de la emprendedora conectada.
req.session.idEmprendedora = emprendedora.id_emprendedora;

// Guardamos la sesión en PostgreSQL.
await new Promise((resolve, reject) => {
    req.session.save((error) => {
        if (error) reject(error);
        else resolve();
    });
});
        // Respondemos sin incluir la contraseña ni su hash.
        return res.json({
            mensaje: "Credenciales verificadas correctamente",
            emprendedora: {
                id_emprendedora: emprendedora.id_emprendedora,
                nombre: emprendedora.nombre,
                apellido: emprendedora.apellido,
                correo: emprendedora.correo
            }
        });

    } catch (error) {
        console.error("Error al verificar credenciales:", error.message);

        return res.status(500).json({
            mensaje: "Error al verificar las credenciales"
        });
    }
});
// Ruta para consultar la emprendedora que inició sesión.
app.get("/api/auth/yo", async (req, res) => {
    try {
        // Comprobamos si existe una sesión autenticada.
        if (!req.session.idEmprendedora) {
            return res.status(401).json({
                mensaje: "Debes iniciar sesión"
            });
        }

        // Consultamos los datos actuales de la emprendedora.
        const resultado = await pool.query(`
            SELECT
                id_emprendedora,
                nombre,
                apellido,
                correo
            FROM emprendedora
            WHERE id_emprendedora = $1
              AND estado = 'activa';
        `, [req.session.idEmprendedora]);

        // Rechazamos el acceso si la cuenta ya no está activa.
        if (resultado.rows.length === 0) {
            return res.status(401).json({
                mensaje: "La sesión ya no corresponde a una cuenta activa"
            });
        }

        // Devolvemos los datos sin incluir contraseñas.
        return res.json({
            mensaje: "Sesión activa",
            emprendedora: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al consultar sesión:", error.message);

        return res.status(500).json({
            mensaje: "Error al consultar la sesión"
        });
    }
});
// Ruta para cerrar la sesión de una emprendedora.
app.post("/api/auth/logout", async (req, res) => {
    try {
        // Comprobamos que exista una sesión autenticada.
        if (!req.session.idEmprendedora) {
            return res.status(401).json({
                mensaje: "Debes iniciar sesión"
            });
        }

        // Eliminamos la sesión almacenada en PostgreSQL.
        await new Promise((resolve, reject) => {
            req.session.destroy((error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        // Eliminamos la cookie del navegador.
        res.clearCookie("meraki.sid", {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: false
        });

        // Confirmamos el cierre de sesión.
        return res.json({
            mensaje: "Sesión cerrada correctamente"
        });

    } catch (error) {
        console.error("Error al cerrar sesión:", error.message);

        return res.status(500).json({
            mensaje: "No se pudo cerrar la sesión"
        });
    }
});
// Iniciamos el servidor en el puerto 3000.
app.listen(3000, () => {
    console.log("Servidor de Meraki funcionando en http://localhost:3000");
});
console.log("Iniciando Backend de Meraki");

