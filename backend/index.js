// Primer mensaje de prueba del Backend de Meraki
const express = require("express");
// Creamos la aplicación que utilizará Express.
const app = express();
// Ruta principal para comprobar el funcionamiento del Backend.
app.get("/", (req, res) => {
    res.send("Bienvenida al Backend de Meraki");
});


// Importamos la conexión con PostgreSQL.
const pool = require("./db");

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


// Ruta para consultar los horarios de atención.
app.get("/api/disponibilidad", async (req, res) => {
    try {
         // Obtenemos la fecha enviada por el navegador.
        const fecha = req.query.fecha;

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
        
        
// Generamos horas posibles según la jornada y duración del servicio.
    const resultado = await pool.query(`
    SELECT
        t.nombre AS trabajadora,
        s.nombre AS servicio,
        horas.hora::TIME AS hora_inicio
    FROM trabajadora t
    INNER JOIN horario_atencion h
        ON t.id_trabajadora = h.id_trabajadora
    INNER JOIN trabajadora_servicio ts
        ON t.id_trabajadora = ts.id_trabajadora
    INNER JOIN servicio s
        ON ts.id_servicio = s.id_servicio

    -- Generamos horarios según los datos guardados.
    CROSS JOIN LATERAL generate_series(
        $1::DATE + h.hora_inicio,
        $1::DATE + h.hora_fin
            - s.duracion_min * INTERVAL '1 minute',
        s.duracion_min * INTERVAL '1 minute'
    ) AS horas(hora)

       WHERE t.nombre = 'Camila'
      AND t.apellido = 'Ejemplo'
      AND h.dia_semana = $2
      AND h.activo = TRUE
      AND t.activa = TRUE
      AND s.nombre = 'Manicure permanente'
      AND s.activo = TRUE

    AND s.nombre = 'Manicure permanente'
    AND s.activo = TRUE

    -- Excluir horarios bloqueados.
    AND NOT EXISTS (
    SELECT 1
    FROM bloqueo_horario b
    WHERE b.id_trabajadora = t.id_trabajadora
      AND horas.hora < b.fecha_fin
      AND (
          horas.hora + s.duracion_min * INTERVAL '1 minute'
      ) > b.fecha_inicio
)

    -- Excluir horarios reservados.
    AND NOT EXISTS (
    SELECT 1
    FROM reserva r
    WHERE r.id_trabajadora = t.id_trabajadora
      AND r.estado IN ('pendiente_abono', 'confirmada')
      AND horas.hora < r.fecha_hora_fin
      AND (
          horas.hora + s.duracion_min * INTERVAL '1 minute'
      ) > r.fecha_hora_inicio
)

    ORDER BY horas.hora;
    `, [fecha, diaSemana]);
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

// Iniciamos el servidor en el puerto 3000.
app.listen(3000, () => {
    console.log("Servidor de Meraki funcionando en http://localhost:3000");
});
console.log("Iniciando Backend de Meraki");

