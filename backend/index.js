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
// Iniciamos el servidor en el puerto 3000.
app.listen(3000, () => {
    console.log("Servidor de Meraki funcionando en http://localhost:3000");
});
console.log("Iniciando Backend de Meraki");