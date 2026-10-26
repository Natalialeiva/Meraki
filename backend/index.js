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
// Iniciamos el servidor en el puerto 3000.
app.listen(3000, () => {
    console.log("Servidor de Meraki funcionando en http://localhost:3000");
});
console.log("Iniciando Backend de Meraki");